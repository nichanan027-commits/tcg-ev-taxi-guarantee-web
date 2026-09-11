import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { competitionConfig } from "../app/lib/config/competition.ts";
import { DEMO_CASES } from "../app/lib/demo/cases.ts";
import { evaluateApplication } from "../app/lib/evaluation/evaluate-application.ts";
import { getSnapshotById, listEvaluationSnapshots } from "../app/lib/evaluation/snapshot.ts";
import { listFiConsents, listFiSelections, recordFiConsent, setFiSelections } from "../app/lib/fi/fi-repository.ts";
import { listFaCases, requestFaAdvisory } from "../app/lib/fa/advisory-service.ts";
import { createApplication, getApplication, updateApplication } from "../app/lib/registration/application-service.ts";
import { recordCompetitionConsent, listConsents } from "../app/lib/registration/consent-service.ts";
import {
  ANONYMIZED_NAME,
  ANONYMIZED_PHONE,
  RETENTION_BLOCK_CODE,
  anonymizeAfter,
  dryRunRetention,
  executeRetention,
  exportCompetitionMetrics,
  isDueForAnonymization
} from "../app/lib/retention/retention-service.ts";

/**
 * นโยบายด้านล่างเป็น test fixture เท่านั้น ไม่ใช่ authoritative competition cutoff
 */
const POLICY = {
  competitionCutoffAt: "2030-01-31T23:59:59.000Z",
  retentionDays: 30,
  cutoffSource: "COMPETITION_CUTOFF_AT"
};
const BEFORE = new Date("2030-02-20T00:00:00.000Z");
const AT_THRESHOLD = new Date("2030-03-02T23:59:59.000Z");
const AFTER = new Date("2030-03-15T00:00:00.000Z");

async function seedFullJourney(caseId = "A") {
  const application = await createApplication();
  await recordCompetitionConsent(application.id);
  await updateApplication(application.id, DEMO_CASES[caseId].input);
  const snapshot = await evaluateApplication(application.id);
  return { applicationId: application.id, snapshot };
}

test("ไม่มี cutoff: dry-run คืน BLOCKED โดยไม่ต้องมีฐานข้อมูล", async () => {
  const report = await dryRunRetention({ now: AFTER, env: {} });
  assert.equal(report.status, "BLOCKED");
  assert.equal(report.code, RETENTION_BLOCK_CODE);
  assert.equal(report.policy, null);
  assert.equal(report.anonymizeAfter, null);
  assert.equal(report.due, false);
  assert.deepEqual(report.eligibleApplications, []);
  assert.deepEqual(report.wouldAnonymize, []);
  assert.deepEqual(report.anonymized, []);
  assert.deepEqual(report.deleted, []);
});

test("ไม่มี cutoff: execute คืน BLOCKED และไม่แก้ข้อมูลแม้แต่แถวเดียว", async () => {
  const { applicationId } = await seedFullJourney();
  const before = await getApplication(applicationId);
  const snapshotsBefore = await listEvaluationSnapshots(applicationId);

  const report = await executeRetention({ now: AFTER, env: {} });
  assert.equal(report.status, "BLOCKED");
  assert.equal(report.code, RETENTION_BLOCK_CODE);
  assert.deepEqual(report.anonymized, []);
  assert.deepEqual(report.deleted, []);

  const after = await getApplication(applicationId);
  assert.deepEqual(after.profile, before.profile);
  assert.equal(after.piiAnonymizedAt, null);
  assert.equal((await listEvaluationSnapshots(applicationId)).length, snapshotsBefore.length);
});

test("missing-cutoff guard มาก่อน schema/database access ทั้ง dry-run และ execute", () => {
  const service = fs.readFileSync("app/lib/retention/retention-service.ts", "utf8");
  const dryBody = service.slice(
    service.indexOf("export async function dryRunRetention"),
    service.indexOf("export async function executeRetention")
  );
  const executeBody = service.slice(
    service.indexOf("export async function executeRetention"),
    service.indexOf("export type CompetitionExportRow")
  );

  assert.ok(dryBody.indexOf("if (!policy)") >= 0);
  assert.ok(dryBody.indexOf("if (!policy)") < dryBody.indexOf("candidates()"));
  assert.ok(executeBody.indexOf("if (!policy)") >= 0);
  assert.ok(executeBody.indexOf("if (!policy)") < executeBody.indexOf("candidates()"));
  assert.ok(executeBody.indexOf("if (!policy)") < executeBody.indexOf("ensureSchema()"));
});

