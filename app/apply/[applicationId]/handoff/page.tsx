import Link from "next/link";

import { GOVERNANCE_COPY, applicantRouteCopy } from "../../../lib/config/competition.ts";
import { referenceSnapshotFor } from "../../../lib/fi/fi-repository.ts";
import { fiJourneyViewModel } from "../../../lib/fi/journey-view-model.ts";
import { getApplication } from "../../../lib/registration/application-service.ts";
import { FiHandoffPanel } from "../../../../components/frontoffice/FiHandoffPanel.tsx";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ applicationId: string }> };

/**
 * เตรียมส่งต่อสถาบันการเงิน
 *
 * หน้านี้แสดงผลอ้างอิงเทียบกับผลภายใต้เงื่อนไขของแต่ละแห่ง
 * เพื่อให้เห็นว่าเงื่อนไขที่ต่างกันทำให้ผลต่างกันได้จริง และแต่ละแห่งถูกตัดสินแยกกัน
 */
export default async function HandoffPage({ params }: Props) {
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
      <h1 className="fo-title">เตรียมส่งข้อมูลประกอบการพิจารณา</h1>
      <p className="fo-lede">
        ผลอ้างอิงของคุณคือ <b data-role="reference-route">{applicantRouteCopy(vm.referenceRoute)}</b> —
        แต่ละสถาบันการเงินใช้เงื่อนไขของตัวเอง ผลจึงอาจต่างจากผลอ้างอิง
      </p>
      <p className="fo-governance">{vm.fiOwnsDecision}</p>

      {vm.selections.length === 0 ? (
        <p className="fo-protected-note" data-role="no-selection">
          ยังไม่ได้เลือกสถาบันการเงิน{" "}
          <Link href={`/apply/${applicationId}/fi`}>ไปเลือกสถาบันการเงินที่สอดคล้อง</Link>
        </p>
      ) : (
        <FiHandoffPanel vm={vm} />
      )}

      <section className="fo-section" aria-labelledby="rights-heading">
        <h2 id="rights-heading" className="fo-h2">
          ขอบเขตการตัดสินใจ
        </h2>
        <dl className="fo-status-grid">
          <div>
            <dt>Route to Own by บสย.</dt>
            <dd>Basic Eligibility · Credit Readiness · Pre-Screen · Guarantee Readiness</dd>
          </div>
          <div>
            <dt>สถาบันการเงิน</dt>
            <dd>Underwriting · Final Credit Decision · Contractual Terms</dd>
          </div>
        </dl>
        <p className="fo-muted">ระบบนี้จบที่การเตรียมข้อมูลให้พร้อมพิจารณา ไม่ใช่การอนุมัติสินเชื่อ</p>
      </section>

      <footer className="fo-disclaimers">
        <p>{GOVERNANCE_COPY.preScoreNotApproval}</p>
        <p>{GOVERNANCE_COPY.readinessNotApproval}</p>
        <p>{GOVERNANCE_COPY.zeroDownNotGuarantee}</p>
        <p className="fo-muted">ผลอ้างอิง Snapshot {vm.referenceSnapshotId}</p>
        <p>
          <Link href={`/apply/${applicationId}/fi`}>กลับไปเปรียบเทียบสถาบันการเงิน</Link>
          {" · "}
          <Link href={`/apply/${applicationId}`}>หน้าผลความพร้อม</Link>
        </p>
      </footer>
    </main>
  );
}
