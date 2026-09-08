/**
 * Route to Own — Front Office Credit Readiness Engine
 * FINAL / FROZEN FOR COMPETITION
 *
 * ไฟล์นี้เป็น "ระบบคำนวณหลัก" หนึ่งเดียวของโครงการ ใช้ร่วมกันทั้ง
 *   - หน้าบ้าน  public/route2own.html  (โหลดเป็น ES module + window.Route2OwnEngine)
 *   - Next.js   app/lib/route2own.ts   (re-export ต่อให้ /api/score และ /legacy-score)
 * แก้ที่นี่ที่เดียว ทุกช่องทางเปลี่ยนตาม — ไม่มีสำเนาตรรกะซ้ำ
 *
 * ขอบเขต: Front Office ก่อนอนุมัติเท่านั้น สิ้นสุดที่การส่งต่อ FI
 * การหักเงินจริง (Actual Sweep) บัญชีหนี้ DPD Claim และ Control Tower
 * อยู่ในระบบหลังอนุมัติคนละ repository
 *
 * หลักการที่ล็อกไว้:
 *   - เงินดาวน์ผู้ขับ = 0% เป็นแบบผลิตภัณฑ์หลัก ไม่ใช่การอนุมัติสินเชื่ออัตโนมัติ
 *   - Affordability ตัดสินเส้นทางก่อนคะแนน Pre-Score เสมอ
 *   - ข้อมูลกิจกรรม (GPS/Trips/KM) ใช้ Cross-Validation ไม่ใช่หลักฐานรายได้
 *   - RBP คิดจากวงเงินค้ำที่เข้าเกณฑ์ ไม่ใช่วงเงินสินเชื่อทั้งก้อน
 *   - FI เป็นผู้ Underwrite และตัดสินสินเชื่อขั้นสุดท้าย
 */

export const PRODUCT_NAME = 'Route to Own by บสย.';
export const PRODUCT_STATUS = 'FINAL / FROZEN FOR COMPETITION';
export const SIMULATION_LABEL = 'Illustrative / Competition Simulation';

/**
 * วงเงินค้ำที่เข้าเกณฑ์ตั้งต้นของ Competition Scenario
 * ประกาศเป็นพารามิเตอร์ของการแข่งขันโดยตรง ไม่ได้อ้างอิงวงเงินสินเชื่อ
 * เพื่อไม่ให้เกิดสมมติฐาน "ค้ำเต็มวงเงิน" โดยปริยายเมื่อราคารถเปลี่ยน
 */
export const ELIGIBLE_GUARANTEE_DESIGN_PARAMETER = 800000;

export const RBP_RATE = { A: 0.012, B: 0.015, C: 0.018 };
export const RBP_DAY_COUNT_BASIS = 365;

/** สถานะกำกับพารามิเตอร์ทุกตัวที่ยังต้องสอบเทียบหลังได้รับคัดเลือก */
export const CALIBRATION_STATUS = 'Pilot Calibration after Selection';
export const RBP_STATUS = `Competition Design Parameter — ${CALIBRATION_STATUS}`;

/** Adaptive Payment Reserve — สะสม 10% ของ PAYD Target จนถึงเป้าหมาย 5 วัน */
export const RESERVE_CONTRIBUTION_RATE = 0.1;
export const RESERVE_TARGET_DAYS = 5;

/**
 * Proposed RBP Fee Waiver ปี 1–3
 * ยังไม่อยู่ใน Frozen Product Spec จึง "ปิดไว้เป็นค่าตั้งต้น"
 * เปิดได้เฉพาะเป็น Scenario option และต้องติดป้าย Proposed / Not Frozen เสมอ
 */
export const FEE_WAIVER_YEARS = 3;
export const FEE_WAIVER_ENABLED_DEFAULT = false;
export const FEE_WAIVER_STATUS = 'Proposed / Not Frozen';

export const DSCR_GATE = 1.0; // Gate ขั้นต่ำของ Affordability ใน Working Model

/** เกณฑ์แบ่งระดับความน่าเชื่อถือของหลักฐานรายได้ */
export const INCOME_EVIDENCE_THRESHOLDS = { HIGH: 90, MEDIUM: 70 };
/** เกณฑ์แบ่งสถานะหลักฐานกิจกรรม */
export const ACTIVITY_EVIDENCE_THRESHOLDS = { CONSISTENT: 90, REVIEW: 70 };

/**
 * พารามิเตอร์ทั้งหมดที่ตั้งขึ้นเพื่อการแข่งขัน รวมไว้ที่เดียวเพื่อให้ตรวจสอบได้
 * ทุกตัวเป็น Competition Design Parameter ไม่ใช่กติกา Underwriting ขั้นสุดท้ายของ FI
 */
export const COMPETITION_DESIGN_PARAMETERS = {
  status: CALIBRATION_STATUS,
  notFinalUnderwritingRule: true,
  note: 'ค่าเหล่านี้ตั้งขึ้นเพื่อสาธิตในการประกวด ต้องสอบเทียบกับข้อมูลจริงหลังได้รับคัดเลือก และไม่ใช่กติกาการพิจารณาสินเชื่อขั้นสุดท้ายของสถาบันการเงิน',
  affordability: { dscrGate: DSCR_GATE },
  incomeEvidence: INCOME_EVIDENCE_THRESHOLDS,
  activityEvidence: ACTIVITY_EVIDENCE_THRESHOLDS,
  rbp: { rates: RBP_RATE, dayCountBasis: RBP_DAY_COUNT_BASIS },
  eligibleGuarantee: { designParameter: ELIGIBLE_GUARANTEE_DESIGN_PARAMETER },
  reserve: { contributionRate: RESERVE_CONTRIBUTION_RATE, targetDays: RESERVE_TARGET_DAYS },
  feeWaiver: { years: FEE_WAIVER_YEARS, enabledByDefault: FEE_WAIVER_ENABLED_DEFAULT, status: FEE_WAIVER_STATUS }
};

