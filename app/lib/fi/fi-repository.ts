import { canHandoffToFi, competitionConfig } from "../config/competition.ts";
import { ensureSchema, iso, rowId, str } from "../db/schema.ts";
import { getLatestEvaluationSnapshot, getSnapshotById } from "../evaluation/snapshot.ts";
import { setStatus } from "../registration/application-service.ts";
import type { EvaluationSnapshot, FinancingScenario } from "../registration/types.ts";
import { getFiProduct } from "./catalogue.ts";
import { assertSelectionAllowed, evaluateForFi, handoffDecisionFor } from "./selection-service.ts";

export const FI_CONSENT_VERSION = "RTO-FI-1.0";

export type StoredFiSelection = {
  id: string;
  applicationId: string;
  fiId: string;
  slot: number;
  evaluationSnapshotId: string | null;
  /** ผลที่ผู้สมัครเห็นอยู่ตอนเลือก FI แห่งนี้ ใช้เป็นฐานเปรียบเทียบ */
  referenceSnapshotId: string | null;
  financingScenario: FinancingScenario | null;
  materialChange: boolean;
  active: boolean;
  createdAt: string;
};

export type StoredFiConsent = {
  id: string;
  applicationId: string;
  fiId: string;
  version: string;
  accepted: boolean;
  acceptedAt: string;
};

function parseScenario(value: unknown): FinancingScenario | null {
  if (!value) return null;
  if (typeof value === "object") return value as FinancingScenario;
  try {
    return JSON.parse(String(value)) as FinancingScenario;
  } catch {
    return null;
  }
}

function hydrateSelection(row: Record<string, unknown>): StoredFiSelection {
  return {
    id: str(row.id),
    applicationId: str(row.application_id),
    fiId: str(row.fi_id),
    slot: Number(row.slot),
    evaluationSnapshotId: row.evaluation_snapshot_id ? str(row.evaluation_snapshot_id) : null,
    referenceSnapshotId: row.reference_snapshot_id ? str(row.reference_snapshot_id) : null,
    financingScenario: parseScenario(row.financing_scenario),
    materialChange: row.material_change === true || row.material_change === "true",
    active: row.active === true || row.active === "true",
    createdAt: iso(row.created_at)
  };
}

/**
 * ผลอ้างอิงของใบสมัคร — ผลภายใต้เงื่อนไขของผู้สมัครเอง ไม่ใช่ของสถาบันการเงินแห่งใด
 *
 * เมื่อเคยเลือก FI มาก่อน ผลล่าสุดจะเป็นผลภายใต้เงื่อนไขของ FI แห่งนั้น
 * ซึ่งใช้เป็นฐานตัดสินรอบใหม่ไม่ได้ เพราะจะทำให้เงื่อนไขของแห่งหนึ่งไปกำหนดสิทธิ์ของอีกแห่ง
 * จึงย้อนกลับไปที่ผลอ้างอิงที่บันทึกไว้ตอนเลือกครั้งแรกเสมอ
 */
export async function referenceSnapshotFor(applicationId: string): Promise<EvaluationSnapshot | null> {
  const selections = await listFiSelections(applicationId);
  for (const selection of selections) {
    if (!selection.referenceSnapshotId) continue;
    const snapshot = await getSnapshotById(selection.referenceSnapshotId);
    if (snapshot) return snapshot;
  }
  return getLatestEvaluationSnapshot(applicationId);
}

/**
 * บันทึกการเลือกสถาบันการเงิน
 *
 * ทุก FI ที่เลือกจะถูกประเมินภายใต้เงื่อนไขของตัวเอง ถ้าเงื่อนไขต่างจากที่ประเมินไว้
 * อย่างมีนัยสำคัญ จะเกิด Snapshot ใหม่ผ่าน Frozen Engine แล้วผูกกับ FI รายนั้น
 *
 * ประวัติเป็น append-only: การเปลี่ยน FI จะปิดแถวเดิม (active = false) ไม่ลบทิ้ง
 */
