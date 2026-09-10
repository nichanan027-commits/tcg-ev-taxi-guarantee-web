import {
  FA_ACTIVE_STATUSES,
  FA_CASE_STATUSES,
  FA_CONTACT_CHANNELS,
  FA_CONTACT_TIMES,
  canRequestFaAdvisory,
  competitionConfig
} from "../config/competition.ts";
import type { FaCaseStatus } from "../config/competition.ts";
import { ensureSchema, iso, num, rowId, str, strOrNull } from "../db/schema.ts";
import { getSnapshotById, getLatestEvaluationSnapshot } from "../evaluation/snapshot.ts";
import { setStatus } from "../registration/application-service.ts";
import type { EvaluationSnapshot, FaCase, ReasonCode } from "../registration/types.ts";

/**
 * F.A Readiness Advisory — คำปรึกษาเพื่อสร้างความพร้อมก่อนสินเชื่อ
 *
 * นี่คือบริการฝั่ง Front Office ที่เกิด "ก่อน" การขอสินเชื่อ
 * ไม่ใช่การดูแลหลังอนุมัติ ไม่ใช่การแก้หนี้ ไม่ใช่การติดตามการชำระ
 * จึงไม่มีสนามใดในไฟล์นี้ที่เกี่ยวกับสัญญา การผ่อนจริง หรือการเคลมค้ำประกัน
 *
 * เคสหนึ่งผูกกับ Evaluation Snapshot หนึ่งใบเสมอ
 * เมื่อผู้สมัครกลับมาประเมินใหม่ จะได้ Snapshot ใบใหม่ และเคสใหม่ผูกกับใบใหม่
 * เคสเดิมยังชี้ไปที่ใบเดิมไม่เปลี่ยน เพื่อให้เทียบก่อน/หลังคำปรึกษาได้จริง
 */
export const FA_ADVISORY_NAME = "F.A. ให้คำปรึกษาเพื่อสร้างความพร้อมก่อนสินเชื่อ";
export const FA_ADVISORY_NAME_EN = "F.A Readiness Advisory";

export const FA_ADVISORY_COPY = {
  /**
   * ประโยคนี้ต้องปรากฏบนหน้าคำขอเสมอ
   * เพราะคำว่า "ให้คำปรึกษา" อาจถูกเข้าใจว่าเป็นการแก้หนี้ ซึ่งเป็นคนละเรื่องและอยู่คนละระบบ
   */
  explanation:
    "คำขอนี้เป็นการขอคำปรึกษาเพื่อพัฒนาความพร้อมก่อนเข้าสู่กระบวนการสินเชื่อ ไม่ใช่การปรับโครงสร้างหนี้ และไม่ใช่กระบวนการแก้ไขหนี้หลังอนุมัติ",
  scope:
    "บริการให้คำปรึกษาเพื่อสร้างความพร้อมก่อนขอสินเชื่อ ไม่ใช่การพิจารณาสินเชื่อ และไม่ใช่การรับประกันว่าจะได้รับอนุมัติในภายหลัง",
  notApproval: "การขอคำปรึกษาไม่ใช่การยื่นขอสินเชื่อ และไม่มีผลผูกพันกับสถาบันการเงินใด",
  reassessment:
    "เมื่อสถานะการเงินเปลี่ยน ให้กลับมาประเมินใหม่ ระบบจะเก็บผลใหม่เป็นคนละชุดกับผลเดิม จึงเทียบก่อน/หลังได้"
} as const;

export function formatFaCaseId(sequenceValue: number): string {
  return `${competitionConfig.faCaseIdPrefix}-${String(sequenceValue).padStart(6, "0")}`;
}

export type FaContactTime = (typeof FA_CONTACT_TIMES)[number];
export type FaContactChannel = (typeof FA_CONTACT_CHANNELS)[number];

export type FaAdvisoryRequest = {
  applicationId: string;
  preferredContactTime: FaContactTime;
  preferredChannel: FaContactChannel;
  /** ผูกกับผลใบใดใบหนึ่งอย่างชัดเจน ไม่ระบุ = ใช้ผลล่าสุด */
  evaluationSnapshotId?: string;
};

/** เหตุผลหลักที่ทำให้ยังไม่พร้อม — ใช้เป็นหัวข้อตั้งต้นของการให้คำปรึกษา */
export function primaryReasonOf(snapshot: EvaluationSnapshot): string | null {
  const blocker = snapshot.reasonCodes.find((reason) => reason.severity === "BLOCKER");
  if (blocker) return blocker.code;
  const watch = snapshot.reasonCodes.find((reason) => reason.severity === "WATCH");
  return watch ? watch.code : null;
}

