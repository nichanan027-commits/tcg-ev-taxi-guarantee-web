import test from "node:test";
import assert from "node:assert/strict";

import {
  applicantRouteCopy,
  canHandoffToFi,
  canRequestFaAdvisory
} from "../app/lib/config/competition.ts";
import { createApplication, updateApplication } from "../app/lib/registration/application-service.ts";
import { recordCompetitionConsent } from "../app/lib/registration/consent-service.ts";
import {
  evaluateApplication,
  getLatestEvaluationSnapshot,
  listEvaluationSnapshots
} from "../app/lib/evaluation/evaluate-application.ts";

const baseProfile = {
  displayName: "ผู้ทดลอง",
  phone: "0812345678",
  province: "กรุงเทพมหานคร",
  driverStatus: "RENTING",
  yearsDriving: 6,
  ownershipGoal: "OWN_WITHIN_5_YEARS"
};

const baseFinancial = {
  averageDailyIncome: 2200,
  incomeChannels: ["APP_TRANSFER"],
  workingDaysPerMonth: 26,
  verifiedPct: 95,
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
};

async function applicationWith(financial) {
  const application = await createApplication();
  await recordCompetitionConsent(application.id);
  await updateApplication(application.id, {
    profile: baseProfile,
    financial: { ...baseFinancial, ...financial }
  });
  return application.id;
}

test("a healthy applicant is routed READY FOR FI and the snapshot records it", async () => {
  const id = await applicationWith({});
  const snapshot = await evaluateApplication(id);

  assert.equal(snapshot.route, "READY FOR FI");
  assert.equal(snapshot.affordabilityPassed, true);
  assert.equal(snapshot.applicationId, id);
  assert.ok(snapshot.id);
  assert.ok(snapshot.evaluatedAt);
  assert.equal(snapshot.engineStatus, "FINAL / FROZEN FOR COMPETITION");
  assert.ok(snapshot.preScore >= 0 && snapshot.preScore <= 100);
});

test("an evidence-poor but affordable applicant is routed BUILD READINESS", async () => {
  const id = await applicationWith({ averageDailyIncome: 3000, verifiedPct: 55, activityConsistency: 60 });
  const snapshot = await evaluateApplication(id);

  // Snapshot เก็บรหัสภายในของ engine ส่วนป้ายสาธารณะเป็นคนละค่า
  assert.equal(snapshot.route, "BUILD READINESS");
  assert.equal(applicantRouteCopy(snapshot.route), "BUILD READINESS / CONTINUE TO LEASE");
  assert.equal(snapshot.affordabilityPassed, true, "BUILD หมายถึงหลักฐานยังไม่พอ ไม่ใช่จ่ายไม่ไหว");
});

test("the applicant never sees the raw NO NEW DEBT code", async () => {
  const id = await applicationWith({ averageDailyIncome: 1150, existingDebtMonthly: 2500 });
  const snapshot = await evaluateApplication(id);

  assert.equal(snapshot.route, "NO NEW DEBT", "รหัสภายในต้องไม่เปลี่ยน");
  assert.equal(applicantRouteCopy(snapshot.route), "ยังไม่พร้อมสำหรับสินเชื่อใหม่");
  assert.equal(canHandoffToFi(snapshot.route), false);
  assert.equal(canRequestFaAdvisory(snapshot.route), true);
});

test("only READY FOR FI may hand off, and both other routes may ask F.A Center", async () => {
  const ready = await evaluateApplication(await applicationWith({}));
  assert.equal(canHandoffToFi(ready.route), true);
  assert.equal(canRequestFaAdvisory(ready.route), false);

  const build = await evaluateApplication(
    await applicationWith({ averageDailyIncome: 3000, verifiedPct: 55, activityConsistency: 60 })
  );
  assert.equal(canHandoffToFi(build.route), false);
  assert.equal(canRequestFaAdvisory(build.route), true);
});

test("a failed affordability is NO NEW DEBT and a high pre-score cannot override it", async () => {
  const id = await applicationWith({
    averageDailyIncome: 1150,
    verifiedPct: 90,
    activityConsistency: 100,
    existingDebtMonthly: 2500
  });
  const snapshot = await evaluateApplication(id);

  assert.equal(snapshot.route, "NO NEW DEBT");
  assert.equal(snapshot.affordabilityPassed, false);
  assert.ok(snapshot.affordabilityGap > 0, "ต้องรายงานส่วนที่ขาดเป็นตัวเลขของตัวเอง");
  assert.equal(snapshot.residual, 0, "เงินคงเหลือที่แสดงต้องไม่ติดลบ");

  // แม้คะแนนจะสูง เส้นทางก็ต้องไม่ถูกเปิดกลับ
  assert.notEqual(snapshot.route, "READY FOR FI");
});

