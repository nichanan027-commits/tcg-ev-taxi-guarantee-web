/**
 * แบบจำลองหลักฐานรายได้
 *
 * แยกสามชั้นให้ขาดจากกัน:
 *   Declared   — ตัวเลขที่ผู้สมัครระบุเอง
 *   Assessment — ตัวเลขที่นำไปใช้ประเมินในรอบทดลอง
 *   Verified   — เฉพาะส่วนที่มีหลักฐานธุรกรรมจริงรองรับ
 *
 * การพิมพ์ตัวเลขเองไม่ทำให้รายได้กลายเป็น Verified ไม่ว่ากรณีใด
 */
export const REVENUE_EVIDENCE_STATUSES = [
  "DECLARED_ONLY",
  "TRANSACTION_EVIDENCED",
  "CASH_CROSS_VALIDATED",
  "PARTIALLY_EVIDENCED"
] as const;

export type RevenueEvidenceStatus = (typeof REVENUE_EVIDENCE_STATUSES)[number];

export const INCOME_CHANNELS = ["CASH", "QR", "BANK_TRANSFER", "PLATFORM", "OTHER"] as const;
export type IncomeChannel = (typeof INCOME_CHANNELS)[number];

/** ช่องทางที่โดยธรรมชาติมีร่องรอยธุรกรรมให้ตรวจได้ — ยังต้องมีหลักฐานจริงจึงจะนับ */
export const DIGITAL_CHANNELS: IncomeChannel[] = ["QR", "BANK_TRANSFER", "PLATFORM"];

export type IncomeChannelEntry = {
  channel: IncomeChannel;
  dailyAmount: number;
  /** มีหลักฐานธุรกรรมจริงรองรับหรือไม่ — ในรอบแข่งขันเป็น false เว้นแต่ระบุว่ามีจริง */
  hasTransactionEvidence: boolean;
};

export type RevenueAssessment = {
  declaredDailyRevenue: number;
  assessmentDailyRevenue: number;
  verifiedDailyRevenue: number | null;
  evidenceStatus: RevenueEvidenceStatus;
  evidenceReliability: string;
  /** สัดส่วนรายได้ที่มีหลักฐานรองรับ คำนวณจากข้อมูลจริง ไม่ใช่ค่าที่ผู้สมัครพิมพ์ */
  evidencedSharePct: number;
  /** ผลการตรวจสอบไขว้จากข้อมูลกิจกรรม — ใช้ยืนยันความสม่ำเสมอ ไม่ใช่รายได้ */
  activityCrossValidated: boolean;
};

export const REVENUE_EVIDENCE_STATUS_COPY: Record<RevenueEvidenceStatus, string> = {
  DECLARED_ONLY: "ผู้สมัครระบุเอง — ยังไม่มีหลักฐานธุรกรรมรองรับ",
  TRANSACTION_EVIDENCED: "มีหลักฐานธุรกรรมรองรับทั้งจำนวน",
  CASH_CROSS_VALIDATED: "เงินสดที่ตรวจสอบไขว้กับข้อมูลการวิ่งแล้ว — ยังไม่ใช่รายได้ที่ยืนยัน",
  PARTIALLY_EVIDENCED: "มีหลักฐานธุรกรรมรองรับบางส่วน"
};
