/**
 * Neon / managed PostgreSQL smoke test
 *
 * เดินทุกเส้นทางที่เขียนและอ่านฐานข้อมูลจริงหนึ่งรอบ บนฐานข้อมูลที่จัดการโดยผู้ให้บริการ
 * PGlite ในเครื่องเป็น PostgreSQL จริงก็จริง แต่ไม่ได้พิสูจน์เรื่อง connection pooling,
 * สิทธิ์ของผู้ใช้ฐานข้อมูล, ความหน่วงข้ามเครือข่าย หรือพฤติกรรมของ driver จริง
 *
 * รันด้วย:
 *   DATABASE_URL="postgresql://..." node scripts/neon-smoke-test.mjs
 *
 * สคริปต์นี้เขียนข้อมูลจริงลงฐานข้อมูลที่ชี้ไป ห้ามรันกับฐานข้อมูลที่มีข้อมูลจริงของผู้ใช้
 */
import { competitionConfig } from "../app/lib/config/competition.ts";
import { DEMO_CASES } from "../app/lib/demo/cases.ts";
import { getDb } from "../app/lib/db/client.ts";
import { evaluateApplication } from "../app/lib/evaluation/evaluate-application.ts";
import { getSnapshotById, listEvaluationSnapshots } from "../app/lib/evaluation/snapshot.ts";
import { listFaCases, requestFaAdvisory } from "../app/lib/fa/advisory-service.ts";
import {
  fiHandoffStatuses,
  listFiConsents,
  listFiSelections,
  recordFiConsent,
  setFiSelections
} from "../app/lib/fi/fi-repository.ts";
import { createApplication, getApplication, updateApplication } from "../app/lib/registration/application-service.ts";
import { listConsents, recordCompetitionConsent } from "../app/lib/registration/consent-service.ts";
import { RETENTION_BLOCK_CODE, dryRunRetention } from "../app/lib/retention/retention-service.ts";

if (!process.env.DATABASE_URL) {
  console.error("NEON_SMOKE_TEST = BLOCKED_BY_MISSING_DATABASE_URL");
  console.error("");
  console.error("ต้องตั้งค่า DATABASE_URL ให้ชี้ไปยัง managed PostgreSQL ก่อน เช่น:");
  console.error('  DATABASE_URL="postgresql://user:password@host/db?sslmode=require"');
  console.error("");
  console.error("จากนั้นรัน:");
  console.error("  npm run db:migrate      # ถ้ายังไม่เคย migrate ฐานข้อมูลนี้");
  console.error("  npm run smoke:neon");
  process.exit(2);
}

const steps = [];
let failed = 0;

