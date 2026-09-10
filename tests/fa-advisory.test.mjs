import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { competitionConfig } from "../app/lib/config/competition.ts";
import { DEMO_CASES } from "../app/lib/demo/cases.ts";
import { evaluateApplication } from "../app/lib/evaluation/evaluate-application.ts";
import {
  FA_ADVISORY_NAME,
  FA_DUPLICATE_ACTIVE_REASON,
  FA_ROUTE_NOT_ELIGIBLE_REASON,
  faProgressFor,
  formatFaCaseId,
  getFaCase,
  listFaCaseEvents,
  listFaCases,
  primaryReasonOf,
  requestFaAdvisory,
  updateFaCaseStatus
} from "../app/lib/fa/advisory-service.ts";
import { createApplication, getApplication, updateApplication } from "../app/lib/registration/application-service.ts";
import { recordCompetitionConsent } from "../app/lib/registration/consent-service.ts";
import { resultViewModel } from "../app/lib/result/view-model.ts";

/**
 * F.A Readiness Advisory เป็นบริการก่อนขอสินเชื่อ
 *
 * เปิดให้เฉพาะเส้นทางที่การเพิ่มหนี้ตอนนี้ยังไม่ใช่คำตอบ
 * และต้องไม่พาผู้สมัครไปเข้าใจว่านี่คือช่องทางลัดสู่การอนุมัติ
 */
async function seed(caseId, overrides = {}) {
  const application = await createApplication();
  await recordCompetitionConsent(application.id);
  const input = DEMO_CASES[caseId].input;
  await updateApplication(application.id, {
    ...input,
    financial: { ...input.financial, ...(overrides.financial ?? {}) }
  });
  const snapshot = await evaluateApplication(application.id);
  return { applicationId: application.id, snapshot };
}

test("เลขที่เคสเป็นลำดับจริงในรูปแบบ FA-C26-000001", async () => {
  assert.equal(formatFaCaseId(1), "FA-C26-000001");
  assert.equal(competitionConfig.faCaseIdPrefix, "FA-C26");

  const { applicationId } = await seed("B");
  const faCase = await requestFaAdvisory({
    applicationId,
    preferredContactTime: "MORNING",
    preferredChannel: "PHONE"
  });
  assert.match(faCase.id, /^FA-C26-\d{6}$/);
});

test("เคสเก็บภาพรวมการเงินจาก Snapshot ที่ผูกไว้ ไม่ให้กรอกซ้ำ", async () => {
  const { applicationId, snapshot } = await seed("C");
  assert.equal(snapshot.route, "NO NEW DEBT");

  const faCase = await requestFaAdvisory({
    applicationId,
    preferredContactTime: "EVENING",
    preferredChannel: "LINE"
  });

  assert.equal(faCase.applicationId, applicationId);
  assert.equal(faCase.evaluationSnapshotId, snapshot.id);
  assert.equal(faCase.route, snapshot.route);
  assert.equal(faCase.tier, snapshot.tier);
  assert.equal(faCase.preScore, snapshot.preScore);
  assert.equal(faCase.affordabilityPassed, snapshot.affordabilityPassed);
  assert.equal(faCase.availableCash.toFixed(2), snapshot.availableCash.toFixed(2));
  assert.equal(faCase.estimatedObligation.toFixed(2), snapshot.estimatedObligation.toFixed(2));
  assert.equal(faCase.residual.toFixed(2), snapshot.residual.toFixed(2));
  assert.equal(faCase.affordabilityGap.toFixed(2), snapshot.affordabilityGap.toFixed(2));
  assert.equal(faCase.evidenceReliability, snapshot.incomeEvidenceReliability);
  assert.equal(faCase.primaryReason, primaryReasonOf(snapshot));
  assert.ok(faCase.reasonCodes.length > 0);
  assert.equal(faCase.preferredContactTime, "EVENING");
  assert.equal(faCase.preferredChannel, "LINE");
  assert.equal(faCase.status, "NEW");
});

test("เส้นทาง BUILD READINESS และ NO NEW DEBT ขอคำปรึกษาได้", async () => {
  for (const [caseId, expected] of [
    ["B", "BUILD READINESS"],
    ["C", "NO NEW DEBT"]
  ]) {
    const { applicationId, snapshot } = await seed(caseId);
    assert.equal(snapshot.route, expected);
    const faCase = await requestFaAdvisory({
      applicationId,
      preferredContactTime: "AFTERNOON",
      preferredChannel: "PHONE"
    });
    assert.equal(faCase.route, expected);
  }
});

