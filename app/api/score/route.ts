import { NextResponse } from "next/server";
import { evaluate, type ScoreInput } from "../../lib/route2own";

/**
 * POST /api/score — Route2Own Credit Readiness v1.4
 * Competition Working Scenario (800K / BaaS 400)
 *
 * ตรรกะการคำนวณอยู่ใน public/route2own-engine.js ซึ่งเป็นไฟล์เดียวกับที่หน้าบ้าน
 * (public/route2own.html) โหลดไปใช้ จึงรับประกันว่าให้ผลตรงกันเสมอ
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
    scenario: "Route2Own Competition Working Scenario v1.4 (800K / BaaS 400)",
    disclaimer:
      "ผลลัพธ์นี้เป็นการประเมินความพร้อมเบื้องต้น ไม่ใช่การอนุมัติสินเชื่อ ไม่ใช่ Pre-approved Loan " +
      "และไม่ผูกพันสถาบันการเงิน — FI เป็นผู้อนุมัติวงเงิน ดอกเบี้ย Tenor และเงื่อนไขสินเชื่อขั้นสุดท้าย",
    input,
    calc,
    readiness,
    reasons
  });
}