export async function setFiSelections(
  applicationId: string,
  fiIds: string[]
): Promise<{ selections: StoredFiSelection[]; outcomes: Awaited<ReturnType<typeof evaluateForFi>>[] }> {
  const sql = await ensureSchema();

  const reference = await referenceSnapshotFor(applicationId);
  if (!reference) throw new Error("ยังไม่มีผลการประเมิน จึงเลือกสถาบันการเงินไม่ได้");

  // ด่านฝั่งเซิร์ฟเวอร์: เส้นทางต้องเป็น READY, ไม่เกิน 2, ไม่ซ้ำ, และรองรับเงินดาวน์ 0%
  assertSelectionAllowed(reference, fiIds);

  await sql`update fi_selections set active = false where application_id = ${applicationId} and active = true`;

  const outcomes = [];
  const selections: StoredFiSelection[] = [];

  for (const [index, fiId] of fiIds.entries()) {
    const fi = getFiProduct(fiId);
    if (!fi) throw new Error(`ไม่พบสถาบันการเงิน ${fiId}`);

    // ประเมินใหม่เมื่อเงื่อนไขของ FI รายนี้ต่างอย่างมีนัยสำคัญ
    const outcome = await evaluateForFi(applicationId, fi, reference);
    outcomes.push(outcome);

    const id = rowId("fisel");
    const [row] = await sql`
      insert into fi_selections (
        id, application_id, fi_id, slot, evaluation_snapshot_id, reference_snapshot_id,
        financing_scenario, material_change, active
      ) values (
        ${id}, ${applicationId}, ${fiId}, ${index + 1}, ${outcome.snapshot.id}, ${reference.id},
        ${JSON.stringify(outcome.financingScenario)}, ${outcome.materialChange}, ${true}
      )
      returning *
    `;
    selections.push(hydrateSelection(row));
  }

  // ไม่ต้องคืนค่าอะไรที่นี่ — การประเมินของ FI ใช้ override ต่อการเรียก
  // ข้อมูลใบสมัครจึงไม่เคยถูกเขียนทับด้วยเงื่อนไขของ FI แห่งใดเลย

  if (fiIds.length > 0) await setStatus(applicationId, "FI_SELECTED", `เลือกสถาบันการเงิน ${fiIds.length} แห่ง`);

  return { selections, outcomes };
}

export async function listFiSelections(
  applicationId: string,
  options: { activeOnly?: boolean } = {}
): Promise<StoredFiSelection[]> {
  const sql = await ensureSchema();
  const rows = options.activeOnly
    ? await sql`select * from fi_selections where application_id = ${applicationId} and active = true order by slot`
    : await sql`select * from fi_selections where application_id = ${applicationId} order by created_at, slot`;
  return rows.map(hydrateSelection);
}

/** เหตุผลที่ยังให้ความยินยอมส่งต่อไม่ได้ — ใช้ทั้งฝั่งเซิร์ฟเวอร์และหน้าจอ */
export const FI_CONSENT_NOT_READY_REASON =
  "ผลประเมินภายใต้เงื่อนไขของสถาบันการเงินนี้ยังไม่อยู่ในสถานะ READY FOR FI จึงยังไม่สามารถให้ความยินยอมเพื่อส่งต่อข้อมูลได้";

/**
 * ความยินยอมรายสถาบันการเงิน — แยกจากความยินยอมของการแข่งขัน และไม่เขียนทับของเดิม
 *
 * ความยินยอมนี้มีความหมายเดียวคือ "ยอมให้ส่งข้อมูลไปให้สถาบันการเงินแห่งนี้พิจารณา"
 * ถ้าผลภายใต้เงื่อนไขของแห่งนั้นไม่ใช่ READY FOR FI การส่งต่อจะไม่เกิดขึ้นอยู่แล้ว
 * การขอความยินยอมทั้งที่ส่งต่อไม่ได้ จึงเป็นการขอสิ่งที่ไม่มีทางถูกใช้
 * และทำให้ผู้สมัครเข้าใจว่ากำลังเดินหน้าเข้าสู่การพิจารณา
 *
 * ผลเก่าที่เคย READY ใช้อนุมัติแทนไม่ได้ — ตัดสินจาก Snapshot ที่ผูกกับ FI แห่งนั้นในปัจจุบันเท่านั้น
 */
