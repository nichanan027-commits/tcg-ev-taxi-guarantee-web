import { GOVERNANCE_COPY, canHandoffToFi } from "../config/competition.ts";
import { GUARANTEE_COPY } from "../evaluation/guarantee-wording.ts";
import { REVENUE_EVIDENCE_STATUS_COPY } from "../evidence/types.ts";
import type { EvaluationSnapshot, FinancingScenario } from "../registration/types.ts";
import type { FiProduct } from "./catalogue.ts";

/**
 * FI Handoff Preparation — จุดสิ้นสุดของ System A
 *
 * ชุดข้อมูลนี้เตรียมไว้ให้สถาบันการเงินใช้พิจารณา ไม่ใช่คำขออนุมัติและไม่ผูกพันฝ่ายใด
 * การพิจารณาสินเชื่อ การอนุมัติ และเงื่อนไขตามสัญญา อยู่นอกระบบนี้ทั้งหมด
 *
 * สิ่งที่เกิดหลัง FI อนุมัติ (Child E-LG, การหักชำระจริง, การติดตามหนี้, การเคลม)
 * อยู่ในระบบหลังอนุมัติซึ่งเป็นคนละ repository
 */
export type FiConsentSummary = { version: string; acceptedAt: string; accepted: boolean };

export type FiHandoffPackage = ReturnType<typeof buildHandoffPackage>;

export function buildHandoffPackage(input: {
  applicationId: string;
  fi: Pick<FiProduct, "id" | "fiName" | "productName" | "sourceStatus" | "sourceLabel">;
  snapshot: EvaluationSnapshot;
  financingScenario: FinancingScenario;
  consent: FiConsentSummary;
}) {
  const { applicationId, fi, snapshot, financingScenario, consent } = input;

  // ด่านสุดท้าย: ต้องเป็น READY ภายใต้เงื่อนไขของ FI รายนี้ และต้องมีความยินยอมของ FI รายนี้
  if (!canHandoffToFi(snapshot.route)) {
    throw new Error(
      `ส่งต่อไม่ได้: ผลประเมินภายใต้เงื่อนไขของ ${fi.fiName} คือ ${snapshot.route} ไม่ใช่ READY FOR FI`
    );
  }
  if (!consent.accepted) {
    throw new Error(`ส่งต่อไม่ได้: ยังไม่มีความยินยอมสำหรับ ${fi.fiName}`);
  }

  return {
    applicationId,
    fiId: fi.id,
    fiName: fi.fiName,
    productName: fi.productName,

    /** ผูกกับ Snapshot ของ FI รายนี้โดยเฉพาะ ไม่ใช่ผลของ FI อื่น */
    evaluationSnapshotId: snapshot.id,
    snapshotVersion: snapshot.inputVersion,
    evaluatedAt: snapshot.evaluatedAt,

    route: snapshot.route,
    preScore: snapshot.preScore,
    tier: snapshot.tier,

    financialPassport: {
      declaredDailyRevenue: snapshot.revenue.declaredDailyRevenue,
      assessmentDailyRevenue: snapshot.revenue.assessmentDailyRevenue,
      verifiedDailyRevenue: snapshot.revenue.verifiedDailyRevenue,
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

    basicEligibilitySummary: snapshot.basicEligibility
      ? {
          taxiOccupationStatus: snapshot.basicEligibility.taxiOccupationStatus,
          publicDriverLicenseStatus: snapshot.basicEligibility.publicDriverLicenseStatus,
          currentVehicleRelationship: snapshot.basicEligibility.currentVehicleRelationship,
          yearsProfessionalDriving: snapshot.basicEligibility.yearsProfessionalDriving,
          serviceProvince: snapshot.basicEligibility.serviceProvince,
          occupationalEvidenceStatus: snapshot.basicEligibility.occupationalEvidenceStatus,
          statusCopy: snapshot.basicEligibility.statusCopy,
          identityState: snapshot.basicEligibility.identityState
        }
      : null,

    incomeEvidenceSummary: {
      evidenceStatus: snapshot.revenue.evidenceStatus,
      evidenceStatusCopy: REVENUE_EVIDENCE_STATUS_COPY[snapshot.revenue.evidenceStatus] ?? "",
      incomeEvidenceReliability: snapshot.incomeEvidenceReliability,
      activityEvidenceStatus: snapshot.activityEvidenceStatus,
      activityNote: GOVERNANCE_COPY.activityNotIncome
    },

    vehicleScenario: snapshot.vehicleScenario,
    financingScenario,
    financingNote: GOVERNANCE_COPY.illustrativeFinancingLong,

    guarantee: {
      label: GUARANTEE_COPY.label,
      labelTh: GUARANTEE_COPY.labelTh,
      indicativeGuaranteeEligibleBase: snapshot.indicativeGuaranteeEligibleBase,
      disclaimer: GUARANTEE_COPY.disclaimer
    },

    consent: {
      version: consent.version,
      acceptedAt: consent.acceptedAt,
      scope: `FI:${fi.id}`
    },

    decisionRights: {
      routeToOwn: "Basic Eligibility · Credit Readiness · Pre-Screen · Guarantee Readiness",
      financialInstitution: "Underwriting · Final Credit Decision · Contractual Terms"
    },

    disclaimers: [
      GOVERNANCE_COPY.preScoreNotApproval,
      "สถาบันการเงินเป็นผู้พิจารณาและตัดสินสินเชื่อขั้นสุดท้าย",
      GOVERNANCE_COPY.zeroDownNotGuarantee,
      GOVERNANCE_COPY.readinessNotApproval
    ]
  };
}
