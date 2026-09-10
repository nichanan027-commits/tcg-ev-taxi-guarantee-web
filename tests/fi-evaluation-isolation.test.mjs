import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { DEMO_CASES } from "../app/lib/demo/cases.ts";
import {
  evaluateApplication,
  evaluateApplicationForFi
} from "../app/lib/evaluation/evaluate-application.ts";
import { getSnapshotById, listEvaluationSnapshots } from "../app/lib/evaluation/snapshot.ts";
import { getFiProduct } from "../app/lib/fi/catalogue.ts";
import { listFiSelections, setFiSelections } from "../app/lib/fi/fi-repository.ts";
import { evaluateForFi, fiFinancingScenarioFor } from "../app/lib/fi/selection-service.ts";
import { createApplication, getApplication, updateApplication } from "../app/lib/registration/application-service.ts";
import { recordCompetitionConsent } from "../app/lib/registration/consent-service.ts";

/**
 * การประเมินภายใต้เงื่อนไขของสถาบันการเงินต้องไม่แตะข้อมูลใบสมัคร
 *
 * รูปแบบเดิมคือ "แก้เงื่อนไขในใบสมัคร → ประเมิน → คืนค่ากลับ"
 * ซึ่งใช้ได้เมื่อเรียกทีละครั้งตามลำดับ แต่ระหว่างนั้นใบสมัครถือเงื่อนไขของ FI แห่งหนึ่งอยู่จริง
 * ถ้ามีการอ่านหรือประเมินซ้อนเข้ามาในจังหวะนั้น จะได้ผลของเงื่อนไขที่ไม่ใช่ของตัวเอง
 *
 * รูปแบบปัจจุบันส่งเงื่อนไขเป็น override ของการเรียกครั้งนั้น ใบสมัครจึงไม่เคยเปลี่ยนเลย
 */
async function seed(caseId) {
  const application = await createApplication();
  await recordCompetitionConsent(application.id);
  await updateApplication(application.id, DEMO_CASES[caseId].input);
  const snapshot = await evaluateApplication(application.id);
  return { applicationId: application.id, snapshot };
}

function financingOf(application) {
  return {
    annualRatePct: application.financial.annualRatePct,
    termMonths: application.financial.termMonths,
    vehiclePrice: application.financial.vehiclePrice
  };
}

test("ข้อมูลการเงินของใบสมัครเหมือนเดิมทุกค่าหลังประเมินตามเงื่อนไขของสถาบันการเงิน", async () => {
  const { applicationId } = await seed("D");
  const before = financingOf(await getApplication(applicationId));

  await setFiSelections(applicationId, ["IBANK_GREEN_LIFE", "KKP_EV"]);

  const after = financingOf(await getApplication(applicationId));
  assert.deepEqual(after, before);
});

test("ประเมินสถาบันการเงินแห่งหนึ่งไม่เปลี่ยน input ของอีกแห่ง", async () => {
  const { applicationId, snapshot } = await seed("D");

  const ibank = getFiProduct("IBANK_GREEN_LIFE");
  const kkp = getFiProduct("KKP_EV");

  // ประเมินสลับลำดับ แล้วเทียบกับการประเมินเรียงลำดับปกติ
  const kkpFirst = await evaluateForFi(applicationId, kkp, snapshot);
  const ibankSecond = await evaluateForFi(applicationId, ibank, snapshot);

  const { applicationId: otherId, snapshot: otherSnapshot } = await seed("D");
  const ibankFirst = await evaluateForFi(otherId, ibank, otherSnapshot);
  const kkpSecond = await evaluateForFi(otherId, kkp, otherSnapshot);

  // ผลของแต่ละแห่งไม่ขึ้นกับว่าถูกประเมินก่อนหรือหลังอีกแห่ง
  assert.equal(kkpFirst.snapshot.route, kkpSecond.snapshot.route);
  assert.equal(ibankFirst.snapshot.route, ibankSecond.snapshot.route);
  assert.equal(
    kkpFirst.snapshot.financingScenario.annualRatePct,
    kkpSecond.snapshot.financingScenario.annualRatePct
  );
  assert.equal(
    ibankFirst.snapshot.financingScenario.termMonths,
    ibankSecond.snapshot.financingScenario.termMonths
  );
  assert.equal(kkpFirst.snapshot.estimatedObligation, kkpSecond.snapshot.estimatedObligation);
  assert.equal(ibankSecond.snapshot.estimatedObligation, ibankFirst.snapshot.estimatedObligation);
});

