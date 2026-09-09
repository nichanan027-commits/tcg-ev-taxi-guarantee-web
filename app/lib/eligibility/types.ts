import { z } from "zod";

/**
 * Basic Eligibility / Occupational Status
 *
 * เก็บเฉพาะ metadata ของสถานะอาชีพ ไม่รับเอกสารหรือเลขที่เอกสารจริง
 * หลักสำคัญ: กรอกฟอร์มครบ ไม่เท่ากับผ่านคุณสมบัติ
 * ในโหมดแข่งขันยังไม่มีการยืนยันตัวตนจริง จึงห้ามแสดงว่า Verified
 */
export const TAXI_OCCUPATION_STATUSES = [
  "ACTIVE_TAXI_DRIVER",
  "OTHER_PROFESSIONAL_DRIVER",
  "OTHER"
] as const;

export const PUBLIC_DRIVER_LICENSE_STATUSES = ["VALID", "TO_VERIFY", "NOT_AVAILABLE"] as const;
export const VEHICLE_RELATIONSHIPS = ["RENT", "OWNER", "OTHER"] as const;
export const OCCUPATIONAL_EVIDENCE_STATUSES = ["DECLARED", "SUPPORTED", "TO_VERIFY"] as const;

export type TaxiOccupationStatus = (typeof TAXI_OCCUPATION_STATUSES)[number];
export type PublicDriverLicenseStatus = (typeof PUBLIC_DRIVER_LICENSE_STATUSES)[number];
export type VehicleRelationship = (typeof VEHICLE_RELATIONSHIPS)[number];
export type OccupationalEvidenceStatus = (typeof OCCUPATIONAL_EVIDENCE_STATUSES)[number];

export const BasicEligibilitySchema = z.object({
  taxiOccupationStatus: z.enum(TAXI_OCCUPATION_STATUSES),
  publicDriverLicenseStatus: z.enum(PUBLIC_DRIVER_LICENSE_STATUSES),
  currentVehicleRelationship: z.enum(VEHICLE_RELATIONSHIPS),
  cooperativeOrOperator: z.string().trim().max(160).optional(),
  yearsProfessionalDriving: z
    .number()
    .int("ปีประสบการณ์ต้องเป็นจำนวนเต็ม")
    .min(0, "ปีประสบการณ์ต้องไม่ติดลบ")
    .max(60),
  serviceProvince: z.string().trim().min(1, "กรุณาระบุจังหวัดที่ให้บริการ").max(80),
  occupationalEvidenceStatus: z.enum(OCCUPATIONAL_EVIDENCE_STATUSES)
});

export type BasicEligibilityInput = z.infer<typeof BasicEligibilitySchema>;

export const ELIGIBILITY_COPY = {
  declared: "ข้อมูลอาชีพที่ผู้สมัครระบุ — รอยืนยันในขั้นตอนจริง",
  supported: "ข้อมูลอาชีพที่ผู้สมัครระบุ พร้อมข้อมูลประกอบ — รอยืนยันในขั้นตอนจริง",
  toVerify: "ข้อมูลอาชีพที่ผู้สมัครระบุ — ต้องยืนยันในขั้นตอนจริง",
  identityDeferred: "Identity verification deferred — Competition Mode",
  formNotEligibility: "การกรอกข้อมูลครบถ้วนไม่ใช่การผ่านคุณสมบัติ"
} as const;

const STATUS_COPY: Record<OccupationalEvidenceStatus, string> = {
  DECLARED: ELIGIBILITY_COPY.declared,
  SUPPORTED: ELIGIBILITY_COPY.supported,
  TO_VERIFY: ELIGIBILITY_COPY.toVerify
};

export type BasicEligibility = BasicEligibilityInput & {
  /** โหมดแข่งขันยังไม่มีการยืนยันจริง ค่านี้จึงเป็น false เสมอ */
  verified: false;
  statusCopy: string;
  identityState: string;
};

export function basicEligibilityOf(input: unknown): BasicEligibility {
  const parsed = BasicEligibilitySchema.parse(input);
  return {
    ...parsed,
    verified: false,
    statusCopy: STATUS_COPY[parsed.occupationalEvidenceStatus],
    identityState: ELIGIBILITY_COPY.identityDeferred
  };
}

/** ตรวจว่ากรอกครบหรือยัง — เป็นคนละเรื่องกับการผ่านคุณสมบัติ */
export function isFormComplete(input: unknown): boolean {
  return BasicEligibilitySchema.safeParse(input).success;
}
