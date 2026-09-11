import { competitionConfig } from "../config/competition.ts";
import { ensureSchema, iso, isoOrNull, str } from "../db/schema.ts";

/**
 * การเก็บและลบข้อมูลส่วนบุคคลของรอบการแข่งขัน
 *
 * ข้อมูลที่ระบุตัวบุคคลถูกเก็บไว้เพียงเท่าที่จำเป็นต่อการตัดสิน
 * เมื่อพ้นกำหนดแล้ว ชื่อและเบอร์โทรจะถูกแทนที่ ไม่ใช่ลบทั้งใบสมัคร
 * เพราะผลการประเมิน การเลือกสถาบันการเงิน และร่องรอยความยินยอม
 * ต้องตรวจย้อนได้ว่าระบบตัดสินอย่างไร แม้จะไม่รู้แล้วว่าเป็นของใคร
 *
 * เกณฑ์เวลานับจากวันสิ้นสุดการแข่งขัน ไม่ใช่จากวันที่สร้างใบสมัครแต่ละใบ
 */
export type RetentionPolicy = {
  competitionCutoffAt: string;
  retentionDays: number;
  cutoffSource: "COMPETITION_CUTOFF_AT";
};

export const RETENTION_BLOCK_CODE = "BLOCKED_MISSING_COMPETITION_CUTOFF" as const;

export const MISSING_CUTOFF_MESSAGE =
  "COMPETITION_CUTOFF_AT ไม่ได้ตั้งค่าไว้ — retention ถูก block แบบ fail closed จนกว่าจะระบุวันสิ้นสุดการแข่งขันจริง";

/**
 * คืนค่านโยบายเฉพาะเมื่อมีวันสิ้นสุดการแข่งขันที่ตั้งจากภายนอกเท่านั้น
 *
 * การไม่มี COMPETITION_CUTOFF_AT ไม่ใช่ runtime error ของแอป เพราะ Front Office
 * ต้องเปิดใช้งานและ deploy ได้โดยไม่ต้องเดาวันสิ้นสุดการแข่งขัน แต่ action ที่จะอ่าน
 * หรือแก้ข้อมูลตาม retention policy ต้อง fail closed แยกต่างหาก
 */
export function resolveRetentionPolicy(env: NodeJS.ProcessEnv = process.env): RetentionPolicy | null {
  const configured = env.COMPETITION_CUTOFF_AT?.trim();
  if (!configured) return null;

  if (Number.isNaN(new Date(configured).getTime())) {
    throw new Error(`COMPETITION_CUTOFF_AT ไม่ใช่เวลาแบบ ISO 8601 ที่ถูกต้อง: ${configured}`);
  }

  return {
    competitionCutoffAt: new Date(configured).toISOString(),
    retentionDays: competitionConfig.piiRetentionDays,
    cutoffSource: "COMPETITION_CUTOFF_AT"
  };
}

/** ค่าที่ใช้แทนข้อมูลเดิม — สื่อว่าถูกลบตามนโยบาย ไม่ใช่ว่าไม่เคยมี */
export const ANONYMIZED_NAME = "[ลบตามนโยบายเก็บข้อมูล]";
export const ANONYMIZED_PHONE = "[ลบตามนโยบายเก็บข้อมูล]";

export function anonymizeAfter(policy: RetentionPolicy): Date {
  const cutoff = new Date(policy.competitionCutoffAt);
  if (Number.isNaN(cutoff.getTime())) throw new Error("competitionCutoffAt ไม่ใช่วันที่ที่ถูกต้อง");
  if (!Number.isFinite(policy.retentionDays) || policy.retentionDays < 0) {
    throw new Error("retentionDays ต้องเป็นจำนวนวันที่ไม่ติดลบ");
  }
  return new Date(cutoff.getTime() + policy.retentionDays * 24 * 60 * 60 * 1000);
}

/** ถึงกำหนดลบหรือยัง — ณ เวลาครบกำหนดพอดีถือว่าถึงกำหนดแล้ว */
export function isDueForAnonymization(now: Date, policy: RetentionPolicy): boolean {
  return now.getTime() >= anonymizeAfter(policy).getTime();
}

export type RetentionCandidate = {
  applicationId: string;
  createdAt: string;
  piiAnonymizedAt: string | null;
  hasDirectPii: boolean;
};

