/**
 * Route2Own Credit Readiness — v1.4
 *
 * ตรรกะจริงทั้งหมดอยู่ใน public/route2own-engine.js ซึ่งเป็น "ระบบคำนวณหลัก"
 * ตัวเดียวที่ใช้ร่วมกันระหว่าง Next.js (/api/score, /legacy-score) และหน้าบ้าน
 * public/route2own.html (โหลดไฟล์เดียวกันผ่าน <script type="module">)
 *
 * ไฟล์นี้ทำหน้าที่เป็นชั้น re-export ที่มี type เท่านั้น — ห้ามใส่ตรรกะคำนวณที่นี่
 * มิฉะนั้นหน้าบ้านกับ API จะกลับไปคำนวณคนละชุดอีก
 */
export {
  SCENARIO_V13,
  DEMO_CASES,
  FOLLOW_UP_QUESTIONS,
  RBP_RATE,
  RBP_DAY_COUNT_BASIS,
  RBP_STATUS,
  GUARANTEE_COVERAGE,
  MONITORING_DAILY,
  CURE_RESERVE_CAP,
  FEE_WAIVER_YEARS,
  DSCR_GATE,
  MATURITY_TOLERANCE,
  RISK_LEVELS,
  num,
  nonNegative,
  deriveLoanNeed,
  normalize,
  buildSchedule,
  readinessLevelOf,
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
  DataConfidence,
  RiskLevel,
  ReadinessLevelCode,
  ScoreInput,
  ScheduleRow,
  BreakEven,
  ScoreCalc,
  Readiness,
  ReadinessComponent,
  ReadinessLevel,
  ReadinessRecommendation,
  FollowUpQuestion,
  ScoreResult,
  EvaluateResult
} from "../../public/route2own-engine.js";
