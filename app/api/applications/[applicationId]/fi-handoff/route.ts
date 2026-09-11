import { NextResponse } from "next/server";

import { getSnapshotById } from "../../../../lib/evaluation/snapshot.ts";
import { getFiProduct } from "../../../../lib/fi/catalogue.ts";
import { FI_CONSENT_VERSION, fiHandoffStatuses, listFiConsents, listFiSelections } from "../../../../lib/fi/fi-repository.ts";
import { buildHandoffPackage } from "../../../../lib/fi/handoff.ts";

type Context = { params: Promise<{ applicationId: string }> };

/** GET — สถานะการส่งต่อของ FI แต่ละแห่ง ตัดสินแยกกันจาก Snapshot ของตัวเอง */
export async function GET(_request: Request, context: Context) {
  const { applicationId } = await context.params;
  return NextResponse.json(await fiHandoffStatuses(applicationId));
}

/**
 * POST — เตรียมชุดข้อมูลส่งต่อสำหรับ FI หนึ่งแห่ง
 *
 * อนุญาตเฉพาะเมื่อผลประเมินล่าสุดของ FI แห่งนั้นเป็น READY FOR FI และมีความยินยอมแล้ว
 * Snapshot READY ของแห่งอื่นหรือของเงื่อนไขเดิม ใช้อนุมัติแทนกันไม่ได้
 * นี่คือจุดสิ้นสุดของระบบนี้ การพิจารณาสินเชื่ออยู่กับสถาบันการเงิน
 */
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

  const fi = getFiProduct(fiId);
  if (!fi) return NextResponse.json({ error: "ไม่พบสถาบันการเงิน" }, { status: 404 });

  const selection = (await listFiSelections(applicationId, { activeOnly: true })).find((s) => s.fiId === fiId);
  if (!selection || !selection.evaluationSnapshotId || !selection.financingScenario) {
    return NextResponse.json({ error: `ยังไม่ได้เลือก ${fi.fiName}` }, { status: 409 });
  }

  const snapshot = await getSnapshotById(selection.evaluationSnapshotId);
  if (!snapshot) return NextResponse.json({ error: "ไม่พบผลการประเมินของสถาบันการเงินแห่งนี้" }, { status: 409 });

  const consent = (await listFiConsents(applicationId)).find((c) => c.fiId === fiId && c.accepted);

  try {
    const handoffPackage = buildHandoffPackage({
      applicationId,
      fi,
      snapshot,
      financingScenario: selection.financingScenario,
      consent: {
        version: consent?.version ?? FI_CONSENT_VERSION,
        acceptedAt: consent?.acceptedAt ?? "",
        accepted: Boolean(consent)
      }
    });
    return NextResponse.json({ handoffPackage }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เตรียมชุดข้อมูลส่งต่อไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
