import { NextResponse } from "next/server";

type ScoreInput = {
  isMember: boolean;
  hasCertificate: boolean;
  consent: boolean;
  dailyIncome: number;
  drivingDays: number;
  energyCost: number;
  fixedCost: number;
  monthlyInstallment: number;
  guaranteeAmount: number;
  tcgScore: number;
  stressDropPercent: number;
  chargingReady: "ready" | "pending" | "not_ready";
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ScoreInput>;

  const input: ScoreInput = {
    isMember: Boolean(body.isMember),
    hasCertificate: Boolean(body.hasCertificate),
    consent: Boolean(body.consent),
    dailyIncome: toNumber(body.dailyIncome),
    drivingDays: toNumber(body.drivingDays),
    energyCost: toNumber(body.energyCost),
    fixedCost: toNumber(body.fixedCost),
    monthlyInstallment: toNumber(body.monthlyInstallment),
    guaranteeAmount: toNumber(body.guaranteeAmount),
    tcgScore: toNumber(body.tcgScore),
    stressDropPercent: toNumber(body.stressDropPercent),
    chargingReady: body.chargingReady ?? "pending"
  };

  const monthlyGrossIncome = input.dailyIncome * input.drivingDays;
  const monthlyEnergyCost = input.energyCost * input.drivingDays;
  const netIncome = monthlyGrossIncome - monthlyEnergyCost - input.fixedCost;

  const dscr = input.monthlyInstallment > 0 ? netIncome / input.monthlyInstallment : 0;
  const stressNetIncome = netIncome * (1 - input.stressDropPercent / 100);
  const stressDscr = input.monthlyInstallment > 0 ? stressNetIncome / input.monthlyInstallment : 0;

  let tier: "A" | "B" | "C" | "REJECT" = "REJECT";
  let annualFeeRate = 0;

  if (input.tcgScore >= 80 && dscr >= 1.3) {
    tier = "A";
    annualFeeRate = 0.012;
  } else if (input.tcgScore >= 65 && dscr >= 1.2) {
    tier = "B";
    annualFeeRate = 0.015;
  } else if (input.tcgScore >= 50 && dscr >= 1.2) {
    tier = "C";
    annualFeeRate = 0.018;
  }

  const reasons: string[] = [];
  let decision: "APPROVE_FOR_PILOT" | "WATCHLIST" | "REJECT" = "APPROVE_FOR_PILOT";

  if (!input.consent) {
    decision = "REJECT";
    tier = "REJECT";
    annualFeeRate = 0;
    reasons.push("ไม่สามารถประเมินต่อได้ เพราะยังไม่ยินยอมให้ใช้ข้อมูล");
  } else {
    reasons.push("มีความยินยอมใช้ข้อมูลเพื่อประเมิน");
  }

  if (!input.isMember) {
    decision = "REJECT";
    tier = "REJECT";
    annualFeeRate = 0;
    reasons.push("ไม่ผ่าน: ต้องเป็นสมาชิกสหกรณ์");
  } else {
    reasons.push("ผ่านเงื่อนไขสมาชิกสหกรณ์");
  }

  if (!input.hasCertificate) {
    if (decision !== "REJECT") decision = "WATCHLIST";
    reasons.push("ต้องออกหรือยืนยัน Pre-Scored e-Certificate");
  } else {
    reasons.push("มี Pre-Scored e-Certificate");
  }

  if (input.drivingDays < 22) {
    decision = "REJECT";
    tier = "REJECT";
    annualFeeRate = 0;
    reasons.push("ไม่ผ่าน: จำนวนวันที่ขับจริงต่ำกว่า 22 วันต่อเดือน");
  } else {
    reasons.push("จำนวนวันที่ขับจริงผ่านเกณฑ์ขั้นต่ำ");
  }

  if (dscr < 1.2) {
    decision = "REJECT";
    tier = "REJECT";
    annualFeeRate = 0;
    reasons.push("ไม่ผ่าน: DSCR ต่ำกว่า 1.20 เท่า");
  } else {
    reasons.push("DSCR ผ่านเกณฑ์ขั้นต่ำ 1.20 เท่า");
  }

  if (stressDscr < 1.0) {
    decision = "REJECT";
    tier = "REJECT";
    annualFeeRate = 0;
    reasons.push("ไม่ผ่าน Stress Test: รายได้ลดลงแล้วมีความเสี่ยงผิดนัด");
  } else if (stressDscr < 1.2 && decision !== "REJECT") {
    decision = "WATCHLIST";
    reasons.push("ผ่าน Stress Test แบบต้องติดตาม เพราะ Buffer ยังไม่สูง");
  } else {
    reasons.push("Stress Test อยู่ในระดับแข็งแรง");
  }

  if (input.chargingReady === "not_ready") {
    if (decision !== "REJECT") decision = "WATCHLIST";
    reasons.push("ต้องตรวจสอบ Charging Readiness ก่อนเข้าสู่ขั้นอนุมัติจริง");
  } else if (input.chargingReady === "pending") {
    if (decision !== "REJECT") decision = "WATCHLIST";
    reasons.push("Charging Readiness อยู่ระหว่างตรวจสอบ");
  } else {
    reasons.push("Charging Readiness พร้อม");
  }

  const dailyFee = annualFeeRate > 0 ? (input.guaranteeAmount * annualFeeRate) / 365 : 0;
  const readinessScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(input.tcgScore * 0.48 + Math.min(dscr / 1.5, 1) * 34 + Math.min(stressDscr / 1.2, 1) * 18)
    )
  );

  return NextResponse.json({
    input,
    decision,
    tier,
    annualFeeRate,
    dailyFee,
    monthlyGrossIncome,
    netIncome,
    dscr,
    stressDscr,
    readinessScore,
    reasons
  });
}
