import { NextResponse } from "next/server";
import {
  evaluate,
  PRODUCT_NAME,
  PRODUCT_STATUS,
  RBP_DAY_COUNT_BASIS,
  RBP_RATE,
  RBP_STATUS,
  RESERVE_CONTRIBUTION_RATE,
  RESERVE_TARGET_DAYS,
  ROUTES,
  SIMULATION_LABEL,
  type ScoreInput
} from "../../lib/route2own";

/**
 * POST /api/score — Route to Own Front Office Credit Readiness
 * FINAL / FROZEN FOR COMPETITION
 *
 * ตรรกะการคำนวณอยู่ใน public/route2own-engine.js ซึ่งเป็นไฟล์เดียวกับที่หน้าบ้าน
 * (public/route2own.html) โหลดไปใช้ จึงรับประกันว่าให้ผลตรงกันเสมอ
 *
 * ขอบเขต: ประเมินความพร้อมก่อนอนุมัติและส่งต่อ FI เท่านั้น
 * PAYD และ Adaptive Payment Reserve ที่คืนกลับมาเป็นค่า Preview
 * การหักเงินจริงเกิดในระบบหลังอนุมัติซึ่งอยู่คนละ repository
 */
export async function POST(request: Request) {
  let body: Partial<ScoreInput> = {};
  try {
    body = (await request.json()) as Partial<ScoreInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { input, calc, readiness, reasons } = evaluate(body);

  return NextResponse.json({
    product: PRODUCT_NAME,
    status: PRODUCT_STATUS,
    simulationLabel: SIMULATION_LABEL,
    routes: Object.values(ROUTES),
    baseProduct: {
      borrowerDownPaymentPct: 0,
      note: "เงินดาวน์ผู้ขับ 0% เป็นแบบผลิตภัณฑ์หลัก ไม่ใช่การอนุมัติสินเชื่ออัตโนมัติ"
    },
    rbpPolicy: {
      rates: RBP_RATE,
      dayCountBasis: RBP_DAY_COUNT_BASIS,
      base: "Eligible Guaranteed Amount",
      status: RBP_STATUS
    },
    paymentPreview: {
      scope: "PREVIEW_ONLY",
      reserveContributionRate: RESERVE_CONTRIBUTION_RATE,
      reserveTargetDays: RESERVE_TARGET_DAYS,
      note: "Actual Sweep เกิดหลัง FI อนุมัติในระบบหลังอนุมัติเท่านั้น ระบบนี้ไม่ถือเงินของผู้ขับ"
    },
    authorityBoundary: {
      tcg: "Eligibility / Readiness / Guarantee Eligibility",
      fi: "Final Credit Decision / Contract / Debt Ledger"
    },
    disclaimer:
      "ผลลัพธ์นี้เป็นการประเมินความพร้อมเบื้องต้น ไม่ใช่การอนุมัติสินเชื่อ และไม่ผูกพันสถาบันการเงิน",
    input,
    calc,
    readiness,
    reasons
  });
}
