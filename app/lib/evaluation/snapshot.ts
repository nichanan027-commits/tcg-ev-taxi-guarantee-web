import { ensureSchema, iso, num, numOrNull, str, strOrNull } from "../db/schema.ts";
import type { CanonicalRoute } from "../config/competition.ts";
import type { EvaluationSnapshot, FinancingScenario, ReasonCode, VehicleScenario } from "../registration/types.ts";

/**
 * Evaluation Snapshot เป็น append-only
 *
 * ทุกการประเมินสร้างแถวใหม่เสมอ ไม่มี update ผลเดิม เพื่อให้หน้าจอ, PDF,
 * Staff Console และ F.A Center อ่านจากชุดตัวเลขเดียวกัน และเปรียบเทียบก่อน/หลังได้
 */
export async function insertSnapshot(snapshot: EvaluationSnapshot): Promise<EvaluationSnapshot> {
  const sql = await ensureSchema();
  await sql`
    insert into evaluation_snapshots (
      id, application_id, input_version, basic_eligibility,
      declared_daily_revenue, assessment_daily_revenue, verified_daily_revenue, revenue_evidence_status,
      vehicle_scenario, financing_scenario,
      verified_revenue, eligible_opex, protected_cash, available_cash, estimated_obligation,
      residual, affordability_gap, affordability_passed, principal_sustainability_passed,
      income_evidence_reliability, activity_evidence_status, pre_score, tier, route,
      reason_codes, rbp_tier, rbp_rate, indicative_guarantee_eligible_base, engine_status, spec_version
    ) values (
      ${snapshot.id}, ${snapshot.applicationId}, ${snapshot.inputVersion},
      ${JSON.stringify(snapshot.basicEligibility)},
      ${snapshot.revenue.declaredDailyRevenue}, ${snapshot.revenue.assessmentDailyRevenue},
      ${snapshot.revenue.verifiedDailyRevenue}, ${snapshot.revenue.evidenceStatus},
      ${JSON.stringify(snapshot.vehicleScenario)}, ${JSON.stringify(snapshot.financingScenario)},
      ${snapshot.assessmentRevenue}, ${snapshot.eligibleOpEx}, ${snapshot.protectedCash},
      ${snapshot.availableCash}, ${snapshot.estimatedObligation},
      ${snapshot.residual}, ${snapshot.affordabilityGap}, ${snapshot.affordabilityPassed},
      ${snapshot.principalSustainabilityPassed}, ${snapshot.incomeEvidenceReliability},
      ${snapshot.activityEvidenceStatus}, ${snapshot.preScore}, ${snapshot.tier}, ${snapshot.route},
      ${JSON.stringify(snapshot.reasonCodes)}, ${snapshot.rbpTier}, ${snapshot.rbpRate},
      ${snapshot.indicativeGuaranteeEligibleBase}, ${snapshot.engineStatus}, ${snapshot.specVersion}
    )
  `;
  return snapshot;
}

export async function getLatestEvaluationSnapshot(applicationId: string): Promise<EvaluationSnapshot | null> {
  const sql = await ensureSchema();
  const [row] = await sql`
    select * from evaluation_snapshots
    where application_id = ${applicationId}
    order by evaluated_at desc, id desc
    limit 1
  `;
  return row ? hydrateSnapshot(row) : null;
}

export async function getSnapshotById(snapshotId: string): Promise<EvaluationSnapshot | null> {
  const sql = await ensureSchema();
  const [row] = await sql`select * from evaluation_snapshots where id = ${snapshotId}`;
  return row ? hydrateSnapshot(row) : null;
}

/** ประวัติการประเมิน เรียงล่าสุดก่อน ใช้เทียบก่อน/หลังคำปรึกษา F.A Center */
export async function listEvaluationSnapshots(applicationId: string): Promise<EvaluationSnapshot[]> {
  const sql = await ensureSchema();
  const rows = await sql`
    select * from evaluation_snapshots
    where application_id = ${applicationId}
    order by evaluated_at desc, id desc
  `;
  return rows.map(hydrateSnapshot);
}

export async function countSnapshots(applicationId: string): Promise<number> {
  const sql = await ensureSchema();
  const [row] = await sql`select count(*)::int as n from evaluation_snapshots where application_id = ${applicationId}`;
  return num(row?.n);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

export function hydrateSnapshot(row: Record<string, unknown>): EvaluationSnapshot {
  return {
    id: str(row.id),
    applicationId: str(row.application_id),
    inputVersion: num(row.input_version),
    vehicleScenario: parseJson<VehicleScenario>(row.vehicle_scenario, {} as VehicleScenario),
    financingScenario: parseJson<FinancingScenario>(row.financing_scenario, {} as FinancingScenario),
    basicEligibility: parseJson(row.basic_eligibility, null) as EvaluationSnapshot["basicEligibility"],
    revenue: {
      declaredDailyRevenue: num(row.declared_daily_revenue),
      assessmentDailyRevenue: num(row.assessment_daily_revenue),
      verifiedDailyRevenue: numOrNull(row.verified_daily_revenue),
      evidenceStatus: str(row.revenue_evidence_status) as EvaluationSnapshot["revenue"]["evidenceStatus"]
    },
    assessmentRevenue: num(row.verified_revenue),
    eligibleOpEx: num(row.eligible_opex),
    protectedCash: num(row.protected_cash),
    availableCash: num(row.available_cash),
    estimatedObligation: num(row.estimated_obligation),
    residual: num(row.residual),
    affordabilityGap: num(row.affordability_gap),
    affordabilityPassed: row.affordability_passed === true || row.affordability_passed === "true",
    principalSustainabilityPassed:
      row.principal_sustainability_passed === true || row.principal_sustainability_passed === "true",
    incomeEvidenceReliability: str(row.income_evidence_reliability),
    activityEvidenceStatus: str(row.activity_evidence_status),
    preScore: num(row.pre_score),
    tier: strOrNull(row.tier),
    route: str(row.route) as CanonicalRoute,
    reasonCodes: parseJson<ReasonCode[]>(row.reason_codes, []),
    rbpTier: strOrNull(row.rbp_tier),
    rbpRate: numOrNull(row.rbp_rate),
    indicativeGuaranteeEligibleBase: numOrNull(row.indicative_guarantee_eligible_base),
    engineStatus: str(row.engine_status),
    specVersion: str(row.spec_version),
    evaluatedAt: iso(row.evaluated_at)
  };
}
