import { GOVERNANCE_COPY, applicantRouteCopy, canHandoffToFi, canRequestFaAdvisory } from "../config/competition.ts";
import { GUARANTEE_COPY } from "../evaluation/guarantee-wording.ts";
import { REVENUE_ASSESSMENT_LABEL, REVENUE_VERIFIED_LABEL } from "../evidence/revenue-assessment.ts";
import { REVENUE_EVIDENCE_STATUS_COPY } from "../evidence/types.ts";
import { ROUTES } from "../route2own.ts";
import type { EvaluationSnapshot, ReasonCode } from "../registration/types.ts";

/**
 * View Model ของหน้าผลลัพธ์
 *
 * อ่านค่าจาก Evaluation Snapshot อย่างเดียว ไม่คำนวณผลิตภัณฑ์ใหม่แม้แต่ค่าเดียว
 * เส้นทาง คะแนน ความสามารถรับภาระ ทั้งหมดถูกตัดสินไปแล้วโดย Frozen Engine
 * ที่นี่ทำเพียงจัดลำดับการแสดงผลและเลือกถ้อยคำที่ถูกต้อง
 *
 * ลำดับความสำคัญบนหน้าจอถูกกำหนดตายตัว: Route → Affordability → Tier → Pre-Score
 */
export type CapacityState = "RESIDUAL" | "GAP";

export type ResultCta = {
  id: string;
  label: string;
  href?: string;
  tone: "primary" | "secondary";
};

const TIER_COPY: Record<string, string> = {
  A: "Tier A — ความพร้อมสูง",
  B: "Tier B — ความพร้อมปานกลาง",
  C: "Tier C — ต้องติดตาม/เสริมความพร้อม"
};

const HERO_TH: Record<string, string> = {
  [ROUTES.READY_FOR_FI]: "พร้อมเข้าสู่การพิจารณาของสถาบันการเงิน",
  [ROUTES.BUILD_READINESS]: "สร้างความพร้อมเพิ่มเติมก่อนเพิ่มภาระใหม่",
  [ROUTES.NO_NEW_DEBT]: "ยังไม่พร้อมสำหรับสินเชื่อใหม่"
};

const HERO_SUPPORT: Record<string, string> = {
  [ROUTES.READY_FOR_FI]:
    "คุณมีความพร้อมเบื้องต้นสำหรับส่งต่อเข้าสู่กระบวนการพิจารณาของสถาบันการเงิน",
  [ROUTES.BUILD_READINESS]:
    "รายได้ของคุณรองรับภาระได้ แต่หลักฐานยังไม่พอที่จะส่งต่อสถาบันการเงินในตอนนี้",
  [ROUTES.NO_NEW_DEBT]:
    "กระแสเงินสดต่อวันยังไม่พอรองรับภาระรถใหม่ การเพิ่มหนี้ตอนนี้จะทำให้ความเสี่ยงสูงเกินไป"
};

/** ประโยคหลักของผลิตภัณฑ์ ปรากฏได้ทุกเส้นทาง */
export const PRODUCT_THESIS = "Route to Own ไม่ได้พาทุกคนไปกู้";