async function step(name, run) {
  const startedAt = Date.now();
  try {
    const detail = await run();
    steps.push({ name, status: "PASS", ms: Date.now() - startedAt, detail: detail ?? "" });
  } catch (error) {
    failed += 1;
    steps.push({
      name,
      status: "FAIL",
      ms: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sql = getDb();
console.log(`driver: ${sql.driver}`);
assert(sql.driver === "neon", "ต้องใช้ไดรเวอร์ neon — ตรวจว่า DATABASE_URL ถูกอ่านจริง");

let ready = null;
let build = null;
let referenceSnapshot = null;
let fiSnapshotId = null;

await step("1. migration apply", async () => {
  await sql.migrate();
  const rows = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name
  `;
  const names = rows.map((row) => String(row.table_name));
  for (const required of [
    "applications",
    "application_profiles",
    "basic_eligibility",
    "income_evidence",
    "financial_inputs",
    "consent_records",
    "evaluation_snapshots",
    "fi_selections",
    "fi_consent_records",
    "fa_cases",
    "fa_case_events",
    "status_history"
  ]) {
    assert(names.includes(required), `ไม่พบตาราง ${required}`);
  }
  const columns = await sql`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'fi_selections'
  `;
  assert(
    columns.some((row) => String(row.column_name) === "reference_snapshot_id"),
    "migration 0002 ยังไม่ถูก apply — ไม่พบคอลัมน์ reference_snapshot_id"
  );
  return `${names.length} tables`;
});

await step("2. create Application ID", async () => {
  ready = await createApplication();
  assert(/^RTO-C26-\d{6}$/.test(ready.id), `รูปแบบเลขที่ใบสมัครไม่ถูกต้อง: ${ready.id}`);
  assert(ready.status === "DRAFT", "ใบสมัครใหม่ต้องเริ่มที่ DRAFT");
  return ready.id;
});

await step("3. competition consent append", async () => {
  const consent = await recordCompetitionConsent(ready.id);
  assert(consent.version === competitionConfig.consentVersion, "เวอร์ชันความยินยอมไม่ตรง");
  const all = await listConsents(ready.id);
  assert(all.length === 1, `ต้องมีความยินยอม 1 รายการ พบ ${all.length}`);
  return consent.version;
});

await step("4-6. save profile, Basic Eligibility and Income Evidence", async () => {
  await updateApplication(ready.id, DEMO_CASES.D.input);
  const saved = await getApplication(ready.id);
  assert(saved.profile !== null, "โปรไฟล์ไม่ถูกบันทึก");
  assert(saved.profile.phoneVerificationStatus === "NOT_REQUIRED_COMPETITION", "สถานะยืนยันเบอร์ไม่ตรง");
  assert(saved.eligibility !== null, "คุณสมบัติเบื้องต้นไม่ถูกบันทึก");
  assert(saved.financial.incomeEntries.length > 0, "หลักฐานรายได้ไม่ถูกบันทึก");
  return `${saved.financial.incomeEntries.length} income entries`;
});

await step("7. create reference Evaluation Snapshot", async () => {
  referenceSnapshot = await evaluateApplication(ready.id);
  assert(referenceSnapshot.route === "READY FOR FI", `เส้นทางที่ได้คือ ${referenceSnapshot.route}`);
  assert(referenceSnapshot.inputVersion === 1, "เวอร์ชันข้อมูลของ Snapshot แรกต้องเป็น 1");
  return `${referenceSnapshot.id} · ${referenceSnapshot.route}`;
});

await step("8. read reference snapshot", async () => {
  const stored = await getSnapshotById(referenceSnapshot.id);
  assert(stored !== null, "อ่าน Snapshot กลับมาไม่ได้");
  assert(
    stored.availableCash.toFixed(2) === referenceSnapshot.availableCash.toFixed(2),
    "ค่า availableCash ที่อ่านกลับไม่ตรง"
  );
  assert(stored.reasonCodes.length > 0, "reason codes หายไปหลังอ่านกลับ");
  return `${stored.reasonCodes.length} reason codes`;
});

await step("9-10. FI selection and FI-specific Evaluation Snapshot", async () => {
  const { selections, outcomes } = await setFiSelections(ready.id, ["IBANK_GREEN_LIFE", "KKP_EV"]);
  assert(selections.length === 2, "ต้องบันทึกการเลือกได้ 2 แห่ง");
  assert(
    selections.every((row) => row.referenceSnapshotId === referenceSnapshot.id),
    "ทุกแห่งต้องอ้างผลอ้างอิงใบเดียวกัน"
  );
  const kkp = outcomes.find((row) => row.fiId === "KKP_EV");
  assert(kkp.materialChange === true, "เงื่อนไขของ KKP ต้องต่างอย่างมีนัยสำคัญ");
  assert(kkp.snapshot.route === "NO NEW DEBT", `KKP ควรได้ NO NEW DEBT แต่ได้ ${kkp.snapshot.route}`);
  fiSnapshotId = outcomes.find((row) => row.fiId === "IBANK_GREEN_LIFE").snapshot.id;
  const history = await listEvaluationSnapshots(ready.id);
  assert(history.length === 3, `ควรมี Snapshot 3 ใบ พบ ${history.length}`);
  return `iBank READY · KKP NO NEW DEBT · ${history.length} snapshots`;
});

await step("11. FI consent — allowed only where the FI result is READY", async () => {
  const consent = await recordFiConsent(ready.id, "IBANK_GREEN_LIFE");
  assert(consent.accepted === true, "ความยินยอมของ iBank ต้องบันทึกได้");

  let rejected = false;
  try {
    await recordFiConsent(ready.id, "KKP_EV");
  } catch {
    rejected = true;
  }
  assert(rejected, "KKP ที่ผลเป็น NO NEW DEBT ต้องให้ความยินยอมไม่ได้");

  const consents = await listFiConsents(ready.id);
  assert(consents.length === 1, `ต้องมีความยินยอม 1 รายการ พบ ${consents.length}`);
  return "iBank consented · KKP refused";
});

await step("12. FI handoff read", async () => {
  const statuses = await fiHandoffStatuses(ready.id);
  assert(statuses.statuses.length === 2, "ต้องมีสถานะของทั้งสองแห่ง");
  const ibank = statuses.statuses.find((row) => row.fiId === "IBANK_GREEN_LIFE");
  const kkp = statuses.statuses.find((row) => row.fiId === "KKP_EV");
  assert(ibank.handoff.allowed === true, "iBank ควรส่งต่อได้");
  assert(kkp.handoff.allowed === false, "KKP ต้องส่งต่อไม่ได้");
  assert(ibank.evaluationSnapshotId === fiSnapshotId, "สถานะต้องผูกกับ Snapshot ของแห่งนั้น");
  const selections = await listFiSelections(ready.id, { activeOnly: true });
  assert(selections.length === 2, "การเลือกที่ยังใช้งานต้องมี 2 แห่ง");
  return "iBank allowed · KKP blocked";
});

await step("13. F.A case create and read", async () => {
  build = await createApplication();
  await recordCompetitionConsent(build.id);
  await updateApplication(build.id, DEMO_CASES.B.input);
  const snapshot = await evaluateApplication(build.id);
  assert(snapshot.route === "BUILD READINESS", `ควรได้ BUILD READINESS แต่ได้ ${snapshot.route}`);

  const faCase = await requestFaAdvisory({
    applicationId: build.id,
    preferredContactTime: "AFTERNOON",
    preferredChannel: "LINE"
  });
  assert(/^FA-C26-\d{6}$/.test(faCase.id), `รูปแบบเลขที่เคสไม่ถูกต้อง: ${faCase.id}`);
  assert(faCase.evaluationSnapshotId === snapshot.id, "เคสต้องผูกกับ Snapshot ที่ประเมินไว้");

  const cases = await listFaCases(build.id);
  assert(cases.length === 1, "ต้องอ่านเคสกลับมาได้ 1 เคส");
  assert(cases[0].reasonCodes.length > 0, "reason codes ของเคสหายไปหลังอ่านกลับ");
  return `${faCase.id} · ${faCase.route}`;
});

await step("14. retention dry-run", async () => {
  const blocked = await dryRunRetention({ now: new Date("2099-01-01T00:00:00Z"), env: {} });
  assert(blocked.status === "BLOCKED", "ไม่มี cutoff ต้องถูก block");
  assert(blocked.code === RETENTION_BLOCK_CODE, `block code ไม่ถูกต้อง: ${blocked.code}`);
  assert(blocked.anonymized.length === 0, "blocked retention ต้องไม่ลบอะไร");
  assert(blocked.wouldAnonymize.length === 0, "blocked retention ต้องไม่อ่าน candidate จากฐานข้อมูล");

  const policy = {
    competitionCutoffAt: "2098-01-01T00:00:00.000Z",
    retentionDays: competitionConfig.piiRetentionDays,
    cutoffSource: "COMPETITION_CUTOFF_AT"
  };
  const due = await dryRunRetention({ now: new Date("2099-01-01T00:00:00Z"), policy });
  assert(due.status === "OK", "เมื่อระบุ policy ชัดเจน dry-run ต้องทำงานได้");
  assert(due.due === true, "เลยกำหนดแล้วต้อง due");
  assert(due.wouldAnonymize.length >= 2, `ควรพบใบที่ต้องลบอย่างน้อย 2 ใบ พบ ${due.wouldAnonymize.length}`);
  assert(due.anonymized.length === 0, "dry run ต้องไม่ลบอะไร");

  const application = await getApplication(ready.id);
  assert(application.piiAnonymizedAt === null, "dry run ต้องไม่ประทับเวลาการลบ");
  assert(application.profile.displayName === DEMO_CASES.D.input.profile.displayName, "dry run ต้องไม่แก้ชื่อ");
  return `${RETENTION_BLOCK_CODE} · ${due.wouldAnonymize.length} would anonymize · 0 mutated`;
});

console.log("");
for (const row of steps) {
  const mark = row.status === "PASS" ? "PASS" : "FAIL";
  console.log(`[${mark}] ${row.name} (${row.ms}ms)${row.detail ? ` — ${row.detail}` : ""}`);
}

console.log("");
if (failed === 0) {
  console.log(`NEON_SMOKE_TEST = PASS (${steps.length}/${steps.length} steps)`);
  process.exit(0);
}
console.log(`NEON_SMOKE_TEST = FAIL (${failed}/${steps.length} steps failed)`);
process.exit(1);
