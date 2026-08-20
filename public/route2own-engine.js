/**
 * Route2Own Credit Readiness Engine — v1.4
 *
 * ไฟล์นี้เป็น "ระบบคำนวณหลัก" หนึ่งเดียวของโครงการ ใช้ร่วมกันทั้ง
 *   - หน้าบ้าน  public/route2own.html  (โหลดเป็น ES module + window.Route2OwnEngine)
 *   - Next.js   app/lib/route2own.ts   (re-export ต่อให้ /api/score และ /legacy-score)
 * แก้ที่นี่ที่เดียว ทุกช่องทางเปลี่ยนตาม — ไม่มีสำเนาตรรกะซ้ำอีกต่อไป
 *
 * Competition Working Scenario: Loan/Guarantee 800,000 บาท • BaaS 400 บาท/วัน
 * (Energy Included) • Guarantee Coverage 100% • RBP A/B/C = 1.20/1.50/2.50% p.a.
 * • Proposed Fee Waiver ปี 1–3
 *
 * ตัวเลข Threshold ทั้งหมดยังต้องผ่าน Real Data Replay / Risk / FI Validation
 */

/** ค่าตั้งต้นของ Working Scenario (ตัวเลขชุดเดียวกับ v1.3) */
export const SCENARIO_V13 = {
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
  baasDaily: 400,
  energyIncluded: 'included',
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
  loanNeed: 800000,
  interest: 6,
  tenor: 84,
  rbpTier: 'B',
  guaranteeYear: 1
};

export const RBP_RATE = { A: 0.012, B: 0.015, C: 0.025 };

export const GUARANTEE_COVERAGE = 1; // ค้ำ 100% ของวงเงินสินเชื่อ
export const MONITORING_DAILY = 5; // Base Monitoring Proposal / Eligible Day
export const CURE_RESERVE_CAP = 20; // Cure Reserve สูงสุด/วัน (ยังเป็นเงินของผู้ขับ)
export const FEE_WAIVER_YEARS = 3; // Proposed RBP Fee Waiver ปี 1–3
export const DSCR_GATE = 1.0; // Gate ขั้นต่ำใน Working Model
export const MATURITY_TOLERANCE = 1000; // ยอดคงเหลือ ณ ครบกำหนดที่ยังถือว่า CLOSE

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

/**
 * วงเงินสินเชื่อที่ต้องใช้ = ราคารถ − เงินดาวน์ เสมอ
 * ดักไม่ให้ติดลบหรือเป็น NaN (v1.4)
 */
export function deriveLoanNeed(vehiclePrice, downPayment) {
  const price = nonNegative(vehiclePrice, 0);
  const down = nonNegative(downPayment, 0);
  const need = price - down;
  return Number.isFinite(need) && need > 0 ? need : 0;
}

export function normalize(body) {
  const b = body || {};
  const d = SCENARIO_V13;
  const tier = b.rbpTier;
  const vehiclePrice = nonNegative(b.vehiclePrice, d.vehiclePrice);
  // เงินดาวน์ต้องไม่เกินราคารถ มิฉะนั้นวงเงินจะติดลบ
  const downPayment = Math.min(nonNegative(b.downPayment, d.downPayment), vehiclePrice);
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
    baasDaily: nonNegative(b.baasDaily, d.baasDaily),
    energyIncluded: b.energyIncluded === 'excluded' ? 'excluded' : 'included',
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
    // วงเงินคำนวณจากราคารถ − เงินดาวน์ เสมอ เว้นแต่ส่ง loanNeed มาตรงๆ (ใช้ในกรณี API เดิม)
    loanNeed:
      b.loanNeed === undefined || b.loanNeed === null || b.loanNeed === ''
        ? deriveLoanNeed(vehiclePrice, downPayment)
        : nonNegative(b.loanNeed, d.loanNeed),
    interest: nonNegative(b.interest, d.interest),
    tenor: Math.max(1, Math.round(nonNegative(b.tenor, d.tenor)) || d.tenor),
    rbpTier: tier === 'A' || tier === 'B' || tier === 'C' ? tier : d.rbpTier,
    guaranteeYear: Math.max(1, Math.round(num(b.guaranteeYear, d.guaranteeYear)))
  };
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * ตารางผ่อนชำระรายปี ตาม FI Contractual Schedule (v1.4)
 * คืนค่าแยกเงินต้น/ดอกเบี้ยรายปี เพื่อใช้ในรายงาน PDF และกราฟ
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

