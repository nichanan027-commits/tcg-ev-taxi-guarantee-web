import { NextResponse } from "next/server";

import { createApplication } from "../../lib/registration/application-service.ts";

/**
 * POST /api/applications — สร้างใบสมัครแข่งขันจริงพร้อมเลขที่ใบสมัคร
 *
 * รองรับสองแบบ:
 *  - ส่ง Accept: application/json → คืน 201 พร้อม JSON
 *  - ส่งจากฟอร์มธรรมดา → redirect ไปหน้าเส้นทางใบสมัคร
 *
 * นี่คือการลงทะเบียนแข่งขัน ไม่ใช่การยื่นขอสินเชื่อจริง
 */
export async function POST(request: Request) {
  let application;
  try {
    application = await createApplication();
  } catch (error) {
    console.error("createApplication failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "ยังไม่ได้บันทึกใบสมัคร" }, { status: 503 });
  }

  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
  if (wantsJson) {
    return NextResponse.json(
      {
        applicationId: application.id,
        status: application.status,
        createdAt: application.createdAt,
        mode: "COMPETITION",
        notice: "Competition Registration — ไม่ใช่การยื่นขอสินเชื่อจริง"
      },
      { status: 201 }
    );
  }

  return NextResponse.redirect(new URL(`/apply/${application.id}`, request.url), 303);
}
