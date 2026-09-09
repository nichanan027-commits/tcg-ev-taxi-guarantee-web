import { z } from "zod";

import { competitionConfig } from "../config/competition.ts";
import { DRIVER_STATUSES, INCOME_CHANNELS, OWNERSHIP_GOALS, VEHICLE_IDS } from "./types.ts";
import type { RegistrationInput } from "./types.ts";

/**
 * Validation ของ Competition Registration
 *
 * ทุก schema ใช้ strip mode ของ Zod โดยตั้งใจ: สนามที่ไม่ได้ประกาศไว้จะถูกตัดทิ้ง
 * ไม่ใช่แค่ถูกปฏิเสธ ทำให้ค่าอ่อนไหวจากหน้า Secure Verification
 * (เลขบัตรประชาชน เลขบัญชี ฯลฯ) ไม่มีทางไหลผ่านเข้าสู่ฐานข้อมูลแม้ผู้เรียกจะแนบมา
 */
const money = (label: string) =>
  z
    .number({ message: `${label} ต้องเป็นตัวเลข` })
    .finite()
    .min(0, `${label} ต้องไม่ติดลบ`)
    .max(10_000_000, `${label} สูงเกินช่วงที่รองรับ`);

const percent = (label: string) =>
  z.number({ message: `${label} ต้องเป็นตัวเลข` }).min(0, `${label} ต้องไม่ติดลบ`).max(100, `${label} ต้องไม่เกิน 100`);

const thaiMobile = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine((value) => /^0\d{8,9}$/.test(value), "เบอร์โทรศัพท์ไม่ถูกต้อง");

export const ProfileInputSchema = z.object({
  displayName: z.string().trim().min(1, "กรุณาระบุชื่อ").max(120),
  phone: thaiMobile,
  province: z.string().trim().min(1, "กรุณาระบุจังหวัด").max(80),
  driverStatus: z.enum(DRIVER_STATUSES),
  yearsDriving: z.number().int("ปีประสบการณ์ต้องเป็นจำนวนเต็ม").min(0, "ปีประสบการณ์ต้องไม่ติดลบ").max(60),
  ownershipGoal: z.enum(OWNERSHIP_GOALS),
  phoneVerificationStatus: z
    .literal(competitionConfig.phoneVerificationStatus)
    .default(competitionConfig.phoneVerificationStatus)
});

export const FinancialInputSchema = z.object({
  averageDailyIncome: money("รายได้เฉลี่ยต่อวัน"),
  incomeChannels: z.array(z.enum(INCOME_CHANNELS)).min(1, "เลือกช่องทางรายได้อย่างน้อย 1 ช่องทาง"),
  workingDaysPerMonth: z.number().int().min(1, "วันทำงานต่อเดือนต้องมากกว่า 0").max(31),
  verifiedPct: percent("สัดส่วนรายได้ที่ตรวจสอบย้อนกลับได้"),
  currentRentDaily: money("ค่าเช่ารถปัจจุบันต่อวัน"),
  fuelDaily: money("ค่าเชื้อเพลิงต่อวัน"),
  batteryServiceDaily: money("ค่าบริการแบตเตอรี่ต่อวัน"),
  otherOpexDaily: money("ค่าใช้จ่ายเดินรถอื่นต่อวัน"),
  householdMonthly: money("ค่าใช้จ่ายครัวเรือนต่อเดือน"),
  existingDebtMonthly: money("ภาระหนี้เดิมต่อเดือน"),
  activityConsistency: percent("ความสม่ำเสมอของการวิ่ง"),
  vehicleId: z.enum(VEHICLE_IDS).default(competitionConfig.defaultVehicleId),
  vehiclePrice: money("ราคารถ").min(1, "ราคารถต้องมากกว่า 0"),
  termMonths: z.number().int().min(12, "ระยะผ่อนขั้นต่ำ 12 เดือน").max(96, "ระยะผ่อนสูงสุด 96 เดือน"),
  annualRatePct: z.number().min(0, "อัตราดอกเบี้ยต้องไม่ติดลบ").max(36, "อัตราดอกเบี้ยสูงเกินช่วงที่รองรับ")
});

export const RegistrationInputSchema = z.object({
  profile: ProfileInputSchema,
  financial: FinancialInputSchema
});

export const PartialRegistrationInputSchema = z.object({
  profile: ProfileInputSchema.optional(),
  financial: FinancialInputSchema.optional()
});

export type ParsedRegistrationInput = z.infer<typeof RegistrationInputSchema>;

/**
 * แปลงข้อมูลใบสมัครเป็น input ของ Frozen Engine
 *
 * เป็น allow-list ที่เขียนออกทีละสนาม ไม่ใช้ spread จาก object ใบสมัคร
 * เพื่อไม่ให้สนามใหม่ในอนาคตหลุดเข้าไปถึง Engine โดยไม่ตั้งใจ
 * เงินดาวน์ผู้ขับถูกตรึงไว้ที่ 0 ตามแบบผลิตภัณฑ์หลัก
 */
export function toEngineInput(input: RegistrationInput) {
  const f = input.financial;
  return {
    grossDaily: f.averageDailyIncome,
    verifiedPct: f.verifiedPct,
    workingDays: f.workingDaysPerMonth,
    rentDaily: f.currentRentDaily,
    fuelDaily: f.fuelDaily,
    batteryServiceDaily: f.batteryServiceDaily,
    otherDaily: f.otherOpexDaily,
    householdMonthly: f.householdMonthly,
    existingDebt: f.existingDebtMonthly,
    activityConsistency: f.activityConsistency,
    vehiclePrice: f.vehiclePrice,
    downPayment: 0 as const,
    termMonths: f.termMonths,
    rateAnnual: f.annualRatePct
  };
}
