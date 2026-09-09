import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { FI_CATALOGUE, listEnabledFi, getFiProduct, isRouteToOwnSelectable } from "../app/lib/fi/catalogue.ts";
import { matchFi, fiFitFor } from "../app/lib/fi/match.ts";
import {
  MAX_FI_SELECTIONS,
  fiFinancingScenarioFor,
  assertSelectionAllowed,
  handoffDecisionFor
} from "../app/lib/fi/selection-service.ts";
import { buildHandoffPackage } from "../app/lib/fi/handoff.ts";
import { estimateFinancing } from "../app/lib/financing/estimate.ts";

// สร้างจากตัวประมาณการจริง เพื่อไม่ให้ fixture ขัดกันเองระหว่างค่างวดกับภาระต่อวัน
const REFERENCE_ESTIMATE = estimateFinancing({
  vehiclePrice: 800000,
  loanAmount: 800000,
  annualRatePct: 4.5,
  termMonths: 60,
  workingDaysPerMonth: 26
});

/* ---------------- fixtures ---------------- */

function snapshot(overrides = {}) {
  return {
    id: "snap_fi_1",
    applicationId: "RTO-C26-000128",
    inputVersion: 1,
    basicEligibility: {
      taxiOccupationStatus: "ACTIVE_TAXI_DRIVER",
      publicDriverLicenseStatus: "TO_VERIFY",
      currentVehicleRelationship: "RENT",
      yearsProfessionalDriving: 6,
      serviceProvince: "กรุงเทพมหานคร",
      occupationalEvidenceStatus: "DECLARED",
      verified: false,
      statusCopy: "ข้อมูลอาชีพที่ผู้สมัครระบุ — รอยืนยันในขั้นตอนจริง",
      identityState: "Identity verification deferred — Competition Mode"
    },
    revenue: {
      declaredDailyRevenue: 2200,
      assessmentDailyRevenue: 2200,
      verifiedDailyRevenue: 2200,
      evidenceStatus: "TRANSACTION_EVIDENCED"
    },
    vehicleScenario: {
      vehicleId: "AION_ES",
      vehicleName: "AION ES",
      vehiclePrice: 800000,
      borrowerDownPayment: 0,
      sourceStatus: "COMPETITION_ILLUSTRATION"
    },
    financingScenario: {
      loanAmount: 800000,
      termMonths: 60,
      annualRatePct: 4.5,
      estimatedMonthlyInstallment: REFERENCE_ESTIMATE.estimatedMonthlyInstallment,
      dailyEquivalentBurden: REFERENCE_ESTIMATE.dailyEquivalentBurden,
      workingDaysPerMonth: 26,
      label: "ILLUSTRATIVE_FINANCING_ESTIMATE"
    },
    assessmentRevenue: 2200,
    eligibleOpEx: 414,
    protectedCash: 577,
    availableCash: 600,
    estimatedObligation: 470,
    residual: 130,
    affordabilityGap: 0,
    affordabilityPassed: true,
    principalSustainabilityPassed: true,
    incomeEvidenceReliability: "HIGH",
    activityEvidenceStatus: "CONSISTENT",
    preScore: 82,
    tier: "A",
    route: "READY FOR FI",
    reasonCodes: [],
    rbpTier: "A",
    rbpRate: 0.012,
    indicativeGuaranteeEligibleBase: 800000,
    engineStatus: "FINAL / FROZEN FOR COMPETITION",
    specVersion: "RTO-COMP-REG-1.0",
    evaluatedAt: "2026-09-09T00:00:00.000Z",
    ...overrides
  };
}

const zeroDownFi = () => FI_CATALOGUE.find((fi) => isRouteToOwnSelectable(fi));
const downPaymentFi = () => FI_CATALOGUE.find((fi) => !isRouteToOwnSelectable(fi));

/* ---------------- 1. catalogue is reference data, not product rule ---------------- */

