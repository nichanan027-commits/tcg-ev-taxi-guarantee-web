import Link from "next/link";

import { GOVERNANCE_COPY, canRequestFaAdvisory } from "../../../lib/config/competition.ts";
import {
  FA_ADVISORY_COPY,
  FA_ADVISORY_NAME,
  FA_ADVISORY_NAME_EN,
  faProgressFor,
  listFaCases
} from "../../../lib/fa/advisory-service.ts";
import { referenceSnapshotFor } from "../../../lib/fi/fi-repository.ts";
import { getApplication } from "../../../lib/registration/application-service.ts";
import { resultViewModel } from "../../../lib/result/view-model.ts";
import { FaAdvisoryForm } from "../../../../components/frontoffice/FaAdvisoryForm.tsx";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ applicationId: string }> };

const baht = (value: number) => `฿${Math.round(value).toLocaleString("th-TH")}`;

/**
 * F.A Readiness Advisory
 *
 * เปิดให้เฉพาะเส้นทางที่การเพิ่มหนี้ตอนนี้ยังไม่ใช่คำตอบ
 * หน้านี้จึงไม่พูดเรื่องการอนุมัติ แต่พูดเรื่องสิ่งที่ทำได้ก่อน
 */
export default async function AdvisoryPage({ params }: Props) {
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

  const snapshot = await referenceSnapshotFor(applicationId);
  if (!snapshot) {
    return (
      <main className="fo-shell">
        <h1 className="fo-title">ยังไม่มีผลการประเมิน</h1>
        <p>
          <Link href={`/apply/${applicationId}`}>กลับไปกรอกข้อมูลใบสมัคร</Link>
        </p>
      </main>
    );
  }

  const vm = resultViewModel(snapshot);
  const cases = await listFaCases(applicationId);
  const active = cases.find((row) => row.status !== "CLOSED") ?? null;
  const progress = active ? await faProgressFor(active.id) : null;
  const eligible = canRequestFaAdvisory(snapshot.route);

  return (
    <main className="fo-shell">
      <p className="fo-eyebrow">Route to Own by บสย. · {applicationId}</p>
      <h1 className="fo-title">{FA_ADVISORY_NAME}</h1>
      <p className="fo-lede">{FA_ADVISORY_NAME_EN}</p>
      <p className="fo-governance" data-role="advisory-explanation">
        {FA_ADVISORY_COPY.explanation}
      </p>

      <section className="fo-section" aria-labelledby="why-heading">
        <h2 id="why-heading" className="fo-h2">
          ทำไมถึงแนะนำเส้นทางนี้ให้คุณ
        </h2>
        <p className="fo-thesis" data-role="advisory-route">
          ผลประเมินล่าสุดของคุณคือ {vm.hero.title}
        </p>
        <p>{vm.hero.support}</p>

        <dl className="fo-status-grid">
          <div>
            <dt>เงินที่พร้อมรองรับภาระ</dt>
            <dd data-role="advisory-available-cash">{baht(snapshot.availableCash)} / วัน</dd>
          </div>
          <div>
            <dt>ภาระรถโดยประมาณ</dt>
            <dd data-role="advisory-obligation">{baht(snapshot.estimatedObligation)} / วัน</dd>
          </div>
          <div>
            <dt>{snapshot.affordabilityGap > 0 ? "ส่วนที่ยังขาดต่อวัน" : "เหลือหลังรับภาระต่อวัน"}</dt>
            <dd data-role="advisory-gap">
              {baht(snapshot.affordabilityGap > 0 ? snapshot.affordabilityGap : Math.max(0, snapshot.residual))}
            </dd>
          </div>
          <div>
            <dt>ความน่าเชื่อถือของหลักฐานรายได้</dt>
            <dd data-role="advisory-evidence">{snapshot.incomeEvidenceReliability}</dd>
          </div>
        </dl>

        {vm.blockingReasons.length > 0 || vm.watchReasons.length > 0 ? (
          <>
            <h3 className="fo-h3">หัวข้อที่จะคุยกันก่อน</h3>
            <ul className="fo-reasons">
              {vm.blockingReasons.map((reason) => (
                <li key={reason.code} className="blocker" data-role="advisory-topic">
                  {reason.message}
                </li>
              ))}
              {vm.watchReasons.map((reason) => (
                <li key={reason.code} className="watch" data-role="advisory-topic">
                  {reason.message}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section className="fo-section" aria-labelledby="request-heading">
        <h2 id="request-heading" className="fo-h2">
          นัดหมายเพื่อรับคำปรึกษา
        </h2>

        <p className="fo-muted">{FA_ADVISORY_COPY.scope}</p>

        {!eligible ? (
          <p className="fo-protected-note" data-role="advisory-not-eligible">
            เส้นทางปัจจุบันของคุณคือ {snapshot.route} ซึ่งยังไม่เข้าเงื่อนไขของบริการนี้
            เส้นทางนี้มีขั้นตอนถัดไปเป็นการดูรายงานความพร้อมและเปรียบเทียบสถาบันการเงิน
          </p>
        ) : (
          <FaAdvisoryForm
            applicationId={applicationId}
            snapshotId={snapshot.id}
            existingCaseId={active ? active.id : null}
          />
        )}
      </section>

      {progress && progress.reassessed ? (
        <section className="fo-section" aria-labelledby="progress-heading" data-role="advisory-progress">
          <h2 id="progress-heading" className="fo-h2">
            ความคืบหน้าเทียบกับตอนเปิดคำขอ
          </h2>
          <table className="fo-compare">
            <thead>
              <tr>
                <th scope="col">รายการ</th>
                <th scope="col">ตอนเปิดคำขอ</th>
                <th scope="col">ล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              <tr data-role="comparison-row">
                <th scope="row">เส้นทาง</th>
                <td data-label="ตอนเปิดคำขอ">{progress.baseline.route}</td>
                <td data-label="ล่าสุด">{progress.latest.route}</td>
              </tr>
              <tr data-role="comparison-row">
                <th scope="row">เงินที่พร้อมรองรับภาระ</th>
                <td data-label="ตอนเปิดคำขอ">{baht(progress.baseline.availableCash)}</td>
                <td data-label="ล่าสุด">{baht(progress.latest.availableCash)}</td>
              </tr>
              <tr data-role="comparison-row">
                <th scope="row">ส่วนที่ยังขาดต่อวัน</th>
                <td data-label="ตอนเปิดคำขอ">{baht(progress.baseline.affordabilityGap)}</td>
                <td data-label="ล่าสุด">{baht(progress.latest.affordabilityGap)}</td>
              </tr>
            </tbody>
          </table>
          <p className="fo-muted">{progress.note}</p>
        </section>
      ) : null}

      <footer className="fo-disclaimers">
        <p data-role="advisory-not-approval">{FA_ADVISORY_COPY.notApproval}</p>
        <p>{GOVERNANCE_COPY.preScoreNotApproval}</p>
        <p>{GOVERNANCE_COPY.fiOwnsDecision}</p>
        <p className="fo-muted">ผลที่ใช้ประกอบคำปรึกษา Snapshot {snapshot.id}</p>
        <p>
          <Link href={`/apply/${applicationId}`}>กลับไปหน้าผลความพร้อม</Link>
        </p>
      </footer>
    </main>
  );
}
