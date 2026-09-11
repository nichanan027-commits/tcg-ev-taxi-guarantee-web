import type { FinancingScenario } from "../registration/types.ts";
import type { FinancingEstimate, FinancingEstimateInput } from "./types.ts";

/**
 * เครื่องคิดค่างวดแบบประมาณการ (Illustrative Financing Estimate)
 *
 * แยกขาดจากเครื่องประเมินความพร้อมที่ Frozen ไว้: ที่นี่คำนวณเฉพาะค่างวดเพื่อให้ผู้สมัคร
 * เห็นภาระคร่าว ๆ ก่อนถึงหน้า Credit Readiness เท่านั้น
 * ไม่แตะเกณฑ์ DSCR เส้นทาง คะแนน หรือเงื่อนไขการค้ำประกันใด ๆ
 * ค่างวดจริงเป็นอำนาจของสถาบันการเงิน
 */
function requirePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} ต้องเป็นตัวเลขที่มากกว่า 0`);
  }
  return value;
}

export function estimateFinancing(input: FinancingEstimateInput): FinancingEstimate {
  const loanAmount = requirePositive(input.loanAmount, "วงเงินสินเชื่อ");
  const termMonths = requirePositive(input.termMonths, "ระยะเวลาผ่อน");
  const workingDaysPerMonth = requirePositive(input.workingDaysPerMonth, "วันทำงานต่อเดือน");

  if (!Number.isFinite(input.annualRatePct) || input.annualRatePct < 0) {
    throw new Error("อัตราดอกเบี้ยต้องเป็นตัวเลขที่ไม่ติดลบ");
  }

  const monthlyRate = input.annualRatePct / 100 / 12;
  const estimatedMonthlyInstallment =
    monthlyRate === 0
      ? loanAmount / termMonths
      : (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));

  return {
    estimatedMonthlyInstallment,
    dailyEquivalentBurden: estimatedMonthlyInstallment / workingDaysPerMonth
  };
}

/** ห่อผลลัพธ์เป็น Financing Scenario ที่ติดป้ายกำกับไว้ก่อนบันทึกลง Snapshot */
export function financingScenarioOf(input: FinancingEstimateInput): FinancingScenario {
  const estimate = estimateFinancing(input);
  return {
    loanAmount: input.loanAmount,
    termMonths: input.termMonths,
    annualRatePct: input.annualRatePct,
    estimatedMonthlyInstallment: estimate.estimatedMonthlyInstallment,
    dailyEquivalentBurden: estimate.dailyEquivalentBurden,
    workingDaysPerMonth: input.workingDaysPerMonth,
    label: "ILLUSTRATIVE_FINANCING_ESTIMATE"
  };
}