/**
 * คะแนนความพร้อม 0–100 (Prototype Composite) — v1.4
 * ใช้เพื่อสื่อสารกับผู้ขับให้เห็นภาพรวมในตัวเลขเดียว ไม่ใช่ Credit Score
 *   DSCR 45 • Principal Sustainability 25 • Data Confidence 20 • Stress Buffer 10
 */
export function readinessScoreOf({ dscr, dscr15, maturity, principal, dataConfidence }) {
  const dscrPart = Math.min(dscr / 1.5, 1) * 45;
  const maturityPart =
    maturity <= MATURITY_TOLERANCE
      ? 25
      : Math.max(0, 25 * (1 - maturity / Math.max(1, principal)));
  const confPart = dataConfidence === 'HIGH' ? 20 : dataConfidence === 'MEDIUM' ? 12 : 4;
  const stressPart = Math.min(dscr15 / 1.2, 1) * 10;
  return Math.max(0, Math.min(100, Math.round(dscrPart + maturityPart + confPart + stressPart)));
}

export function scoreRoute2Own(input) {
  const wd = input.workDays || SCENARIO_V13.workDays;
  const km = input.serviceKm + input.repositionKm + input.chargingKm;

  // --- Daily Financial X-Ray ---
  const gross = input.grossDaily;
  const verificationFactor = (input.verifiedPct / 100) * (1 - input.commissionPct / 100);
  const verified = gross * verificationFactor;
  const baas = input.baasDaily;
  const energyIncluded = input.energyIncluded === 'included';
  const rawEnergy = km * input.kwhKm * input.electricityRate;
  const energy = energyIncluded ? 0 : rawEnergy; // BaaS รวมค่าไฟแล้ว จึงไม่หักซ้ำ
  const maint = km * input.maintKm;
  const tire = km * input.tireKm;
  const ins = input.insuranceMonthly / wd;
  const other = input.otherOpEx / wd;
  const dailyOpEx = baas + energy + maint + tire + ins + other;
  const protectedDaily = input.householdMonthly / wd + input.nextShiftDaily;
  const rawAvailDaily = verified - dailyOpEx - protectedDaily;
  const sweepableCash = Math.max(0, rawAvailDaily);

  // --- FI Contractual Schedule (Scenario) ---
  const annualRate = input.interest / 100;
  const r = annualRate / 12;
  const n = input.tenor || SCENARIO_V13.tenor;
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
  const dscr = requiredDebtDaily > 0 ? Math.max(0, rawAvailDaily) / requiredDebtDaily : 99;
  const rawAvail15 = verified * 0.85 - dailyOpEx - protectedDaily;
  const rawAvail30 = verified * 0.7 - dailyOpEx - protectedDaily;
  const dscr15 = requiredDebtDaily > 0 ? Math.max(0, rawAvail15) / requiredDebtDaily : 99;
  const dscr30 = requiredDebtDaily > 0 ? Math.max(0, rawAvail30) / requiredDebtDaily : 99;
  const pai = rawAvailDaily > 0 ? requiredDebtDaily / rawAvailDaily : 9.99;

  // --- RBP Transparency ---
  const rbpRate = RBP_RATE[input.rbpTier];
  const guaranteeYear = input.guaranteeYear;
  const guaranteedOutstanding = P * GUARANTEE_COVERAGE;
  const rbpReferenceDay = (guaranteedOutstanding * rbpRate) / 365;
  const customerRbpDay = guaranteeYear <= FEE_WAIVER_YEARS ? 0 : rbpReferenceDay;
  const monitoring = MONITORING_DAILY;
  const cure = Math.min(
    CURE_RESERVE_CAP,
    Math.max(0, rawAvailDaily - requiredDebtDaily - customerRbpDay - monitoring)
  );
  const remaining = rawAvailDaily - requiredDebtDaily - customerRbpDay - monitoring - cure;

  // --- Principal Sustainability: จำลองยอดคงเหลือถึงงวดสุดท้าย ---
  const cfadsMonthly = Math.max(0, rawAvailDaily) * wd;
  const actualNewLoanCapacity = Math.max(0, cfadsMonthly - existingDebtMonthly);
  let bal = P;
  for (let m = 0; m < n; m++) {
    const pay = Math.min(pmt, actualNewLoanCapacity);
    bal = Math.max(0, bal + bal * r - pay);
  }
  const maturity = bal;

  // --- TCO เทียบกับการเช่ารถเดิม ---
  const currentCost = (input.rentDaily + input.fuelDaily) * wd;
  const evExpense = (dailyOpEx + requiredDebtDaily + customerRbpDay + monitoring) * wd;
  const tcoDelta = evExpense - currentCost;

  // --- Data Confidence / Route / Indicative Tier ---
  const dataConfidence =
    input.verifiedPct >= 90 && input.gpsComplete >= 90
      ? 'HIGH'
      : input.verifiedPct >= 70 && input.gpsComplete >= 70
        ? 'MEDIUM'
        : 'LOW';

  let route = 'BUILD READINESS';
  if (dscr < DSCR_GATE || maturity > MATURITY_TOLERANCE) route = 'NO NEW DEBT';
  else if (dscr >= DSCR_GATE && dataConfidence !== 'LOW') route = 'OWN READY';

  let tier = '—';
  if (route === 'OWN READY') {
    if (dscr >= 1.5 && dataConfidence === 'HIGH') tier = 'A';
    else if (dscr >= 1.25 && dataConfidence !== 'LOW') tier = 'B';
    else tier = 'C';
  }

  // ===== v1.4 — Business Insights =====
  const totalRepayment = pmt * n;
  const totalInterest = Math.max(0, totalRepayment - P);
  const interestRatio = P > 0 ? totalInterest / P : 0;
  const schedule = buildSchedule(P, r, n, pmt);

  // Daily Break-even: ต้องมีรายได้ (ก่อน verification) เท่าไรต่อวันจึงจะครบทุกภาระ
  const dailyObligation = dailyOpEx + protectedDaily + requiredDebtDaily + customerRbpDay + monitoring;
  const operatingObligation = dailyOpEx + requiredDebtDaily + customerRbpDay + monitoring; // ไม่รวม Protected Cash
  const safeFactor = verificationFactor > 0 ? verificationFactor : 1;
  const breakEven = {
    dailyObligation,
    operatingObligation,
    requiredGrossDaily: dailyObligation / safeFactor,
    requiredGrossOperating: operatingObligation / safeFactor,
    marginDaily: verified - dailyObligation,
    marginPct: verified > 0 ? (verified - dailyObligation) / verified : 0,
    marginMonthly: (verified - dailyObligation) * wd,
    baasDaily: baas,
    baasShareOfVerified: verified > 0 ? baas / verified : 0,
    baasShareOfObligation: dailyObligation > 0 ? baas / dailyObligation : 0,
    // ต้องขับกี่วัน/เดือน จึงจะครอบคลุมภาระคงที่รายเดือน
    breakEvenWorkDays:
      verified - dailyOpEx > 0
        ? (input.householdMonthly + requiredDebtDaily * wd + (customerRbpDay + monitoring) * wd) /
          (verified - dailyOpEx)
        : Infinity
  };

  const readinessScore = readinessScoreOf({ dscr, dscr15, maturity, principal: P, dataConfidence });
  // ไม่มีวงเงินให้ประเมิน (ราคารถ − เงินดาวน์ = 0) ผลลัพธ์จึงไม่มีความหมายเชิงเครดิต
  const noLoan = !(P > 0);

  // ระดับความเสี่ยงสำหรับกำหนดสีในหน้าจอ
  let riskLevel = RISK_LEVELS.RISK;
  if (route === 'OWN READY' && dscr >= 1.25 && pai <= 0.8) riskLevel = RISK_LEVELS.GOOD;
  else if (dscr >= DSCR_GATE && maturity <= MATURITY_TOLERANCE) riskLevel = RISK_LEVELS.WATCH;

  const reasons = buildReasons({
    dscr,
    dscr15,
    dscr30,
    pai,
    maturity,
    dataConfidence,
    route,
    rawAvailDaily,
    energyIncluded,
    existingDebtMonthly,
    guaranteeYear,
    remaining,
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
      baas,
      dailyOpEx,
      protectedDaily,
      rawAvailDaily,
      availDaily: rawAvailDaily,
      sweepableCash,
      pmt,
      annualDebtService,
      paydRefDaily,
      requiredDebtDaily,
      dscr,
      dscr15,
      dscr30,
      pai,
      coveragePct: GUARANTEE_COVERAGE * 100,
      guaranteedOutstanding,
      rbpRate,
      rbpReferenceDay,
      rbpDay: customerRbpDay,
      customerRbpDay,
      guaranteeYear,
      monitoring,
      cure,
      remaining,
      maturity,
      currentCost,
      evExpense,
      tcoDelta,
      // v1.4
      totalRepayment,
      totalInterest,
      interestRatio,
      schedule: schedule.rows,
      amortizes: schedule.amortizes,
      breakEven
    },
    readiness: { route, tier, dataConfidence, readinessScore, riskLevel, noLoan },
    reasons
  };
}

