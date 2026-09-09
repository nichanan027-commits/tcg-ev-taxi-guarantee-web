import type { ApplicationStatus, CanonicalRoute, FaCaseStatus, FiSourceStatus } from "../config/competition.ts";
import type { BasicEligibility } from "../eligibility/types.ts";
import type { IncomeChannelEntry, RevenueAssessment, RevenueEvidenceStatus } from "../evidence/types.ts";

/** รหัสรถที่รองรับในโหมดการแข่งขัน */
export const VEHICLE_IDS = ["AION_ES", "AION_Y_PLUS", "AION_UT", "AION_V", "OTHER"] as const;
export type VehicleId = (typeof VEHICLE_IDS)[number];

export const DRIVER_STATUSES = ["RENTING", "OWN_ICE", "EMPLOYED_DRIVER", "OTHER"] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const OWNERSHIP_GOALS = ["OWN_WITHIN_3_YEARS", "OWN_WITHIN_5_YEARS", "STILL_DECIDING"] as const;
export type OwnershipGoal = (typeof OWNERSHIP_GOALS)[number];

export type ProfileInput = {
  displayName: string;
  phone: string;
  province: string;
  driverStatus: DriverStatus;
  yearsDriving: number;
  ownershipGoal: OwnershipGoal;
  phoneVerificationStatus: "NOT_REQUIRED_COMPETITION";
};

export type FinancialInput = {
  /** รายได้รายช่องทางพร้อมสถานะหลักฐาน — แหล่งข้อมูลจริงของรายได้ */
  incomeEntries: IncomeChannelEntry[];
  workingDaysPerMonth: number;
  currentRentDaily: number;
  fuelDaily: number;
  batteryServiceDaily: number;
  otherOpexDaily: number;
  householdMonthly: number;
  existingDebtMonthly: number;
  activityConsistency: number;
  vehicleId: VehicleId;
  vehiclePrice: number;
  termMonths: number;
  annualRatePct: number;
};

export type RegistrationInput = {
  profile: ProfileInput;
  eligibility: BasicEligibilityLike;
  financial: FinancialInput;
};

/** Basic Eligibility ที่ยังไม่ผ่านการ derive สถานะข้อความ */
export type BasicEligibilityLike = Omit<BasicEligibility, "verified" | "statusCopy" | "identityState">;

export type ApplicationRecord = {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  piiAnonymizedAt: string | null;
  profile: ProfileInput | null;
  eligibility: BasicEligibilityLike | null;
  financial: FinancialInput | null;
};

export type ConsentRecord = {
  id: string;
  applicationId: string;
  version: string;
  scope: string;
  accepted: boolean;
  acceptedAt: string;
};

export type ReasonCode = {
  code: string;
  severity: "INFO" | "WATCH" | "BLOCKER";
  message: string;
};

export type VehicleScenario = {
  vehicleId: VehicleId;
  vehicleName: string;
  vehiclePrice: number;
  borrowerDownPayment: 0;
  sourceStatus: FiSourceStatus;
};

export type FinancingScenario = {
  loanAmount: number;
  termMonths: number;
  annualRatePct: number;
  estimatedMonthlyInstallment: number;
  dailyEquivalentBurden: number;
  workingDaysPerMonth: number;
  label: "ILLUSTRATIVE_FINANCING_ESTIMATE";
};

export type EvaluationSnapshot = {
  id: string;
  applicationId: string;
  inputVersion: number;
  basicEligibility: BasicEligibility | null;
  /** สามชั้นของรายได้ที่ต้องไม่ถูกยุบรวมกัน */
  revenue: {
    declaredDailyRevenue: number;
    assessmentDailyRevenue: number;
    verifiedDailyRevenue: number | null;
    evidenceStatus: RevenueEvidenceStatus;
  };
  vehicleScenario: VehicleScenario;
  financingScenario: FinancingScenario;
  /** ตัวเลขที่ engine ใช้ประเมิน — ดู revenue.evidenceStatus ประกอบเสมอ */
  assessmentRevenue: number;
  eligibleOpEx: number;
  protectedCash: number;
  availableCash: number;
  estimatedObligation: number;
  residual: number;
  affordabilityGap: number;
  affordabilityPassed: boolean;
  principalSustainabilityPassed: boolean;
  incomeEvidenceReliability: string;
  activityEvidenceStatus: string;
  preScore: number;
  tier: string | null;
  route: CanonicalRoute;
  reasonCodes: ReasonCode[];
  rbpTier: string | null;
  rbpRate: number | null;
  indicativeGuaranteeEligibleBase: number | null;
  engineStatus: string;
  specVersion: string;
  evaluatedAt: string;
};

export type FiCatalogueItem = {
  id: string;
  fiName: string;
  productName: string;
  vehicleCategories: string;
  financingMin: number | null;
  financingMax: number | null;
  termOptions: string;
  rateInfo: string;
  downPaymentNote: string;
  productNotes: string;
  sourceLabel: string;
  sourceUrl: string | null;
  sourceStatus: FiSourceStatus;
  checkedAt: string | null;
  enabled: boolean;
};

export type FiFit = {
  vehicleFit: boolean;
  financingFit: boolean;
  affordabilityFit: boolean;
  eligibilityFit: boolean;
};

export type FiOption = FiCatalogueItem & {
  fit: FiFit;
  fitNotes: string[];
  applicantEstimatedMonthlyInstallment: number | null;
  applicantDailyBurden: number | null;
  applicantResidual: number | null;
};

export type FiSelection = {
  id: string;
  applicationId: string;
  fiId: string;
  slot: number;
  active: boolean;
  createdAt: string;
};

export type FiConsentRecord = {
  id: string;
  applicationId: string;
  fiId: string;
  version: string;
  accepted: boolean;
  acceptedAt: string;
};

export type FaCase = {
  id: string;
  applicationId: string;
  evaluationSnapshotId: string;
  route: CanonicalRoute;
  tier: string | null;
  preScore: number;
  affordabilityPassed: boolean;
  availableCash: number;
  estimatedObligation: number;
  residual: number;
  affordabilityGap: number;
  evidenceReliability: string;
  primaryReason: string | null;
  reasonCodes: ReasonCode[];
  preferredContactTime: "MORNING" | "AFTERNOON" | "EVENING";
  preferredChannel: "PHONE" | "LINE";
  status: FaCaseStatus;
  createdAt: string;
  updatedAt: string;
};
