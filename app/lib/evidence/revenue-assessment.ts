import { incomeEvidenceReliabilityOf } from "../route2own.ts";
import { DIGITAL_CHANNELS } from "./types.ts";
import type { IncomeChannelEntry, RevenueAssessment, RevenueEvidenceStatus } from "./types.ts";

/** ป้ายกำกับรายได้ที่ใช้ประเมินในรอบแข่งขัน — ห้ามเรียกว่า Verified Revenue */
export const REVENUE_ASSESSMENT_LABEL = "รายได้ที่ใช้ในการประเมินรอบทดลอง";
export const REVENUE_ASSESSMENT_LABEL_EN = "Assessment Revenue — Competition Mode";
export const REVENUE_VERIFIED_LABEL = "รายได้ที่มีหลักฐานธุรกรรมรองรับ";

/**
 * เกณฑ์ตรวจสอบไขว้จากข้อมูลกิจกรรม
 *
 * ค่านี้บอกได้เพียงว่า "การวิ่งสม่ำเสมอพอจะสอดคล้องกับรายได้ที่แจ้งไหม"
 * ไม่ได้แปลงเป็นจำนวนเงิน และไม่ทำให้รายได้กลายเป็น Verified
 */
const ACTIVITY_CROSS_VALIDATION_MIN = 70;

export type AssessRevenueInput = {
  entries: IncomeChannelEntry[];
  /** ความสม่ำเสมอของการวิ่งจาก GPS/trips/km/hours — Cross-Validation เท่านั้น */
  activityConsistency: number;
};

function requireAmount(value: number, channel: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`จำนวนเงินของช่องทาง ${channel} ต้องเป็นตัวเลขที่ไม่ติดลบ`);
  }
  return value;
}

/**
 * ประเมินรายได้จากหลักฐานที่มีจริง
 *
 * รายได้ที่ผู้สมัครพิมพ์เองจะกลายเป็น assessmentDailyRevenue เท่านั้น
 * verifiedDailyRevenue จะมีค่าก็ต่อเมื่อมีหลักฐานธุรกรรมรองรับ มิฉะนั้นเป็น null
 */
export function assessRevenue(input: AssessRevenueInput): RevenueAssessment {
  const entries = input.entries ?? [];

  let declared = 0;
  let evidenced = 0;
  let cashDeclared = 0;

  for (const entry of entries) {
    const amount = requireAmount(entry.dailyAmount, entry.channel);
    declared += amount;

    // หลักฐานธุรกรรมนับได้เฉพาะช่องทางที่มีร่องรอยให้ตรวจ และต้องระบุว่ามีหลักฐานจริง
    if (entry.hasTransactionEvidence && DIGITAL_CHANNELS.includes(entry.channel)) {
      evidenced += amount;
    } else if (entry.channel === "CASH") {
      cashDeclared += amount;
    }
  }

  const activityCrossValidated =
    Number.isFinite(input.activityConsistency) && input.activityConsistency >= ACTIVITY_CROSS_VALIDATION_MIN;

  const evidencedSharePct = declared > 0 ? (evidenced / declared) * 100 : 0;

  let evidenceStatus: RevenueEvidenceStatus;
  if (evidenced > 0 && evidenced >= declared) {
    evidenceStatus = "TRANSACTION_EVIDENCED";
  } else if (evidenced > 0) {
    evidenceStatus = "PARTIALLY_EVIDENCED";
  } else if (cashDeclared > 0 && activityCrossValidated) {
    evidenceStatus = "CASH_CROSS_VALIDATED";
  } else {
    evidenceStatus = "DECLARED_ONLY";
  }

  return {
    declaredDailyRevenue: declared,
    // ตัวเลขที่นำไปประเมินยังเป็นจำนวนที่ผู้สมัครระบุ แต่ถูกเรียกชื่อตามความเป็นจริง
    assessmentDailyRevenue: declared,
    verifiedDailyRevenue: evidenced > 0 ? evidenced : null,
    evidenceStatus,
    evidenceReliability: incomeEvidenceReliabilityOf(evidencedSharePct),
    evidencedSharePct,
    activityCrossValidated
  };
}

/**
 * สัดส่วนหลักฐานที่ส่งให้ Frozen Engine
 *
 * เดิมค่านี้เป็นช่องที่ผู้สมัครพิมพ์เอง ซึ่งทำให้ตัวเลขที่พิมพ์กลายเป็น Verified Revenue ทันที
 * ตอนนี้คำนวณจากหลักฐานที่มีจริงเท่านั้น ผู้สมัครกำหนดเองไม่ได้
 */
export function engineVerifiedPct(assessment: RevenueAssessment): number {
  return assessment.evidencedSharePct;
}

/** ป้ายที่ใช้เรียกตัวเลขรายได้บนหน้าจอ ขึ้นกับว่ามีหลักฐานจริงหรือยัง */
export function revenueLabelOf(assessment: RevenueAssessment): string {
  return assessment.verifiedDailyRevenue === null ? REVENUE_ASSESSMENT_LABEL : REVENUE_VERIFIED_LABEL;
}
