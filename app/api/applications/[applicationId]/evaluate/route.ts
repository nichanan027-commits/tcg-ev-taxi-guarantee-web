import { NextResponse } from "next/server";

import {
  GOVERNANCE_COPY,
  applicantRouteCopy,
  canHandoffToFi,
  canRequestFaAdvisory
} from "../../../../lib/config/competition.ts";
import {
  evaluateApplication,
  getLatestEvaluationSnapshot
} from "../../../../lib/evaluation/evaluate-application.ts";
import { GUARANTEE_COPY } from "../../../../lib/evaluation/guarantee-wording.ts";
import { REVENUE_ASSESSMENT_LABEL } from "../../../../lib/evidence/revenue-assessment.ts";
import { REVENUE_EVIDENCE_STATUS_COPY } from "../../../../lib/evidence/types.ts";
import type { EvaluationSnapshot } from "../../../../lib/registration/types.ts";

type Context = { params: Promise<{ applicationId: string }> };

/**
 * ตอบกลับด้วย DTO ที่เขียนออกทีละสนาม ไม่ spread ทั้งก้อน
 * เพื่อให้รู้แน่ชัดว่าอะไรออกสู่ภายนอกบ้าง
 */
function toDto(snapshot: EvaluationSnapshot) {
  return {
    snapshotId: snapshot.id,
    applicationId: snapshot.applicationId,
    inputVersion: snapshot.inputVersion,
    evaluatedAt: snapshot.evaluatedAt,

    route: snapshot.route,
    routeCopy: applicantRouteCopy(snapshot.route),
    canHandoffToFi: canHandoffToFi(snapshot.route),
    canRequestFaAdvisory: canRequestFaAdvisory(snapshot.route),

    // สามชั้นของรายได้ต้องแยกกันบนหน้าจอ ห้ามยุบเป็นตัวเลขเดียวชื่อ Verified
    revenue: {
      declaredDailyRevenue: snapshot.revenue.declaredDailyRevenue,
      assessmentDailyRevenue: snapshot.revenue.assessmentDailyRevenue,
      verifiedDailyRevenue: snapshot.revenue.verifiedDailyRevenue,
      evidenceStatus: snapshot.revenue.evidenceStatus,
      evidenceStatusCopy: REVENUE_EVIDENCE_STATUS_COPY[snapshot.revenue.evidenceStatus],
      label:
        snapshot.revenue.verifiedDailyRevenue === null
          ? REVENUE_ASSESSMENT_LABEL
          : "รายได้ที่มีหลักฐานธุรกรรมรองรับ"
    },
    basicEligibility: snapshot.basicEligibility,
    financialPassport: {
      assessmentRevenue: snapshot.assessmentRevenue,
      eligibleOpEx: snapshot.eligibleOpEx,
      protectedCash: snapshot.protectedCash,
      availableCash: snapshot.availableCash
    },
    affordability: {
      estimatedObligation: snapshot.estimatedObligation,
      residual: snapshot.residual,
      affordabilityGap: snapshot.affordabilityGap,
      affordabilityPassed: snapshot.affordabilityPassed,
      principalSustainabilityPassed: snapshot.principalSustainabilityPassed
    },
    evidence: {
      incomeEvidenceReliability: snapshot.incomeEvidenceReliability,
      activityEvidenceStatus: snapshot.activityEvidenceStatus
    },
    preScore: snapshot.preScore,
    tier: snapshot.tier,
    reasonCodes: snapshot.reasonCodes,
    vehicleScenario: snapshot.vehicleScenario,
    financingScenario: snapshot.financingScenario,
    guarantee: {
      rbpTier: snapshot.rbpTier,
      rbpRate: snapshot.rbpRate,
      indicativeGuaranteeEligibleBase: snapshot.indicativeGuaranteeEligibleBase,
      label: GUARANTEE_COPY.label,
      labelTh: GUARANTEE_COPY.labelTh,
      disclaimer: GUARANTEE_COPY.disclaimer
    },
    engineStatus: snapshot.engineStatus,
    specVersion: snapshot.specVersion,

    disclaimers: [
      GOVERNANCE_COPY.preScoreNotApproval,
      GOVERNANCE_COPY.zeroDownNotGuarantee,
      GOVERNANCE_COPY.activityNotIncome,
      GOVERNANCE_COPY.fiOwnsDecision,
      GOVERNANCE_COPY.illustrativeFinancingLong
    ]
  };
}

/** POST — ประเมินใหม่ สร้าง Snapshot ใหม่เสมอ ไม่เขียนทับผลเดิม */
export async function POST(_request: Request, context: Context) {
  const { applicationId } = await context.params;
  try {
    const snapshot = await evaluateApplication(applicationId);
    return NextResponse.json({ evaluation: toDto(snapshot) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ประเมินไม่สำเร็จ";
    if (message.includes("ไม่พบใบสมัคร")) return NextResponse.json({ error: message }, { status: 404 });
    if (message.includes("ยังไม่มีข้อมูล")) return NextResponse.json({ error: message }, { status: 409 });
    // ห้ามเดาคะแนน/เส้นทางเมื่อประเมินไม่สำเร็จ ให้ผู้ใช้ลองใหม่แทน
    console.error("evaluateApplication failed", message);
    return NextResponse.json({ error: "ประเมินไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 503 });
  }
}

/** GET — อ่านผลล่าสุด ไม่คำนวณใหม่ */
export async function GET(_request: Request, context: Context) {
  const { applicationId } = await context.params;
  const snapshot = await getLatestEvaluationSnapshot(applicationId);
  if (!snapshot) return NextResponse.json({ error: "ยังไม่มีผลการประเมิน" }, { status: 404 });
  return NextResponse.json({ evaluation: toDto(snapshot) });
}