test("เส้นทาง READY FOR FI ไม่ใช่กลุ่มเป้าหมายของบริการนี้", async () => {
  const { applicationId, snapshot } = await seed("A");
  assert.equal(snapshot.route, "READY FOR FI");

  await assert.rejects(
    () =>
      requestFaAdvisory({
        applicationId,
        preferredContactTime: "MORNING",
        preferredChannel: "PHONE"
      }),
    { message: FA_ROUTE_NOT_ELIGIBLE_REASON }
  );
});

test("เปิดเคสซ้ำไม่ได้ระหว่างที่ยังมีเคสดำเนินการอยู่", async () => {
  const { applicationId } = await seed("B");
  const first = await requestFaAdvisory({
    applicationId,
    preferredContactTime: "MORNING",
    preferredChannel: "PHONE"
  });

  await assert.rejects(
    () =>
      requestFaAdvisory({
        applicationId,
        preferredContactTime: "EVENING",
        preferredChannel: "LINE"
      }),
    { message: FA_DUPLICATE_ACTIVE_REASON }
  );

  // ปิดเคสแล้วจึงเปิดใหม่ได้
  await updateFaCaseStatus(first.id, "CLOSED", { note: "ให้คำปรึกษาครบแล้ว" });
  const second = await requestFaAdvisory({
    applicationId,
    preferredContactTime: "EVENING",
    preferredChannel: "LINE"
  });
  assert.notEqual(second.id, first.id);
  assert.equal((await listFaCases(applicationId)).length, 2);
});

test("สถานะเดินตามลำดับที่กำหนด และทุกก้าวถูกบันทึกเป็นเหตุการณ์", async () => {
  const { applicationId } = await seed("B");
  const faCase = await requestFaAdvisory({
    applicationId,
    preferredContactTime: "MORNING",
    preferredChannel: "PHONE"
  });

  for (const status of ["ACCEPTED", "CONTACTED", "ADVISORY_IN_PROGRESS", "FOLLOW_UP", "CLOSED"]) {
    const updated = await updateFaCaseStatus(faCase.id, status, { note: `ก้าวไปยัง ${status}` });
    assert.equal(updated.status, status);
  }

  const events = await listFaCaseEvents(faCase.id);
  assert.deepEqual(
    events.map((event) => event.toStatus),
    ["NEW", "ACCEPTED", "CONTACTED", "ADVISORY_IN_PROGRESS", "FOLLOW_UP", "CLOSED"]
  );
  assert.equal(events[1].fromStatus, "NEW");

  // เคสที่ปิดแล้วเปลี่ยนสถานะต่อไม่ได้
  await assert.rejects(() => updateFaCaseStatus(faCase.id, "FOLLOW_UP"), { message: /ปิดแล้ว/ });
});

test("การประเมินใหม่สร้าง Snapshot ใหม่ และเคสยังชี้ที่ใบเดิม", async () => {
  const { applicationId, snapshot } = await seed("C");
  const faCase = await requestFaAdvisory({
    applicationId,
    preferredContactTime: "MORNING",
    preferredChannel: "PHONE"
  });

  // ผู้สมัครสร้างความพร้อมเพิ่ม: ปิดหนี้เดิมและมีรายได้ที่มีหลักฐานมากขึ้น แล้วประเมินใหม่
  const application = await getApplication(applicationId);
  await updateApplication(applicationId, {
    profile: application.profile,
    eligibility: application.eligibility,
    financial: {
      ...application.financial,
      existingDebtMonthly: 0,
      incomeEntries: [{ channel: "PLATFORM", dailyAmount: 1900, hasTransactionEvidence: true }]
    }
  });
  const reassessed = await evaluateApplication(applicationId);

  assert.notEqual(reassessed.id, snapshot.id, "การประเมินใหม่ต้องได้ Snapshot ใบใหม่");
  assert.equal(reassessed.inputVersion, snapshot.inputVersion + 1);

  const stored = await getFaCase(faCase.id);
  assert.equal(stored.evaluationSnapshotId, snapshot.id, "เคสต้องยังชี้ที่ผลตอนเปิดคำขอ");
  // ตัวเลขที่เคสบันทึกไว้ต้องเป็นของตอนเปิดคำขอ ไม่ถูกเขียนทับด้วยผลใหม่
  assert.equal(stored.route, snapshot.route);
  assert.equal(stored.availableCash.toFixed(2), snapshot.availableCash.toFixed(2));
  assert.equal(stored.affordabilityGap.toFixed(2), snapshot.affordabilityGap.toFixed(2));

  const progress = await faProgressFor(faCase.id);
  assert.equal(progress.reassessed, true);
  assert.equal(progress.baseline.snapshotId, snapshot.id);
  assert.equal(progress.latest.snapshotId, reassessed.id);
  assert.ok(progress.gapClosedBy > 0, "ช่องว่างต้องแคบลงหลังสร้างความพร้อมเพิ่ม");
  assert.equal(progress.routeChanged, true);
  assert.equal(progress.latest.route, "READY FOR FI");
});