test("ผลอ้างอิงไม่ถูกแก้ไขจากการประเมินตามเงื่อนไขของสถาบันการเงิน", async () => {
  const { applicationId, snapshot } = await seed("D");
  const before = await getSnapshotById(snapshot.id);

  await setFiSelections(applicationId, ["IBANK_GREEN_LIFE", "KKP_EV"]);

  const after = await getSnapshotById(snapshot.id);
  assert.deepEqual(after, before);
});

test("เฉพาะ Snapshot ของสถาบันการเงินเท่านั้นที่ได้รับเงื่อนไขที่แทนที่", async () => {
  const { applicationId, snapshot } = await seed("D");
  await setFiSelections(applicationId, ["KKP_EV"]);

  const kkp = getFiProduct("KKP_EV");
  const expected = fiFinancingScenarioFor(kkp, snapshot);

  const selection = (await listFiSelections(applicationId, { activeOnly: true }))[0];
  const fiSnapshot = await getSnapshotById(selection.evaluationSnapshotId);

  assert.equal(fiSnapshot.financingScenario.annualRatePct, expected.annualRatePct);
  assert.equal(fiSnapshot.financingScenario.termMonths, expected.termMonths);

  // ผลอ้างอิงยังถือเงื่อนไขของผู้สมัครเอง
  assert.equal(snapshot.financingScenario.annualRatePct, DEMO_CASES.D.input.financial.annualRatePct);
  assert.equal(snapshot.financingScenario.termMonths, DEMO_CASES.D.input.financial.termMonths);
});

test("ประเมินตามเงื่อนไขของสถาบันการเงินพร้อมกันได้ผลเท่ากับเรียงทีละแห่ง", async () => {
  const { applicationId, snapshot } = await seed("D");
  const ibank = getFiProduct("IBANK_GREEN_LIFE");
  const kkp = getFiProduct("KKP_EV");

  // เรียกพร้อมกัน — ถ้ายังต้องพึ่งการแก้แล้วคืนค่า ผลจะปนกัน
  const [a, b] = await Promise.all([
    evaluateForFi(applicationId, ibank, snapshot),
    evaluateForFi(applicationId, kkp, snapshot)
  ]);

  assert.equal(a.snapshot.financingScenario.annualRatePct, ibank.indicativeRatePct);
  assert.equal(b.snapshot.financingScenario.annualRatePct, kkp.indicativeRatePct);
  assert.equal(a.snapshot.route, "READY FOR FI");
  assert.equal(b.snapshot.route, "NO NEW DEBT");

  // ใบสมัครยังไม่ถูกแตะแม้จะเรียกซ้อนกัน
  const application = await getApplication(applicationId);
  assert.equal(application.financial.annualRatePct, DEMO_CASES.D.input.financial.annualRatePct);
  assert.equal(application.financial.termMonths, DEMO_CASES.D.input.financial.termMonths);
});

test("ผลอ้างอิงของใบสมัครอื่นถูกปฏิเสธ", async () => {
  const mine = await seed("D");
  const theirs = await seed("A");

  await assert.rejects(
    () =>
      evaluateApplicationForFi({
        applicationId: mine.applicationId,
        referenceSnapshotId: theirs.snapshot.id,
        fiId: "KKP_EV",
        financingOverride: { annualRatePct: 5.8, termMonths: 72 }
      }),
    { message: /ไม่ได้เป็นของใบสมัครนี้/ }
  );
});

test("ทุก Snapshot ยังเป็น append-only และเรียงตามลำดับเวอร์ชัน", async () => {
  const { applicationId } = await seed("D");
  await setFiSelections(applicationId, ["IBANK_GREEN_LIFE", "KKP_EV"]);

  const history = await listEvaluationSnapshots(applicationId);
  assert.equal(history.length, 3);
  const versions = history.map((row) => row.inputVersion).sort((a, b) => a - b);
  assert.deepEqual(versions, [1, 2, 3]);
});

test("ตัวเชื่อมไม่กลับไปใช้การแก้ข้อมูลใบสมัครเพื่อประเมิน FI", () => {
  const repository = fs.readFileSync("app/lib/fi/fi-repository.ts", "utf8");
  const service = fs.readFileSync("app/lib/fi/selection-service.ts", "utf8");
  assert.ok(!repository.includes("updateFinancingTerms"), "fi-repository ต้องไม่แก้เงื่อนไขของใบสมัคร");
  assert.ok(!service.includes("updateFinancingTerms"), "selection-service ต้องไม่แก้เงื่อนไขของใบสมัคร");
});
