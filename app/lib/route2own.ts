/**
 * Route2Own Credit Readiness — Competition Working Scenario v1.3 (800K / BaaS 400)
 *
 * ตรรกะทั้งหมดในไฟล์นี้ port มาจาก calculateRoute() ของหน้าบ้าน
 * (public/route2own.html) เพื่อให้ API และ Front Office ให้ผลตรงกัน
 *
 * Working Scenario: Loan/Guarantee 800,000 บาท • BaaS 400 บาท/วัน (Energy Included)
 * • Guarantee Coverage 100% • RBP A/B/C = 1.20% / 1.50% / 2.50% p.a.
 * • Proposed Fee Waiver ปี 1–3
 *
 * ตัวเลข Threshold ทั้งหมดยังต้องผ่าน Real Data Replay / Risk / FI Validation
 */

export type EnergyMode = "included" | "excluded";
export type RbpTier = "A" | "B" | "C";
export type Route = "OWN READY" | "BUILD READINESS" | "NO NEW DEBT";
export type DataConfidence = "HIGH" | "MEDIUM" | "LOW";

export type ScoreInput = {
  // A. รายได้
  grossDaily: number;
  workDays: number;
  verifiedPct: number;
  commissionPct: number;
  rentDaily: number;
  fuelDaily: number;
  // B. Mobility
  serviceKm: number;
  repositionKm: number;
  chargingKm: number;
  downtimeDays: number;
  gpsComplete: number;
  // C. ค่าใช้จ่าย EV / BaaS
  baasDaily: number;
  energyIncluded: EnergyMode;
  electricityRate: number;
  kwhKm: number;
  maintKm: number;
  tireKm: number;
  insuranceMonthly: number;
  otherOpEx: number;
  // D. ภาระและ Protected Cash
  existingDebt: number;
  householdMonthly: number;
  nextShiftDaily: number;
  // E. โครงสร้างสินเชื่อ
  vehiclePrice: number;
  downPayment: number;
  loanNeed: number;
  interest: number;
  tenor: number;
  // F. Guarantee / RBP
  rbpTier: RbpTier;
  guaranteeYear: number;
};

/** ค่าตั้งต้นของ Working Scenario v1.3 — ตรงกับ state.passport ของหน้าบ้าน */
export const SCENARIO_V13: ScoreInput = {
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
  energyIncluded: "included",
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
  rbpTier: "B",
  guaranteeYear: 1
};

/** RBP Fee Scenario ต่อปี ตาม Risk Tier */
export const RBP_RATE: Record<RbpTier, number> = { A: 0.012, B: 0.015, C: 0.025 };

export const GUARANTEE_COVERAGE = 1; // ค้ำ 100% ของวงเงินสินเชื่อ
export const MONITORING_DAILY = 5; // Base Monitoring Proposal / Eligible Day
export const CURE_RESERVE_CAP = 20; // Cure Reserve สูงสุด/วัน (ยังเป็นเงินของผู้ขับ)
export const FEE_WAIVER_YEARS = 3; // Proposed RBP Fee Waiver ปี 1–3
export const DSCR_GATE = 1.0; // Gate ขั้นต่ำใน Working Model
export const MATURITY_TOLERANCE = 1000; // ยอดคงเหลือ ณ ครบกำหนดที่ยังถือว่า CLOSE