test("ผลการประเมินของใบสมัครอื่นใช้เปิดเคสไม่ได้", async () => {
  const mine = await seed("B");
  const theirs = await seed("C");

  await assert.rejects(
    () =>
      requestFaAdvisory({
        applicationId: mine.applicationId,
        preferredContactTime: "MORNING",
        preferredChannel: "PHONE",
        evaluationSnapshotId: theirs.snapshot.id
      }),
    { message: /ไม่ได้เป็นของใบสมัครนี้/ }
  );
});

test("ช่วงเวลาและช่องทางนอกรายการถูกปฏิเสธ", async () => {
  const { applicationId } = await seed("B");

  await assert.rejects(
    () => requestFaAdvisory({ applicationId, preferredContactTime: "MIDNIGHT", preferredChannel: "PHONE" }),
    { message: /ช่วงเวลา/ }
  );
  await assert.rejects(
    () => requestFaAdvisory({ applicationId, preferredContactTime: "MORNING", preferredChannel: "SMS" }),
    { message: /ช่องทาง/ }
  );
});

const FA_SOURCES = [
  ["advisory-service", "app/lib/fa/advisory-service.ts"],
  ["advisory page", "app/apply/[applicationId]/advisory/page.tsx"],
  ["advisory form", "components/frontoffice/FaAdvisoryForm.tsx"],
  ["fa-request route", "app/api/applications/[applicationId]/fa-request/route.ts"]
];

test("บริการนี้ไม่พกคำหรือสนามของระบบหลังอนุมัติเข้ามา", () => {
  // ชื่อสาธารณะต้องเป็นบริการก่อนสินเชื่อ ไม่ใช่การดูแลหลังอนุมัติ
  assert.equal(FA_ADVISORY_NAME, "F.A. ให้คำปรึกษาเพื่อสร้างความพร้อมก่อนสินเชื่อ");

  // แนวคิดของระบบหลังอนุมัติทั้งหมด ต้องไม่ปรากฏในโมดูลนี้เลย
  //
  // ตรวจแบบเทียบคำเต็ม ไม่ใช่สตริงย่อย เพราะคำอย่าง "disclaimers" มี "claim" อยู่ข้างใน
  // ถ้าตรวจแบบสตริงย่อย จะกลายเป็นการห้ามคำที่ถูกต้องอยู่แล้ว แล้วนำไปสู่การปิดเทสต์ทิ้ง
  const forbidden = [
    "dpd",
    "npl",
    "promptcure",
    "prompt cure",
    "restructure",
    "restructuring",
    "actualsweep",
    "actual sweep",
    "paymentledger",
    "payment ledger",
    "claim",
    "claims",
    "recovery",
    "childelg",
    "child elg",
    "child lg",
    "e-lg",
    "elg",
    "repossession"
  ];

  for (const [name, path] of FA_SOURCES) {
    const words = fs.readFileSync(path, "utf8").toLowerCase().split(/[^a-z-]+/);
    const present = new Set(words);
    for (const term of forbidden) {
      assert.ok(!present.has(term), `${name} ต้องไม่อ้างถึง "${term}" ซึ่งเป็นเรื่องของระบบหลังอนุมัติ`);
    }
  }
});