/** ค่าตั้งต้นของ Competition Scenario — ตัวเลขสาธิต ไม่ใช่ค่าเฉลี่ยตลาด */
export const SCENARIO_COMPETITION = {
  grossDaily: 1850.52,
  workDays: 25,
  verifiedPct: 95,
  commissionPct: 0,
  rentDaily: 600,
  fuelDaily: 450,
  serviceKm: 180,
  repositionKm: 55,
  chargingKm: 15,
  downtimeDays: 1,
  gpsComplete: 95,
  batteryServiceDaily: 0,
  energyIncluded: 'excluded',
  electricityRate: 5.9,
  kwhKm: 0.185,
  maintKm: 0.07828,
  tireKm: 0.1,
  insuranceMonthly: 2500,
  otherOpEx: 0,
  existingDebt: 0,
  householdMonthly: 15000,
  nextShiftDaily: 0,
  vehiclePrice: 800000,
  downPayment: 0,
  eligibleGuaranteedAmount: ELIGIBLE_GUARANTEE_DESIGN_PARAMETER,
  reserveBalance: 0,
  feeWaiverEnabled: FEE_WAIVER_ENABLED_DEFAULT,
  interest: 6,
  tenor: 84,
  rbpTier: 'B',
  guaranteeYear: 1
};

/** รหัสเส้นทางภายใน — ใช้เปรียบเทียบในโค้ดเท่านั้น ห้ามนำไปแสดงผลตรง ๆ */
export const ROUTES = {
  READY_FOR_FI: 'READY FOR FI',
  BUILD_READINESS: 'BUILD READINESS',
  NO_NEW_DEBT: 'NO NEW DEBT'
};

/** ข้อความที่แสดงต่อผู้ใช้ — แยกจากรหัสภายในเพื่อให้เปลี่ยนถ้อยคำได้โดยไม่กระทบตรรกะ */
export const ROUTE_LABELS = {
  [ROUTES.READY_FOR_FI]: 'READY FOR FI',
  [ROUTES.BUILD_READINESS]: 'BUILD READINESS / CONTINUE TO LEASE',
  [ROUTES.NO_NEW_DEBT]: 'NO NEW DEBT'
};

export function routeLabelOf(route) {
  return ROUTE_LABELS[route] || '';
}

/** เคสสาธิต — หนึ่งเคสต่อหนึ่งเส้นทาง */
export const DEMO_CASES = {
  READY: {
    label: 'พร้อมส่งต่อ FI',
    route: ROUTES.READY_FOR_FI,
    input: { ...SCENARIO_COMPETITION, grossDaily: 2200, workDays: 26, verifiedPct: 95, gpsComplete: 95, downtimeDays: 0 }
  },
  BUILD: {
    // รับภาระไหว แต่หลักฐานรายได้ยังตรวจสอบย้อนกลับได้น้อย จึงยังไม่ส่งต่อ FI
    label: 'สร้างความพร้อม / เช่าต่อ',
    route: ROUTES.BUILD_READINESS,
    input: { ...SCENARIO_COMPETITION, grossDaily: 3000, workDays: 25, verifiedPct: 55, gpsComplete: 80, downtimeDays: 2 }
  },
  NODEBT: {
    label: 'ยังไม่ควรเพิ่มหนี้ใหม่',
    route: ROUTES.NO_NEW_DEBT,
    input: { ...SCENARIO_COMPETITION, grossDaily: 1150, workDays: 21, verifiedPct: 80, gpsComplete: 70, downtimeDays: 4, existingDebt: 2500 }
  }
};

export const FOLLOW_UP_QUESTIONS = [
  {
    id: 'incomeOutlook',
    question: 'รายได้ของคุณใน 30 วันข้างหน้าคาดว่าจะเปลี่ยนอย่างไร?',
    options: ['เพิ่มขึ้น', 'ใกล้เคียงเดิม', 'ลดลง', 'ยังไม่แน่ใจ', 'ข้ามตอนนี้']
  },
  {
    id: 'reserveDays',
    question: 'คุณมีเงินสำรองสำหรับค่าใช้จ่ายจำเป็นได้กี่วัน?',
    options: ['ยังไม่มี', '1–7 วัน', '8–14 วัน', 'มากกว่า 14 วัน', 'ข้ามตอนนี้']
  },
  {
    id: 'continuityBarrier',
    question: 'อะไรเป็นอุปสรรคหลักต่อการทำงานต่อเนื่อง?',
    options: ['รถหรือการชาร์จ', 'สุขภาพ', 'ปริมาณผู้โดยสาร', 'ค่าใช้จ่าย', 'เอกสาร', 'อื่น ๆ', 'ข้ามตอนนี้']
  },
  {
    id: 'supportNeed',
    question: 'คุณอยากได้รับความช่วยเหลือเรื่องใดก่อน?',
    options: ['วางแผนรายรับรายจ่าย', 'วางแผนภาระชำระ', 'รถหยุดวิ่ง', 'เพิ่มรายได้', 'ยังไม่ต้องการ', 'ข้ามตอนนี้']
  },
  {
    id: 'followUpChannel',
    question: 'คุณต้องการติดตามแผนผ่านช่องทางใด?',
    options: ['ดูในระบบ', 'โทรศัพท์', 'LINE', 'นัดหมายออนไลน์', 'ข้ามตอนนี้']
  }
];

export function followUpSubmissionOf(answers, consent) {
  const values = Object.values(answers || {}).filter(
    (value) => value !== undefined && value !== null && value !== '' && value !== 'ข้ามตอนนี้'
  );
  if (values.length === 0) return { status: 'SKIPPED', answerCount: 0 };
  if (!consent) return { status: 'CONSENT_REQUIRED', answerCount: values.length };
  return { status: 'READY', answerCount: values.length };
}

