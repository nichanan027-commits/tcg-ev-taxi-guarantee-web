import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { readinessReportModel, reportTitleFor, reportFileName } from "../app/lib/result/report-model.ts";

function snapshot(overrides = {}) {
  return {
    id: "snap_pdf1",
    applicationId: "RTO-C26-000128",
    inputVersion: 2,
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
      declaredDailyRevenue: 1850,
      assessmentDailyRevenue: 1850,
      verifiedDailyRevenue: null,
      evidenceStatus: "DECLARED_ONLY"
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
      estimatedMonthlyInstallment: 14910,
      dailyEquivalentBurden: 573,
      workingDaysPerMonth: 26,
      label: "ILLUSTRATIVE_FINANCING_ESTIMATE"
    },
    assessmentRevenue: 1757,
    eligibleOpEx: 414,
    protectedCash: 577,
    availableCash: 766,
    estimatedObligation: 540,
    residual: 226,
    affordabilityGap: 0,
    affordabilityPassed: true,
    principalSustainabilityPassed: true,
    incomeEvidenceReliability: "HIGH",
    activityEvidenceStatus: "CONSISTENT",
    preScore: 78,
    tier: "A",
    route: "READY FOR FI",
    reasonCodes: [{ code: "ENGINE_NOTE_1", severity: "INFO", message: "ตัวอย่างเหตุผล" }],
    rbpTier: "A",
    rbpRate: 0.012,
    indicativeGuaranteeEligibleBase: 800000,
    engineStatus: "FINAL / FROZEN FOR COMPETITION",
    specVersion: "RTO-COMP-REG-1.0",
    evaluatedAt: "2026-09-09T00:00:00.000Z",
    ...overrides
  };
}

const flatten = (model) => JSON.stringify(model);

/* ---------- titles by route ---------- */

test("each route gets its own report title", () => {
  assert.equal(reportTitleFor("READY FOR FI"), "Route to Own — Pre-E-LG Readiness Report");
  assert.equal(reportTitleFor("BUILD READINESS"), "Credit Readiness Improvement Report");
  assert.equal(reportTitleFor("NO NEW DEBT"), "สถานะ: ยังไม่พร้อมสำหรับสินเชื่อใหม่");
});

test("the READY title carries the Thai subtitle and never reads as an issued certificate", () => {
  const model = readinessReportModel(snapshot());

  assert.equal(model.title, "Route to Own — Pre-E-LG Readiness Report");
  assert.equal(model.subtitleTh, "รายงานความพร้อมก่อนเข้าสู่กระบวนการสินเชื่อและการค้ำประกัน");
  assert.doesNotMatch(model.title, /Certificate/i);
  assert.doesNotMatch(flatten(model), /อนุมัติสินเชื่อแล้ว|ได้รับการค้ำประกันแล้ว/);
});

/* ---------- snapshot parity ---------- */

test("every headline number in the report comes from the snapshot unchanged", () => {
  const s = snapshot();
  const model = readinessReportModel(s);

  assert.equal(model.snapshotId, s.id);
  assert.equal(model.inputVersion, s.inputVersion);
  assert.equal(model.applicationId, s.applicationId);
  assert.equal(model.executive.route, s.route);
  assert.equal(model.executive.preScore, s.preScore);
  assert.equal(model.executive.tier, s.tier);
  assert.equal(model.executive.availableCash, s.availableCash);
  assert.equal(model.executive.estimatedObligation, s.estimatedObligation);
  assert.equal(model.executive.residual, s.residual);
  assert.equal(model.executive.affordabilityGap, s.affordabilityGap);
});