export async function recordFiConsent(applicationId: string, fiId: string): Promise<StoredFiConsent> {
  const sql = await ensureSchema();

  const fi = getFiProduct(fiId);
  if (!fi) throw new Error(`ไม่พบสถาบันการเงิน ${fiId}`);

  const active = await listFiSelections(applicationId, { activeOnly: true });
  const selection = active.find((row) => row.fiId === fiId);
  if (!selection) {
    throw new Error(`ต้องเลือก ${fi.fiName} ก่อนจึงจะให้ความยินยอมได้`);
  }

  const snapshot = selection.evaluationSnapshotId
    ? await getSnapshotById(selection.evaluationSnapshotId)
    : null;
  if (!snapshot) {
    throw new Error(`ยังไม่มีผลการประเมินภายใต้เงื่อนไขของ ${fi.fiName}`);
  }
  if (!canHandoffToFi(snapshot.route)) {
    throw new Error(FI_CONSENT_NOT_READY_REASON);
  }

  const [row] = await sql`
    insert into fi_consent_records (id, application_id, fi_id, version, accepted)
    values (${rowId("ficon")}, ${applicationId}, ${fiId}, ${FI_CONSENT_VERSION}, ${true})
    returning id, application_id, fi_id, version, accepted, accepted_at
  `;

  await setStatus(applicationId, "FI_CONSENTED", `ให้ความยินยอมสำหรับ ${fi.fiName}`);

  return {
    id: str(row.id),
    applicationId: str(row.application_id),
    fiId: str(row.fi_id),
    version: str(row.version),
    accepted: row.accepted === true || row.accepted === "true",
    acceptedAt: iso(row.accepted_at)
  };
}

export async function listFiConsents(applicationId: string): Promise<StoredFiConsent[]> {
  const sql = await ensureSchema();
  const rows = await sql`
    select id, application_id, fi_id, version, accepted, accepted_at
    from fi_consent_records where application_id = ${applicationId}
    order by accepted_at, id
  `;
  return rows.map((row) => ({
    id: str(row.id),
    applicationId: str(row.application_id),
    fiId: str(row.fi_id),
    version: str(row.version),
    accepted: row.accepted === true || row.accepted === "true",
    acceptedAt: iso(row.accepted_at)
  }));
}

/**
 * สถานะการส่งต่อของแต่ละ FI ที่เลือกไว้
 *
 * ตัดสินทีละแห่งจาก Snapshot ของ FI นั้นเอง
 * FI แห่งหนึ่ง READY ไม่ได้ทำให้อีกแห่งส่งต่อได้
 */
export async function fiHandoffStatuses(applicationId: string) {
  const selections = await listFiSelections(applicationId, { activeOnly: true });
  const consents = await listFiConsents(applicationId);

  const statuses = [];
  for (const selection of selections) {
    const snapshot: EvaluationSnapshot | null = selection.evaluationSnapshotId
      ? await getSnapshotById(selection.evaluationSnapshotId)
      : null;

    const consented = consents.some((consent) => consent.fiId === selection.fiId && consent.accepted);
    const fi = getFiProduct(selection.fiId);

    const decision = snapshot
      ? handoffDecisionFor(snapshot, { consented })
      : { allowed: false, reason: "ยังไม่มีผลการประเมินสำหรับสถาบันการเงินแห่งนี้" };

    statuses.push({
      fiId: selection.fiId,
      fiName: fi?.fiName ?? selection.fiId,
      evaluationSnapshotId: selection.evaluationSnapshotId,
      route: snapshot?.route ?? null,
      materialChange: selection.materialChange,
      financingScenario: selection.financingScenario,
      consented,
      consentVersion: consented ? FI_CONSENT_VERSION : null,
      handoff: decision
    });
  }

  return { maxSelections: competitionConfig.maxFiSelections, statuses };
}