/** ใช้ค่า default เมื่อไม่ได้ส่งมาหรือส่งค่าที่ไม่ใช่ตัวเลข — เทียบเท่า `??` ของหน้าบ้าน (0 ที่ตั้งใจส่งจะถูกเก็บไว้) */
function num(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalize(body: Partial<ScoreInput>): ScoreInput {
  const d = SCENARIO_V13;
  const tier = body.rbpTier;
  return {
    grossDaily: num(body.grossDaily, d.grossDaily),
    workDays: num(body.workDays, d.workDays),
    verifiedPct: num(body.verifiedPct, d.verifiedPct),
    commissionPct: num(body.commissionPct, d.commissionPct),
    rentDaily: num(body.rentDaily, d.rentDaily),
    fuelDaily: num(body.fuelDaily, d.fuelDaily),
    serviceKm: num(body.serviceKm, d.serviceKm),
    repositionKm: num(body.repositionKm, d.repositionKm),
    chargingKm: num(body.chargingKm, d.chargingKm),
    downtimeDays: num(body.downtimeDays, d.downtimeDays),
    gpsComplete: num(body.gpsComplete, d.gpsComplete),
    baasDaily: num(body.baasDaily, d.baasDaily),
    energyIncluded: body.energyIncluded === "excluded" ? "excluded" : "included",
    electricityRate: num(body.electricityRate, d.electricityRate),
    kwhKm: num(body.kwhKm, d.kwhKm),
    maintKm: num(body.maintKm, d.maintKm),
    tireKm: num(body.tireKm, d.tireKm),
    insuranceMonthly: num(body.insuranceMonthly, d.insuranceMonthly),
    otherOpEx: num(body.otherOpEx, d.otherOpEx),
    existingDebt: num(body.existingDebt, d.existingDebt),
    householdMonthly: num(body.householdMonthly, d.householdMonthly),
    nextShiftDaily: num(body.nextShiftDaily, d.nextShiftDaily),
    vehiclePrice: num(body.vehiclePrice, d.vehiclePrice),
    downPayment: num(body.downPayment, d.downPayment),
    loanNeed: num(body.loanNeed, d.loanNeed),
    interest: num(body.interest, d.interest),
    tenor: num(body.tenor, d.tenor),
    rbpTier: tier === "A" || tier === "B" || tier === "C" ? tier : d.rbpTier,
    guaranteeYear: Math.max(1, Math.round(num(body.guaranteeYear, d.guaranteeYear)))
  };
}

export type ScoreResult = ReturnType<typeof scoreRoute2Own>;

export function scoreRoute2Own(input: ScoreInput) {
  const wd = input.workDays || SCENARIO_V13.workDays;
  const km = input.serviceKm + input.repositionKm + input.chargingKm;

  // --- Daily Financial X-Ray ---
  const gross = input.grossDaily;
  const verified = gross * (input.verifiedPct / 100) * (1 - input.commissionPct / 100);
  const baas = input.baasDaily;
  const energyIncluded = input.energyIncluded === "included";
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
  const dataConfidence: DataConfidence =
    input.verifiedPct >= 90 && input.gpsComplete >= 90
      ? "HIGH"
      : input.verifiedPct >= 70 && input.gpsComplete >= 70
        ? "MEDIUM"
        : "LOW";

  let route: Route = "BUILD READINESS";
  if (dscr < DSCR_GATE || maturity > MATURITY_TOLERANCE) route = "NO NEW DEBT";
  else if (dscr >= DSCR_GATE && dataConfidence !== "LOW") route = "OWN READY";

  let tier: RbpTier | "—" = "—";
  if (route === "OWN READY") {
    if (dscr >= 1.5 && dataConfidence === "HIGH") tier = "A";
    else if (dscr >= 1.25 && dataConfidence !== "LOW") tier = "B";
    else tier = "C";
  }

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
    downtimeDays: input.downtimeDays
  });

  return {
    calc: {
      gross,
      verified,
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
      tcoDelta
    },
    readiness: { route, tier, dataConfidence },
    reasons
  };
}

function buildReasons(x: {
  dscr: number;
  dscr15: number;
  dscr30: number;
  pai: number;
  maturity: number;
  dataConfidence: DataConfidence;
  route: Route;
  rawAvailDaily: number;
  energyIncluded: boolean;
  existingDebtMonthly: number;
  guaranteeYear: number;
  remaining: number;
  tcoDelta: number;
  downtimeDays: number;
}) {
  const baht = (v: number) => Math.round(v).toLocaleString("th-TH");
  const reasons: string[] = [];

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
      ? "Principal Maturity = CLOSE: ปิดเงินต้นได้ตาม FI Contractual Schedule"
      : `Principal Maturity = GAP: คาดว่าเหลือเงินต้น ${baht(x.maturity)} บาท ณ งวดสุดท้าย`
  );

  reasons.push(`PAI ${x.pai.toFixed(2)} (สัดส่วนภาระหนี้ต่อ Available Cash)`);

  reasons.push(
    x.dataConfidence === "HIGH"
      ? "Data Confidence = HIGH: Verified Revenue และ GPS Completeness ครบถ้วน"
      : x.dataConfidence === "MEDIUM"
        ? "Data Confidence = MEDIUM: ควรสะสมข้อมูลรายได้/GPS เพิ่มก่อนยื่น FI"
        : "Data Confidence = LOW: ข้อมูลยังไม่พอต่อการจัด Route OWN READY"
  );

  reasons.push(
    `Stress Diagnostic — DSCR −15% = ${x.dscr15.toFixed(2)}x, −30% = ${x.dscr30.toFixed(2)}x ` +
      "(ใช้ Calibration ยังไม่ใช่ Hard Decline จนกว่าจะผ่าน Real Data Replay)"
  );

  if (x.downtimeDays > 0) {
    reasons.push(
      `Downtime ${x.downtimeDays} วัน/เดือน ใช้เป็นข้อมูลความเสถียร ยังไม่ใช่ Hard Threshold`
    );
  }

  reasons.push(
    x.energyIncluded
      ? "BaaS รวมค่าไฟแล้ว (Energy Included) ระบบจึงไม่หัก Energy ซ้ำ"
      : "BaaS ไม่รวมค่าไฟ (Energy Excluded) ระบบหักค่าพลังงานตาม kWh/km และค่าไฟที่กรอก"
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
    x.route === "OWN READY"
      ? "สามารถจัดทำ Readiness Certificate และส่งต่อ FI ได้ โดยต้องยืนยันเอกสารและเงื่อนไข FI จริง"
      : x.route === "BUILD READINESS"
        ? "ยังไม่ควรเร่งสร้างหนี้ ควรเก็บข้อมูลเพิ่ม ลดภาระ/ราคาสินทรัพย์ หรือเพิ่มเงินดาวน์"
        : "ไม่ควรใช้ Guarantee Coverage เพื่อฝืน Affordability ควรคงเส้นทางเช่า/ไม่สร้างหนี้ใหม่และทบทวนภายหลัง"
  );

  return reasons;
}
