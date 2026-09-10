import { ROUTES, routeLabelOf } from "../route2own.ts";

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
  /**
   * นโยบายเก็บข้อมูลส่วนบุคคลของรอบการแข่งขัน
   *
   * นับจาก "วันสิ้นสุดการแข่งขัน" ไม่ใช่จากวันที่แต่ละใบสมัครถูกสร้าง
   * เพราะข้อมูลทั้งรอบถูกเก็บไว้เพื่อการตัดสินชุดเดียวกัน จึงหมดความจำเป็นพร้อมกัน
   * ถ้านับจาก createdAt ใบที่สมัครก่อนจะถูกลบทั้งที่การตัดสินยังไม่จบ
   */
  competitionCutoffAt: "2026-10-31T23:59:59.000Z",
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

/**
 * เส้นทางตามหลัก (canonical) มาจาก Frozen Engine โดยตรง ไม่ประกาศซ้ำที่นี่
 *
 * รหัสภายในกับป้ายที่แสดงต่อผู้ใช้เป็นคนละค่า:
 *   รหัสภายใน `BUILD READINESS` → ป้ายสาธารณะ `BUILD READINESS / CONTINUE TO LEASE`
 * การประกาศซ้ำเองจะทำให้สองฝั่งเพี้ยนออกจากกันได้ จึงอ่านจาก engine เสมอ
 */
export const CANONICAL_ROUTES = [ROUTES.READY_FOR_FI, ROUTES.BUILD_READINESS, ROUTES.NO_NEW_DEBT] as const;

export type CanonicalRoute = (typeof CANONICAL_ROUTES)[number];

/**
 * ข้อความที่แสดงต่อผู้สมัคร
 * NO NEW DEBT ต้องอ่านว่า "ยังไม่พร้อมสำหรับสินเชื่อใหม่" ส่วนรหัสภายในไม่เปลี่ยน
 * เส้นทางอื่นใช้ป้ายสาธารณะจาก engine
 */
export function applicantRouteCopy(route: string): string {
  if (route === ROUTES.NO_NEW_DEBT) return "ยังไม่พร้อมสำหรับสินเชื่อใหม่";
  return publicRouteLabel(route);
}

/** ป้ายสาธารณะตาม engine (ใช้ในหน้าจอ Staff ที่ต้องเห็นชื่อเส้นทางเต็ม) */
export function publicRouteLabel(route: string): string {
  return isCanonicalRoute(route) ? routeLabelOf(route) || route : route;
}

export function isCanonicalRoute(route: string): route is CanonicalRoute {
  return (CANONICAL_ROUTES as readonly string[]).includes(route);
}

/** เส้นทางที่ส่งต่อ FI ได้ — มีเพียงเส้นทางเดียว */
export function canHandoffToFi(route: string): boolean {
  return route === ROUTES.READY_FOR_FI;
}

/** เส้นทางที่ขอคำปรึกษา F.A Center ได้ */
export function canRequestFaAdvisory(route: string): boolean {
  return route === ROUTES.BUILD_READINESS || route === ROUTES.NO_NEW_DEBT;
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