function hydrateCase(row: Record<string, unknown>): FaCase {
  return {
    id: str(row.id),
    applicationId: str(row.application_id),
    evaluationSnapshotId: str(row.evaluation_snapshot_id),
    route: str(row.route) as FaCase["route"],
    tier: strOrNull(row.tier),
    preScore: num(row.pre_score),
    affordabilityPassed: row.affordability_passed === true || row.affordability_passed === "true",
    availableCash: num(row.available_cash),
    estimatedObligation: num(row.estimated_obligation),
    residual: num(row.residual),
    affordabilityGap: num(row.affordability_gap),
    evidenceReliability: str(row.evidence_reliability),
    primaryReason: strOrNull(row.primary_reason),
    reasonCodes: (typeof row.reason_codes === "object" && row.reason_codes !== null
      ? row.reason_codes
      : JSON.parse(String(row.reason_codes ?? "[]"))) as ReasonCode[],
    preferredContactTime: str(row.preferred_contact_time) as FaContactTime,
    preferredChannel: str(row.preferred_channel) as FaContactChannel,
    status: str(row.status) as FaCaseStatus,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

export const FA_DUPLICATE_ACTIVE_REASON = "มีคำขอคำปรึกษาที่กำลังดำเนินการอยู่แล้ว";

export const FA_ROUTE_NOT_ELIGIBLE_REASON =
  "เส้นทางปัจจุบันยังไม่เข้าเงื่อนไขของบริการให้คำปรึกษาเพื่อสร้างความพร้อมก่อนสินเชื่อ";

/**
 * เปิดเคสคำปรึกษา
 *
 * เปิดได้เมื่อเส้นทางเป็น BUILD READINESS หรือ NO NEW DEBT
 * เพราะสองเส้นทางนี้คือกรณีที่การเพิ่มหนี้ตอนนี้ยังไม่ใช่คำตอบ
 * และสิ่งที่ช่วยได้จริงคือการสร้างความพร้อมก่อน
 *
 * ผู้สมัครหนึ่งคนมีเคสที่ยังทำงานอยู่ได้ครั้งละหนึ่งเคส
 */
export async function requestFaAdvisory(request: FaAdvisoryRequest): Promise<FaCase> {
  const sql = await ensureSchema();

  if (!FA_CONTACT_TIMES.includes(request.preferredContactTime)) {
    throw new Error("ช่วงเวลาที่สะดวกให้ติดต่อกลับไม่ถูกต้อง");
  }
  if (!FA_CONTACT_CHANNELS.includes(request.preferredChannel)) {
    throw new Error("ช่องทางติดต่อกลับไม่ถูกต้อง");
  }

  const snapshot = request.evaluationSnapshotId
    ? await getSnapshotById(request.evaluationSnapshotId)
    : await getLatestEvaluationSnapshot(request.applicationId);

  if (!snapshot) throw new Error("ยังไม่มีผลการประเมินสำหรับขอคำปรึกษา");
  if (snapshot.applicationId !== request.applicationId) {
    throw new Error("ผลการประเมินไม่ได้เป็นของใบสมัครนี้");
  }
  if (!canRequestFaAdvisory(snapshot.route)) {
    throw new Error(FA_ROUTE_NOT_ELIGIBLE_REASON);
  }

  const active = await listFaCases(request.applicationId, { activeOnly: true });
  if (active.length > 0) throw new Error(FA_DUPLICATE_ACTIVE_REASON);

  const [seq] = await sql<{ nextval: string }>`select nextval('fa_case_number_seq') as nextval`;
  const id = formatFaCaseId(Number(seq.nextval));

  const [row] = await sql`
    insert into fa_cases (
      id, application_id, evaluation_snapshot_id, route, tier, pre_score, affordability_passed,
      available_cash, estimated_obligation, residual, affordability_gap, evidence_reliability,
      primary_reason, reason_codes, preferred_contact_time, preferred_channel, status
    ) values (
      ${id}, ${request.applicationId}, ${snapshot.id}, ${snapshot.route}, ${snapshot.tier},
      ${snapshot.preScore}, ${snapshot.affordabilityPassed},
      ${snapshot.availableCash}, ${snapshot.estimatedObligation}, ${snapshot.residual},
      ${snapshot.affordabilityGap}, ${snapshot.incomeEvidenceReliability},
      ${primaryReasonOf(snapshot)}, ${JSON.stringify(snapshot.reasonCodes)},
      ${request.preferredContactTime}, ${request.preferredChannel}, ${"NEW"}
    )
    returning *
  `;

  await recordCaseEvent(id, null, "NEW", "เปิดคำขอคำปรึกษาจากหน้าผลความพร้อม");
  await setStatus(request.applicationId, "FA_REQUESTED", `เปิดคำขอคำปรึกษา ${id}`);

  return hydrateCase(row);
}

export async function getFaCase(caseId: string): Promise<FaCase | null> {
  const sql = await ensureSchema();
  const [row] = await sql`select * from fa_cases where id = ${caseId}`;
  return row ? hydrateCase(row) : null;
}

export async function listFaCases(
  applicationId: string,
  options: { activeOnly?: boolean } = {}
): Promise<FaCase[]> {
  const sql = await ensureSchema();
  const rows = await sql`
    select * from fa_cases where application_id = ${applicationId} order by created_at desc, id desc
  `;
  const cases = rows.map(hydrateCase);
  return options.activeOnly ? cases.filter((row) => FA_ACTIVE_STATUSES.includes(row.status)) : cases;
}

/**
 * เปลี่ยนสถานะเคส
 *
 * ทุกการเปลี่ยนถูกบันทึกเป็นเหตุการณ์ ไม่ใช่การเขียนทับสถานะเดิมเงียบ ๆ
 * ประวัติจึงบอกได้ว่าเคสเดินทางอย่างไร ไม่ใช่แค่ว่าตอนนี้อยู่ตรงไหน
 */
export async function updateFaCaseStatus(
  caseId: string,
  toStatus: FaCaseStatus,
  detail: { note?: string; nextAction?: string; followUpOn?: string } = {}
): Promise<FaCase> {
  const sql = await ensureSchema();

  if (!FA_CASE_STATUSES.includes(toStatus)) throw new Error(`สถานะ ${toStatus} ไม่ถูกต้อง`);

  const current = await getFaCase(caseId);
  if (!current) throw new Error(`ไม่พบเคส ${caseId}`);
  if (current.status === "CLOSED") throw new Error("เคสนี้ปิดแล้ว เปลี่ยนสถานะต่อไม่ได้");

  const [row] = await sql`
    update fa_cases set status = ${toStatus}, updated_at = now() where id = ${caseId} returning *
  `;
  await recordCaseEvent(caseId, current.status, toStatus, detail.note, detail.nextAction, detail.followUpOn);

  return hydrateCase(row);
}

export type FaCaseEvent = {
  id: string;
  caseId: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  nextAction: string | null;
  followUpOn: string | null;
  createdAt: string;
};

async function recordCaseEvent(
  caseId: string,
  fromStatus: string | null,
  toStatus: string,
  note?: string,
  nextAction?: string,
  followUpOn?: string
): Promise<void> {
  const sql = await ensureSchema();
  await sql`
    insert into fa_case_events (id, case_id, from_status, to_status, note, next_action, follow_up_on)
    values (${rowId("faev")}, ${caseId}, ${fromStatus}, ${toStatus}, ${note ?? null},
            ${nextAction ?? null}, ${followUpOn ?? null})
  `;
}

export async function listFaCaseEvents(caseId: string): Promise<FaCaseEvent[]> {
  const sql = await ensureSchema();
  const rows = await sql`
    select * from fa_case_events where case_id = ${caseId} order by created_at, id
  `;
  return rows.map((row) => ({
    id: str(row.id),
    caseId: str(row.case_id),
    fromStatus: strOrNull(row.from_status),
    toStatus: str(row.to_status),
    note: strOrNull(row.note),
    nextAction: strOrNull(row.next_action),
    followUpOn: row.follow_up_on ? String(row.follow_up_on).slice(0, 10) : null,
    createdAt: iso(row.created_at)
  }));
}

/**
 * เทียบผลก่อน/หลังคำปรึกษา
 *
 * ใช้ Snapshot ที่เคสผูกไว้เป็นจุดตั้งต้น เทียบกับผลล่าสุดของใบสมัคร
 * เคสไม่ถูกย้ายไปผูกกับผลใหม่ เพราะจะทำให้จุดตั้งต้นหายไปและเทียบไม่ได้อีก
 */
export async function faProgressFor(caseId: string) {
  const faCase = await getFaCase(caseId);
  if (!faCase) return null;

  const baseline = await getSnapshotById(faCase.evaluationSnapshotId);
  const latest = await getLatestEvaluationSnapshot(faCase.applicationId);
  if (!baseline || !latest) return null;

  const reassessed = latest.id !== baseline.id;

  return {
    caseId: faCase.id,
    reassessed,
    baseline: {
      snapshotId: baseline.id,
      route: baseline.route,
      preScore: baseline.preScore,
      availableCash: baseline.availableCash,
      affordabilityGap: baseline.affordabilityGap,
      evaluatedAt: baseline.evaluatedAt
    },
    latest: {
      snapshotId: latest.id,
      route: latest.route,
      preScore: latest.preScore,
      availableCash: latest.availableCash,
      affordabilityGap: latest.affordabilityGap,
      evaluatedAt: latest.evaluatedAt
    },
    routeChanged: reassessed && baseline.route !== latest.route,
    gapClosedBy: reassessed ? baseline.affordabilityGap - latest.affordabilityGap : 0,
    note: FA_ADVISORY_COPY.reassessment
  };
}
