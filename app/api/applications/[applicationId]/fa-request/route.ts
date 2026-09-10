import { NextResponse } from "next/server";

import { FA_CONTACT_CHANNEL_COPY, FA_CONTACT_TIME_COPY, GOVERNANCE_COPY } from "../../../../lib/config/competition.ts";
import {
  FA_ADVISORY_COPY,
  FA_ADVISORY_NAME,
  FA_ADVISORY_NAME_EN,
  FA_DUPLICATE_ACTIVE_REASON,
  FA_ROUTE_NOT_ELIGIBLE_REASON,
  listFaCases,
  requestFaAdvisory
} from "../../../../lib/fa/advisory-service.ts";
import { getApplication } from "../../../../lib/registration/application-service.ts";
import type { FaCase } from "../../../../lib/registration/types.ts";

type Context = { params: Promise<{ applicationId: string }> };

/**
 * ตอบกลับทีละสนามตามที่ประกาศไว้
 * ชื่อและเบอร์ของผู้สมัครไม่อยู่ในนี้ — เคสอ้างถึงใบสมัคร ไม่ได้พกข้อมูลส่วนตัวไปด้วย
 */
function toDto(faCase: FaCase) {
  return {
    caseId: faCase.id,
    applicationId: faCase.applicationId,
    evaluationSnapshotId: faCase.evaluationSnapshotId,
    status: faCase.status,
    route: faCase.route,
    tier: faCase.tier,
    preScore: faCase.preScore,
    affordabilityPassed: faCase.affordabilityPassed,
    availableCash: faCase.availableCash,
    estimatedObligation: faCase.estimatedObligation,
    residual: faCase.residual,
    affordabilityGap: faCase.affordabilityGap,
    evidenceReliability: faCase.evidenceReliability,
    primaryReason: faCase.primaryReason,
    reasonCodes: faCase.reasonCodes,
    preferredContactTime: faCase.preferredContactTime,
    preferredContactTimeCopy: FA_CONTACT_TIME_COPY[faCase.preferredContactTime],
    preferredChannel: faCase.preferredChannel,
    preferredChannelCopy: FA_CONTACT_CHANNEL_COPY[faCase.preferredChannel],
    createdAt: faCase.createdAt,
    updatedAt: faCase.updatedAt
  };
}

export async function GET(_request: Request, context: Context) {
  const { applicationId } = await context.params;
  if (!(await getApplication(applicationId))) {
    return NextResponse.json({ error: "ไม่พบใบสมัคร" }, { status: 404 });
  }

  const cases = await listFaCases(applicationId);
  return NextResponse.json({
    serviceName: FA_ADVISORY_NAME,
    serviceNameEn: FA_ADVISORY_NAME_EN,
    explanation: FA_ADVISORY_COPY.explanation,
    scope: FA_ADVISORY_COPY.scope,
    cases: cases.map(toDto)
  });
}

/** POST — เปิดคำขอคำปรึกษาเพื่อสร้างความพร้อมก่อนสินเชื่อ */
export async function POST(request: Request, context: Context) {
  const { applicationId } = await context.params;

  // ใบสมัครที่ไม่มีอยู่จริงคือทรัพยากรที่หาไม่พบ ไม่ใช่ข้อมูลที่ส่งมาผิด
  if (!(await getApplication(applicationId))) {
    return NextResponse.json({ error: "ไม่พบใบสมัคร" }, { status: 404 });
  }

  let body: { preferredContactTime?: unknown; preferredChannel?: unknown; evaluationSnapshotId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  if (typeof body.preferredContactTime !== "string" || typeof body.preferredChannel !== "string") {
    return NextResponse.json({ error: "ต้องระบุช่วงเวลาและช่องทางที่สะดวกให้ติดต่อกลับ" }, { status: 422 });
  }

  try {
    const faCase = await requestFaAdvisory({
      applicationId,
      preferredContactTime: body.preferredContactTime as never,
      preferredChannel: body.preferredChannel as never,
      evaluationSnapshotId: typeof body.evaluationSnapshotId === "string" ? body.evaluationSnapshotId : undefined
    });

    return NextResponse.json(
      {
        case: toDto(faCase),
        serviceName: FA_ADVISORY_NAME,
        explanation: FA_ADVISORY_COPY.explanation,
        disclaimers: [FA_ADVISORY_COPY.notApproval, GOVERNANCE_COPY.preScoreNotApproval]
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "เปิดคำขอคำปรึกษาไม่สำเร็จ";
    // สถานะที่ยังไม่เข้าเงื่อนไข หรือมีเคสค้างอยู่แล้ว เป็นเรื่องของสถานะ ไม่ใช่ข้อมูลผิดรูปแบบ
    const conflict = message === FA_DUPLICATE_ACTIVE_REASON || message === FA_ROUTE_NOT_ELIGIBLE_REASON;
    if (message.includes("ยังไม่มีผลการประเมิน")) return NextResponse.json({ error: message }, { status: 409 });
    return NextResponse.json({ error: message }, { status: conflict ? 409 : 422 });
  }
}
