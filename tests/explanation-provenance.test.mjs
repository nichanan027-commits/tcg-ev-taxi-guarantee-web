import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { DEMO_CASES } from "../app/lib/demo/cases.ts";
import { evaluateApplication } from "../app/lib/evaluation/evaluate-application.ts";
import { primaryReasonOf } from "../app/lib/fa/advisory-service.ts";
import { createApplication, updateApplication } from "../app/lib/registration/application-service.ts";
import { recordCompetitionConsent } from "../app/lib/registration/consent-service.ts";
import { readinessReportModel } from "../app/lib/result/report-model.ts";
import { resultViewModel } from "../app/lib/result/view-model.ts";

/**
 * คำอธิบายที่ผู้สมัครเห็นต้องสืบกลับไปที่ผลการประเมินได้เสมอ
 *
 * ภาระหนี้เดิมเป็นตัวอย่างที่ชัดที่สุดของกฎนี้ ค่านี้ถูกส่งให้ engine
 * และ engine นำไปรวมใน Required Debt Service ซึ่งกระทบ DSCR, Principal Sustainability
 * และคะแนนความพร้อม แต่ไม่ได้กระทบ Available Cash หรือ Affordability Gap โดยตรง
 *
 * ความเสี่ยงคือชั้นแสดงผลจะ "ช่วยอธิบาย" ด้วยการอนุมานเอง — เห็นว่ามีตัวเลขหนี้เดิม
 * แล้วบอกผู้สมัครว่าหนี้เดิมทำให้ผลตก ทั้งที่ผลการประเมินอาจไม่ได้ระบุเช่นนั้น
 * ผู้สมัครอาจไปตัดสินใจปิดหนี้ด้วยความเข้าใจผิดว่าเส้นทางจะเปลี่ยน
 *
 * กฎจึงเป็นเรื่องที่มาของคำอธิบาย ไม่ใช่การห้ามพูดถึงหนี้เดิม:
 * ถ้า engine ระบุไว้ใน reason code ก็แสดงได้ ถ้าไม่ระบุก็ห้ามเติมเอง
 * และห้ามตั้งเกณฑ์หนี้เดิมหรือคำนวณความสามารถรับภาระเองที่ฝั่งหน้าจอ
 */
async function seed(financialOverrides = {}) {
  const application = await createApplication();
  await recordCompetitionConsent(application.id);
  const input = DEMO_CASES.C.input;
  await updateApplication(application.id, {
    ...input,
    financial: { ...input.financial, ...financialOverrides }
  });
  return evaluateApplication(application.id);
}

/** ทุกข้อความที่ผู้สมัครเห็นบนหน้าผลลัพธ์และในรายงาน */
function applicantFacingText(snapshot) {
  const vm = resultViewModel(snapshot);
  const report = readinessReportModel(snapshot);
  return [
    vm.hero.title,
    vm.hero.titleTh,
    vm.hero.support,
    vm.capacity.label,
    ...vm.ctas.map((cta) => cta.label),
    ...vm.reasonCodes.map((reason) => reason.message),
    ...vm.disclaimers,
    JSON.stringify(report.pages)
  ].join("\n");
}

test("ภาระหนี้เดิมเป็น input ของ engine จริง และผลที่ต่างกันมาจาก engine ไม่ใช่จากหน้าจอ", async () => {
  const withDebt = await seed({ existingDebtMonthly: 2500 });
  const withoutDebt = await seed({ existingDebtMonthly: 0 });

  // engine นำหนี้เดิมไปรวมใน Required Debt Service — คะแนนและ DSCR จึงต่างกันจริง
  assert.notEqual(withDebt.preScore, withoutDebt.preScore);
  const noteWith = withDebt.reasonCodes.find((reason) => reason.message.includes("ภาระหนี้เดิม"));
  assert.ok(noteWith, "engine ต้องระบุไว้เองว่าหนี้เดิมถูกรวมใน Required Debt Service");
  assert.equal(noteWith.severity, "INFO");

  // แต่ค่าที่ engine ไม่ได้ผูกกับหนี้เดิม ต้องไม่ขยับ
  assert.equal(withDebt.availableCash.toFixed(2), withoutDebt.availableCash.toFixed(2));
  assert.equal(withDebt.affordabilityGap.toFixed(2), withoutDebt.affordabilityGap.toFixed(2));
});