test("นโยบายนับจากวันสิ้นสุดการแข่งขัน ไม่ใช่จากวันที่สร้างใบสมัคร", () => {
  assert.equal(competitionConfig.piiRetentionDays, 30);
  assert.equal(anonymizeAfter(POLICY).toISOString(), "2030-03-02T23:59:59.000Z");

  const service = fs.readFileSync("app/lib/retention/retention-service.ts", "utf8");
  assert.ok(
    !/created_at\s*[+<>]|createdAt\s*\+/.test(service),
    "ต้องไม่คำนวณกำหนดลบจากวันที่สร้างใบสมัคร"
  );
});

test("ก่อนถึงกำหนด ข้อมูลไม่ถูกแตะเลย", async () => {
  const { applicationId } = await seedFullJourney();

  assert.equal(isDueForAnonymization(BEFORE, POLICY), false);

  const dry = await dryRunRetention({ now: BEFORE, policy: POLICY });
  assert.equal(dry.due, false);
  assert.deepEqual(dry.wouldAnonymize, []);
  assert.ok(dry.skipped.some((row) => row.applicationId === applicationId));

  const executed = await executeRetention({ now: BEFORE, policy: POLICY });
  assert.deepEqual(executed.anonymized, []);

  const application = await getApplication(applicationId);
  assert.equal(application.profile.displayName, DEMO_CASES.A.input.profile.displayName);
  assert.equal(application.piiAnonymizedAt, null);
});

test("ณ เวลาที่ครบกำหนดพอดี ถือว่าถึงกำหนดแล้ว", () => {
  assert.equal(isDueForAnonymization(AT_THRESHOLD, POLICY), true);
  assert.equal(isDueForAnonymization(new Date(AT_THRESHOLD.getTime() - 1), POLICY), false);
});

test("หลังพ้นกำหนด ชื่อและเบอร์ถูกแทนที่ แต่ใบสมัครและผลยังอยู่ครบ", async () => {
  const { applicationId, snapshot } = await seedFullJourney();
  const before = await getApplication(applicationId);

  const dry = await dryRunRetention({ now: AFTER, policy: POLICY });
  assert.ok(dry.wouldAnonymize.includes(applicationId));

  const afterDry = await getApplication(applicationId);
  assert.equal(afterDry.profile.displayName, before.profile.displayName);
  assert.equal(afterDry.profile.phone, before.profile.phone);
  assert.equal(afterDry.piiAnonymizedAt, null);

  const executed = await executeRetention({ now: AFTER, policy: POLICY });
  assert.ok(executed.anonymized.includes(applicationId));
  assert.deepEqual(executed.errors, []);

  const after = await getApplication(applicationId);
  assert.equal(after.profile.displayName, ANONYMIZED_NAME);
  assert.equal(after.profile.phone, ANONYMIZED_PHONE);
  assert.notEqual(after.piiAnonymizedAt, null);

  assert.equal(after.id, applicationId);
  assert.equal(after.status, before.status);
  assert.equal(after.profile.province, before.profile.province);
  assert.equal(after.financial.vehiclePrice, before.financial.vehiclePrice);
  assert.equal(after.financial.workingDaysPerMonth, before.financial.workingDaysPerMonth);

  const storedSnapshot = await getSnapshotById(snapshot.id);
  assert.equal(storedSnapshot.route, snapshot.route);
  assert.equal(storedSnapshot.preScore, snapshot.preScore);
  assert.equal(storedSnapshot.availableCash.toFixed(2), snapshot.availableCash.toFixed(2));
  assert.equal(storedSnapshot.applicationId, applicationId);
});

test("ความสัมพันธ์ของสถาบันการเงิน ความยินยอม และเคสคำปรึกษายังใช้ได้หลังลบข้อมูลส่วนบุคคล", async () => {
  const ready = await seedFullJourney("A");
  await setFiSelections(ready.applicationId, ["IBANK_GREEN_LIFE"]);
  await recordFiConsent(ready.applicationId, "IBANK_GREEN_LIFE");

  const build = await seedFullJourney("B");
  const faCase = await requestFaAdvisory({
    applicationId: build.applicationId,
    preferredContactTime: "MORNING",
    preferredChannel: "PHONE"
  });

  await executeRetention({ now: AFTER, policy: POLICY });

  const selections = await listFiSelections(ready.applicationId, { activeOnly: true });
  assert.equal(selections.length, 1);
  const fiSnapshot = await getSnapshotById(selections[0].evaluationSnapshotId);
  assert.ok(fiSnapshot, "Snapshot ของสถาบันการเงินต้องยังอ่านได้");
  assert.ok(await getSnapshotById(selections[0].referenceSnapshotId));

  const fiConsents = await listFiConsents(ready.applicationId);
  assert.equal(fiConsents.length, 1);
  assert.equal(fiConsents[0].accepted, true);
  assert.ok((await listConsents(ready.applicationId)).length > 0);

  const cases = await listFaCases(build.applicationId);
  assert.equal(cases.length, 1);
  assert.equal(cases[0].id, faCase.id);
  assert.equal(cases[0].applicationId, build.applicationId);
  assert.ok(await getSnapshotById(cases[0].evaluationSnapshotId));

  assert.ok((await listEvaluationSnapshots(ready.applicationId)).length >= 1);
});