export function resultViewModel(snapshot: EvaluationSnapshot) {
  const route = snapshot.route;
  const isReady = canHandoffToFi(route);
  const canAskAdvisory = canRequestFaAdvisory(route);
  const isNoNewDebt = route === ROUTES.NO_NEW_DEBT;

  const capacityState: CapacityState = snapshot.affordabilityGap > 0 ? "GAP" : "RESIDUAL";

  const ctas: ResultCta[] = [];
  if (isReady) {
    ctas.push({ id: "readiness-report", label: "ดู / ดาวน์โหลดรายงานความพร้อม", tone: "primary" });
    ctas.push({ id: "fi-match", label: "ดูสถาบันการเงินที่สอดคล้องกับข้อมูลของคุณ", tone: "secondary" });
  }
  if (canAskAdvisory) {
    ctas.push({
      id: "fa-advisory",
      label: "F.A. ให้คำปรึกษาเพื่อสร้างความพร้อมก่อนสินเชื่อ",
      tone: "primary"
    });
    ctas.push({ id: "readiness-report", label: "ดู / ดาวน์โหลดรายงานความพร้อม", tone: "secondary" });
  }

  const blockingReasons = snapshot.reasonCodes.filter((reason) => reason.severity === "BLOCKER");
  const watchReasons = snapshot.reasonCodes.filter((reason) => reason.severity === "WATCH");

  return {
    applicationId: snapshot.applicationId,
    snapshotId: snapshot.id,
    inputVersion: snapshot.inputVersion,
    evaluatedAt: snapshot.evaluatedAt,
    engineStatus: snapshot.engineStatus,
    productThesis: PRODUCT_THESIS,

    /** ลำดับที่หน้าจอต้องเรียง ห้ามสลับ */
    hierarchy: [
      { id: "route", label: "เส้นทางที่เหมาะสม" },
      { id: "affordability", label: "ความสามารถรับภาระ" },
      { id: "tier", label: "ระดับความพร้อม" },
      { id: "preScore", label: "คะแนนความพร้อม" }
    ],

    hero: {
      /** รหัสภายในจาก engine ไม่เปลี่ยนตามภาษา */
      route,
      /** ข้อความที่ผู้สมัครเห็น — NO NEW DEBT อ่านเป็นภาษาไทย */
      title: isNoNewDebt ? "สถานะ: ยังไม่พร้อมสำหรับสินเชื่อใหม่" : applicantRouteCopy(route),
      titleTh: HERO_TH[route] ?? "",
      support: HERO_SUPPORT[route] ?? "",
      /** Route เป็นหัวเรื่องระดับสูงสุดเสมอ */
      level: 1 as const,
      tone: isReady ? ("ready" as const) : isNoNewDebt ? ("hold" as const) : ("build" as const)
    },

    capacity: {
      state: capacityState,
      availableCash: snapshot.availableCash,
      availableCashLabel: "เงินที่พร้อมรองรับภาระ",
      estimatedObligation: snapshot.estimatedObligation,
      estimatedObligationLabel: "ภาระรถโดยประมาณ",
      // เงินคงเหลือที่แสดงต้องไม่ติดลบ ส่วนที่ขาดถูกรายงานเป็นตัวเลขของตัวเอง
      residual: Math.max(0, snapshot.residual),
      gap: Math.max(0, snapshot.affordabilityGap),
      label: capacityState === "GAP" ? "ยังขาดกระแสเงินสดต่อวัน" : "เหลือหลังรับภาระต่อวัน",
      passed: snapshot.affordabilityPassed,
      principalSustainabilityPassed: snapshot.principalSustainabilityPassed
    },

    preScore: {
      score: snapshot.preScore,
      max: 100,
      tier: snapshot.tier,
      tierCopy: snapshot.tier ? (TIER_COPY[snapshot.tier] ?? null) : null,
      disclaimer: GOVERNANCE_COPY.preScoreDisclaimer,
      /** ต่ำกว่า Route เสมอ */
      level: 3 as const
    },

    passport: {
      declared: { label: "รายได้ที่ผู้สมัครระบุ", value: snapshot.revenue.declaredDailyRevenue },
      evidenceStatus: {
        code: snapshot.revenue.evidenceStatus,
        copy: REVENUE_EVIDENCE_STATUS_COPY[snapshot.revenue.evidenceStatus] ?? ""
      },
      assessment: { label: REVENUE_ASSESSMENT_LABEL, value: snapshot.revenue.assessmentDailyRevenue },
      // บรรทัดนี้มีได้ก็ต่อเมื่อมีหลักฐานธุรกรรมจริง
      verified:
        snapshot.revenue.verifiedDailyRevenue === null
          ? null
          : { label: REVENUE_VERIFIED_LABEL, value: snapshot.revenue.verifiedDailyRevenue },
      eligibleOpEx: { label: "ต้นทุนในการทำงาน", value: snapshot.eligibleOpEx },
      protectedCash: { label: "เงินจำเป็นที่ต้องกันไว้", value: snapshot.protectedCash },
      availableCash: { label: "เงินที่พร้อมรองรับภาระ", value: snapshot.availableCash }
    },

    eligibility: {
      occupationalStatus: snapshot.basicEligibility?.taxiOccupationStatus ?? null,
      licenseStatus: snapshot.basicEligibility?.publicDriverLicenseStatus ?? null,
      vehicleRelationship: snapshot.basicEligibility?.currentVehicleRelationship ?? null,
      occupationalEvidenceStatus: snapshot.basicEligibility?.occupationalEvidenceStatus ?? null,
      statusCopy: snapshot.basicEligibility?.statusCopy ?? "",
      identityState: snapshot.basicEligibility?.identityState ?? "",
      incomeEvidenceReliability: snapshot.incomeEvidenceReliability,
      activityCrossValidation: snapshot.activityEvidenceStatus,
      activityNote: GOVERNANCE_COPY.activityNotIncome
    },

    vehicle: snapshot.vehicleScenario,
    financing: {
      ...snapshot.financingScenario,
      note: GOVERNANCE_COPY.illustrativeFinancingLong
    },

    guarantee: {
      label: GUARANTEE_COPY.label,
      labelTh: GUARANTEE_COPY.labelTh,
      value: snapshot.indicativeGuaranteeEligibleBase,
      disclaimer: GUARANTEE_COPY.disclaimer
    },

    /** สิทธิ์ที่เส้นทางนี้เปิดให้ — client เปลี่ยนเองไม่ได้ */
    fi: {
      canView: isReady || route === ROUTES.BUILD_READINESS,
      canSelect: isReady,
      canConsent: isReady,
      canHandoff: isReady,
      maxSelections: 2
    },

    showsImprovementGuidance: canAskAdvisory,
    blockingReasons,
    watchReasons,
    reasonCodes: snapshot.reasonCodes as ReasonCode[],
    ctas,

    disclaimers: [
      GOVERNANCE_COPY.preScoreNotApproval,
      GOVERNANCE_COPY.zeroDownNotGuarantee,
      GOVERNANCE_COPY.activityNotIncome,
      GOVERNANCE_COPY.fiOwnsDecision
    ]
  };
}

export type ResultViewModel = ReturnType<typeof resultViewModel>;