test("เมื่อผลการประเมินไม่ได้ระบุหนี้เดิม ไม่มีชั้นใดพูดถึงหนี้เดิมกับผู้สมัคร", async () => {
  const snapshot = await seed({ existingDebtMonthly: 0 });

  // ตั้งต้นจากข้อเท็จจริง: engine ไม่ได้ให้เหตุผลเรื่องหนี้เดิมมาในเคสนี้
  const engineMentions = snapshot.reasonCodes.filter((reason) => reason.message.includes("หนี้เดิม"));
  assert.equal(engineMentions.length, 0);

  // ดังนั้นข้อความที่ผู้สมัครเห็นก็ต้องไม่มีเรื่องหนี้เดิมเลย
  assert.ok(
    !applicantFacingText(snapshot).includes("หนี้เดิม"),
    "ชั้นแสดงผลเติมเหตุผลเรื่องหนี้เดิมเข้ามาเอง ทั้งที่ผลการประเมินไม่ได้ระบุ"
  );
  assert.ok(!String(primaryReasonOf(snapshot) ?? "").includes("DEBT"));
});

test("ทุกเหตุผลที่แสดงต่อผู้สมัครสืบกลับไปที่ reason codes ของ Snapshot ได้", async () => {
  for (const debt of [0, 2500]) {
    const snapshot = await seed({ existingDebtMonthly: debt });
    const vm = resultViewModel(snapshot);

    const fromSnapshot = new Map(snapshot.reasonCodes.map((reason) => [reason.code, reason.message]));

    for (const reason of [...vm.blockingReasons, ...vm.watchReasons, ...vm.reasonCodes]) {
      assert.ok(fromSnapshot.has(reason.code), `เหตุผล ${reason.code} ไม่ได้มาจาก Snapshot`);
      // ข้อความต้องเป็นของ engine คำต่อคำ ไม่ใช่ถ้อยคำที่ชั้นแสดงผลเรียบเรียงใหม่
      assert.equal(reason.message, fromSnapshot.get(reason.code));
    }

    // หัวข้อตั้งต้นของการให้คำปรึกษาก็ต้องเป็นรหัสที่มาจาก Snapshot เท่านั้น
    const primary = primaryReasonOf(snapshot);
    if (primary !== null) assert.ok(fromSnapshot.has(primary));
  }
});

test("ชั้นแสดงผลไม่ตั้งเกณฑ์หนี้เดิมหรือคำนวณความสามารถรับภาระเอง", () => {
  const surfaces = [
    "app/lib/result/view-model.ts",
    "app/lib/result/report-model.ts",
    "app/lib/fa/advisory-service.ts",
    "app/apply/[applicationId]/advisory/page.tsx",
    "components/frontoffice/RouteResult.tsx",
    "components/frontoffice/CapacityBar.tsx",
    "components/frontoffice/FinancialPassportCard.tsx",
    "components/frontoffice/pdf/ReadinessReport.tsx",
    "components/frontoffice/FaAdvisoryForm.tsx"
  ];

  for (const path of surfaces) {
    const source = fs.readFileSync(path, "utf8");
    assert.ok(
      !/existingDebt/i.test(source),
      `${path} ต้องไม่อ่านภาระหนี้เดิมเอง — เหตุผลต้องมาจาก reason codes ของ Snapshot`
    );
  }

  // แบบฟอร์มลงทะเบียนเก็บค่านี้ได้ แต่ต้องเป็นการเก็บเพื่อส่งต่อ ไม่ใช่การตัดสิน
  const wizard = fs.readFileSync("components/frontoffice/RegistrationWizard.tsx", "utf8");
  const debtLines = wizard
    .split("\n")
    .filter((line) => /existingDebt/i.test(line))
    .join("\n");
  assert.ok(debtLines.length > 0, "แบบฟอร์มยังต้องเก็บภาระหนี้เดิมเป็นข้อมูลประกอบ");
  for (const pattern of [/[<>]=?\s*\d/, /\bif\b/, /\?\s*[^:]+:/]) {
    assert.ok(
      !pattern.test(debtLines),
      `แบบฟอร์มต้องไม่ตั้งเงื่อนไขหรือเกณฑ์กับภาระหนี้เดิม พบ: ${debtLines}`
    );
  }
});

test("ภาระหนี้เดิมยังถูกส่งถึง engine ครบถ้วนตามสัญญาของ input", async () => {
  const { toEngineInput } = await import("../app/lib/registration/validation.ts");
  const input = {
    ...DEMO_CASES.C.input,
    financial: { ...DEMO_CASES.C.input.financial, existingDebtMonthly: 2500 }
  };

  // ชั้นบนไม่ตัดค่านี้ทิ้ง และไม่แปลงความหมายก่อนส่ง
  assert.equal(toEngineInput(input).existingDebt, 2500);
});
