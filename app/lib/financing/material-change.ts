/**
 * ตรวจว่า Financing Scenario ของ FI ต่างจากที่ใช้ประเมินไว้อย่างมีนัยสำคัญหรือไม่
 *
 * READY ภายใต้เงื่อนไขหนึ่ง ไม่ได้แปลว่า READY ภายใต้เงื่อนไขของ FI ทุกแห่ง
 * เมื่อเงื่อนไขเปลี่ยน ระบบต้องประเมินใหม่ผ่าน Frozen Engine แล้วสร้าง Snapshot ใหม่
 * ไม่ใช่แก้ผลเดิมหรือให้ฝั่ง client สรุปเอง
 *
 * ไฟล์นี้รายงานเพียงว่า "ต่างกันไหม" ไม่ตัดสินเส้นทางหรือคะแนนใด ๆ
 */
export type ComparableFinancingScenario = {
  loanAmount: number;
  annualRatePct: number;
  termMonths: number;
  estimatedMonthlyInstallment: number;
  dailyEquivalentBurden: number;
};

/**
 * ค่าความคลาดเคลื่อนที่ถือว่าเท่าเดิม
 * ตั้งไว้ระดับการปัดเศษเท่านั้น เพื่อไม่ให้ตัวเลขที่ปัดต่างกันนิดเดียวไปกระตุ้นการประเมินใหม่
 */
const MONEY_EPSILON = 1;
const RATE_EPSILON = 0.01;

const FIELDS = [
  "loanAmount",
  "annualRatePct",
  "termMonths",
  "estimatedMonthlyInstallment",
  "dailyEquivalentBurden"
] as const;

type Field = (typeof FIELDS)[number];

function epsilonFor(field: Field): number {
  if (field === "annualRatePct") return RATE_EPSILON;
  if (field === "termMonths") return 0;
  return MONEY_EPSILON;
}

export type MaterialChangeReport = {
  requiresReevaluation: boolean;
  changedFields: Field[];
  /** ภาระต่อวันเปลี่ยนไปเท่าไร บวก = หนักขึ้น */
  dailyBurdenDelta: number;
};

export function materialChangeReport(
  assessed: ComparableFinancingScenario | null | undefined,
  candidate: ComparableFinancingScenario | null | undefined
): MaterialChangeReport {
  // ไม่มีฐานให้เทียบ = ต้องประเมินใหม่ ปลอดภัยกว่าการเดาว่าไม่เปลี่ยน
  if (!assessed || !candidate) {
    return { requiresReevaluation: true, changedFields: [...FIELDS], dailyBurdenDelta: 0 };
  }

  const changedFields = FIELDS.filter(
    (field) => Math.abs(candidate[field] - assessed[field]) > epsilonFor(field)
  );

  return {
    requiresReevaluation: changedFields.length > 0,
    changedFields,
    dailyBurdenDelta: candidate.dailyEquivalentBurden - assessed.dailyEquivalentBurden
  };
}

export function hasMaterialFinancingChange(
  assessed: ComparableFinancingScenario | null | undefined,
  candidate: ComparableFinancingScenario | null | undefined
): boolean {
  return materialChangeReport(assessed, candidate).requiresReevaluation;
}