/**
 * ค่าคลาดเคลื่อนจากการปัดเศษทศนิยมเท่านั้น ไม่ใช่ Policy Threshold
 * ใช้ตัดสินว่ายอดเงินต้นคงเหลือ ณ งวดสุดท้ายถือว่าปิดได้แล้วหรือไม่
 */
export const PRINCIPAL_CLOSE_EPSILON = 1;

/** ระดับความเสี่ยงที่ใช้กำหนดสีในหน้าจอ */
export const RISK_LEVELS = { GOOD: 'good', WATCH: 'watch', RISK: 'risk' };

/** ใช้ค่า default เมื่อไม่ได้ส่งมาหรือส่งค่าที่ไม่ใช่ตัวเลข — เทียบเท่า `??` (0 ที่ตั้งใจส่งจะถูกเก็บไว้) */
export function num(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** กันค่าติดลบและ NaN สำหรับช่องที่ไม่ควรติดลบ */
export function nonNegative(value, fallback) {
  const n = num(value, fallback);
  return n < 0 ? 0 : n;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * วงเงินสินเชื่อ = ราคารถ − เงินดาวน์
 * แบบผลิตภัณฑ์หลักล็อกเงินดาวน์ไว้ที่ 0 วงเงินจึงเท่ากับราคารถเสมอ
 */
export function deriveLoanNeed(vehiclePrice, downPayment) {
  const price = nonNegative(vehiclePrice, 0);
  const down = nonNegative(downPayment, 0);
  const need = price - down;
  return Number.isFinite(need) && need > 0 ? need : 0;
}

/**
 * ความน่าเชื่อถือของหลักฐานรายได้ — คิดจากสัดส่วนรายได้ที่ตรวจสอบย้อนกลับได้เท่านั้น
 * ข้อมูลกิจกรรมไม่มีผลต่อค่านี้โดยเจตนา
 */
export function incomeEvidenceReliabilityOf(verifiedPct) {
  const value = clamp(num(verifiedPct, 0), 0, 100);
  if (value >= INCOME_EVIDENCE_THRESHOLDS.HIGH) return 'HIGH';
  if (value >= INCOME_EVIDENCE_THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'LOW';
}

/** สถานะหลักฐานกิจกรรม — ใช้ Cross-Validation และดูความต่อเนื่องของอาชีพ ไม่ใช่รายได้ */
export function activityEvidenceStatusOf(gpsComplete) {
  const value = clamp(num(gpsComplete, 0), 0, 100);
  if (value >= ACTIVITY_EVIDENCE_THRESHOLDS.CONSISTENT) return 'CONSISTENT';
  if (value >= ACTIVITY_EVIDENCE_THRESHOLDS.REVIEW) return 'REVIEW';
  return 'LIMITED';
}

/**
 * เส้นทางที่เหมาะสม — รับผลของ Gate มาเป็น boolean ที่ผู้เรียกคำนวณแล้ว
 * ฟังก์ชันนี้จึงไม่ถือ Policy Threshold ใด ๆ ไว้เอง และเปลี่ยนเกณฑ์ได้โดยไม่ต้องแก้ตรรกะเส้นทาง
 * ลำดับการตัดสิน: Affordability → Principal Sustainability → Income Evidence
 * คะแนน Pre-Score ไม่มีสิทธิ์ Override
 */
export function appropriateRouteOf({
  affordabilityPassed,
  principalSustainabilityPassed,
  incomeEvidenceReliability
}) {
  if (!affordabilityPassed || !principalSustainabilityPassed) return ROUTES.NO_NEW_DEBT;
  if (incomeEvidenceReliability === 'LOW') return ROUTES.BUILD_READINESS;
  return ROUTES.READY_FOR_FI;
}

/** ส่งต่อ FI ได้เฉพาะเส้นทาง READY FOR FI และต้องผ่าน Integrity Gate ก่อน */
export function fiHandoffDecisionOf(route, integrityVerified) {
  if (!integrityVerified) return { eligible: false, reason: 'INTEGRITY_REVIEW' };
  if (route === ROUTES.READY_FOR_FI) return { eligible: true, reason: 'READY_FOR_FI' };
  if (route === ROUTES.NO_NEW_DEBT) return { eligible: false, reason: 'NO_NEW_DEBT' };
  return { eligible: false, reason: 'BUILD_READINESS' };
}

export function normalize(body) {
  const b = body || {};
  const d = SCENARIO_COMPETITION;
  const tier = b.rbpTier;
  const vehiclePrice = nonNegative(b.vehiclePrice, d.vehiclePrice);
  // แบบผลิตภัณฑ์หลักล็อกเงินดาวน์ผู้ขับไว้ที่ 0% ค่าที่ส่งมาจึงถูกทับเสมอ
  const downPayment = 0;
  const loanNeed = deriveLoanNeed(vehiclePrice, downPayment);
  // วงเงินค้ำที่เข้าเกณฑ์ไม่ใช่สิทธิอัตโนมัติ และไม่ผูกกับวงเงินสินเชื่อโดยปริยาย
  // ค่าตั้งต้นมาจากพารามิเตอร์ของการแข่งขันที่ประกาศไว้ แล้วจึง cap ไม่ให้เกินวงเงินสินเชื่อ
  const eligibleGuaranteedAmount = Math.min(
    nonNegative(b.eligibleGuaranteedAmount, ELIGIBLE_GUARANTEE_DESIGN_PARAMETER),
    loanNeed
  );

  return {
    grossDaily: nonNegative(b.grossDaily, d.grossDaily),
    workDays: nonNegative(b.workDays, d.workDays),
    verifiedPct: clamp(num(b.verifiedPct, d.verifiedPct), 0, 100),
    commissionPct: clamp(num(b.commissionPct, d.commissionPct), 0, 100),
    rentDaily: nonNegative(b.rentDaily, d.rentDaily),
    fuelDaily: nonNegative(b.fuelDaily, d.fuelDaily),
    serviceKm: nonNegative(b.serviceKm, d.serviceKm),
    repositionKm: nonNegative(b.repositionKm, d.repositionKm),
    chargingKm: nonNegative(b.chargingKm, d.chargingKm),
    downtimeDays: nonNegative(b.downtimeDays, d.downtimeDays),
    gpsComplete: clamp(num(b.gpsComplete, d.gpsComplete), 0, 100),
    batteryServiceDaily: nonNegative(b.batteryServiceDaily, d.batteryServiceDaily),
    energyIncluded: b.energyIncluded === 'included' ? 'included' : 'excluded',
    electricityRate: nonNegative(b.electricityRate, d.electricityRate),
    kwhKm: nonNegative(b.kwhKm, d.kwhKm),
    maintKm: nonNegative(b.maintKm, d.maintKm),
    tireKm: nonNegative(b.tireKm, d.tireKm),
    insuranceMonthly: nonNegative(b.insuranceMonthly, d.insuranceMonthly),
    otherOpEx: nonNegative(b.otherOpEx, d.otherOpEx),
    existingDebt: nonNegative(b.existingDebt, d.existingDebt),
    householdMonthly: nonNegative(b.householdMonthly, d.householdMonthly),
    nextShiftDaily: nonNegative(b.nextShiftDaily, d.nextShiftDaily),
    vehiclePrice,
    downPayment,
    loanNeed,
    eligibleGuaranteedAmount,
    reserveBalance: nonNegative(b.reserveBalance, 0),
    // Fee Waiver ยังไม่อยู่ใน Frozen Spec — ต้องเปิดโดยตั้งใจเท่านั้น
    feeWaiverEnabled: b.feeWaiverEnabled === true,
    interest: nonNegative(b.interest, d.interest),
    tenor: Math.max(1, Math.round(nonNegative(b.tenor, d.tenor)) || d.tenor),
    rbpTier: tier === 'A' || tier === 'B' || tier === 'C' ? tier : d.rbpTier,
    guaranteeYear: Math.max(1, Math.round(num(b.guaranteeYear, d.guaranteeYear)))
  };
}

/**
 * ตารางผ่อนชำระรายปี ตาม FI Contractual Schedule
 * คืนค่าแยกเงินต้น/ดอกเบี้ยรายปี เพื่อใช้ในรายงานและกราฟ
 */
export function buildSchedule(principal, monthlyRate, months, payment) {
  const rows = [];
  let balance = principal;
  let amortizes = true;
  const yearCount = Math.ceil(months / 12);
  for (let y = 0; y < yearCount; y++) {
    const opening = balance;
    let interestPaid = 0;
    let principalPaid = 0;
    let paid = 0;
    const monthsThisYear = Math.min(12, months - y * 12);
    for (let m = 0; m < monthsThisYear; m++) {
      const interest = balance * monthlyRate;
      const due = Math.min(payment, balance + interest);
      if (due <= interest && balance > 0) amortizes = false;
      const toPrincipal = due - interest;
      balance = Math.max(0, balance - toPrincipal);
      interestPaid += interest;
      principalPaid += toPrincipal;
      paid += due;
    }
    rows.push({
      year: y + 1,
      months: monthsThisYear,
      opening,
      payment: paid,
      interest: interestPaid,
      principal: principalPaid,
      closing: balance
    });
  }
  return { rows, amortizes, finalBalance: balance };
}

function scoreComponent(id, label, maxPoints, rawPoints, explanation, improvementActions) {
  return {
    id,
    label,
    maxPoints,
    points: Math.round(clamp(rawPoints, 0, maxPoints)),
    explanation,
    improvementActions
  };
}

/**
 * คะแนน Pre-Score แบบเปิดเผยองค์ประกอบ รวมเต็ม 100 คะแนน
 * เป็นข้อมูลประกอบการสื่อสารกับผู้ขับ ไม่ใช่ตัวกำหนดเส้นทางและไม่ใช่ Credit Score
 */
export function readinessBreakdownOf(input, metrics) {
  const incomeCoverage = metrics.breakEven.requiredGrossDaily > 0
    ? metrics.verified / metrics.breakEven.requiredGrossDaily
    : 0;
  const maturityRatio = metrics.principal > 0 ? 1 - metrics.maturity / metrics.principal : 0;
  const residualFactor = clamp(metrics.remaining / 100, 0, 1);

  return [
    scoreComponent(
      'work_continuity',
      'ความต่อเนื่องของงาน',
      25,
      clamp(input.workDays / 26, 0, 1) * 12 +
        clamp(1 - input.downtimeDays / 8, 0, 1) * 7 +
        clamp(input.gpsComplete / 100, 0, 1) * 6,
      `ทำงาน ${input.workDays} วัน/เดือน • Downtime ${input.downtimeDays} วัน • หลักฐานกิจกรรม ${input.gpsComplete.toFixed(0)}% (Cross-Validation ไม่ใช่รายได้)`,
      ['บันทึกวันให้บริการต่อเนื่อง 30 วัน', 'ลดวันหยุดวิ่งที่ไม่จำเป็น', 'เพิ่มความครบถ้วนของข้อมูลกิจกรรม']
    ),
    scoreComponent(
      'income_quality',
      'คุณภาพและเสถียรภาพรายได้',
      25,
      clamp(input.verifiedPct / 100, 0, 1) * 15 + clamp(incomeCoverage / 1.1, 0, 1) * 10,
      `รายได้ตรวจสอบได้ ${input.verifiedPct.toFixed(0)}% • ครอบคลุมจุดคุ้มทุน ${(incomeCoverage * 100).toFixed(0)}%`,
      ['บันทึกรายได้ต่อเนื่องอย่างน้อย 30 วัน', 'เพิ่มสัดส่วนรายได้ที่ตรวจสอบย้อนกลับได้', 'ทบทวนช่วงเวลาหรือพื้นที่ทำรายได้']
    ),
    scoreComponent(
      'cashflow_capacity',
      'กระแสเงินสดและความสามารถรับภาระ',
      25,
      clamp(metrics.dscr / 1.5, 0, 1) * 12 +
        clamp((1.5 - metrics.pai) / 0.7, 0, 1) * 6 +
        clamp(maturityRatio, 0, 1) * 7,
      `DSCR ${metrics.dscr.toFixed(2)}x • PAI ${metrics.pai.toFixed(2)} • Principal ${metrics.maturity <= PRINCIPAL_CLOSE_EPSILON ? 'CLOSE' : 'GAP'}`,
      ['ลดภาระชำระเดิม', 'ปรับราคารถให้เหมาะกับ Available Cash', 'สะสม Adaptive Payment Reserve ให้ถึงเป้าหมาย']
    ),
    scoreComponent(
      'documents_partner',
      'ความพร้อมเอกสารและพันธมิตร',
      15,
      clamp(input.verifiedPct / 100, 0, 1) * 9 + clamp(input.gpsComplete / 100, 0, 1) * 6,
      `เอกสารหลักฐานรายได้ ${input.verifiedPct.toFixed(0)}% • ความครบถ้วนของชุดข้อมูล ${input.gpsComplete.toFixed(0)}% (Document Completeness Proxy)`,
      ['ตรวจสอบเอกสารสหกรณ์/Fleet และใบอนุญาต', 'เชื่อมหลักฐานรายได้กับแหล่งข้อมูลที่ยืนยันได้', 'ปิดรายการเอกสารที่ยังไม่ครบก่อน FI Review']
    ),
    scoreComponent(
      'continuous_readiness',
      'ความพร้อมต่อเนื่องและการเรียนรู้',
      10,
      clamp(metrics.dscr15 / 1.2, 0, 1) * 6 + residualFactor * 4,
      `Stress DSCR −15% = ${metrics.dscr15.toFixed(2)}x • Residual Cash ${Math.round(metrics.remaining).toLocaleString('th-TH')} บาท/วัน`,
      ['จัดทำแผนบริหารเงิน 30 วัน', 'ตอบแบบประเมินและทบทวนแผนทุกสัปดาห์', 'ขอคำปรึกษาเมื่อรายได้หรือค่าใช้จ่ายเปลี่ยน']
    )
  ];
}

export function readinessScoreOf({ breakdown }) {
  return clamp(
    (breakdown || []).reduce((total, component) => total + num(component.points, 0), 0),
    0,
    100
  );
}

export function recommendationsOf(breakdown) {
  return [...breakdown]
    .sort((a, b) => a.points / a.maxPoints - b.points / b.maxPoints)
    .slice(0, 3)
    .map((component) => ({
      componentId: component.id,
      title: component.improvementActions[0],
      reason: `${component.label}: ${component.points}/${component.maxPoints} คะแนน`
    }));
}

export function scoreRoute2Own(input) {
  const wd = input.workDays || SCENARIO_COMPETITION.workDays;
  const km = input.serviceKm + input.repositionKm + input.chargingKm;

  // --- Daily Financial X-Ray ---
  const gross = input.grossDaily;
  const verificationFactor = (input.verifiedPct / 100) * (1 - input.commissionPct / 100);
  const verified = gross * verificationFactor;
  const batteryService = input.batteryServiceDaily; // แยกจากสินเชื่อซื้อรถ
  const energyIncluded = input.energyIncluded === 'included';
  const rawEnergy = km * input.kwhKm * input.electricityRate;
  const energy = energyIncluded ? 0 : rawEnergy; // แพ็กเกจสลับแบตที่รวมค่าไฟแล้วจึงไม่หักซ้ำ
  const maint = km * input.maintKm;
  const tire = km * input.tireKm;
  const ins = input.insuranceMonthly / wd;
  const other = input.otherOpEx / wd;
  const dailyOpEx = batteryService + energy + maint + tire + ins + other;
  const protectedDaily = input.householdMonthly / wd + input.nextShiftDaily;
  /**
   * Available Cash ตามนิยามของ Frozen Spec — ไม่ติดลบ
   *   availableCash = max(0, Verified Revenue − Eligible OpEx − Protected Cash)
   * rawAvailDaily เก็บค่าดิบที่ติดลบได้ไว้ใช้วินิจฉัยภายในเท่านั้น
   * ห้ามนำ rawAvailDaily ไปแสดงต่อผู้ใช้ในชื่อ Available Cash
   */
  const rawAvailDaily = verified - dailyOpEx - protectedDaily;
  const availableCash = Math.max(0, rawAvailDaily);
  const cashShortfallBeforeObligations = Math.max(0, -rawAvailDaily);

  // --- FI Contractual Schedule (Scenario) ---
  const annualRate = input.interest / 100;
  const r = annualRate / 12;
  const n = input.tenor || SCENARIO_COMPETITION.tenor;
  const years = n / 12;
  const P = input.loanNeed;
  const pmt = r > 0 ? (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : P / n;
  const eligibleDaysAnnual = wd * 12;
  const annualDebtService =
    annualRate > 0
      ? (P * annualRate * Math.pow(1 + annualRate, years)) / (Math.pow(1 + annualRate, years) - 1)
      : P / years;
  const paydRefDaily = annualDebtService / eligibleDaysAnnual;
  const existingDebtMonthly = input.existingDebt;
  const existingDebtDaily = existingDebtMonthly / wd;
  const requiredDebtDaily = paydRefDaily + existingDebtDaily;

  // --- DSCR / PAI ---
  const dscr = requiredDebtDaily > 0 ? availableCash / requiredDebtDaily : 99;
  const availableCash15 = Math.max(0, verified * 0.85 - dailyOpEx - protectedDaily);
  const availableCash30 = Math.max(0, verified * 0.7 - dailyOpEx - protectedDaily);
  const dscr15 = requiredDebtDaily > 0 ? availableCash15 / requiredDebtDaily : 99;
  const dscr30 = requiredDebtDaily > 0 ? availableCash30 / requiredDebtDaily : 99;
  const pai = availableCash > 0 ? requiredDebtDaily / availableCash : 9.99;

  // --- RBP Reference: คิดจากวงเงินค้ำที่เข้าเกณฑ์ ไม่ใช่วงเงินสินเชื่อทั้งก้อน ---
  const rbpRate = RBP_RATE[input.rbpTier];
  const guaranteeYear = input.guaranteeYear;
  const eligibleGuaranteedAmount = input.eligibleGuaranteedAmount;
  // ค่าธรรมเนียมอ้างอิงคิดจากวงเงินค้ำที่เข้าเกณฑ์เสมอ ไม่ขึ้นกับ Fee Waiver
  const rbpReferenceDay = (eligibleGuaranteedAmount * rbpRate) / RBP_DAY_COUNT_BASIS;
  const feeWaiverEnabled = input.feeWaiverEnabled === true;
  const feeWaiverApplied = feeWaiverEnabled && guaranteeYear <= FEE_WAIVER_YEARS;
  const customerRbpDay = feeWaiverApplied ? 0 : rbpReferenceDay;

  // --- PAYD / Adaptive Payment Reserve — Preview เท่านั้น ไม่มีการหักเงินจริงในระบบนี้ ---
  const paydTarget = paydRefDaily;
  const paydCapacity = availableCash;
  const postPaydResidual = Math.max(0, availableCash - paydTarget);
  const reserveTarget = paydTarget * RESERVE_TARGET_DAYS;
  const remainingReserveNeed = Math.max(0, reserveTarget - input.reserveBalance);
  const reserveContributionPreview =
    availableCash >= paydTarget
      ? Math.min(paydTarget * RESERVE_CONTRIBUTION_RATE, postPaydResidual, remainingReserveNeed)
      : 0;
  // เงินคงเหลือหลังจัดสรร แยกเป็นสองค่า: ส่วนที่เหลือจริง กับส่วนที่ยังขาด
  // ค่าที่นำไปแสดงผลจึงไม่ติดลบ และ "ขาดเท่าไร" ถูกสื่อสารเป็นตัวเลขของตัวเอง
  const netAfterAllocation = availableCash - paydTarget - reserveContributionPreview;
  const residualCash = Math.max(0, netAfterAllocation);
  const affordabilityGap = Math.max(0, -netAfterAllocation);

  // --- Principal Sustainability: จำลองยอดคงเหลือถึงงวดสุดท้าย ---
  const cfadsMonthly = availableCash * wd;
  const actualNewLoanCapacity = Math.max(0, cfadsMonthly - existingDebtMonthly);
  let bal = P;
  for (let m = 0; m < n; m++) {
    const pay = Math.min(pmt, actualNewLoanCapacity);
    bal = Math.max(0, bal + bal * r - pay);
  }
  const maturity = bal;

  // --- TCO เทียบกับการเช่ารถเดิม ---
  const currentCost = (input.rentDaily + input.fuelDaily) * wd;
  const evExpense = (dailyOpEx + requiredDebtDaily + customerRbpDay) * wd;
  const tcoDelta = evExpense - currentCost;

  // --- Evidence / Route / Indicative Tier ---
  const incomeEvidenceReliability = incomeEvidenceReliabilityOf(input.verifiedPct);
  const activityEvidenceStatus = activityEvidenceStatusOf(input.gpsComplete);
  const affordabilityPassed = dscr >= DSCR_GATE;
  const principalSustainabilityPassed = maturity <= PRINCIPAL_CLOSE_EPSILON;
  const route = appropriateRouteOf({
    affordabilityPassed,
    principalSustainabilityPassed,
    incomeEvidenceReliability
  });

  let tier = '—';
  if (route === ROUTES.READY_FOR_FI) {
    if (dscr >= 1.5 && incomeEvidenceReliability === 'HIGH') tier = 'A';
    else if (dscr >= 1.25) tier = 'B';
    else tier = 'C';
  }

  // --- Business Insights ---
  const totalRepayment = pmt * n;
  const totalInterest = Math.max(0, totalRepayment - P);
  const interestRatio = P > 0 ? totalInterest / P : 0;
  const schedule = buildSchedule(P, r, n, pmt);

  // Daily Break-even: ต้องมีรายได้ (ก่อน verification) เท่าไรต่อวันจึงจะครบทุกภาระ
  const dailyObligation = dailyOpEx + protectedDaily + requiredDebtDaily + customerRbpDay;
  const operatingObligation = dailyOpEx + requiredDebtDaily + customerRbpDay; // ไม่รวม Protected Cash
  const safeFactor = verificationFactor > 0 ? verificationFactor : 1;
  const breakEven = {
    dailyObligation,
    operatingObligation,
    requiredGrossDaily: dailyObligation / safeFactor,
    requiredGrossOperating: operatingObligation / safeFactor,
    marginDaily: verified - dailyObligation,
    marginPct: verified > 0 ? (verified - dailyObligation) / verified : 0,
    marginMonthly: (verified - dailyObligation) * wd,
    batteryServiceDaily: batteryService,
    batteryShareOfVerified: verified > 0 ? batteryService / verified : 0,
    batteryShareOfObligation: dailyObligation > 0 ? batteryService / dailyObligation : 0,
    // ต้องขับกี่วัน/เดือน จึงจะครอบคลุมภาระคงที่รายเดือน
    breakEvenWorkDays:
      verified - dailyOpEx > 0
        ? (input.householdMonthly + requiredDebtDaily * wd + customerRbpDay * wd) / (verified - dailyOpEx)
        : Infinity
  };

  const breakdown = readinessBreakdownOf(input, {
    verified,
    dscr,
    dscr15,
    pai,
    maturity,
    principal: P,
    remaining: residualCash,
    breakEven
  });
  const readinessScore = readinessScoreOf({ breakdown });
  const recommendations = recommendationsOf(breakdown);
  // ไม่มีวงเงินให้ประเมิน ผลลัพธ์จึงไม่มีความหมายเชิงเครดิต
  const noLoan = !(P > 0);

  // ระดับความเสี่ยงสำหรับกำหนดสีในหน้าจอ
  let riskLevel = RISK_LEVELS.RISK;
  if (route === ROUTES.READY_FOR_FI && dscr >= 1.25 && pai <= 0.8) riskLevel = RISK_LEVELS.GOOD;
  else if (affordabilityPassed && principalSustainabilityPassed) riskLevel = RISK_LEVELS.WATCH;

  const reasons = buildReasons({
    dscr,
    dscr15,
    dscr30,
    pai,
    maturity,
    availableCash,
    cashShortfallBeforeObligations,
    feeWaiverApplied,
    affordabilityPassed,
    principalSustainabilityPassed,
    incomeEvidenceReliability,
    activityEvidenceStatus,
    route,
    rawAvailDaily,
    energyIncluded,
    batteryService,
    existingDebtMonthly,
    guaranteeYear,
    eligibleGuaranteedAmount,
    loanNeed: P,
    paydTarget,
    reserveTarget,
    reserveContributionPreview,
    residualCash,
    affordabilityGap,
    tcoDelta,
    downtimeDays: input.downtimeDays,
    totalInterest,
    breakEven
  });

  return {
    calc: {
      gross,
      verified,
      verificationFactor,
      km,
      energyIncluded,
      rawEnergy,
      energy,
      maint,
      tire,
      ins,
      other,
      batteryService,
      dailyOpEx,
      protectedDaily,
      /** ค่าที่นำไปแสดงผลทุกช่องทาง — ไม่ติดลบ */
      availableCash,
      /** ขาดอยู่เท่าไรก่อนถึงภาระผ่อน (แสดงแทนการโชว์ Available Cash ติดลบ) */
      cashShortfallBeforeObligations,
      /** ค่าดิบสำหรับวินิจฉัยภายในเท่านั้น ติดลบได้ ห้ามแสดงในชื่อ Available Cash */
      rawAvailDaily,
      pmt,
      annualDebtService,
      paydRefDaily,
      requiredDebtDaily,
      dscr,
      dscr15,
      dscr30,
      pai,
      // Guarantee / RBP
      eligibleGuaranteedAmount,
      rbpRate,
      rbpDayCountBasis: RBP_DAY_COUNT_BASIS,
      rbpStatus: RBP_STATUS,
      rbpReferenceDay,
      rbpDay: customerRbpDay,
      customerRbpDay,
      guaranteeYear,
      feeWaiverEnabled,
      feeWaiverApplied,
      feeWaiverStatus: FEE_WAIVER_STATUS,
      // PAYD / Reserve preview
      paydTarget,
      paydCapacity,
      reserveTarget,
      reserveBalance: input.reserveBalance,
      reserveContributionPreview,
      residualCash,
      affordabilityGap,
      maturity,
      affordabilityPassed,
      principalSustainabilityPassed,
      currentCost,
      evExpense,
      tcoDelta,
      totalRepayment,
      totalInterest,
      interestRatio,
      schedule: schedule.rows,
      amortizes: schedule.amortizes,
      breakEven
    },
    readiness: {
      route,
      tier,
      incomeEvidenceReliability,
      activityEvidenceStatus,
      readinessScore,
      riskLevel,
      noLoan,
      breakdown,
      recommendations,
      preScore: {
        status: 'COMPLETED',
        score: readinessScore,
        method: 'Explainable 5-Component Pre-Score (advisory, non-routing)'
      }
    },
    reasons
  };
}

function buildReasons(x) {
  const baht = (v) => Math.round(v).toLocaleString('th-TH');
  const reasons = [];

  reasons.push(
    x.cashShortfallBeforeObligations > 0
      ? `Available Cash = 0 บาท/วัน — รายได้ยังขาดอีก ${baht(x.cashShortfallBeforeObligations)} บาท/วัน จึงจะครอบคลุม Eligible OpEx และ Protected Cash`
      : `Available Cash หลัง Eligible OpEx และ Protected Cash = ${baht(x.availableCash)} บาท/วัน`
  );

  reasons.push(
    x.affordabilityPassed
      ? `Affordability ผ่าน — DSCR Base ${x.dscr.toFixed(2)}x ไม่ต่ำกว่า Gate ${DSCR_GATE.toFixed(2)}x`
      : `Affordability ไม่ผ่าน — DSCR Base ${x.dscr.toFixed(2)}x ต่ำกว่า Gate ${DSCR_GATE.toFixed(2)}x`
  );

  reasons.push(
    x.principalSustainabilityPassed
      ? 'Principal Sustainability = CLOSE: ปิดเงินต้นได้ตาม FI Contractual Schedule'
      : `Principal Sustainability = GAP: คาดว่าเหลือเงินต้น ${baht(x.maturity)} บาท ณ งวดสุดท้าย`
  );

  reasons.push(`PAI ${x.pai.toFixed(2)} (สัดส่วนภาระหนี้ต่อ Available Cash)`);

  reasons.push(
    `Income Evidence Reliability = ${x.incomeEvidenceReliability}: อ้างอิงจากสัดส่วนรายได้ที่ตรวจสอบย้อนกลับได้เท่านั้น`
  );

  reasons.push(
    `Activity Evidence = ${x.activityEvidenceStatus}: ใช้เป็น Cross-Validation และดูความต่อเนื่องของอาชีพ ไม่ใช้สร้างรายได้`
  );

  reasons.push(
    `Stress Diagnostic — DSCR −15% = ${x.dscr15.toFixed(2)}x, −30% = ${x.dscr30.toFixed(2)}x ` +
      '(ใช้ Calibration ยังไม่ใช่ Hard Decline จนกว่าจะผ่าน Real Data Replay)'
  );

  reasons.push(
    `ต้นทุนดอกเบี้ยรวมตลอดสัญญา ${baht(x.totalInterest)} บาท — ต้องมีรายได้ก่อนหักอย่างน้อย ` +
      `${baht(x.breakEven.requiredGrossDaily)} บาท/วัน จึงจะครอบคลุมทุกภาระ`
  );

  reasons.push(
    x.breakEven.marginDaily >= 0
      ? `เหลือหลังครบทุกภาระ ${baht(x.breakEven.marginDaily)} บาท/วัน (${(x.breakEven.marginPct * 100).toFixed(1)}% ของรายได้ที่ Verify ได้)`
      : `ขาด ${baht(Math.abs(x.breakEven.marginDaily))} บาท/วัน จึงจะครอบคลุมทุกภาระ`
  );

  reasons.push(
    `PAYD Target Preview ${baht(x.paydTarget)} บาท/วัน และ Adaptive Payment Reserve เป้าหมาย ${baht(x.reserveTarget)} บาท ` +
      `(สะสมวันละ ${baht(x.reserveContributionPreview)} บาทในภาพจำลอง) — Actual Sweep เกิดหลัง FI อนุมัติในระบบหลังอนุมัติเท่านั้น`
  );

  reasons.push(
    x.affordabilityGap > 0
      ? `Affordability Gap ${baht(x.affordabilityGap)} บาท/วัน — ยังขาดเท่านี้จึงจะรองรับ PAYD Target และเงินสำรองได้`
      : `Residual Cash ${baht(x.residualCash)} บาท/วัน — เหลือหลังจัดสรร PAYD Target และเงินสำรองแล้ว`
  );

  if (x.downtimeDays > 0) {
    reasons.push(`Downtime ${x.downtimeDays} วัน/เดือน ใช้เป็นข้อมูลความเสถียร ยังไม่ใช่ Hard Threshold`);
  }

  reasons.push(
    x.batteryService > 0
      ? `ค่าบริการแบตเตอรี่/การสลับ ${baht(x.batteryService)} บาท/วัน แยกจากสินเชื่อซื้อรถ` +
        (x.energyIncluded ? ' และรวมค่าไฟแล้ว ระบบจึงไม่หัก Energy ซ้ำ' : ' โดยไม่รวมค่าไฟ ระบบหักค่าพลังงานแยกตาม kWh/km')
      : 'ยังไม่มีค่าบริการแบตเตอรี่/การสลับใน Scenario นี้ — ต้นทุนแบตเตอรี่แยกจากสินเชื่อซื้อรถเสมอ'
  );

  if (x.existingDebtMonthly > 0) {
    reasons.push(`มีภาระหนี้เดิม ${baht(x.existingDebtMonthly)} บาท/เดือน ถูกรวมใน Required Debt Service`);
  }

  reasons.push(
    x.eligibleGuaranteedAmount < x.loanNeed
      ? `วงเงินค้ำที่เข้าเกณฑ์ ${baht(x.eligibleGuaranteedAmount)} บาท จากวงเงินสินเชื่อ ${baht(x.loanNeed)} บาท — ค่าธรรมเนียมอ้างอิงคิดจากฐานที่เข้าเกณฑ์เท่านั้น`
      : `วงเงินค้ำที่เข้าเกณฑ์ ${baht(x.eligibleGuaranteedAmount)} บาท ใน Scenario นี้ — ไม่ใช่สิทธิค้ำอัตโนมัติและต้องผ่านเกณฑ์จริง`
  );

  reasons.push(
    x.feeWaiverApplied
      ? `ปีที่ ${x.guaranteeYear} เปิดใช้ Proposed RBP Fee Waiver ปี 1–${FEE_WAIVER_YEARS} (${FEE_WAIVER_STATUS}) — ผู้ขับยังไม่ถูกเรียกเก็บ RBP ใน Scenario นี้`
      : `RBP Fee Waiver ปิดอยู่ (${FEE_WAIVER_STATUS} — ยังไม่อยู่ใน Frozen Product Spec) ผู้ขับจึงถูกคิดค่าธรรมเนียมอ้างอิงตาม Risk Tier`
  );

  reasons.push(
    x.tcoDelta <= 0
      ? `TCO ต่ำกว่าการเช่ารถเดิม ${baht(Math.abs(x.tcoDelta))} บาท/เดือน`
      : `TCO สูงกว่าการเช่ารถเดิม ${baht(x.tcoDelta)} บาท/เดือน`
  );

  reasons.push(
    x.route === ROUTES.READY_FOR_FI
      ? 'พร้อมเข้าสู่การพิจารณาของ FI โดย FI เป็นผู้ตัดสินสินเชื่อขั้นสุดท้าย'
      : x.route === ROUTES.BUILD_READINESS
        ? 'สร้างความพร้อมหรือเช่าต่อก่อน แล้วประเมินใหม่เมื่อหลักฐานรายได้เพียงพอ'
        : 'Affordability ยังไม่รองรับหนี้ใหม่ จึงไม่ควรเพิ่มภาระในขณะนี้'
  );

  return reasons;
}

/** ทางลัด: normalize + score ในครั้งเดียว (หน้าบ้านใช้ตัวนี้) */
export function evaluate(body) {
  const input = normalize(body);
  const result = scoreRoute2Own(input);
  return { input, calc: result.calc, readiness: result.readiness, reasons: result.reasons };
}

// เปิดให้ inline script แบบ classic ในหน้าบ้านเรียกใช้ได้
if (typeof window !== 'undefined') {
  window.Route2OwnEngine = {
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
  };
  window.dispatchEvent(new Event('route2own-engine-ready'));
}
