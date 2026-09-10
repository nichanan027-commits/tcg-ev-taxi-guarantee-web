import test from "node:test";
import assert from "node:assert/strict";

import { DEMO_CASES } from "../app/lib/demo/cases.ts";
import { evaluateApplication } from "../app/lib/evaluation/evaluate-application.ts";
import { getLatestEvaluationSnapshot } from "../app/lib/evaluation/snapshot.ts";
import { listFiSelections, referenceSnapshotFor, setFiSelections } from "../app/lib/fi/fi-repository.ts";
import { createApplication, getApplication, updateApplication } from "../app/lib/registration/application-service.ts";
import { recordCompetitionConsent } from "../app/lib/registration/consent-service.ts";

/**
 * ผลอ้างอิงต้องไม่ถูกกลืนโดยเงื่อนไขของสถาบันการเงิน
 *
 * เมื่อเลือก FI ที่เงื่อนไขต่างออกไป ระบบจะสร้าง Snapshot ใหม่เฉพาะแห่งนั้น
 * ซึ่งอาจเป็น NO NEW DEBT ได้ ถ้าปล่อยให้ Snapshot นั้นกลายเป็น "ผลล่าสุด" ของใบสมัคร
 * ผู้สมัครจะถูกล็อกไว้ในผลของ FI แห่งเดียวและเลือกแห่งอื่นต่อไม่ได้อีกเลย
 */
async function seedDemo(caseId) {
  const application = await createApplication();
  await recordCompetitionConsent(application.id);
  await updateApplication(application.id, DEMO_CASES[caseId].input);
  const snapshot = await evaluateApplication(application.id);
  return { applicationId: application.id, snapshot };
}

test("ผลอ้างอิงยังเป็นผลของผู้สมัครเอง แม้ผลล่าสุดจะเป็นผลของสถาบันการเงิน", async () => {
  const { applicationId, snapshot } = await seedDemo("D");
  assert.equal(snapshot.route, "READY FOR FI");

  await setFiSelections(applicationId, ["KKP_EV"]);

  const latest = await getLatestEvaluationSnapshot(applicationId);
  const reference = await referenceSnapshotFor(applicationId);

  // ผลล่าสุดคือผลภายใต้เงื่อนไขของ KKP ซึ่งต่างจากผลอ้างอิง
  assert.notEqual(latest.id, reference.id);
  assert.equal(reference.id, snapshot.id);
  assert.equal(reference.route, "READY FOR FI");
  assert.equal(latest.route, "NO NEW DEBT");
});

test("เลือกสถาบันการเงินรอบใหม่ได้ แม้รอบก่อนหน้าจะได้ผลเป็น NO NEW DEBT", async () => {
  const { applicationId } = await seedDemo("D");

  await setFiSelections(applicationId, ["KKP_EV"]);
  const first = await listFiSelections(applicationId, { activeOnly: true });
  assert.equal(first[0].materialChange, true);

  // รอบที่สองต้องตัดสินจากผลอ้างอิง ไม่ใช่จากผลของ KKP ที่เป็น NO NEW DEBT
  const { outcomes } = await setFiSelections(applicationId, ["IBANK_GREEN_LIFE"]);
  assert.equal(outcomes[0].snapshot.route, "READY FOR FI");

  const active = await listFiSelections(applicationId, { activeOnly: true });
  assert.equal(active.length, 1);
  assert.equal(active[0].fiId, "IBANK_GREEN_LIFE");

  // ประวัติเป็น append-only — แถวเดิมยังอยู่ เพียงแต่ถูกปิด
  const all = await listFiSelections(applicationId);
  assert.equal(all.length, 2);
  assert.equal(all.filter((row) => row.active).length, 1);
});

test("เงื่อนไขของสถาบันการเงินไม่ถูกทิ้งค้างไว้เป็นเงื่อนไขของใบสมัคร", async () => {
  const { applicationId } = await seedDemo("D");
  const before = await getApplication(applicationId);

  await setFiSelections(applicationId, ["KKP_EV"]);

  const after = await getApplication(applicationId);
  assert.equal(after.financial.annualRatePct, before.financial.annualRatePct);
  assert.equal(after.financial.termMonths, before.financial.termMonths);
});

test("แต่ละสถาบันการเงินผูกกับ Snapshot ของตัวเอง และอ้างผลอ้างอิงใบเดียวกัน", async () => {
  const { applicationId, snapshot } = await seedDemo("D");

  await setFiSelections(applicationId, ["IBANK_GREEN_LIFE", "KKP_EV"]);
  const selections = await listFiSelections(applicationId, { activeOnly: true });

  assert.equal(selections.length, 2);
  assert.notEqual(selections[0].evaluationSnapshotId, selections[1].evaluationSnapshotId);
  assert.equal(selections[0].referenceSnapshotId, snapshot.id);
  assert.equal(selections[1].referenceSnapshotId, snapshot.id);
});
