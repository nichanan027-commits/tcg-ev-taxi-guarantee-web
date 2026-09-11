import { NextResponse } from "next/server";

import {
  FI_CONSENT_NOT_READY_REASON,
  FI_CONSENT_VERSION,
  listFiConsents,
  recordFiConsent
} from "../../../../lib/fi/fi-repository.ts";

type Context = { params: Promise<{ applicationId: string }> };

export async function GET(_request: Request, context: Context) {
  const { applicationId } = await context.params;
  return NextResponse.json({
    consents: await listFiConsents(applicationId),
    currentVersion: FI_CONSENT_VERSION,
    note: "ความยินยอมของการแข่งขันไม่ใช่ความยินยอมสำหรับสถาบันการเงิน ต้องให้แยกรายแห่ง"
  });
}

/** POST — ให้ความยินยอมสำหรับสถาบันการเงินหนึ่งแห่ง (append-only) */
export async function POST(request: Request, context: Context) {
  const { applicationId } = await context.params;

  let fiId: unknown;
  try {
    const body = (await request.json()) as { fiId?: unknown };
    fiId = body?.fiId;
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  if (typeof fiId !== "string" || !fiId) {
    return NextResponse.json({ error: "ต้องระบุ fiId" }, { status: 400 });
  }

  try {
    return NextResponse.json({ consent: await recordFiConsent(applicationId, fiId) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "บันทึกความยินยอมไม่สำเร็จ";
    // สถานะที่ยังไม่พร้อมส่งต่อเป็นเรื่องของสถานะปัจจุบัน ไม่ใช่ข้อมูลที่ส่งมาผิดรูปแบบ
    const notReady = message === FI_CONSENT_NOT_READY_REASON || message.startsWith("ยังไม่มีผลการประเมิน");
    return NextResponse.json({ error: message }, { status: notReady ? 409 : 422 });
  }
}
