import { NextResponse } from "next/server";

import { GOVERNANCE_COPY } from "../../../../lib/config/competition.ts";
import { getLatestEvaluationSnapshot } from "../../../../lib/evaluation/evaluate-application.ts";
import { listFiSelections, setFiSelections } from "../../../../lib/fi/fi-repository.ts";
import { matchFi } from "../../../../lib/fi/match.ts";

type Context = { params: Promise<{ applicationId: string }> };

/** GET — รายชื่อสถาบันการเงินที่สอดคล้อง พร้อมสถานะการเลือกปัจจุบัน */
export async function GET(_request: Request, context: Context) {
  const { applicationId } = await context.params;
  const snapshot = await getLatestEvaluationSnapshot(applicationId);
  if (!snapshot) return NextResponse.json({ error: "ยังไม่มีผลการประเมิน" }, { status: 404 });

  return NextResponse.json({
    heading: GOVERNANCE_COPY.fiMatchHeading,
    maxSelections: GOVERNANCE_COPY.fiMaxSelections,
    options: matchFi(snapshot),
    selections: await listFiSelections(applicationId, { activeOnly: true }),
    notice: GOVERNANCE_COPY.checkWithFi
  });
}

/**
 * PUT — บันทึกการเลือกสถาบันการเงิน (สูงสุด 2 แห่ง)
 *
 * ด่านตรวจอยู่ฝั่งเซิร์ฟเวอร์เสมอ ฝั่งหน้าจอปิดปุ่มเป็นเพียงชั้นเสริม
 * ทุกแห่งที่เลือกจะถูกประเมินภายใต้เงื่อนไขของตัวเอง และอาจได้ Snapshot ใหม่
 */
export async function PUT(request: Request, context: Context) {
  const { applicationId } = await context.params;

  let fiIds: unknown;
  try {
    const body = (await request.json()) as { fiIds?: unknown };
    fiIds = body?.fiIds;
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  if (!Array.isArray(fiIds) || fiIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "fiIds ต้องเป็นรายการรหัสสถาบันการเงิน" }, { status: 400 });
  }

  try {
    const { selections, outcomes } = await setFiSelections(applicationId, fiIds as string[]);
    return NextResponse.json({
      selections,
      // แจ้งกลับว่าแห่งใดต้องประเมินใหม่ เพราะเงื่อนไขต่างจากที่ประเมินไว้
      reevaluation: outcomes.map((outcome) => ({
        fiId: outcome.fiId,
        materialChange: outcome.materialChange,
        changedFields: outcome.changedFields,
        evaluationSnapshotId: outcome.snapshot.id,
        route: outcome.snapshot.route
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "บันทึกการเลือกไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
