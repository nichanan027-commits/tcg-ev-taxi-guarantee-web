/** Type declarations for the shared Route to Own engine (public/route2own-engine.js) */

export type EnergyMode = "included" | "excluded";
export type RbpTier = "A" | "B" | "C";

/** ผลลัพธ์สาธารณะของ Front Office มีเพียงสามเส้นทาง */
export type Route = "READY FOR FI" | "BUILD READINESS" | "NO NEW DEBT";

/** ข้อความสาธารณะของแต่ละเส้นทาง — ต่างจากรหัสภายในโดยเจตนา */
export type RouteLabel =
  | "READY FOR FI"
  | "BUILD READINESS / CONTINUE TO LEASE"
  | "NO NEW DEBT";

/** คิดจากสัดส่วนรายได้ที่ตรวจสอบย้อนกลับได้เท่านั้น */
export type IncomeEvidenceReliability = "HIGH" | "MEDIUM" | "LOW";
/** Cross-Validation ของข้อมูลกิจกรรม — ไม่ใช่หลักฐานรายได้ */
export type ActivityEvidenceStatus = "CONSISTENT" | "REVIEW" | "LIMITED";

export type RiskLevel = "good" | "watch" | "risk";
export type DemoCaseId = "READY" | "BUILD" | "NODEBT";

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
  /** ค่าบริการแบตเตอรี่ / การสลับ — แยกจากสินเชื่อซื้อรถ */
  batteryServiceDaily: number;
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
  /** แบบผลิตภัณฑ์หลักล็อกไว้ที่ 0 เสมอ */
  downPayment: 0;
  loanNeed: number;
  /** วงเงินค้ำที่เข้าเกณฑ์ใน Scenario — ไม่เกิน loanNeed */
  eligibleGuaranteedAmount: number;
  reserveBalance: number;
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
  batteryServiceDaily: number;
  batteryShareOfVerified: number;
  batteryShareOfObligation: number;
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
  batteryService: number;
  dailyOpEx: number;
  protectedDaily: number;
  rawAvailDaily: number;
  availDaily: number;
  pmt: number;
  annualDebtService: number;
  paydRefDaily: number;
  requiredDebtDaily: number;
  dscr: number;
  dscr15: number;
  dscr30: number;
  pai: number;
  eligibleGuaranteedAmount: number;
  rbpRate: number;
  rbpDayCountBasis: 365;
  rbpStatus: string;
  rbpReferenceDay: number;
  rbpDay: number;
  customerRbpDay: number;
  guaranteeYear: number;
  /** PAYD และ Reserve ในระบบนี้เป็น Preview เท่านั้น การหักเงินจริงเกิดหลัง FI อนุมัติ */
  paydTarget: number;
  paydCapacity: number;
  reserveTarget: number;
  reserveBalance: number;
  reserveContributionPreview: number;
  /** เหลือหลังจัดสรรแล้ว — ไม่ติดลบเสมอ */
  residualCash: number;
  /** ยังขาดเท่าไรจึงจะรองรับ PAYD Target และเงินสำรอง — ไม่ติดลบเสมอ */
  affordabilityGap: number;
  maturity: number;
  affordabilityPassed: boolean;
  principalSustainabilityPassed: boolean;
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

export type ReadinessComponent = {
  id: string;
  label: string;
  maxPoints: number;
  points: number;
  explanation: string;
  improvementActions: string[];
};

export type ReadinessRecommendation = {
  componentId: string;
  title: string;
  reason: string;
};

export type Readiness = {
  route: Route;
  /** เสนอ Indicative Tier เฉพาะเมื่อเส้นทางเป็น READY FOR FI */
  tier: RbpTier | "—";
  incomeEvidenceReliability: IncomeEvidenceReliability;
  activityEvidenceStatus: ActivityEvidenceStatus;
  /** คะแนนอธิบายได้ 0–100 — ประกอบการสื่อสาร ไม่ใช่ตัวกำหนดเส้นทาง */
  readinessScore: number;
  riskLevel: RiskLevel;
  noLoan: boolean;
  breakdown: ReadinessComponent[];
  recommendations: ReadinessRecommendation[];
  preScore: {
    status: "COMPLETED";
    score: number;
    method: string;
  };
};