function buildReasons(x) {
  const baht = (v) => Math.round(v).toLocaleString('th-TH');
  const reasons = [];

  reasons.push(
    x.rawAvailDaily > 0
      ? `Available Cash หลัง Eligible OpEx และ Protected Cash = ${baht(x.rawAvailDaily)} บาท/วัน`
      : `Available Cash ติดลบ (${baht(x.rawAvailDaily)} บาท/วัน) — รายได้ยังไม่พอหลังหักต้นทุนและ Protected Cash`
  );

  reasons.push(
    x.dscr >= DSCR_GATE
      ? `DSCR Base ${x.dscr.toFixed(2)}x ผ่าน Gate ขั้นต่ำใน Working Model = ${DSCR_GATE.toFixed(2)}x`
      : `DSCR Base ${x.dscr.toFixed(2)}x ต่ำกว่า Gate ขั้นต่ำ ${DSCR_GATE.toFixed(2)}x`
  );

  reasons.push(
    x.maturity <= MATURITY_TOLERANCE
      ? 'Principal Maturity = CLOSE: ปิดเงินต้นได้ตาม FI Contractual Schedule'
      : `Principal Maturity = GAP: คาดว่าเหลือเงินต้น ${baht(x.maturity)} บาท ณ งวดสุดท้าย`
  );

  reasons.push(`PAI ${x.pai.toFixed(2)} (สัดส่วนภาระหนี้ต่อ Available Cash)`);

  reasons.push(
    x.dataConfidence === 'HIGH'
      ? 'Data Confidence = HIGH: Verified Revenue และ GPS Completeness ครบถ้วน'
      : x.dataConfidence === 'MEDIUM'
        ? 'Data Confidence = MEDIUM: ควรสะสมข้อมูลรายได้/GPS เพิ่มก่อนยื่น FI'
        : 'Data Confidence = LOW: ข้อมูลยังไม่พอต่อการจัด Route OWN READY'
  );

  reasons.push(
    `Stress Diagnostic — DSCR −15% = ${x.dscr15.toFixed(2)}x, −30% = ${x.dscr30.toFixed(2)}x ` +
      '(ใช้ Calibration ยังไม่ใช่ Hard Decline จนกว่าจะผ่าน Real Data Replay)'
  );

  // v1.4 — Business Insight
  reasons.push(
    `ต้นทุนดอกเบี้ยรวมตลอดสัญญา ${baht(x.totalInterest)} บาท — ต้องมีรายได้ก่อนหักอย่างน้อย ` +
      `${baht(x.breakEven.requiredGrossDaily)} บาท/วัน จึงจะครอบคลุมทุกภาระ`
  );

  reasons.push(
    x.breakEven.marginDaily >= 0
      ? `เหลือหลังครบทุกภาระ ${baht(x.breakEven.marginDaily)} บาท/วัน (${(x.breakEven.marginPct * 100).toFixed(1)}% ของรายได้ที่ Verify ได้)`
      : `ขาด ${baht(Math.abs(x.breakEven.marginDaily))} บาท/วัน จึงจะครอบคลุมทุกภาระ`
  );

  if (x.downtimeDays > 0) {
    reasons.push(
      `Downtime ${x.downtimeDays} วัน/เดือน ใช้เป็นข้อมูลความเสถียร ยังไม่ใช่ Hard Threshold`
    );
  }

  reasons.push(
    x.energyIncluded
      ? 'BaaS รวมค่าไฟแล้ว (Energy Included) ระบบจึงไม่หัก Energy ซ้ำ'
      : 'BaaS ไม่รวมค่าไฟ (Energy Excluded) ระบบหักค่าพลังงานตาม kWh/km และค่าไฟที่กรอก'
  );

  if (x.existingDebtMonthly > 0) {
    reasons.push(`มีภาระหนี้เดิม ${baht(x.existingDebtMonthly)} บาท/เดือน ถูกรวมใน Required Debt Service`);
  }

  reasons.push(
    x.guaranteeYear <= FEE_WAIVER_YEARS
      ? `ปีที่ ${x.guaranteeYear} อยู่ใน Proposed RBP Fee Waiver ปี 1–${FEE_WAIVER_YEARS} — ผู้ขับยังไม่ถูกเรียกเก็บ RBP`
      : `ปีที่ ${x.guaranteeYear} พ้นช่วง Fee Waiver — เริ่มเก็บ RBP ตาม Risk Tier`
  );

  reasons.push(
    x.tcoDelta <= 0
      ? `TCO ต่ำกว่าการเช่ารถเดิม ${baht(Math.abs(x.tcoDelta))} บาท/เดือน`
      : `TCO สูงกว่าการเช่ารถเดิม ${baht(x.tcoDelta)} บาท/เดือน`
  );

  reasons.push(
    x.route === 'OWN READY'
      ? 'สามารถจัดทำ Readiness Certificate และส่งต่อ FI ได้ โดยต้องยืนยันเอกสารและเงื่อนไข FI จริง'
      : x.route === 'BUILD READINESS'
        ? 'ยังไม่ควรเร่งสร้างหนี้ ควรเก็บข้อมูลเพิ่ม ลดภาระ/ราคาสินทรัพย์ หรือเพิ่มเงินดาวน์'
        : 'ไม่ควรใช้ Guarantee Coverage เพื่อฝืน Affordability ควรคงเส้นทางเช่า/ไม่สร้างหนี้ใหม่และทบทวนภายหลัง'
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
    SCENARIO_V13,
    RBP_RATE,
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
    readinessScoreOf,
    scoreRoute2Own,
    evaluate
  };
  window.dispatchEvent(new Event('route2own-engine-ready'));
}