test("คำขอเก็บเฉพาะความสะดวกในการติดต่อกับผลการประเมิน ไม่มีข้อมูลอ่อนไหว", async () => {
  const { applicationId } = await seed("B");
  const faCase = await requestFaAdvisory({
    applicationId,
    preferredContactTime: "MORNING",
    preferredChannel: "PHONE"
  });

  // ทุกสนามที่เคสเก็บต้องเป็นสนามที่ประกาศไว้ ไม่มีสนามอ่อนไหวแฝงเข้ามา
  const allowed = new Set([
    "id",
    "applicationId",
    "evaluationSnapshotId",
    "route",
    "tier",
    "preScore",
    "affordabilityPassed",
    "availableCash",
    "estimatedObligation",
    "residual",
    "affordabilityGap",
    "evidenceReliability",
    "primaryReason",
    "reasonCodes",
    "preferredContactTime",
    "preferredChannel",
    "status",
    "createdAt",
    "updatedAt"
  ]);
  for (const key of Object.keys(faCase)) {
    assert.ok(allowed.has(key), `เคสไม่ควรมีสนาม ${key}`);
  }

  // โครงสร้างตารางต้องไม่มีคอลัมน์สำหรับข้อมูลอ่อนไหว
  const migration = fs.readFileSync("db/migrations/0001_competition_registration.sql", "utf8");
  const faTable = migration.slice(
    migration.indexOf("create table if not exists fa_cases"),
    migration.indexOf("create index if not exists fa_cases_status_idx")
  );
  for (const term of ["national_id", "bank_account", "statement", "id_card", "license_image", "bureau", "health"]) {
    assert.ok(!faTable.includes(term), `ตาราง fa_cases ต้องไม่มีคอลัมน์ ${term}`);
  }
});

test("หน้าคำขอมีข้อความอธิบายขอบเขตตามที่กำหนด", () => {
  const page = fs.readFileSync("app/apply/[applicationId]/advisory/page.tsx", "utf8");
  const service = fs.readFileSync("app/lib/fa/advisory-service.ts", "utf8");

  assert.ok(page.includes("FA_ADVISORY_NAME"), "หน้าต้องใช้ชื่อบริการจากแหล่งเดียว");
  assert.ok(page.includes("FA_ADVISORY_COPY.explanation"), "หน้าต้องแสดงข้อความอธิบายขอบเขต");
  assert.ok(
    service.includes(
      "คำขอนี้เป็นการขอคำปรึกษาเพื่อพัฒนาความพร้อมก่อนเข้าสู่กระบวนการสินเชื่อ ไม่ใช่การปรับโครงสร้างหนี้ และไม่ใช่กระบวนการแก้ไขหนี้หลังอนุมัติ"
    ),
    "ข้อความอธิบายขอบเขตต้องตรงตามที่กำหนด"
  );
});

test("เส้นทาง READY ไม่เสนอคำปรึกษาเป็นขั้นตอนหลัก", async () => {
  const { snapshot } = await seed("A");
  const vm = resultViewModel(snapshot);

  assert.equal(vm.hero.route, "READY FOR FI");
  // ขั้นตอนหลักของ READY ยังเป็นรายงานความพร้อมแล้วไปเปรียบเทียบสถาบันการเงิน
  const primary = vm.ctas.filter((cta) => cta.tone === "primary");
  assert.equal(primary.length, 1);
  assert.equal(primary[0].id, "readiness-report");
  assert.ok(
    !vm.ctas.some((cta) => cta.id === "fa-advisory"),
    "READY ต้องไม่มีคำปรึกษาอยู่ในชุดปุ่มหลักของหน้าผลลัพธ์"
  );
  assert.ok(vm.ctas.some((cta) => cta.id === "fi-match"));
});

test("เส้นทางที่ยังไม่พร้อมเสนอคำปรึกษาเป็นขั้นตอนหลัก", async () => {
  for (const caseId of ["B", "C"]) {
    const { snapshot } = await seed(caseId);
    const vm = resultViewModel(snapshot);
    const primary = vm.ctas.filter((cta) => cta.tone === "primary");
    assert.equal(primary[0].id, "fa-advisory", `${snapshot.route} ต้องเสนอคำปรึกษาเป็นขั้นตอนหลัก`);
    assert.equal(primary[0].label, "F.A. ให้คำปรึกษาเพื่อสร้างความพร้อมก่อนสินเชื่อ");
    assert.ok(!vm.ctas.some((cta) => cta.id === "fi-match"));
  }
});