export type FollowUpQuestion = {
  id: string;
  question: string;
  options: string[];
};

export type DemoCase = {
  label: string;
  route: Route;
  input: ScoreInput;
};

export type FiHandoffDecision = {
  eligible: boolean;
  reason: "INTEGRITY_REVIEW" | "READY_FOR_FI" | "BUILD_READINESS" | "NO_NEW_DEBT";
};

export type ScoreResult = {
  calc: ScoreCalc;
  readiness: Readiness;
  reasons: string[];
};

export type EvaluateResult = ScoreResult & { input: ScoreInput };

export declare const PRODUCT_NAME: string;
export declare const PRODUCT_STATUS: "FINAL / FROZEN FOR COMPETITION";
export declare const SIMULATION_LABEL: string;
export declare const SCENARIO_COMPETITION: ScoreInput;
export declare const ROUTES: {
  READY_FOR_FI: "READY FOR FI";
  BUILD_READINESS: "BUILD READINESS";
  NO_NEW_DEBT: "NO NEW DEBT";
};
/** ข้อความที่แสดงต่อผู้ใช้ แยกจากรหัสเส้นทางภายใน */
export declare const ROUTE_LABELS: Record<Route, RouteLabel>;
export declare function routeLabelOf(route: Route): RouteLabel | "";
export declare const DEMO_CASES: Record<DemoCaseId, DemoCase>;
export declare const FOLLOW_UP_QUESTIONS: FollowUpQuestion[];
export declare const RBP_RATE: Record<RbpTier, number>;
export declare const RBP_DAY_COUNT_BASIS: 365;
export declare const RBP_STATUS: string;
export declare const RESERVE_CONTRIBUTION_RATE: number;
export declare const RESERVE_TARGET_DAYS: number;
export declare const ELIGIBLE_GUARANTEE_DESIGN_PARAMETER: number;
export declare const FEE_WAIVER_YEARS: number;
export declare const DSCR_GATE: number;
/** ค่าคลาดเคลื่อนจากการปัดเศษ ไม่ใช่ Policy Threshold */
export declare const PRINCIPAL_CLOSE_EPSILON: number;
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
export declare function incomeEvidenceReliabilityOf(verifiedPct: unknown): IncomeEvidenceReliability;
export declare function activityEvidenceStatusOf(gpsComplete: unknown): ActivityEvidenceStatus;
export declare function appropriateRouteOf(args: {
  affordabilityPassed: boolean;
  principalSustainabilityPassed: boolean;
  incomeEvidenceReliability: IncomeEvidenceReliability;
}): Route;
export declare function fiHandoffDecisionOf(route: Route, integrityVerified: boolean): FiHandoffDecision;
export declare function readinessBreakdownOf(input: ScoreInput, metrics: {
  verified: number;
  dscr: number;
  dscr15: number;
  pai: number;
  maturity: number;
  principal: number;
  remaining: number;
  breakEven: BreakEven;
}): ReadinessComponent[];
export declare function readinessScoreOf(args: { breakdown: ReadinessComponent[] }): number;
export declare function recommendationsOf(breakdown: ReadinessComponent[]): ReadinessRecommendation[];
export declare function followUpSubmissionOf(
  answers: Record<string, string> | null | undefined,
  consent: boolean
): { status: "SKIPPED" | "CONSENT_REQUIRED" | "READY"; answerCount: number };
export declare function scoreRoute2Own(input: ScoreInput): ScoreResult;
export declare function evaluate(body: Partial<ScoreInput> | null | undefined): EvaluateResult;
