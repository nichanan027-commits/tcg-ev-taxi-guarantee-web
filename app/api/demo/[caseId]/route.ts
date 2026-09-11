import { NextResponse } from "next/server";

import { getDemoCase } from "../../../lib/demo/cases.ts";
import { evaluateApplication } from "../../../lib/evaluation/evaluate-application.ts";
import { createApplication, updateApplication } from "../../../lib/registration/application-service.ts";
import { recordCompetitionConsent } from "../../../lib/registration/consent-service.ts";

type Context = { params: Promise<{ caseId: string }> };

/**
 * POST /api/demo/{A|B|C|D} — สร้างใบสมัครสาธิตที่ให้ผลคงที่
 *
 * ใช้เส้นทางเดียวกับผู้สมัครจริงทุกขั้น: สร้างใบสมัคร → ยินยอม → บันทึกข้อมูล → ประเมิน
 * ไม่มีการเขียนผลลัพธ์ลงไปตรง ๆ ผลที่ได้จึงมาจาก Frozen Engine เหมือนกรณีจริง
 */
export async function POST(request: Request, context: Context) {
  const { caseId } = await context.params;
  const demo = getDemoCase(caseId.toUpperCase());
  if (!demo) return NextResponse.json({ error: "ไม่พบชุดข้อมูลสาธิต" }, { status: 404 });

  try {
    const application = await createApplication();
    await recordCompetitionConsent(application.id);
    await updateApplication(application.id, demo.input);
    const snapshot = await evaluateApplication(application.id);

    const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
    if (wantsJson) {
      return NextResponse.json(
        { applicationId: application.id, demoCase: demo.id, route: snapshot.route, snapshotId: snapshot.id },
        { status: 201 }
      );
    }
    return NextResponse.redirect(new URL(`/apply/${application.id}`, request.url), 303);
  } catch (error) {
    console.error("demo seed failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "สร้างชุดข้อมูลสาธิตไม่สำเร็จ" }, { status: 503 });
  }
}
