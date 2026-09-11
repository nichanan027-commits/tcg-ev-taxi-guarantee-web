import type { FiSourceStatus } from "../config/competition.ts";
import type { VehicleId } from "../registration/types.ts";

export type VehicleCatalogueItem = {
  id: VehicleId;
  name: string;
  segment: string;
  /** ราคาอ้างอิงเริ่มต้น ผู้สมัครแก้ได้ */
  referencePrice: number;
  /** ระยะทางต่อการชาร์จเต็ม (กม.) ใช้ประกอบการอธิบายเท่านั้น */
  rangeKm: number | null;
  sourceLabel: string;
  sourceStatus: FiSourceStatus;
  configurable: boolean;
};

export type FinancingEstimateInput = {
  vehiclePrice: number;
  loanAmount: number;
  annualRatePct: number;
  termMonths: number;
  workingDaysPerMonth: number;
};

export type FinancingEstimate = {
  estimatedMonthlyInstallment: number;
  dailyEquivalentBurden: number;
};
