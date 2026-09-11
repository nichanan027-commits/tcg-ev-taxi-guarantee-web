import { NextResponse } from "next/server";

import { getApplication, updateApplication } from "../../../lib/registration/application-service.ts";
import { listConsents } from "../../../lib/registration/consent-service.ts";

type Context = { params: Promise<{ applicationId: string }> };

export async function GET(_request: Request, context: Context) {
  const { applicationId } = await context.params;
  const application = await getApplication(applicationId);
  if (!application) {
    return NextResponse.json({ error: "ไม่พบใบสมัคร" }, { status: 404 });
  }

  const consents = await listConsents(applicationId);
  return NextResponse.json({
    application,
    consents,
    notice: "Competition Registration — ไม่ใช่การยื่นขอสินเชื่อจริง"
  });
}

/**
 * PUT — บันทึกข้อมูลใบสมัคร
 *
 * รับเฉพาะ payload ที่ประกาศไว้ใน RegistrationInputSchema
 * ค่าอ่อนไหวจากหน้า Secure Verification ไม่มีเส้นทางเข้ามาที่นี่
 */
export async function PUT(request: Request, context: Context) {
  const { applicationId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const application = await updateApplication(applicationId, body);
    return NextResponse.json({ application });
  } catch (error) {
    const message = error instanceof Error ? error.message : "บันทึกไม่สำเร็จ";
    if (message.includes("ไม่พบใบสมัคร")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: "ข้อมูลไม่ผ่านการตรวจสอบ", detail: message }, { status: 422 });
  }
}