export type RetentionReport = {
  mode: "DRY_RUN" | "EXECUTE";
  status: "OK" | "BLOCKED";
  code: typeof RETENTION_BLOCK_CODE | null;
  policy: RetentionPolicy | null;
  anonymizeAfter: string | null;
  now: string;
  due: boolean;
  eligibleApplications: string[];
  wouldAnonymize: string[];
  anonymized: string[];
  deleted: string[];
  skipped: { applicationId: string; reason: string }[];
  errors: { applicationId: string; message: string }[];
};

async function candidates(): Promise<RetentionCandidate[]> {
  const sql = await ensureSchema();
  const rows = await sql`
    select a.id, a.created_at, a.pii_anonymized_at,
           p.display_name, p.phone, e.cooperative_or_operator
    from applications a
    left join application_profiles p on p.application_id = a.id
    left join basic_eligibility e on e.application_id = a.id
    order by a.id
  `;

  return rows.map((row) => ({
    applicationId: str(row.id),
    createdAt: iso(row.created_at),
    piiAnonymizedAt: isoOrNull(row.pii_anonymized_at),
    hasDirectPii:
      (row.display_name !== null && str(row.display_name) !== ANONYMIZED_NAME) ||
      (row.phone !== null && str(row.phone) !== ANONYMIZED_PHONE) ||
      (row.cooperative_or_operator !== null && str(row.cooperative_or_operator) !== ANONYMIZED_NAME)
  }));
}

function blockedReport(mode: RetentionReport["mode"], now: Date): RetentionReport {
  return {
    mode,
    status: "BLOCKED",
    code: RETENTION_BLOCK_CODE,
    policy: null,
    anonymizeAfter: null,
    now: now.toISOString(),
    due: false,
    eligibleApplications: [],
    wouldAnonymize: [],
    anonymized: [],
    deleted: [],
    skipped: [],
    errors: []
  };
}

function emptyReport(
  mode: RetentionReport["mode"],
  policy: RetentionPolicy,
  now: Date
): RetentionReport {
  return {
    mode,
    status: "OK",
    code: null,
    policy,
    anonymizeAfter: anonymizeAfter(policy).toISOString(),
    now: now.toISOString(),
    due: isDueForAnonymization(now, policy),
    eligibleApplications: [],
    wouldAnonymize: [],
    anonymized: [],
    deleted: [],
    skipped: [],
    errors: []
  };
}

type RetentionInput = {
  now?: Date;
  policy?: RetentionPolicy;
  env?: NodeJS.ProcessEnv;
};

/**
 * ตรวจว่าจะลบอะไรบ้าง โดยไม่แก้ข้อมูลใด ๆ
 * ถ้าไม่มี authoritative cutoff จะคืน BLOCKED ก่อนเปิดฐานข้อมูลหรือสร้าง schema
 */
export async function dryRunRetention(input: RetentionInput = {}): Promise<RetentionReport> {
  const policy = input.policy ?? resolveRetentionPolicy(input.env);
  const now = input.now ?? new Date();
  if (!policy) return blockedReport("DRY_RUN", now);

  const report = emptyReport("DRY_RUN", policy, now);
  const rows = await candidates();

  for (const row of rows) {
    if (!report.due) {
      report.skipped.push({ applicationId: row.applicationId, reason: "ยังไม่ถึงกำหนดตามนโยบาย" });
      continue;
    }
    if (row.piiAnonymizedAt !== null) {
      report.skipped.push({ applicationId: row.applicationId, reason: "ลบข้อมูลส่วนบุคคลไปแล้ว" });
      continue;
    }
    report.eligibleApplications.push(row.applicationId);
    if (row.hasDirectPii) report.wouldAnonymize.push(row.applicationId);
  }

  return report;
}

/**
 * ลบข้อมูลส่วนบุคคลจริง
 * ถ้าไม่มี authoritative cutoff จะคืน BLOCKED ก่อนเปิดฐานข้อมูลหรือสร้าง schema
 */