test("the report never recomputes anything and never calls the engine", () => {
  const source = fs.readFileSync(new URL("../app/lib/result/report-model.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /\bevaluate\s*\(/);
  assert.doesNotMatch(source, /route2own-engine/);
  assert.doesNotMatch(source, /estimateFinancing|assessRevenue/, "PDF ห้ามคำนวณค่างวดหรือหลักฐานใหม่");
  assert.doesNotMatch(source, /appropriateRouteOf|readinessScoreOf|DSCR_GATE/);
});

/* ---------- pages ---------- */

test("the READY report has the six required pages in order", () => {
  const model = readinessReportModel(snapshot());
  assert.deepEqual(model.pages.map((p) => p.id), [
    "executive",
    "passport",
    "explainability",
    "financing",
    "fi",
    "decision-rights"
  ]);
});

test("page 2 shows the three revenue layers and the affordability outcome", () => {
  const model = readinessReportModel(snapshot());
  const page = model.pages.find((p) => p.id === "passport");
  const labels = page.rows.map((r) => r.label);

  assert.ok(labels.includes("รายได้ที่ผู้สมัครระบุ"));
  assert.ok(labels.includes("สถานะหลักฐานรายได้"));
  assert.ok(labels.includes("รายได้ที่ใช้ในการประเมินรอบทดลอง"));
  assert.ok(labels.includes("ต้นทุนในการทำงาน"));
  assert.ok(labels.includes("เงินจำเป็นที่ต้องกันไว้"));
  assert.ok(labels.includes("เงินที่พร้อมรองรับภาระ"));
  assert.ok(labels.includes("ภาระรถโดยประมาณ"));

  // ไม่มีหลักฐานจริง จึงต้องไม่มีบรรทัด Verified Revenue
  assert.ok(!labels.includes("รายได้ที่มีหลักฐานธุรกรรมรองรับ"));
  assert.doesNotMatch(flatten(page), /Verified Revenue/);
});

test("no fabricated multi-day trend is produced from a single daily average", () => {
  const model = readinessReportModel(snapshot());
  assert.equal(model.hasHistoricalSeries, false);
  assert.doesNotMatch(flatten(model), /30 วันย้อนหลัง|90 วันย้อนหลัง|trend/i);
});

test("page 4 states zero borrower down payment and both financing disclaimers", () => {
  const model = readinessReportModel(snapshot());
  const page = model.pages.find((p) => p.id === "financing");

  assert.match(flatten(page), /0% Down ≠ 100% Guarantee/);
  assert.match(flatten(page), /ประมาณการเบื้องต้น \(Illustrative Financing Estimate\)/);
  assert.ok(page.rows.some((r) => r.label === "เงินดาวน์ผู้ขับ" && String(r.value) === "0%"));
});

test("page 5 says FI comparison comes later while the FI module is not built", () => {
  const model = readinessReportModel(snapshot());
  const page = model.pages.find((p) => p.id === "fi");
  assert.match(flatten(page), /FI Comparison — available after READY/);
});

test("page 6 separates the decision rights of TCG and the financial institution", () => {
  const model = readinessReportModel(snapshot());
  const page = model.pages.find((p) => p.id === "decision-rights");
  const body = flatten(page);

  assert.match(body, /Underwriting/);
  assert.match(body, /Final Credit Decision/);
  assert.match(body, /Credit Readiness/);
  assert.match(
    body,
    /เอกสารนี้เป็นผลการประเมินความพร้อม.*ไม่ใช่การอนุมัติสินเชื่อ.*ไม่ใช่หนังสือค้ำประกัน E-LG/
  );
});

/* ---------- guarantee wording ---------- */

test("the report uses the indicative guarantee base and never the approved-sounding label", () => {
  const model = readinessReportModel(snapshot());
  const body = flatten(model);

  assert.match(body, /Indicative Guarantee-Eligible Base/);
  assert.match(body, /วงเงินฐานอ้างอิงที่อาจเข้าเกณฑ์การค้ำประกัน/);
  assert.doesNotMatch(body, /Eligible Guaranteed Amount/);
  assert.doesNotMatch(body, /Final Child E-?LG/i);
});

/* ---------- privacy ---------- */

test("no report variant can contain a sensitive field label or value", () => {
  for (const route of ["READY FOR FI", "BUILD READINESS", "NO NEW DEBT"]) {
    const body = flatten(readinessReportModel(snapshot({ route, tier: route === "READY FOR FI" ? "A" : null })));
    for (const forbidden of [
      /เลขบัตรประชาชน/,
      /national\s?id/i,
      /bank\s?account/i,
      /เลขที่บัญชี/,
      /statement/i,
      /ใบขับขี่.*รูป|driver licen[cs]e image/i,
      /credit bureau/i,
      /health/i
    ]) {
      assert.doesNotMatch(body, forbidden, `${route} report must not contain ${forbidden}`);
    }
  }
});

/* ---------- route variants ---------- */

test("the BUILD report replaces FI submission with improvement guidance", () => {
  const model = readinessReportModel(snapshot({ route: "BUILD READINESS", tier: null }));

  assert.equal(model.title, "Credit Readiness Improvement Report");
  assert.equal(model.showsFiSelection, false);
  assert.equal(model.showsImprovementGuidance, true);
  assert.doesNotMatch(flatten(model), /ส่งต่อสถาบันการเงิน(ได้ทันที|เรียบร้อย)/);
});

test("the not-ready report leads with the Thai status and the gap, and offers no bank CTA", () => {
  const model = readinessReportModel(
    snapshot({
      route: "NO NEW DEBT",
      tier: null,
      affordabilityPassed: false,
      availableCash: 0,
      residual: 0,
      affordabilityGap: 602,
      reasonCodes: [{ code: "AFFORDABILITY_FAILED", severity: "BLOCKER", message: "กระแสเงินสดยังไม่พอ" }]
    })
  );

  assert.equal(model.title, "สถานะ: ยังไม่พร้อมสำหรับสินเชื่อใหม่");
  assert.equal(model.executive.affordabilityGap, 602);
  assert.equal(model.showsFiSelection, false);
  assert.ok(model.blockingReasons.length > 0);
  assert.doesNotMatch(flatten(model), /เลือกธนาคาร|สมัครสินเชื่อกับ/);
});

/* ---------- file name ---------- */

test("the file name carries the application id and a route code", () => {
  assert.equal(reportFileName("RTO-C26-000128", "READY FOR FI"), "Route-to-Own-RTO-C26-000128-READY.pdf");
  assert.equal(reportFileName("RTO-C26-000128", "BUILD READINESS"), "Route-to-Own-RTO-C26-000128-BUILD.pdf");
  assert.equal(reportFileName("RTO-C26-000128", "NO NEW DEBT"), "Route-to-Own-RTO-C26-000128-NO-NEW-DEBT.pdf");
});