test("candidate FI data never becomes a Route to Own product rule", () => {
  const source = fs.readFileSync(new URL("../app/lib/fi/catalogue.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /DSCR|preScore|readinessScore|appropriateRouteOf|RBP_RATE/);
  assert.doesNotMatch(source, /route2own-engine/);

  // อัตราของ FI เป็นข้อมูลอ้างอิง ไม่ใช่พารามิเตอร์ผลิตภัณฑ์ของ Route to Own
  for (const fi of FI_CATALOGUE) {
    assert.equal(typeof fi.indicativeRatePct, "number");
    assert.ok(fi.sourceStatus, `${fi.id} ต้องมี sourceStatus`);
    assert.ok(fi.sourceLabel, `${fi.id} ต้องมี sourceLabel`);
  }
});

test("no unverified source is ever presented as verified by the FI", () => {
  for (const fi of FI_CATALOGUE) {
    assert.ok(
      ["VERIFIED_BY_FI", "PUBLIC_SOURCE_REFERENCE", "COMPETITION_ILLUSTRATION"].includes(fi.sourceStatus)
    );

    // ข้อมูลจากสื่อ โซเชียล หรือการสังเคราะห์ด้วย AI ห้ามถูกยกระดับเป็น VERIFIED_BY_FI
    if (/facebook|line today|autospinn|dailynews|ai |สังเคราะห์|โซเชียล|สื่อ/i.test(fi.sourceLabel)) {
      assert.notEqual(fi.sourceStatus, "VERIFIED_BY_FI", `${fi.id} มาจากสื่อ/โซเชียล ห้าม VERIFIED_BY_FI`);
    }
  }

  // รอบแข่งขันยังไม่มี FI รายใดยืนยันกลับมา
  assert.equal(
    FI_CATALOGUE.filter((fi) => fi.sourceStatus === "VERIFIED_BY_FI").length,
    0,
    "ยังไม่มี FI รายใดยืนยันข้อมูลอย่างเป็นทางการในรอบนี้"
  );
});

/* ---------------- 2. zero-down compatibility ---------------- */

test("an FI whose public product needs a down payment is not a Route to Own handoff option", () => {
  const needsDown = downPaymentFi();
  assert.ok(needsDown, "แคตตาล็อกต้องมี FI ที่ผลิตภัณฑ์สาธารณะต้องมีเงินดาวน์");
  assert.equal(needsDown.routeToOwnCompatibilityStatus, "NOT_CONFIRMED");

  const options = matchFi(snapshot());
  const option = options.find((o) => o.id === needsDown.id);

  assert.ok(option, "ยังแสดงเป็น Market / Reference Scenario ได้");
  assert.equal(option.presentation, "MARKET_REFERENCE");
  assert.equal(option.selectableForHandoff, false);
  assert.match(option.compatibilityNote, /เงินดาวน์/);
});

test("a zero-down compatible FI can be selected for handoff", () => {
  const compatible = zeroDownFi();
  assert.ok(compatible);
  const option = matchFi(snapshot()).find((o) => o.id === compatible.id);

  assert.equal(option.presentation, "ROUTE_TO_OWN_PARTICIPATING");
  assert.equal(option.selectableForHandoff, true);
});

/* ---------------- 3. match wording ---------------- */

test("matching explains fit and never states an approval chance", () => {
  const options = matchFi(snapshot());
  assert.ok(options.length >= 3);

  for (const option of options) {
    for (const key of ["vehicleFit", "financingFit", "affordabilityFit", "eligibilityFit", "routeToOwnCompatibility"]) {
      assert.equal(typeof option.fit[key], "boolean", `${option.id} ต้องมี ${key}`);
    }
    assert.equal(option.approvalProbability, undefined);
    assert.equal(option.score, undefined, "ห้ามจัดอันดับด้วยคะแนนโอกาสอนุมัติ");
  }

  const rendered = JSON.stringify(options);
  for (const forbidden of [/อนุมัติง่าย/, /โอกาสอนุมัติ/, /approval probability/i, /easy approval/i, /highest chance/i, /likely approved/i]) {
    assert.doesNotMatch(rendered, forbidden);
  }
});

test("the match source contains no approval-probability logic at all", () => {
  const source = fs.readFileSync(new URL("../app/lib/fi/match.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /approvalProbability|approvalChance|likelihood/i);
});

test("affordability fit is read from the snapshot, never recomputed", () => {
  const source = fs.readFileSync(new URL("../app/lib/fi/match.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bevaluate\s*\(/);
  assert.doesNotMatch(source, /DSCR_GATE|appropriateRouteOf/);
});

/* ---------------- 4. maximum two ---------------- */

test("zero, one and two selections are allowed but a third is rejected", () => {
  assert.equal(MAX_FI_SELECTIONS, 2);
  const ready = snapshot();
  const ids = FI_CATALOGUE.filter((fi) => isRouteToOwnSelectable(fi)).map((fi) => fi.id);
  assert.ok(ids.length >= 3, "ต้องมี FI ที่รองรับ 0% down อย่างน้อย 3 รายเพื่อทดสอบ");

  assert.doesNotThrow(() => assertSelectionAllowed(ready, []));
  assert.doesNotThrow(() => assertSelectionAllowed(ready, [ids[0]]));
  assert.doesNotThrow(() => assertSelectionAllowed(ready, [ids[0], ids[1]]));
  assert.throws(() => assertSelectionAllowed(ready, [ids[0], ids[1], ids[2]]), /สูงสุด 2/);
});

test("a duplicate FI cannot be counted twice to bypass the limit", () => {
  const ids = FI_CATALOGUE.filter((fi) => isRouteToOwnSelectable(fi)).map((fi) => fi.id);
  assert.throws(() => assertSelectionAllowed(snapshot(), [ids[0], ids[0]]), /ซ้ำ/);
});

test("an FI that is not zero-down compatible cannot be selected even by direct call", () => {
  const needsDown = downPaymentFi();
  assert.throws(() => assertSelectionAllowed(snapshot(), [needsDown.id]), /0%|เงินดาวน์/);
});

/* ---------------- 5. route gating ---------------- */

test("BUILD may browse but cannot select or hand off", () => {
  const build = snapshot({ route: "BUILD READINESS", tier: null });
  const options = matchFi(build);

  assert.ok(options.length > 0, "ดู scenario ได้");
  assert.ok(options.every((o) => o.selectableForHandoff === false), "แต่เลือกเพื่อส่งต่อไม่ได้");

  const ids = FI_CATALOGUE.filter((fi) => isRouteToOwnSelectable(fi)).map((fi) => fi.id);
  assert.throws(() => assertSelectionAllowed(build, [ids[0]]), /READY/);
  assert.equal(handoffDecisionFor(build, { consented: true }).allowed, false);
});

test("NO NEW DEBT cannot select or hand off and gets no bank list", () => {
  const noDebt = snapshot({ route: "NO NEW DEBT", tier: null, affordabilityPassed: false, affordabilityGap: 400 });

  assert.deepEqual(matchFi(noDebt), [], "ไม่มีรายการธนาคารให้เลือก");
  const ids = FI_CATALOGUE.filter((fi) => isRouteToOwnSelectable(fi)).map((fi) => fi.id);
  assert.throws(() => assertSelectionAllowed(noDebt, [ids[0]]), /READY/);
  assert.equal(handoffDecisionFor(noDebt, { consented: true }).allowed, false);
});

/* ---------------- 6. FI-specific scenario ---------------- */

test("each FI produces its own illustrative financing scenario", () => {
  const base = snapshot();
  const compatible = FI_CATALOGUE.filter((fi) => isRouteToOwnSelectable(fi));

  const a = fiFinancingScenarioFor(compatible[0], base);
  const b = fiFinancingScenarioFor(compatible[1], base);

  assert.equal(a.label, "ILLUSTRATIVE_FINANCING_ESTIMATE");
  assert.equal(b.label, "ILLUSTRATIVE_FINANCING_ESTIMATE");
  assert.ok(a.estimatedMonthlyInstallment > 0);

  // อัตราต่างกันต้องให้ค่างวดต่างกัน ไม่ใช่ยกของเดิมมาใช้ซ้ำ
  if (compatible[0].indicativeRatePct !== compatible[1].indicativeRatePct) {
    assert.notEqual(a.estimatedMonthlyInstallment, b.estimatedMonthlyInstallment);
  }
});

/* ---------------- 7. the critical governance test ---------------- */

test("a heavier FI scenario forces re-evaluation and a stale READY cannot authorise handoff", async () => {
  const { evaluateForFi } = await import("../app/lib/fi/selection-service.ts");
  const { createApplication, updateApplication } = await import(
    "../app/lib/registration/application-service.ts"
  );
  const { recordCompetitionConsent } = await import("../app/lib/registration/consent-service.ts");
  const { evaluateApplication, listEvaluationSnapshots } = await import(
    "../app/lib/evaluation/evaluate-application.ts"
  );

  const application = await createApplication();
  await recordCompetitionConsent(application.id);
  await updateApplication(application.id, {
    profile: {
      displayName: "ผู้ทดลอง",
      phone: "0812345678",
      province: "กรุงเทพมหานคร",
      driverStatus: "RENTING",
      yearsDriving: 6,
      ownershipGoal: "OWN_WITHIN_5_YEARS"
    },
    eligibility: {
      taxiOccupationStatus: "ACTIVE_TAXI_DRIVER",
      publicDriverLicenseStatus: "TO_VERIFY",
      currentVehicleRelationship: "RENT",
      yearsProfessionalDriving: 6,
      serviceProvince: "กรุงเทพมหานคร",
      occupationalEvidenceStatus: "DECLARED"
    },
    financial: {
      incomeEntries: [{ channel: "PLATFORM", dailyAmount: 2200, hasTransactionEvidence: true }],
      workingDaysPerMonth: 26,
      currentRentDaily: 700,
      fuelDaily: 300,
      batteryServiceDaily: 0,
      otherOpexDaily: 60,
      householdMonthly: 15000,
      existingDebtMonthly: 0,
      activityConsistency: 95,
      vehicleId: "AION_ES",
      vehiclePrice: 800000,
      termMonths: 60,
      annualRatePct: 4.5
    }
  });

  const reference = await evaluateApplication(application.id);
  assert.equal(reference.route, "READY FOR FI", "เคสอ้างอิงต้อง READY ก่อน");

  // FI ที่แพงกว่ามาก — ทั้งอัตราและระยะเวลาสั้นลง ทำให้ภาระต่อวันสูงขึ้นอย่างมีนัยสำคัญ
  const expensiveFi = {
    id: "FI_TEST_EXPENSIVE",
    fiName: "ทดสอบ",
    productName: "ทดสอบภาระสูง",
    indicativeRatePct: 26,
    termMonths: [24],
    routeToOwnCompatibilityStatus: "COMPETITION_ASSUMPTION"
  };

  const outcome = await evaluateForFi(application.id, expensiveFi, reference);

  assert.equal(outcome.materialChange, true, "ภาระต่างกันมากต้องถือเป็น material change");
  assert.notEqual(outcome.snapshot.id, reference.id, "ต้องเป็น Snapshot ใหม่");
  assert.ok(outcome.snapshot.estimatedObligation > reference.estimatedObligation);

  const history = await listEvaluationSnapshots(application.id);
  const original = history.find((row) => row.id === reference.id);
  assert.equal(original.route, "READY FOR FI", "Snapshot เดิมต้องไม่ถูกแก้");
  // ฐานข้อมูลเก็บจำนวนเงินที่ทศนิยม 2 ตำแหน่ง จึงเทียบที่ความละเอียดเดียวกัน
  assert.equal(
    Math.round(original.estimatedObligation * 100),
    Math.round(reference.estimatedObligation * 100)
  );

  // ถ้าเส้นทางใหม่ไม่ใช่ READY ห้ามส่งต่อ และห้ามใช้ Snapshot READY เดิมมาอนุมัติแทน
  if (outcome.snapshot.route !== "READY FOR FI") {
    assert.equal(handoffDecisionFor(outcome.snapshot, { consented: true }).allowed, false);
    assert.equal(
      handoffDecisionFor(outcome.snapshot, { consented: true, staleSnapshot: reference }).allowed,
      false,
      "stale READY snapshot ห้าม authorize handoff"
    );
  }
});

test("an unchanged FI scenario reuses the latest snapshot rather than creating a duplicate", async () => {
  const { shouldReevaluateForFi } = await import("../app/lib/fi/selection-service.ts");
  const base = snapshot();
  const sameFi = {
    id: "FI_SAME",
    indicativeRatePct: base.financingScenario.annualRatePct,
    termMonths: [base.financingScenario.termMonths],
    routeToOwnCompatibilityStatus: "COMPETITION_ASSUMPTION"
  };

  assert.equal(shouldReevaluateForFi(sameFi, base), false);

  const differentFi = { ...sameFi, id: "FI_DIFF", indicativeRatePct: 9.9 };
  assert.equal(shouldReevaluateForFi(differentFi, base), true);
});

/* ---------------- 8. two FI resolve independently ---------------- */

test("FI A and FI B are assessed separately and may resolve differently", () => {
  const readyForA = snapshot({ id: "snap_A", route: "READY FOR FI" });
  const notReadyForB = snapshot({
    id: "snap_B",
    route: "NO NEW DEBT",
    tier: null,
    affordabilityPassed: false,
    affordabilityGap: 180,
    residual: 0
  });

  const a = handoffDecisionFor(readyForA, { consented: true });
  const b = handoffDecisionFor(notReadyForB, { consented: true });

  assert.equal(a.allowed, true);
  assert.equal(b.allowed, false);
  assert.match(b.reason, /READY/);
});

test("one selected FI never authorises the other", () => {
  const readyForA = snapshot({ id: "snap_A" });
  const notReadyForB = snapshot({ id: "snap_B", route: "NO NEW DEBT", affordabilityPassed: false, tier: null });

  // ใช้ Snapshot ของ FI A มาอนุมัติ FI B ไม่ได้ เพราะการตัดสินผูกกับ Snapshot ของ FI นั้น ๆ
  const wrong = handoffDecisionFor(notReadyForB, { consented: true, staleSnapshot: readyForA });
  assert.equal(wrong.allowed, false);
});

/* ---------------- 9. FI consent ---------------- */

test("the competition consent does not stand in for an FI consent", () => {
  const ready = snapshot();
  const withoutFiConsent = handoffDecisionFor(ready, { consented: false });

  assert.equal(withoutFiConsent.allowed, false);
  assert.match(withoutFiConsent.reason, /ความยินยอม/);
  assert.equal(handoffDecisionFor(ready, { consented: true }).allowed, true);
});

/* ---------------- 10. handoff package ---------------- */

test("the handoff package carries the FI-specific snapshot and the required disclaimers", () => {
  const fi = zeroDownFi();
  const snap = snapshot();
  const scenario = fiFinancingScenarioFor(fi, snap);

  const pkg = buildHandoffPackage({
    applicationId: snap.applicationId,
    fi,
    snapshot: snap,
    financingScenario: scenario,
    consent: { version: "RTO-FI-1.0", acceptedAt: "2026-09-09T01:00:00.000Z", accepted: true }
  });

  assert.equal(pkg.applicationId, "RTO-C26-000128");
  assert.equal(pkg.fiId, fi.id);
  assert.equal(pkg.evaluationSnapshotId, snap.id);
  assert.equal(pkg.route, "READY FOR FI");
  assert.equal(pkg.preScore, 82);
  assert.equal(pkg.tier, "A");
  assert.ok(pkg.financialPassport.availableCash > 0);
  assert.ok(pkg.basicEligibilitySummary);
  assert.ok(pkg.incomeEvidenceSummary);
  assert.equal(pkg.financingScenario.label, "ILLUSTRATIVE_FINANCING_ESTIMATE");
  assert.equal(pkg.consent.version, "RTO-FI-1.0");

  assert.ok(pkg.disclaimers.includes("Pre-Score ≠ Loan Approval"));
  assert.ok(pkg.disclaimers.some((d) => /สถาบันการเงินเป็นผู้พิจารณาและตัดสินสินเชื่อขั้นสุดท้าย/.test(d)));

  const rendered = JSON.stringify(pkg);
  assert.match(rendered, /Indicative Guarantee-Eligible Base/);
  assert.doesNotMatch(rendered, /Eligible Guaranteed Amount/);
});

test("a handoff package cannot be built from a non-READY snapshot", () => {
  const fi = zeroDownFi();
  const notReady = snapshot({ route: "NO NEW DEBT", tier: null, affordabilityPassed: false });

  assert.throws(
    () =>
      buildHandoffPackage({
        applicationId: notReady.applicationId,
        fi,
        snapshot: notReady,
        financingScenario: fiFinancingScenarioFor(fi, notReady),
        consent: { version: "RTO-FI-1.0", acceptedAt: "x", accepted: true }
      }),
    /READY/
  );
});

test("a handoff package cannot be built without an accepted FI consent", () => {
  const fi = zeroDownFi();
  const snap = snapshot();

  assert.throws(
    () =>
      buildHandoffPackage({
        applicationId: snap.applicationId,
        fi,
        snapshot: snap,
        financingScenario: fiFinancingScenarioFor(fi, snap),
        consent: { version: "RTO-FI-1.0", acceptedAt: "x", accepted: false }
      }),
    /ความยินยอม/
  );
});

/* ---------------- 11. no System B ---------------- */

test("the FI layer introduces no post-approval identifier, route or table", () => {
  for (const file of ["catalogue.ts", "match.ts", "selection-service.ts", "handoff.ts"]) {
    const source = fs.readFileSync(new URL(`../app/lib/fi/${file}`, import.meta.url), "utf8");
    for (const forbidden of [
      /\b(const|let|function|type|interface)\s+\w*(childElg|actualSweep|microSweep|dpd|debtLedger|claimCase|recovery|controlTower)\w*/i,
      /create table/i
    ]) {
      assert.doesNotMatch(source, forbidden, `${file} ต้องไม่มีโครงสร้างของ System B`);
    }
  }
});

test("the catalogue exposes only enabled products to applicants", () => {
  const enabled = listEnabledFi();
  assert.ok(enabled.length > 0);
  assert.ok(enabled.every((fi) => fi.enabled === true));
  assert.ok(getFiProduct(enabled[0].id));
  assert.equal(getFiProduct("FI_DOES_NOT_EXIST"), null);
});

test("fit dimensions reflect the applicant's own numbers", () => {
  const fi = zeroDownFi();
  const rich = fiFitFor(fi, snapshot({ availableCash: 5000, estimatedObligation: 200 }));
  const thin = fiFitFor(fi, snapshot({ availableCash: 50, estimatedObligation: 900, affordabilityGap: 850, affordabilityPassed: false }));

  assert.equal(rich.affordabilityFit, true);
  assert.equal(thin.affordabilityFit, false);
});

/* ---------------- A. source authority vs Route to Own participation ---------------- */

test("source status and Route to Own compatibility are two independent fields", () => {
  for (const fi of FI_CATALOGUE) {
    assert.ok(
      ["VERIFIED_BY_FI", "PUBLIC_SOURCE_REFERENCE", "COMPETITION_ILLUSTRATION"].includes(fi.sourceStatus),
      `${fi.id} sourceStatus`
    );
    assert.ok(
      ["VERIFIED_PARTNER", "COMPETITION_ASSUMPTION", "NOT_CONFIRMED"].includes(fi.routeToOwnCompatibilityStatus),
      `${fi.id} routeToOwnCompatibilityStatus`
    );
  }
});

test("a public source reference is never inferred to be a verified Route to Own partner", () => {
  const publicSource = FI_CATALOGUE.filter((fi) => fi.sourceStatus === "PUBLIC_SOURCE_REFERENCE");
  assert.ok(publicSource.length > 0);

  for (const fi of publicSource) {
    assert.notEqual(
      fi.routeToOwnCompatibilityStatus,
      "VERIFIED_PARTNER",
      `${fi.id}: การมีข้อมูลสาธารณะไม่ได้พิสูจน์ว่าเข้าร่วมโครงการ`
    );
  }
});

test("no FI defaults to VERIFIED_PARTNER while no participation evidence exists", () => {
  assert.equal(
    FI_CATALOGUE.filter((fi) => fi.routeToOwnCompatibilityStatus === "VERIFIED_PARTNER").length,
    0,
    "ยังไม่มีหลักฐานการเข้าร่วมโครงการของ FI รายใดในชุดข้อมูลรอบนี้"
  );
});

test("a competition assumption is visibly labelled as a simulation", () => {
  const assumed = matchFi(snapshot()).filter((o) => o.routeToOwnCompatibilityStatus === "COMPETITION_ASSUMPTION");
  assert.ok(assumed.length > 0);

  for (const option of assumed) {
    assert.match(option.compatibilityStatusCopy, /สถานการณ์จำลองสำหรับการแข่งขัน/);
    assert.match(option.compatibilityStatusCopy, /Competition Illustration/);
    assert.match(option.compatibilityStatusCopy, /ไม่ใช่การยืนยันการเข้าร่วมโครงการ/);
  }
});

test("a not-confirmed FI is never represented as a participating partner", () => {
  const notConfirmed = FI_CATALOGUE.filter((fi) => fi.routeToOwnCompatibilityStatus === "NOT_CONFIRMED");
  assert.ok(notConfirmed.length > 0, "แคตตาล็อกต้องมีอย่างน้อยหนึ่งรายที่ยังไม่ยืนยัน");

  for (const fi of notConfirmed) {
    const option = matchFi(snapshot()).find((o) => o.id === fi.id);
    assert.equal(option.presentation, "MARKET_REFERENCE", `${fi.id} ต้องเป็นข้อมูลอ้างอิงตลาดเท่านั้น`);
    assert.equal(option.selectableForHandoff, false);
    assert.throws(() => assertSelectionAllowed(snapshot(), [fi.id]));
    assert.doesNotMatch(option.compatibilityStatusCopy, /เข้าร่วมโครงการแล้ว|ยืนยันการเข้าร่วม/);
  }
});
