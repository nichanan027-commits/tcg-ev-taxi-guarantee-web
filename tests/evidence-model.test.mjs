import test from "node:test";
import assert from "node:assert/strict";

import {
  assessRevenue,
  engineVerifiedPct,
  revenueLabelOf,
  REVENUE_ASSESSMENT_LABEL
} from "../app/lib/evidence/revenue-assessment.ts";

const declaredOnlyCash = [{ channel: "CASH", dailyAmount: 1850, hasTransactionEvidence: false }];

test("self-declared income with no evidence is never called verified", () => {
  const assessment = assessRevenue({ entries: declaredOnlyCash, activityConsistency: 0 });

  assert.equal(assessment.declaredDailyRevenue, 1850);
  assert.equal(assessment.assessmentDailyRevenue, 1850, "ยังใช้ประเมินได้ แต่ต้องเรียกชื่อให้ถูก");
  assert.equal(assessment.verifiedDailyRevenue, null, "ไม่มีหลักฐานธุรกรรม จึงไม่มีรายได้ที่ verified");
  assert.equal(assessment.evidenceStatus, "DECLARED_ONLY");
});

test("the competition label for assessment revenue never says Verified Revenue", () => {
  const assessment = assessRevenue({ entries: declaredOnlyCash, activityConsistency: 0 });
  const label = revenueLabelOf(assessment);

  assert.equal(label, "รายได้ที่ใช้ในการประเมินรอบทดลอง");
  assert.equal(label, REVENUE_ASSESSMENT_LABEL);
  assert.doesNotMatch(label, /Verified Revenue/);
  assert.doesNotMatch(label, /ตรวจสอบย้อนกลับได้แล้ว/);
});

test("digital income counts as verified only when it carries transaction evidence", () => {
  const withEvidence = assessRevenue({
    entries: [{ channel: "PLATFORM", dailyAmount: 2000, hasTransactionEvidence: true }],
    activityConsistency: 90
  });
  assert.equal(withEvidence.verifiedDailyRevenue, 2000);
  assert.equal(withEvidence.evidenceStatus, "TRANSACTION_EVIDENCED");

  const withoutEvidence = assessRevenue({
    entries: [{ channel: "PLATFORM", dailyAmount: 2000, hasTransactionEvidence: false }],
    activityConsistency: 90
  });
  assert.equal(withoutEvidence.verifiedDailyRevenue, null, "ช่องทางดิจิทัลก็ยังต้องมีหลักฐานจริง");
  assert.equal(withoutEvidence.evidenceStatus, "DECLARED_ONLY");
});

test("a mix of evidenced and declared income is reported as partially evidenced", () => {
  const assessment = assessRevenue({
    entries: [
      { channel: "QR", dailyAmount: 1200, hasTransactionEvidence: true },
      { channel: "CASH", dailyAmount: 800, hasTransactionEvidence: false }
    ],
    activityConsistency: 50
  });

  assert.equal(assessment.declaredDailyRevenue, 2000);
  assert.equal(assessment.verifiedDailyRevenue, 1200, "นับเฉพาะส่วนที่มีหลักฐาน");
  assert.equal(assessment.evidenceStatus, "PARTIALLY_EVIDENCED");
});

test("cash supported by consistent activity is cross-validated, not verified income", () => {
  const assessment = assessRevenue({
    entries: [{ channel: "CASH", dailyAmount: 1500, hasTransactionEvidence: false }],
    activityConsistency: 95
  });

  assert.equal(assessment.evidenceStatus, "CASH_CROSS_VALIDATED");
  assert.equal(assessment.verifiedDailyRevenue, null, "Activity Data ≠ Income");
  assert.equal(assessment.assessmentDailyRevenue, 1500);
});

test("activity data changes cross-validation but never the income amount", () => {
  const low = assessRevenue({
    entries: [{ channel: "CASH", dailyAmount: 1500, hasTransactionEvidence: false }],
    activityConsistency: 10
  });
  const high = assessRevenue({
    entries: [{ channel: "CASH", dailyAmount: 1500, hasTransactionEvidence: false }],
    activityConsistency: 99
  });

  assert.equal(low.declaredDailyRevenue, high.declaredDailyRevenue);
  assert.equal(low.assessmentDailyRevenue, high.assessmentDailyRevenue, "GPS/trips/hours ห้ามเพิ่มรายได้");
  assert.equal(low.verifiedDailyRevenue, null);
  assert.equal(high.verifiedDailyRevenue, null);
  assert.notEqual(low.evidenceStatus, high.evidenceStatus, "แต่สถานะการตรวจสอบไขว้เปลี่ยนได้");
});

test("the evidence share handed to the engine is derived from evidence, never typed by the applicant", () => {
  const none = assessRevenue({ entries: declaredOnlyCash, activityConsistency: 0 });
  assert.equal(engineVerifiedPct(none), 0, "ไม่มีหลักฐาน = 0% ไม่ใช่ค่าที่ผู้สมัครพิมพ์เอง");

  const all = assessRevenue({
    entries: [{ channel: "BANK_TRANSFER", dailyAmount: 2000, hasTransactionEvidence: true }],
    activityConsistency: 80
  });
  assert.equal(engineVerifiedPct(all), 100);

  const half = assessRevenue({
    entries: [
      { channel: "QR", dailyAmount: 1000, hasTransactionEvidence: true },
      { channel: "CASH", dailyAmount: 1000, hasTransactionEvidence: false }
    ],
    activityConsistency: 50
  });
  assert.equal(engineVerifiedPct(half), 50);
});

test("zero declared revenue does not divide by zero", () => {
  const assessment = assessRevenue({ entries: [], activityConsistency: 0 });
  assert.equal(assessment.declaredDailyRevenue, 0);
  assert.equal(assessment.verifiedDailyRevenue, null);
  assert.equal(engineVerifiedPct(assessment), 0);
  assert.equal(assessment.evidenceStatus, "DECLARED_ONLY");
});

test("negative or non-finite channel amounts are rejected", () => {
  assert.throws(() =>
    assessRevenue({ entries: [{ channel: "CASH", dailyAmount: -10, hasTransactionEvidence: false }], activityConsistency: 0 })
  );
  assert.throws(() =>
    assessRevenue({ entries: [{ channel: "CASH", dailyAmount: Number.NaN, hasTransactionEvidence: false }], activityConsistency: 0 })
  );
});

test("evidence reliability is read from the frozen engine, not decided here", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("../app/lib/evidence/revenue-assessment.ts", import.meta.url), "utf8");

  assert.match(source, /incomeEvidenceReliabilityOf/, "ต้องเรียกเกณฑ์ของ engine");
  // ห้ามตั้งเกณฑ์ HIGH/MEDIUM/LOW เองในไฟล์นี้
  assert.doesNotMatch(source, />=\s*90\s*\)?\s*return\s*"HIGH"/);
  assert.doesNotMatch(source, /INCOME_EVIDENCE_THRESHOLDS\s*=/);
});
