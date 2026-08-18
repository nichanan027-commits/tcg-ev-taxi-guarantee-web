import { NextResponse } from "next/server";
import { normalize, scoreRoute2Own, type ScoreInput } from "../../lib/route2own";

/**
 * POST /api/score — Route2Own Credit Readiness
 * Competition Working Scenario v1.3 (800K / BaaS 400)
 *
 * ตรรกะการคำนวณอยู่ใน app/lib/route2own.ts ซึ่งใช้ร่วมกับหน้า /legacy-score
 * เพื่อให้ API และหน้าบ้าน (public/route2own.html) ให้ผลตรงกัน
 */
export async function POST(request: Request) {
  let body: Partial<ScoreInput> = {};
  try {
    body = (await request.json()) as Partial<ScoreInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = normalize(body);
  const { calc, readiness, reasons } = scoreRoute2Own(input);

  return NextResponse.json({
    scenario: "Route2Own Competition Working Scenario v1.3 (800K / BaaS 400)",
    disclaimer:
      "ผลลัพธ์นี้เป็นการประเมินความพร้อมเบื้องต้น ไม่ใช่การอนุมัติสินเชื่อ ไม่ใช่ Pre-approved Loan " +
      "และไม่ผูกพันสถาบันการเงิน — FI เป็นผู้อนุมัติวงเงิน ดอกเบี้ย Tenor และเงื่อนไขสินเชื่อขั้นสุดท้าย",
    input,
    calc,
    readiness,
    reasons
  });
}
