import Link from "next/link";

import { GOVERNANCE_COPY, applicantRouteCopy } from "../../../lib/config/competition.ts";
import { referenceSnapshotFor } from "../../../lib/fi/fi-repository.ts";
import { fiJourneyViewModel } from "../../../lib/fi/journey-view-model.ts";
import { getApplication } from "../../../lib/registration/application-service.ts";
import { FiComparison } from "../../../../components/frontoffice/FiComparison.tsx";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ applicationId: string }> };

/**
 * เปรียบเทียบสถาบันการเงิน
 *
 * รายการนี้อธิบายความสอดคล้อง ไม่จัดอันดับโอกาสอนุมัติ
 * ตัวเลขทุกตัวอ่านจากผลอ้างอิงที่ประเมินไว้แล้ว ไม่มีการคำนวณผลิตภัณฑ์ใหม่ที่ชั้นแสดงผล
 */
export default async function FiPage({ params }: Props) {
  const { applicationId } = await params;
  const application = await getApplication(applicationId);
  if (!application) {
    return (
      <main className="fo-shell">
        <h1 className="fo-title">ไม่พบใบสมัคร</h1>
        <p>
          <Link href="/">กลับไปหน้าเริ่มต้น</Link>
        </p>
      </main>
    );
  }

  const reference = await referenceSnapshotFor(applicationId);
  if (!reference) {
    return (
      <main className="fo-shell">
        <h1 className="fo-title">ยังไม่มีผลการประเมิน</h1>
        <p>
          <Link href={`/apply/${applicationId}`}>กลับไปกรอกข้อมูลใบสมัคร</Link>
        </p>
      </main>
    );
  }

  const vm = await fiJourneyViewModel(applicationId, reference);

  return (
    <main className="fo-shell">
      <p className="fo-eyebrow">Route to Own by บสย. · {applicationId}</p>
      <h1 className="fo-title">{vm.heading}</h1>
      <p className="fo-lede">
        ผลอ้างอิงของคุณคือ <b data-role="reference-route">{applicantRouteCopy(vm.referenceRoute)}</b> —
        รายการด้านล่างเรียงตามลำดับในทะเบียน ไม่ได้เรียงตามโอกาสอนุมัติ
      </p>
      <p className="fo-governance">{vm.fiOwnsDecision}</p>

      {!vm.canSelect ? (
        <p className="fo-protected-note" data-role="fi-select-blocked">
          เส้นทางปัจจุบันยังไม่เปิดให้เลือกสถาบันการเงินเพื่อส่งต่อ ดูรายการนี้เพื่อเปรียบเทียบได้
          แต่การส่งต่อจะเปิดเมื่อผลประเมินเป็น READY FOR FI
        </p>
      ) : null}

      <FiComparison vm={vm} />

      <footer className="fo-disclaimers">
        <p>{GOVERNANCE_COPY.preScoreNotApproval}</p>
        <p>{GOVERNANCE_COPY.zeroDownNotGuarantee}</p>
        <p>{GOVERNANCE_COPY.illustrativeFinancingLong}</p>
        <p className="fo-muted">ผลอ้างอิง Snapshot {vm.referenceSnapshotId}</p>
        <p>
          <Link href={`/apply/${applicationId}`}>กลับไปหน้าผลความพร้อม</Link>
          {vm.selections.length > 0 ? (
            <>
              {" · "}
              <Link href={`/apply/${applicationId}/handoff`}>ดูสถานะการเตรียมส่งต่อ</Link>
            </>
          ) : null}
        </p>
      </footer>
    </main>
  );
}