export async function executeRetention(input: RetentionInput = {}): Promise<RetentionReport> {
  const policy = input.policy ?? resolveRetentionPolicy(input.env);
  const now = input.now ?? new Date();
  if (!policy) return blockedReport("EXECUTE", now);

  const report = emptyReport("EXECUTE", policy, now);
  const rows = await candidates();
  const sql = await ensureSchema();

  for (const row of rows) {
    if (!report.due) {
      report.skipped.push({ applicationId: row.applicationId, reason: "ยังไม่ถึงกำหนดตามนโยบาย" });
      continue;
    }
    if (row.piiAnonymizedAt !== null) {
      report.skipped.push({ applicationId: row.applicationId, reason: "ลบข้อมูลส่วนบุคคลไปแล้ว" });
      continue;
    }

    report.eligibleApplications.push(row.applicationId);

    try {
      await sql`
        update application_profiles
        set display_name = ${ANONYMIZED_NAME}, phone = ${ANONYMIZED_PHONE}, updated_at = now()
        where application_id = ${row.applicationId}
      `;
      await sql`
        update basic_eligibility
        set cooperative_or_operator = ${ANONYMIZED_NAME}, updated_at = now()
        where application_id = ${row.applicationId} and cooperative_or_operator is not null
      `;
      await sql`
        update applications set pii_anonymized_at = ${now.toISOString()}, updated_at = now()
        where id = ${row.applicationId}
      `;
      report.anonymized.push(row.applicationId);
    } catch (error) {
      report.errors.push({
        applicationId: row.applicationId,
        message: error instanceof Error ? error.message : "ลบข้อมูลส่วนบุคคลไม่สำเร็จ"
      });
    }
  }

  return report;
}

/**
 * ข้อมูลสำหรับส่งออก — ไม่มีข้อมูลที่ระบุตัวบุคคลโดยค่าเริ่มต้น
 */
export type CompetitionExportRow = {
  applicationId: string;
  status: string;
  createdAt: string;
  route: string | null;
  tier: string | null;
  preScore: number | null;
  affordabilityPassed: boolean | null;
  availableCash: number | null;
  estimatedObligation: number | null;
  affordabilityGap: number | null;
  evidenceStatus: string | null;
  fiSelectionCount: number;
  fiConsentCount: number;
  faCaseCount: number;
  piiAnonymizedAt: string | null;
};

export async function exportCompetitionMetrics(): Promise<CompetitionExportRow[]> {
  const sql = await ensureSchema();
  const rows = await sql`
    select
      a.id, a.status, a.created_at, a.pii_anonymized_at,
      s.route, s.tier, s.pre_score, s.affordability_passed,
      s.available_cash, s.estimated_obligation, s.affordability_gap, s.revenue_evidence_status,
      (select count(*) from fi_selections f where f.application_id = a.id and f.active = true) as fi_selection_count,
      (select count(*) from fi_consent_records c where c.application_id = a.id) as fi_consent_count,
      (select count(*) from fa_cases fc where fc.application_id = a.id) as fa_case_count
    from applications a
    left join lateral (
      select * from evaluation_snapshots es
      where es.application_id = a.id
      order by es.evaluated_at desc, es.id desc
      limit 1
    ) s on true
    order by a.id
  `;

  return rows.map((row) => ({
    applicationId: str(row.id),
    status: str(row.status),
    createdAt: iso(row.created_at),
    route: row.route === null || row.route === undefined ? null : str(row.route),
    tier: row.tier === null || row.tier === undefined ? null : str(row.tier),
    preScore: row.pre_score === null || row.pre_score === undefined ? null : Number(row.pre_score),
    affordabilityPassed:
      row.affordability_passed === null || row.affordability_passed === undefined
        ? null
        : row.affordability_passed === true || row.affordability_passed === "true",
    availableCash:
      row.available_cash === null || row.available_cash === undefined ? null : Number(row.available_cash),
    estimatedObligation:
      row.estimated_obligation === null || row.estimated_obligation === undefined
        ? null
        : Number(row.estimated_obligation),
    affordabilityGap:
      row.affordability_gap === null || row.affordability_gap === undefined
        ? null
        : Number(row.affordability_gap),
    evidenceStatus:
      row.revenue_evidence_status === null || row.revenue_evidence_status === undefined
        ? null
        : str(row.revenue_evidence_status),
    fiSelectionCount: Number(row.fi_selection_count ?? 0),
    fiConsentCount: Number(row.fi_consent_count ?? 0),
    faCaseCount: Number(row.fa_case_count ?? 0),
    piiAnonymizedAt: isoOrNull(row.pii_anonymized_at)
  }));
}