test("ส่งออกข้อมูลโดยค่าเริ่มต้นไม่มีชื่อหรือเบอร์โทร", async () => {
  const { applicationId } = await seedFullJourney();
  const rows = await exportCompetitionMetrics();
  const row = rows.find((item) => item.applicationId === applicationId);

  assert.ok(row, "ต้องมีแถวของใบสมัครนี้");
  assert.ok(row.route !== null, "ยังต้องมีตัวเลขเชิงผลลัพธ์ให้วิเคราะห์");

  const keys = Object.keys(row);
  for (const forbidden of ["displayName", "phone", "name", "cooperativeOrOperator"]) {
    assert.ok(!keys.includes(forbidden), `ข้อมูลส่งออกต้องไม่มีสนาม ${forbidden}`);
  }

  const serialized = JSON.stringify(rows);
  assert.ok(!serialized.includes(DEMO_CASES.A.input.profile.phone));
  assert.ok(!serialized.includes(DEMO_CASES.A.input.profile.displayName));
});

test("dry run ไม่แก้ข้อมูลแม้แต่แถวเดียว", async () => {
  const { applicationId } = await seedFullJourney();

  const before = await getApplication(applicationId);
  const snapshotsBefore = await listEvaluationSnapshots(applicationId);

  const first = await dryRunRetention({ now: AFTER, policy: POLICY });
  const second = await dryRunRetention({ now: AFTER, policy: POLICY });

  assert.deepEqual(first.wouldAnonymize, second.wouldAnonymize);
  assert.deepEqual(first.anonymized, []);
  assert.deepEqual(first.deleted, []);

  const after = await getApplication(applicationId);
  assert.deepEqual(after.profile, before.profile);
  assert.equal(after.piiAnonymizedAt, null);
  assert.equal((await listEvaluationSnapshots(applicationId)).length, snapshotsBefore.length);

  const service = fs.readFileSync("app/lib/retention/retention-service.ts", "utf8");
  const dryRunBody = service.slice(
    service.indexOf("export async function dryRunRetention"),
    service.indexOf("export async function executeRetention")
  );
  for (const pattern of [/\bupdate\s+\w+\s+set\b/i, /\bdelete\s+from\b/i, /\binsert\s+into\b/i]) {
    assert.doesNotMatch(dryRunBody, pattern, "dryRunRetention ต้องไม่มีคำสั่งเขียน");
  }
});

test("เรียกลบซ้ำไม่สร้างความเสียหายเพิ่ม", async () => {
  const { applicationId } = await seedFullJourney();

  const first = await executeRetention({ now: AFTER, policy: POLICY });
  assert.ok(first.anonymized.includes(applicationId));

  const afterFirst = await getApplication(applicationId);
  const stamp = afterFirst.piiAnonymizedAt;

  const second = await executeRetention({ now: new Date(AFTER.getTime() + 86_400_000), policy: POLICY });
  assert.ok(!second.anonymized.includes(applicationId), "ใบที่ลบแล้วต้องไม่ถูกลบซ้ำ");
  assert.ok(second.skipped.some((row) => row.applicationId === applicationId));
  assert.deepEqual(second.errors, []);

  const afterSecond = await getApplication(applicationId);
  assert.equal(afterSecond.piiAnonymizedAt, stamp, "เวลาที่ลบต้องไม่ถูกเขียนทับ");
  assert.equal(afterSecond.profile.displayName, ANONYMIZED_NAME);
  assert.equal(afterSecond.profile.province, DEMO_CASES.A.input.profile.province);
});

test("ไม่มีค่าจาก Secure Verification ให้ลบ เพราะไม่เคยถูกบันทึก", () => {
  const service = fs.readFileSync("app/lib/retention/retention-service.ts", "utf8");

  for (const term of ["national_id", "bank_account", "id_card", "driver_license_blob", "statement_blob"]) {
    assert.ok(!service.includes(term), `นโยบายเก็บข้อมูลไม่ต้องรู้จัก ${term} เพราะไม่เคยมีการบันทึก`);
  }

  const migrations = fs
    .readdirSync("db/migrations")
    .filter((file) => file.endsWith(".sql"))
    .map((file) => fs.readFileSync(`db/migrations/${file}`, "utf8"))
    .join("\n")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  assert.ok(!/national_id|bank_account|id_card_/.test(migrations));
});
