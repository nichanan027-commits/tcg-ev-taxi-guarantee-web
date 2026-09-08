/**
 * Route to Own — Front Office Credit Readiness
 * FINAL / FROZEN FOR COMPETITION
 *
 * ตรรกะจริงทั้งหมดอยู่ใน public/route2own-engine.js ซึ่งเป็น "ระบบคำนวณหลัก"
 * ตัวเดียวที่ใช้ร่วมกันระหว่าง Next.js (/api/score, /legacy-score) และหน้าบ้าน
 * public/route2own.html (โหลดไฟล์เดียวกันผ่าน <script type="module">)
 *
 * ไฟล์นี้ทำหน้าที่เป็นชั้น re-export ที่มี type เท่านั้น — ห้ามใส่ตรรกะคำนวณที่นี่
 * มิฉะนั้นหน้าบ้านกับ API จะกลับไปคำนวณคนละชุดอีก
 */
export {
  PRODUCT_NAME,
  PRODUCT_STATUS,
  SIMULATION_LABEL,
  SCENARIO_COMPETITION,
  ROUTES,
  ROUTE_LABELS,
  routeLabelOf,
  DEMO_CASES,
  FOLLOW_UP_QUESTIONS,
  RBP_RATE,
  RBP_DAY_COUNT_BASIS,
  RBP_STATUS,
  RESERVE_CONTRIBUTION_RATE,
  RESERVE_TARGET_DAYS,
  ELIGIBLE_GUARANTEE_DESIGN_PARAMETER,
  FEE_WAIVER_YEARS,
  DSCR_GATE,
  PRINCIPAL_CLOSE_EPSILON,
  RISK_LEVELS,
  num,
  nonNegative,
  deriveLoanNeed,
  normalize,
  buildSchedule,
  incomeEvidenceReliabilityOf,
  activityEvidenceStatusOf,
  appropriateRouteOf,
  fiHandoffDecisionOf,
  readinessBreakdownOf,
  readinessScoreOf,
  recommendationsOf,
  followUpSubmissionOf,
  scoreRoute2Own,
  evaluate
} from "../../public/route2own-engine.js";

export type {
  EnergyMode,
  RbpTier,
  Route,
  RouteLabel,
  IncomeEvidenceReliability,
  ActivityEvidenceStatus,
  RiskLevel,
  DemoCaseId,
  DemoCase,
  FiHandoffDecision,
  ScoreInput,
  ScheduleRow,
  BreakEven,
  ScoreCalc,
  Readiness,
  ReadinessComponent,
  ReadinessRecommendation,
  FollowUpQuestion,
  ScoreResult,
  EvaluateResult
} from "../../public/route2own-engine.js";
