/**
 * Competition configuration — System A (Front Office) only.
 *
 * ค่าที่นี่คือค่ากำกับโหมดการแข่งขัน ไม่ใช่กติกาการให้คะแนนหรือการจัดเส้นทาง
 * ตรรกะการประเมินทั้งหมดยังอยู่ใน public/route2own-engine.js ซึ่ง Frozen ไว้แล้ว
 */
export const competitionConfig = {
  mode: "COMPETITION" as const,
  consentVersion: "RTO-COMP-1.0",
  phoneVerificationStatus: "NOT_REQUIRED_COMPETITION" as const,
  piiRetentionDays: 30,
  lineContact: "@tcgfirst",
  maxFiSelections: 2,
  defaultVehicleId: "AION_ES",
  applicationIdPrefix: "RTO-C26",
  faCaseIdPrefix: "FA-C26"
} as const;

/** ข้อความกำกับที่ต้องปรากฏต่อผู้ใช้เสมอ ห้ามแก้ให้อ่อนลง */
export const GOVERNANCE_COPY = {
  competitionRegistration: "Competition Registration — ไม่ใช่การยื่นขอสินเชื่อจริง",
  phoneVerification: "Phone Verification: Not required — Competition Mode",
  preScoreNotApproval: "Pre-Score ≠ Loan Approval",
  preScoreDisclaimer: "คะแนนประกอบการประเมินความพร้อม ไม่ใช่ผลอนุมัติสินเชื่อ",
  zeroDownNotGuarantee: "0% Down ≠ 100% Guarantee",
  activityNotIncome: "Activity Data ≠ Income",
  illustrativeFinancing: "ประมาณการเบื้องต้น (Illustrative Financing Estimate)",
  illustrativeFinancingLong:
    "ประมาณการเบื้องต้น (Illustrative Financing Estimate) — ไม่ใช่ข้อเสนอสินเชื่อหรือค่างวดที่ FI อนุมัติจริง",
  secureVerificationSafety: "ข้อมูลส่วนนี้ไม่ถูกบันทึกหรือส่งออกจากอุปกรณ์ในระบบการแข่งขัน",
  readinessNotApproval:
    "เอกสารนี้เป็นผลการประเมินความพร้อมและข้อเสนอเพื่อเข้าสู่กระบวนการพิจารณา ไม่ใช่การอนุมัติสินเชื่อ และไม่ใช่หนังสือค้ำประกัน E-LG",
  fiOwnsDecision: "สถาบันการเงินเป็นผู้ตัดสินสินเชื่อขั้นสุดท้าย",
  fiMatchHeading: "สถาบันการเงินที่สอดคล้องกับข้อมูลของคุณ",
  fiMaxSelections: "เลือกได้สูงสุด 2 แห่ง",
  checkWithFi: "กรุณาตรวจสอบเงื่อนไขล่าสุดกับ FI"
} as const;

/** สถานะเส้นทางของใบสมัคร — ไม่มี APPROVED เพราะ Route to Own ไม่อนุมัติสินเชื่อ */
export const APPLICATION_STATUSES = [
  "DRAFT",
  "CONSENTED",
  "DATA_COMPLETE",
  "ASSESSED",
  "ROUTED",
  "FI_SELECTED",
  "FI_CONSENTED",
  "FA_REQUESTED"
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** เส้นทางตามหลัก (canonical) ของ Frozen Engine — ห้ามเพิ่ม/ลด */
export const CANONICAL_ROUTES = [
  "READY FOR FI",
  "BUILD READINESS / CONTINUE TO LEASE",
  "NO NEW DEBT"
] as const;

export type CanonicalRoute = (typeof CANONICAL_ROUTES)[number];

/**
 * ข้อความที่แสดงต่อผู้สมัคร โดย NO NEW DEBT ต้องอ่านว่า "ยังไม่พร้อมสำหรับสินเชื่อใหม่"
 * ส่วนค่า canonical ภายในต้องไม่เปลี่ยน
 */
export const APPLICANT_ROUTE_COPY: Record<CanonicalRoute, string> = {
  "READY FOR FI": "READY FOR FI",
  "BUILD READINESS / CONTINUE TO LEASE": "BUILD READINESS / CONTINUE TO LEASE",
  "NO NEW DEBT": "ยังไม่พร้อมสำหรับสินเชื่อใหม่"
};

export function applicantRouteCopy(route: string): string {
  return APPLICANT_ROUTE_COPY[route as CanonicalRoute] ?? route;
}

/** เส้นทางที่ส่งต่อ FI ได้ — มีเพียงเส้นทางเดียว */
export function canHandoffToFi(route: string): boolean {
  return route === "READY FOR FI";
}

/** เส้นทางที่ขอคำปรึกษา F.A Center ได้ */
export function canRequestFaAdvisory(route: string): boolean {
  return route === "BUILD READINESS / CONTINUE TO LEASE" || route === "NO NEW DEBT";
}

/** สถานะแหล่งที่มาของข้อมูล FI — ห้ามนำข้อมูลสื่อ/AI มาแสดงเป็นข้อเสนอที่ยืนยันแล้ว */
export const FI_SOURCE_STATUSES = [
  "VERIFIED_BY_FI",
  "PUBLIC_SOURCE_REFERENCE",
  "COMPETITION_ILLUSTRATION"
] as const;

export type FiSourceStatus = (typeof FI_SOURCE_STATUSES)[number];

export const FI_SOURCE_STATUS_COPY: Record<FiSourceStatus, string> = {
  VERIFIED_BY_FI: "ยืนยันโดยสถาบันการเงิน",
  PUBLIC_SOURCE_REFERENCE: "อ้างอิงแหล่งข้อมูลสาธารณะ",
  COMPETITION_ILLUSTRATION: "ตัวอย่างประกอบการแข่งขัน"
};

/** ช่วงเวลาและช่องทางติดต่อกลับของ F.A Center */
export const FA_CONTACT_TIMES = ["MORNING", "AFTERNOON", "EVENING"] as const;
export const FA_CONTACT_CHANNELS = ["PHONE", "LINE"] as const;

export const FA_CONTACT_TIME_COPY: Record<(typeof FA_CONTACT_TIMES)[number], string> = {
  MORNING: "เช้า",
  AFTERNOON: "บ่าย",
  EVENING: "เย็น"
};

export const FA_CONTACT_CHANNEL_COPY: Record<(typeof FA_CONTACT_CHANNELS)[number], string> = {
  PHONE: "โทรศัพท์",
  LINE: "LINE"
};

export const FA_CASE_STATUSES = [
  "NEW",
  "ACCEPTED",
  "CONTACTED",
  "ADVISORY_IN_PROGRESS",
  "FOLLOW_UP",
  "CLOSED"
] as const;

export type FaCaseStatus = (typeof FA_CASE_STATUSES)[number];

/** เคสที่ยังทำงานอยู่ — ใช้กันการสร้างคำขอซ้ำ */
export const FA_ACTIVE_STATUSES: FaCaseStatus[] = [
  "NEW",
  "ACCEPTED",
  "CONTACTED",
  "ADVISORY_IN_PROGRESS",
  "FOLLOW_UP"
];
