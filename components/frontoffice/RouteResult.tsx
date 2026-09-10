import Link from "next/link";

import { CapacityBar } from "./CapacityBar.tsx";
import { FinancialPassportCard } from "./FinancialPassportCard.tsx";
import { PreScoreGauge } from "./PreScoreGauge.tsx";
import type { ResultViewModel } from "../../app/lib/result/view-model.ts";

const baht = (value: number) => `฿${Math.round(value).toLocaleString("th-TH")}`;

/**
 * หน้าผลลัพธ์ Credit Readiness
 *
 * ลำดับสายตาถูกล็อกไว้: Route → Affordability → Tier → Pre-Score
 * ทุกค่ามาจาก Evaluation Snapshot ผ่าน view model — คอมโพเนนต์นี้ไม่คำนวณอะไรเลย
 */
export function RouteResult({ vm }: { vm: ResultViewModel }) {
  return (
    <div className="fo-result">
      {/* 1 — เส้นทางที่เหมาะสม: หัวเรื่องหลักของหน้า */}
      <section className={`fo-hero-route tone-${vm.hero.tone}`} aria-labelledby="route-heading">
        <p className="fo-eyebrow">เส้นทางที่เหมาะสม</p>
        <h1 id="route-heading" className="fo-route-title" data-role="route-hero">
          {vm.hero.title}
        </h1>
        {vm.hero.titleTh && vm.hero.titleTh !== vm.hero.title ? (
          <p className="fo-route-th" data-role="route-title-th">
            {vm.hero.titleTh}
          </p>
        ) : null}
        <p className="fo-route-support">{vm.hero.support}</p>
        <p className="fo-thesis">{vm.productThesis}</p>

        <ul className="fo-cta-row">
          {vm.ctas.map((cta) => (
            <li key={`${cta.id}-${cta.tone}`}>
              {cta.href ? (
                <Link href={cta.href} className={`fo-cta-chip ${cta.tone}`} data-role={`cta-${cta.id}`}>
                  {cta.label}
                </Link>
              ) : (
                <span className={`fo-cta-chip ${cta.tone}`} data-role={`cta-${cta.id}`}>
                  {cta.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* 2 — ความสามารถรับภาระ */}
      <CapacityBar capacity={vm.capacity} />

      {/* 3 + 4 — ระดับความพร้อมและคะแนน */}
      <div className="fo-result-grid">
        <PreScoreGauge preScore={vm.preScore} />
        <FinancialPassportCard passport={vm.passport} />
      </div>

      {/* หลักฐานและคุณสมบัติเบื้องต้น */}
      <section className="fo-section" aria-labelledby="evidence-heading">
        <h3 id="evidence-heading" className="fo-h3">
          คุณสมบัติเบื้องต้นและหลักฐาน
        </h3>
        <dl className="fo-status-grid">
          <div>
            <dt>สถานะอาชีพ</dt>
            <dd data-role="occupational-status">{vm.eligibility.occupationalStatus ?? "—"}</dd>
          </div>
          <div>
            <dt>ใบขับขี่สาธารณะ</dt>
            <dd data-role="license-status">{vm.eligibility.licenseStatus ?? "—"}</dd>
          </div>
          <div>
            <dt>สถานะหลักฐานอาชีพ</dt>
            <dd data-role="occupational-evidence">{vm.eligibility.occupationalEvidenceStatus ?? "—"}</dd>
          </div>
          <div>
            <dt>ความน่าเชื่อถือของหลักฐานรายได้</dt>
            <dd data-role="income-evidence-reliability">{vm.eligibility.incomeEvidenceReliability}</dd>
          </div>
          <div>
            <dt>การตรวจสอบไขว้จากข้อมูลการวิ่ง</dt>
            <dd data-role="activity-cross-validation">{vm.eligibility.activityCrossValidation}</dd>
          </div>
        </dl>
        <p className="fo-muted" data-role="eligibility-status-copy">
          {vm.eligibility.statusCopy}
        </p>
        <p className="fo-muted">{vm.eligibility.identityState}</p>
        <p className="fo-muted">{vm.eligibility.activityNote}</p>
      </section>

      {/* เหตุผลที่อธิบายผลลัพธ์ */}
      {vm.blockingReasons.length > 0 || vm.watchReasons.length > 0 ? (
        <section className="fo-section" aria-labelledby="reasons-heading">
          <h3 id="reasons-heading" className="fo-h3">
            เหตุผลประกอบผลลัพธ์
          </h3>
          <ul className="fo-reasons">
            {vm.blockingReasons.map((reason) => (
              <li key={reason.code} className="blocker" data-role="blocking-reason">
                <b>{reason.code}</b> {reason.message}
              </li>
            ))}
            {vm.watchReasons.map((reason) => (
              <li key={reason.code} className="watch" data-role="watch-reason">
                <b>{reason.code}</b> {reason.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* รถและประมาณการค่างวด */}
      <section className="fo-section" aria-labelledby="financing-heading">
        <h3 id="financing-heading" className="fo-h3">
          รถและประมาณการค่างวด
        </h3>
        <dl className="fo-status-grid">
          <div>
            <dt>รถ</dt>
            <dd>{vm.vehicle.vehicleName}</dd>
          </div>
          <div>
            <dt>ราคารถ</dt>
            <dd>{baht(vm.vehicle.vehiclePrice)}</dd>
          </div>
          <div>
            <dt>เงินดาวน์ผู้ขับ</dt>
            <dd data-role="borrower-down-payment">0%</dd>
          </div>
          <div>
            <dt>วงเงินสินเชื่อโดยประมาณ</dt>
            <dd>{baht(vm.financing.loanAmount)}</dd>
          </div>
          <div>
            <dt>ระยะเวลาผ่อน</dt>
            <dd>{vm.financing.termMonths} เดือน</dd>
          </div>
          <div>
            <dt>ค่างวดโดยประมาณ</dt>
            <dd data-role="estimated-installment">{baht(vm.financing.estimatedMonthlyInstallment)} / เดือน</dd>
          </div>
          <div>
            <dt>{vm.guarantee.labelTh}</dt>
            <dd data-role="indicative-guarantee-base">
              {vm.guarantee.value === null ? "—" : baht(vm.guarantee.value)}
            </dd>
          </div>
        </dl>
        <p className="fo-muted" data-role="financing-note">
          {vm.financing.note}
        </p>
        <p className="fo-muted" data-role="guarantee-disclaimer">
          {vm.guarantee.labelTh} ({vm.guarantee.label}) — {vm.guarantee.disclaimer}
        </p>
      </section>

      <footer className="fo-disclaimers">
        {vm.disclaimers.map((line) => (
          <p key={line} data-role="disclaimer">
            {line}
          </p>
        ))}
        <p className="fo-muted">
          Snapshot {vm.snapshotId} · เวอร์ชันข้อมูล {vm.inputVersion} · {vm.engineStatus}
        </p>
      </footer>
    </div>
  );
}
