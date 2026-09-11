import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { resultViewModel } from "../app/lib/result/view-model.ts";

function snapshot(overrides = {}) {
  return {
    id: "snap_test1",
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

/* ---------- hierarchy ---------- */

test("the route is the primary heading and the pre-score is never promoted above it", () => {
  const vm = resultViewModel(snapshot());

  assert.equal(vm.hierarchy[0].id, "route");
  assert.equal(vm.hierarchy[1].id, "affordability");
  assert.equal(vm.hierarchy[2].id, "tier");
  assert.equal(vm.hierarchy[3].id, "preScore");

  assert.equal(vm.hero.level, 1, "Route ต้องเป็น heading ระดับสูงสุด");
  assert.ok(vm.preScore.level > vm.hero.level, "Pre-Score ต้องไม่ใหญ่กว่า Route");
});

/* ---------- READY ---------- */

test("READY shows the Thai hero, the report and FI next steps, and the approval disclaimer", () => {
  const vm = resultViewModel(snapshot());

  assert.equal(vm.hero.route, "READY FOR FI");
  assert.equal(vm.hero.title, "READY FOR FI");
  assert.equal(vm.hero.titleTh, "พร้อมเข้าสู่การพิจารณาของสถาบันการเงิน");
  assert.match(vm.hero.support, /ความพร้อมเบื้องต้น/);

  const ctaIds = vm.ctas.map((c) => c.id);
  assert.ok(ctaIds.includes("readiness-report"));
  assert.ok(ctaIds.includes("fi-match"));
  assert.ok(!ctaIds.includes("fa-advisory"), "READY ไม่ต้องมี CTA ที่ปรึกษาเป็นค่าตั้งต้น");

  assert.ok(vm.disclaimers.includes("Pre-Score ≠ Loan Approval"));
  assert.ok(vm.disclaimers.includes("สถาบันการเงินเป็นผู้ตัดสินสินเชื่อขั้นสุดท้าย"));
});

/* ---------- BUILD ---------- */

test("BUILD may view FI scenarios but has no selection, consent or handoff", () => {
  const vm = resultViewModel(snapshot({ route: "BUILD READINESS", tier: null }));

  assert.equal(vm.hero.title, "BUILD READINESS / CONTINUE TO LEASE");
  assert.equal(vm.hero.titleTh, "สร้างความพร้อมเพิ่มเติมก่อนเพิ่มภาระใหม่");

  assert.equal(vm.fi.canView, true, "ดู scenario ได้");
  assert.equal(vm.fi.canSelect, false);
  assert.equal(vm.fi.canConsent, false);
  assert.equal(vm.fi.canHandoff, false);

  const ctaIds = vm.ctas.map((c) => c.id);
  assert.ok(ctaIds.includes("fa-advisory"));
  assert.ok(!ctaIds.includes("fi-handoff"));
  assert.ok(vm.showsImprovementGuidance);
});

/* ---------- NO NEW DEBT ---------- */

test("NO NEW DEBT speaks Thai to the applicant and offers no borrowing call to action", () => {
  const vm = resultViewModel(
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

  assert.equal(vm.hero.title, "สถานะ: ยังไม่พร้อมสำหรับสินเชื่อใหม่");
  assert.equal(vm.hero.route, "NO NEW DEBT", "รหัสภายในยังเป็น NO NEW DEBT");

  assert.equal(vm.fi.canView, false);
  assert.equal(vm.fi.canSelect, false);
  assert.equal(vm.fi.canHandoff, false);

  const ctaIds = vm.ctas.map((c) => c.id);
  assert.ok(!ctaIds.includes("fi-match"), "ห้ามมี CTA เลือกธนาคาร");
  assert.ok(!ctaIds.includes("fi-handoff"));
  assert.ok(ctaIds.includes("fa-advisory"));

  assert.equal(vm.capacity.state, "GAP");
  assert.equal(vm.capacity.gap, 602);
  assert.ok(vm.blockingReasons.length > 0);
});

/* ---------- capacity ---------- */

test("the capacity bar compares money with money and never shows a negative residual as cash left", () => {
  const ok = resultViewModel(snapshot()).capacity;
  assert.equal(ok.state, "RESIDUAL");
  assert.equal(ok.availableCash, 766);
  assert.equal(ok.estimatedObligation, 540);
  assert.equal(ok.residual, 226);
  assert.equal(ok.gap, 0);
  assert.ok(ok.residual >= 0);

  const short = resultViewModel(
    snapshot({ availableCash: 0, estimatedObligation: 602, residual: 0, affordabilityGap: 602, affordabilityPassed: false })
  ).capacity;
  assert.equal(short.state, "GAP");
  assert.equal(short.residual, 0);
  assert.equal(short.gap, 602);
  assert.match(short.label, /ยังขาด/);
});

test("DSCR is not the primary affordability visual", () => {
  const vm = resultViewModel(snapshot());
  assert.equal(vm.capacity.dscr, undefined, "หน้าจอผู้สมัครไม่ใช้ DSCR เป็นภาพหลัก");
  assert.doesNotMatch(JSON.stringify(vm.capacity), /dscr/i);
});

/* ---------- revenue wording ---------- */

test("a declared-only income is labelled assessment revenue and never verified revenue", () => {
  const vm = resultViewModel(snapshot());

  assert.equal(vm.passport.declared.value, 1850);
  assert.equal(vm.passport.assessment.label, "รายได้ที่ใช้ในการประเมินรอบทดลอง");
  assert.equal(vm.passport.verified, null, "ไม่มีหลักฐานจึงไม่แสดงบรรทัด Verified Revenue");
  assert.equal(vm.passport.evidenceStatus.code, "DECLARED_ONLY");

  const rendered = JSON.stringify(vm.passport);
  assert.doesNotMatch(rendered, /Verified Revenue/);
});

test("a transaction-evidenced income does show a verified revenue line", () => {
  const vm = resultViewModel(
    snapshot({
      revenue: {
        declaredDailyRevenue: 2000,
        assessmentDailyRevenue: 2000,
        verifiedDailyRevenue: 2000,
        evidenceStatus: "TRANSACTION_EVIDENCED"
      }
    })
  );

  assert.ok(vm.passport.verified);
  assert.equal(vm.passport.verified.value, 2000);
  assert.equal(vm.passport.verified.label, "รายได้ที่มีหลักฐานธุรกรรมรองรับ");
});

/* ---------- pre-score ---------- */

test("the gauge carries the score, the tier meaning and the not-an-approval line", () => {
  const vm = resultViewModel(snapshot());

  assert.equal(vm.preScore.score, 78);
  assert.equal(vm.preScore.max, 100);
  assert.equal(vm.preScore.tier, "A");
  assert.equal(vm.preScore.tierCopy, "Tier A — ความพร้อมสูง");
  assert.equal(vm.preScore.disclaimer, "คะแนนประกอบการประเมินความพร้อม ไม่ใช่ผลอนุมัติสินเชื่อ");

  // ห้ามสื่อว่าเขียว = อนุมัติ แดง = ปฏิเสธ
  assert.doesNotMatch(JSON.stringify(vm.preScore), /approved|rejected|อนุมัติแล้ว/i);
});

test("tier copy covers B and C and disappears when no tier was offered", () => {
  assert.equal(resultViewModel(snapshot({ tier: "B" })).preScore.tierCopy, "Tier B — ความพร้อมปานกลาง");
  assert.equal(
    resultViewModel(snapshot({ tier: "C" })).preScore.tierCopy,
    "Tier C — ต้องติดตาม/เสริมความพร้อม"
  );
  assert.equal(resultViewModel(snapshot({ route: "BUILD READINESS", tier: null })).preScore.tierCopy, null);
});

/* ---------- eligibility / evidence ---------- */

test("supporting statuses are shown without ever claiming a verified identity", () => {
  const vm = resultViewModel(snapshot());

  assert.equal(vm.eligibility.occupationalStatus, "ACTIVE_TAXI_DRIVER");
  assert.equal(vm.eligibility.licenseStatus, "TO_VERIFY");
  assert.equal(vm.eligibility.statusCopy, "ข้อมูลอาชีพที่ผู้สมัครระบุ — รอยืนยันในขั้นตอนจริง");
  assert.equal(vm.eligibility.incomeEvidenceReliability, "HIGH");
  assert.equal(vm.eligibility.activityCrossValidation, "CONSISTENT");

  const rendered = JSON.stringify(vm.eligibility);
  assert.doesNotMatch(rendered, /Identity Verified/i);
  assert.doesNotMatch(rendered, /Occupational Identity Verified/i);
});

/* ---------- no client-side product logic ---------- */

test("a high pre-score with a failed affordability still renders NO NEW DEBT from the snapshot", () => {
  const vm = resultViewModel(
    snapshot({ route: "NO NEW DEBT", preScore: 96, tier: null, affordabilityPassed: false, affordabilityGap: 400, residual: 0 })
  );

  assert.equal(vm.hero.route, "NO NEW DEBT");
  assert.equal(vm.hero.title, "สถานะ: ยังไม่พร้อมสำหรับสินเชื่อใหม่");
  assert.equal(vm.preScore.score, 96, "คะแนนยังแสดงตามจริง");
  assert.equal(vm.fi.canHandoff, false, "คะแนนสูงห้ามเปิดทางส่งต่อ FI");
});

test("the view model reads the snapshot and derives no product decision of its own", () => {
  const source = fs.readFileSync(new URL("../app/lib/result/view-model.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /\bevaluate\s*\(/, "ห้ามเรียก engine ในชั้นแสดงผล");
  assert.doesNotMatch(source, /DSCR_GATE|readinessScoreOf|appropriateRouteOf/);
  assert.doesNotMatch(source, /affordabilityPassed\s*=\s*[^=]/, "ห้ามคำนวณผลใหม่ ต้องอ่านจาก snapshot");
});

test("no visual component calls the engine or recomputes a route", () => {
  const dir = "components";
  if (!fs.existsSync(dir)) return;
  const files = fs
    .readdirSync(dir, { recursive: true })
    .map((p) => `${dir}/${p}`)
    .filter((p) => /\.tsx?$/.test(p) && fs.statSync(p).isFile());

  assert.ok(files.length > 0, "ต้องมีคอมโพเนนต์ให้ตรวจ");
  for (const file of files) {
    const body = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(body, /from "[^"]*route2own(-engine)?(\.ts|\.js)?"/, `${file} ห้าม import Frozen Engine`);
    assert.doesNotMatch(body, /\bevaluate\s*\(/, `${file} ห้ามเรียก evaluate()`);
    assert.doesNotMatch(body, /appropriateRouteOf|readinessScoreOf/, `${file} ห้ามตัดสินเส้นทางเอง`);
  }
});
