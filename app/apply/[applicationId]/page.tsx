import Link from "next/link";

import { GOVERNANCE_COPY } from "../../lib/config/competition.ts";
import { getLatestEvaluationSnapshot } from "../../lib/evaluation/evaluate-application.ts";
import { getApplication } from "../../lib/registration/application-service.ts";
import { readinessReportModel } from "../../lib/result/report-model.ts";
import { resultViewModel } from "../../lib/result/view-model.ts";
import { RouteResult } from "../../../components/frontoffice/RouteResult.tsx";
import { ReadinessReport } from "../../../components/frontoffice/pdf/ReadinessReport.tsx";
import { PdfDownloadButton } from "../../../components/frontoffice/pdf/PdfDownloadButton.tsx";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ applicationId: string }> };

/**
 * หน้าเส้นทางใบสมัคร
 *
 * ถ้ามีผลการประเมินแล้วจะแสดงผล Credit Readiness จาก Evaluation Snapshot ล่าสุด
 * ทั้งหน้าจอและ PDF อ่านจาก Snapshot เดียวกัน ไม่มีการคำนวณซ้ำที่ชั้นแสดงผล
 */
export default async function ApplyPage({ params }: Props) {
  const { applicationId } = await params;
  const application = await getApplication(applicationId);

  if (!application) {
    return (
      <main className="fo-shell">
        <h1 className="fo-title">ไม่พบใบสมัคร</h1>
        <p className="fo-lede">เลขที่ใบสมัคร {applicationId} ไม่อยู่ในระบบการแข่งขันนี้</p>
        <p>
          <Link href="/">กลับไปหน้าเริ่มต้น</Link>
        </p>
      </main>
    );
  }

  const snapshot = await getLatestEvaluationSnapshot(applicationId);

  if (!snapshot) {
    return (
      <main className="fo-shell">
        <p className="fo-eyebrow">Route to Own by บสย.</p>
        <h1 className="fo-title">ใบสมัคร {application.id}</h1>
        <p className="fo-governance">{GOVERNANCE_COPY.competitionRegistration}</p>
        <section className="fo-section">
          <h2 className="fo-h2">สถานะปัจจุบัน: {application.status}</h2>
          <p>ยังไม่มีผลการประเมิน กรอกข้อมูลอาชีพ รายได้ และค่าใช้จ่ายให้ครบก่อนจึงจะประเมินได้</p>
          <p className="fo-muted">{GOVERNANCE_COPY.phoneVerification}</p>
        </section>
      </main>
    );
  }

  const vm = resultViewModel(snapshot);
  const report = readinessReportModel(snapshot);

  return (
    <main className="fo-shell">
      <p className="fo-eyebrow">Route to Own by บสย. · {application.id}</p>
      <p className="fo-governance">{GOVERNANCE_COPY.competitionRegistration}</p>

      <RouteResult vm={vm} />

      <section className="fo-section">
        <h3 className="fo-h3">รายงานความพร้อม</h3>
        <p className="fo-muted">
          เอกสารนี้สร้างจากผลการประเมินชุดเดียวกับหน้าจอ (Snapshot {vm.snapshotId}) ไม่ได้คำนวณใหม่
        </p>
        <PdfDownloadButton fileName={report.fileName} />
      </section>

      {/* เนื้อหารายงานถูกเรนเดอร์ไว้นอกสายตา เพื่อให้ปุ่มดาวน์โหลดแปลงเป็น PDF ได้ */}
      <div className="fo-report-host" aria-hidden="true">
        <ReadinessReport model={report} />
      </div>
    </main>
  );
}