test("no tier is offered unless the applicant is READY FOR FI", async () => {
  const noDebt = await evaluateApplication(
    await applicationWith({ averageDailyIncome: 1150, existingDebtMonthly: 2500 })
  );
  assert.equal(noDebt.tier, null);

  const ready = await evaluateApplication(await applicationWith({}));
  assert.ok(["A", "B", "C"].includes(ready.tier));
});

test("each evaluation appends an immutable snapshot instead of updating the previous one", async () => {
  const id = await applicationWith({});
  const first = await evaluateApplication(id);
  const second = await evaluateApplication(id);

  assert.notEqual(first.id, second.id);

  const history = await listEvaluationSnapshots(id);
  assert.equal(history.length, 2);
  assert.equal(history[0].id, second.id, "ล่าสุดอยู่บนสุด");

  const latest = await getLatestEvaluationSnapshot(id);
  assert.equal(latest.id, second.id);

  // แถวแรกต้องยังอ่านค่าเดิมได้ ไม่ถูกเขียนทับ
  const original = history.find((row) => row.id === first.id);
  assert.equal(original.preScore, first.preScore);
  assert.equal(original.route, first.route);
});

test("reassessment after improving the inputs creates a new snapshot and keeps the old one", async () => {
  const id = await applicationWith({ averageDailyIncome: 1150, existingDebtMonthly: 2500 });
  const before = await evaluateApplication(id);
  assert.equal(before.route, "NO NEW DEBT");

  await updateApplication(id, { profile: baseProfile, financial: baseFinancial });
  const after = await evaluateApplication(id);

  assert.equal(after.route, "READY FOR FI");
  assert.notEqual(after.id, before.id);

  const history = await listEvaluationSnapshots(id);
  assert.equal(history.length, 2);
  assert.equal(history.find((row) => row.id === before.id).route, "NO NEW DEBT", "ผลเดิมต้องไม่ถูกแก้");
});

test("the snapshot carries the financial passport identity the screen will display", async () => {
  const id = await applicationWith({});
  const s = await evaluateApplication(id);

  // Verified Revenue − Eligible OpEx − Protected Cash = Available Cash
  assert.equal(
    Math.round(s.availableCash * 100),
    Math.round(Math.max(0, s.verifiedRevenue - s.eligibleOpEx - s.protectedCash) * 100)
  );
  assert.ok(s.availableCash >= 0);
  assert.ok(s.estimatedObligation > 0);
  assert.equal(s.financingScenario.label, "ILLUSTRATIVE_FINANCING_ESTIMATE");
  assert.equal(s.vehicleScenario.borrowerDownPayment, 0);
  assert.equal(s.vehicleScenario.vehicleId, "AION_ES");
});

test("reason codes are structured and explain the route", async () => {
  const id = await applicationWith({ averageDailyIncome: 1150, existingDebtMonthly: 2500 });
  const s = await evaluateApplication(id);

  assert.ok(Array.isArray(s.reasonCodes));
  assert.ok(s.reasonCodes.length > 0);
  for (const reason of s.reasonCodes) {
    assert.ok(reason.code, "reason code ต้องมีรหัส");
    assert.ok(["INFO", "WATCH", "BLOCKER"].includes(reason.severity));
    assert.ok(reason.message.length > 0);
  }
  assert.ok(
    s.reasonCodes.some((r) => r.severity === "BLOCKER"),
    "เคสที่ไปต่อไม่ได้ต้องมีเหตุผลระดับ BLOCKER"
  );
});

test("evaluation requires saved financial data rather than inventing a result", async () => {
  const application = await createApplication();
  await assert.rejects(() => evaluateApplication(application.id), /ยังไม่มีข้อมูล/);
});

test("the adapter calls the frozen engine and copies no formula of its own", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("../app/lib/evaluation/evaluate-application.ts", import.meta.url), "utf8");

  assert.match(source, /from "\.\.\/route2own\.ts"|from "\.\.\/route2own"/);
  // ห้ามคัดลอกสูตรจาก engine มาไว้ที่นี่
  assert.doesNotMatch(source, /RBP_DAY_COUNT_BASIS\s*=/);
  assert.doesNotMatch(source, /DSCR_GATE\s*=/);
  assert.doesNotMatch(source, /\/\s*365/);
});
