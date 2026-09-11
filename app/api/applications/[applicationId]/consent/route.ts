import { NextResponse } from "next/server";

import { competitionConfig } from "../../../../lib/config/competition.ts";
import { listConsents, recordCompetitionConsent } from "../../../../lib/registration/consent-service.ts";

type Context = { params: Promise<{ applicationId: string }> };

export async function GET(_request: Request, context: Context) {
  const { applicationId } = await context.params;
  const consents = await listConsents(applicationId);
  return NextResponse.json({ consents, currentVersion: competitionConfig.consentVersion });
}

/**
 * POST — บันทึกความยินยอมของโหมดการแข่งขัน
 *
 * ทุกครั้งเป็นแถวใหม่ที่มีเวอร์ชันและเวลา ไม่เขียนทับของเดิม
 * โหมดการแข่งขันไม่ใช้ OTP
 */
export async function POST(request: Request, context: Context) {
  const { applicationId } = await context.params;

  let accepted = true;
  try {
    const body = (await request.json()) as { accepted?: unknown };
    if (body && typeof body.accepted === "boolean") accepted = body.accepted;
  } catch {
    // ฟอร์มธรรมดาไม่มี body — ถือว่ากดยินยอม
  }

  if (!accepted) {
    return NextResponse.json({ error: "ต้องให้ความยินยอมก่อนจึงจะดำเนินการต่อได้" }, { status: 400 });
  }

  try {
    const consent = await recordCompetitionConsent(applicationId);
    return NextResponse.json({ consent }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "บันทึกความยินยอมไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: message.includes("ไม่พบใบสมัคร") ? 404 : 500 });
  }
}
