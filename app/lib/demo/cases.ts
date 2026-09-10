import type { RegistrationInput } from "../registration/types.ts";

/**
 * ชุดข้อมูลสาธิตสำหรับการนำเสนอ
 *
 * เป็นข้อมูลสมมติที่ตั้งค่าไว้ให้ผลลัพธ์คงที่ทุกครั้ง เพื่อให้การนำเสนอ 7 นาทีไม่พลาด
 * ไม่ใช่ข้อมูลลูกค้าจริง และต้องติดป้าย "Competition Demo Data" ทุกครั้งที่แสดง
 */
export const DEMO_BADGE = "Competition Demo Data";
export const DEMO_NOTICE = "ข้อมูลสาธิตสำหรับการแข่งขัน ไม่ใช่ข้อมูลลูกค้าจริง";

const profile = (displayName: string) => ({
  displayName,
  phone: "0812345678",
  province: "กรุงเทพมหานคร",
  driverStatus: "RENTING" as const,
  yearsDriving: 6,
  ownershipGoal: "OWN_WITHIN_5_YEARS" as const,
  phoneVerificationStatus: "NOT_REQUIRED_COMPETITION" as const
});

const eligibility = {
  taxiOccupationStatus: "ACTIVE_TAXI_DRIVER" as const,
  publicDriverLicenseStatus: "TO_VERIFY" as const,
  currentVehicleRelationship: "RENT" as const,
  cooperativeOrOperator: "สหกรณ์แท็กซี่ตัวอย่าง",
  yearsProfessionalDriving: 6,
  serviceProvince: "กรุงเทพมหานคร",
  occupationalEvidenceStatus: "DECLARED" as const
};

const costs = {
  workingDaysPerMonth: 26,
  currentRentDaily: 700,
  fuelDaily: 300,
  batteryServiceDaily: 0,
  otherOpexDaily: 60,
  householdMonthly: 15000,
  existingDebtMonthly: 0,
  vehicleId: "AION_ES" as const,
  vehiclePrice: 800000,
  termMonths: 60,
  annualRatePct: 4.5
};

export type DemoCaseId = "A" | "B" | "C" | "D";

export type DemoCase = {
  id: DemoCaseId;
  title: string;
  expectation: string;
  /** สิ่งที่กรรมการควรเห็นในเคสนี้ */
  demonstrates: string;
  input: RegistrationInput;
};

export const DEMO_CASES: Record<DemoCaseId, DemoCase> = {
  A: {
    id: "A",
    title: "Demo A — พร้อมเข้าสู่การพิจารณา",
    expectation: "READY FOR FI",
    demonstrates: "รายได้มีหลักฐานธุรกรรมครบ รับภาระไหว จึงส่งต่อสถาบันการเงินได้",
    input: {
      profile: profile("สาธิต ก — READY"),
      eligibility,
      financial: {
        ...costs,
        incomeEntries: [{ channel: "PLATFORM", dailyAmount: 2200, hasTransactionEvidence: true }],
        activityConsistency: 95
      }
    }
  },
  B: {
    id: "B",
    title: "Demo B — ต้องสร้างความพร้อมเพิ่ม",
    expectation: "BUILD READINESS",
    demonstrates: "รายได้พอ แต่ส่วนใหญ่เป็นเงินสดที่ยังไม่มีหลักฐานธุรกรรม จึงยังไม่ส่งต่อ",
    input: {
      profile: profile("สาธิต ข — BUILD"),
      eligibility: { ...eligibility, occupationalEvidenceStatus: "TO_VERIFY" as const },
      financial: {
        ...costs,
        incomeEntries: [
          { channel: "PLATFORM", dailyAmount: 1650, hasTransactionEvidence: true },
          { channel: "CASH", dailyAmount: 1350, hasTransactionEvidence: false }
        ],
        activityConsistency: 60
      }
    }
  },
  C: {
    id: "C",
    title: "Demo C — ยังไม่พร้อมสำหรับสินเชื่อใหม่",
    expectation: "NO NEW DEBT",
    demonstrates: "กระแสเงินสดต่อวันไม่พอรองรับภาระใหม่ ระบบจึงไม่ผลักไปกู้",
    input: {
      profile: profile("สาธิต ค — NO NEW DEBT"),
      eligibility,
      financial: {
        ...costs,
        incomeEntries: [{ channel: "PLATFORM", dailyAmount: 1150, hasTransactionEvidence: true }],
        existingDebtMonthly: 2500,
        activityConsistency: 90
      }
    }
  },
  D: {
    id: "D",
    title: "Demo D — เงื่อนไข FI ทำให้ผลเปลี่ยน",
    expectation: "READY FOR FI แล้วถูกประเมินใหม่เมื่อเลือก FI ที่ภาระสูงกว่า",
    demonstrates:
      "READY ภายใต้เงื่อนไขอ้างอิง แต่เมื่อเลือกสถาบันการเงินที่อัตราและระยะเวลาต่างออกไป ระบบประเมินใหม่ผ่าน Frozen Engine และเส้นทางเปลี่ยนเป็น NO NEW DEBT",
    input: {
      profile: profile("สาธิต ง — FI Downgrade"),
      eligibility,
      financial: {
        ...costs,
        // ขอบเขตบาง: ผ่านที่ 84 เดือน/3.5% แต่ไม่ผ่านเมื่อระยะสั้นลงและอัตราสูงขึ้น
        incomeEntries: [{ channel: "PLATFORM", dailyAmount: 1500, hasTransactionEvidence: true }],
        activityConsistency: 95,
        termMonths: 84,
        annualRatePct: 3.5
      }
    }
  }
};

export const DEMO_CASE_LIST = Object.values(DEMO_CASES);

export function getDemoCase(id: string): DemoCase | null {
  return DEMO_CASES[id as DemoCaseId] ?? null;
}
