import test from "node:test";
import assert from "node:assert/strict";

import {
  ProfileInputSchema,
  FinancialInputSchema,
  RegistrationInputSchema,
  toEngineInput
} from "../app/lib/registration/validation.ts";
import { competitionConfig } from "../app/lib/config/competition.ts";

const validProfile = {
  displayName: "ผู้ทดลอง",
  phone: "0812345678",
  province: "กรุงเทพมหานคร",
  driverStatus: "RENTING",
  yearsDriving: 6,
  ownershipGoal: "OWN_WITHIN_5_YEARS"
};

const validFinancial = {
  averageDailyIncome: 1850.52,
  incomeChannels: ["APP_TRANSFER", "CASH"],
  workingDaysPerMonth: 26,
  verifiedPct: 85,
  currentRentDaily: 700,
  fuelDaily: 300,
  batteryServiceDaily: 0,
  otherOpexDaily: 60,
  householdMonthly: 15000,
  existingDebtMonthly: 0,
  activityConsistency: 88,
  vehicleId: "AION_ES",
  vehiclePrice: 800000,
  termMonths: 60,
  annualRatePct: 4.5
};

const valid = { profile: validProfile, financial: validFinancial };

test("a complete registration input parses and carries competition-mode phone status", () => {
  const parsed = RegistrationInputSchema.parse(valid);
  assert.equal(parsed.profile.phoneVerificationStatus, "NOT_REQUIRED_COMPETITION");
  assert.equal(parsed.profile.phoneVerificationStatus, competitionConfig.phoneVerificationStatus);
  assert.equal(parsed.financial.vehicleId, "AION_ES");
});

test("negative money and negative experience are rejected, not coerced", () => {
  assert.throws(() =>
    RegistrationInputSchema.parse({
      ...valid,
      financial: { ...validFinancial, averageDailyIncome: -1 }
    })
  );
  assert.throws(() =>
    RegistrationInputSchema.parse({
      ...valid,
      profile: { ...validProfile, yearsDriving: -1 }
    })
  );
});

test("the default vehicle id is accepted and unknown vehicles are rejected", () => {
  assert.doesNotThrow(() => FinancialInputSchema.parse({ ...validFinancial, vehicleId: "AION_ES" }));
  assert.doesNotThrow(() => FinancialInputSchema.parse({ ...validFinancial, vehicleId: "AION_Y_PLUS" }));
  assert.throws(() => FinancialInputSchema.parse({ ...validFinancial, vehicleId: "TESLA_MODEL_S" }));
});

test("percentage fields stay inside 0-100", () => {
  assert.throws(() => FinancialInputSchema.parse({ ...validFinancial, verifiedPct: 101 }));
  assert.throws(() => FinancialInputSchema.parse({ ...validFinancial, activityConsistency: -5 }));
  assert.doesNotThrow(() => FinancialInputSchema.parse({ ...validFinancial, verifiedPct: 0 }));
});

test("the phone must look like a Thai mobile number", () => {
  assert.throws(() => ProfileInputSchema.parse({ ...validProfile, phone: "12345" }));
  assert.doesNotThrow(() => ProfileInputSchema.parse({ ...validProfile, phone: "081-234-5678" }));
});

test("no sensitive Secure Verification field can enter the registration schema", () => {
  // ค่าจากหน้า Secure Verification ต้องไม่ผ่านเข้ามาแม้ผู้เรียกจะแนบมาด้วย
  const parsed = RegistrationInputSchema.parse({
    ...valid,
    profile: { ...validProfile, nationalId: "1234567890123" },
    financial: { ...validFinancial, bankAccountNumber: "1234567890" }
  });

  const serialized = JSON.stringify(parsed);
  assert.doesNotMatch(serialized, /nationalId/);
  assert.doesNotMatch(serialized, /bankAccountNumber/);
  assert.doesNotMatch(serialized, /1234567890123/);
});

test("the engine input is built only from allow-listed registration fields", () => {
  const parsed = RegistrationInputSchema.parse(valid);
  const engineInput = toEngineInput(parsed);

  // ค่าเหล่านี้คือ input ที่ Frozen Engine รู้จัก
  assert.equal(engineInput.grossDaily, 1850.52);
  assert.equal(engineInput.verifiedPct, 85);
  assert.equal(engineInput.vehiclePrice, 800000);
  assert.equal(engineInput.downPayment, 0, "การแข่งขันใช้เงินดาวน์ผู้ขับ 0% เสมอ");
  assert.equal(engineInput.workingDays, 26);

  // ต้องไม่มีสนามที่ Engine ไม่รู้จักหลุดเข้าไป
  assert.equal(engineInput.displayName, undefined);
  assert.equal(engineInput.phone, undefined);
  assert.equal(engineInput.province, undefined);
});
