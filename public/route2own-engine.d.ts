/** Type declarations for the shared Route2Own engine (public/route2own-engine.js) */

export type EnergyMode = "included" | "excluded";
export type RbpTier = "A" | "B" | "C";
export type Route = "OWN READY" | "BUILD READINESS" | "NO NEW DEBT";
export type DataConfidence = "HIGH" | "MEDIUM" | "LOW";
export type RiskLevel = "good" | "watch" | "risk";

export type ScoreInput = {
  grossDaily: number;
  workDays: number;
  verifiedPct: number;
  commissionPct: number;
  rentDaily: number;
  fuelDaily: number;
  serviceKm: number;
  repositionKm: number;
  chargingKm: number;
  downtimeDays: number;
  gpsComplete: number;
  baasDaily: number;
  energyIncluded: EnergyMode;
  electricityRate: number;
  kwhKm: number;
  maintKm: number;
  tireKm: number;
  insuranceMonthly: number;
  otherOpEx: number;
  existingDebt: number;
  householdMonthly: number;
  nextShiftDaily: number;
  vehiclePrice: number;
  downPayment: number;
  loanNeed: number;
  interest: number;
  tenor: number;
  rbpTier: RbpTier;
  guaranteeYear: number;
};

export type ScheduleRow = {
  year: number;
  months: number;
  opening: number;
  payment: number;
  interest: number;
  principal: number;
  closing: number;
};

export type BreakEven = {
  dailyObligation: number;
  operatingObligation: number;
  requiredGrossDaily: number;
  requiredGrossOperating: number;
  marginDaily: number;
  marginPct: number;
  marginMonthly: number;
  baasDaily: number;
  baasShareOfVerified: number;
  baasShareOfObligation: number;
  breakEvenWorkDays: number;
};

export type ScoreCalc = {
  gross: number;
  verified: number;
  verificationFactor: number;
  km: number;
  energyIncluded: boolean;
  rawEnergy: number;
  energy: number;
  maint: number;
  tire: number;
  ins: number;
  other: number;
  baas: number;
  dailyOpEx: number;
  protectedDaily: number;
  rawAvailDaily: number;
  availDaily: number;
  sweepableCash: number;
  pmt: number;
  annualDebtService: number;
  paydRefDaily: number;
  requiredDebtDaily: number;
  dscr: number;
  dscr15: number;
  dscr30: number;
  pai: number;
  coveragePct: number;
  guaranteedOutstanding: number;
  rbpRate: number;
  rbpReferenceDay: number;
  rbpDay: number;
  customerRbpDay: number;
  guaranteeYear: number;
  monitoring: number;
  cure: number;
  remaining: number;
  maturity: number;
  currentCost: number;
  evExpense: number;
  tcoDelta: number;
  totalRepayment: number;
  totalInterest: number;
  interestRatio: number;
  schedule: ScheduleRow[];
  amortizes: boolean;
  breakEven: BreakEven;
};

export type Readiness = {
  route: Route;
  tier: RbpTier | "—";
  dataConfidence: DataConfidence;
  readinessScore: number;
  riskLevel: RiskLevel;
  noLoan: boolean;
};

export type ScoreResult = {
  calc: ScoreCalc;
  readiness: Readiness;
  reasons: string[];
};

export type EvaluateResult = ScoreResult & { input: ScoreInput };

export declare const SCENARIO_V13: ScoreInput;
export declare const RBP_RATE: Record<RbpTier, number>;
export declare const GUARANTEE_COVERAGE: number;
export declare const MONITORING_DAILY: number;
export declare const CURE_RESERVE_CAP: number;
export declare const FEE_WAIVER_YEARS: number;
export declare const DSCR_GATE: number;
export declare const MATURITY_TOLERANCE: number;
export declare const RISK_LEVELS: { GOOD: "good"; WATCH: "watch"; RISK: "risk" };

export declare function num(value: unknown, fallback: number): number;
export declare function nonNegative(value: unknown, fallback: number): number;
export declare function deriveLoanNeed(vehiclePrice: unknown, downPayment: unknown): number;
export declare function normalize(body: Partial<ScoreInput> | null | undefined): ScoreInput;
export declare function buildSchedule(
  principal: number,
  monthlyRate: number,
  months: number,
  payment: number
): { rows: ScheduleRow[]; amortizes: boolean; finalBalance: number };
export declare function readinessScoreOf(args: {
  dscr: number;
  dscr15: number;
  maturity: number;
  principal: number;
  dataConfidence: DataConfidence;
}): number;
export declare function scoreRoute2Own(input: ScoreInput): ScoreResult;
export declare function evaluate(body: Partial<ScoreInput> | null | undefined): EvaluateResult;
