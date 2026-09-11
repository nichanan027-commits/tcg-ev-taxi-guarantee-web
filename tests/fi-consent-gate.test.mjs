import test from "node:test";
import assert from "node:assert/strict";

import { DEMO_CASES } from "../app/lib/demo/cases.ts";
import { evaluateApplication } from "../app/lib/evaluation/evaluate-application.ts";
import { getSnapshotById } from "../app/lib/evaluation/snapshot.ts";
import {
  FI_CONSENT_NOT_READY_REASON,
  listFiConsents,
  listFiSelections,
  recordFiConsent,
  setFiSelections
} from "../app/lib/fi/fi-repository.ts";
import { createApplication, updateApplication } from "../app/lib/registration/application-service.ts";
import { recordCompetitionConsent } from "../app/lib/registration/consent-service.ts";

/**
 * ความยินยอมรายสถาบันการเงินคือความยินยอมให้ "ส่งข้อมูลไปให้แห่งนั้นพิจารณา"
 *
 * ถ้าผลภายใต้เงื่อนไขของแห่งนั้นไม่ใช่ READY FOR FI การส่งต่อจะไม่เกิดขึ้นอยู่แล้ว
 * การรับความยินยอมไว้ก่อนจึงเป็นการเก็บสิ่งที่ไม่มีทางถูกใช้
 * และทำให้ผู้สมัครเข้าใจว่ากำลังเดินหน้าเข้าสู่การพิจารณาทั้งที่ไม่ใช่
 */
async function seed(caseId) {
  const application = await createApplication();
  await recordCompetitionConsent(application.id);
  await updateApplication(application.id, DEMO_CASES[caseId].input);
  const snapshot = await evaluateApplication(application.id);
  return { applicationId: application.id, snapshot };
}

async function routeOf(applicationId, fiId) {
  const selection = (await listFiSelections(applicationId, { activeOnly: true })).find((row) => row.fiId === fiId);
  const snapshot = await getSnapshotById(selection.evaluationSnapshotId);
  return snapshot.route;
}

test("ให้ความยินยอมได้เมื่อผลของสถาบันการเงินแห่งนั้นเป็น READY FOR FI", async () => {
  const { applicationId } = await seed("A");
  await setFiSelections(applicationId, ["IBANK_GREEN_LIFE"]);
  assert.equal(await routeOf(applicationId, "IBANK_GREEN_LIFE"), "READY FOR FI");

  const consent = await recordFiConsent(applicationId, "IBANK_GREEN_LIFE");
  assert.equal(consent.accepted, true);
  assert.equal(consent.fiId, "IBANK_GREEN_LIFE");
});

test("ให้ความยินยอมไม่ได้เมื่อเงื่อนไขของสถาบันการเงินทำให้ผลเป็น NO NEW DEBT", async () => {
  const { applicationId } = await seed("D");
  await setFiSelections(applicationId, ["KKP_EV"]);
  assert.equal(await routeOf(applicationId, "KKP_EV"), "NO NEW DEBT");

  await assert.rejects(() => recordFiConsent(applicationId, "KKP_EV"), {
    message: FI_CONSENT_NOT_READY_REASON
  });

  // ไม่มีแถวความยินยอมค้างไว้
  assert.equal((await listFiConsents(applicationId)).length, 0);
});

test("ให้ความยินยอมไม่ได้เมื่อเส้นทางเป็น BUILD READINESS", async () => {
  const { applicationId, snapshot } = await seed("B");
  assert.equal(snapshot.route, "BUILD READINESS");

  // BUILD ถูกปฏิเสธตั้งแต่ขั้นเลือก จึงยังไม่มี selection ให้ยินยอมด้วยซ้ำ
  await assert.rejects(() => setFiSelections(applicationId, ["IBANK_GREEN_LIFE"]), {
    message: /READY FOR FI/
  });
  await assert.rejects(() => recordFiConsent(applicationId, "IBANK_GREEN_LIFE"), {
    message: /ต้องเลือก/
  });
});

test("ผลเก่าที่เคย READY ใช้อนุมัติความยินยอมของเงื่อนไขปัจจุบันไม่ได้", async () => {
  const { applicationId, snapshot } = await seed("D");
  assert.equal(snapshot.route, "READY FOR FI");

  await setFiSelections(applicationId, ["KKP_EV"]);

  // ผลอ้างอิงยัง READY อยู่ในประวัติ แต่ไม่ใช่ผลของ KKP
  const reference = await getSnapshotById(snapshot.id);
  assert.equal(reference.route, "READY FOR FI");

  await assert.rejects(() => recordFiConsent(applicationId, "KKP_EV"), {
    message: FI_CONSENT_NOT_READY_REASON
  });
});

test("สองสถาบันการเงินตัดสินความยินยอมแยกกัน", async () => {
  const { applicationId } = await seed("D");
  await setFiSelections(applicationId, ["IBANK_GREEN_LIFE", "KKP_EV"]);

  assert.equal(await routeOf(applicationId, "IBANK_GREEN_LIFE"), "READY FOR FI");
  assert.equal(await routeOf(applicationId, "KKP_EV"), "NO NEW DEBT");

  const allowed = await recordFiConsent(applicationId, "IBANK_GREEN_LIFE");
  assert.equal(allowed.accepted, true);

  await assert.rejects(() => recordFiConsent(applicationId, "KKP_EV"), {
    message: FI_CONSENT_NOT_READY_REASON
  });

  const consents = await listFiConsents(applicationId);
  assert.equal(consents.length, 1);
  assert.equal(consents[0].fiId, "IBANK_GREEN_LIFE");
});

test("การปฏิเสธความยินยอมไม่ลบประวัติการเลือกหรือผลการประเมิน", async () => {
  const { applicationId } = await seed("D");
  await setFiSelections(applicationId, ["KKP_EV"]);

  await assert.rejects(() => recordFiConsent(applicationId, "KKP_EV"));

  const selections = await listFiSelections(applicationId, { activeOnly: true });
  assert.equal(selections.length, 1);
  assert.equal(selections[0].fiId, "KKP_EV");

  const snapshot = await getSnapshotById(selections[0].evaluationSnapshotId);
  assert.equal(snapshot.route, "NO NEW DEBT");
  assert.equal(selections[0].materialChange, true);
});
