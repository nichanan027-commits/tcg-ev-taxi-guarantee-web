"use client";

import { useState } from "react";

import type { FiJourneyViewModel, FiOutcomeView, FiSelectionView } from "../../app/lib/fi/journey-view-model.ts";

/**
 * เตรียมส่งต่อสถาบันการเงิน — จุดสิ้นสุดของระบบนี้
 *
 * แต่ละแห่งมีผลประเมินของตัวเอง ความยินยอมของตัวเอง และสถานะการส่งต่อของตัวเอง
 * ระบบไม่ยืมผล READY ของแห่งหนึ่งไปเปิดสิทธิ์ให้อีกแห่ง
 * การอนุมัติสินเชื่อไม่ได้เกิดที่นี่ — ระบบนี้จบที่การเตรียมข้อมูลให้พร้อมพิจารณา
 */
const baht = (value: number) => `฿${Math.round(value).toLocaleString("th-TH")}`;

function Row({
  label,
  reference,
  fiSpecific,
  format
}: {
  label: string;
  reference: string | number | null;
  fiSpecific: string | number | null;
  format?: (value: number) => string;
}) {
  const render = (value: string | number | null) => {
    if (value === null || value === undefined) return "—";
    return typeof value === "number" && format ? format(value) : String(value);
  };
  const changed = reference !== fiSpecific;
  return (
    <tr className={changed ? "changed" : ""} data-role="comparison-row" data-changed={changed ? "true" : "false"}>
      <th scope="row">{label}</th>
      {/* data-label ทำให้อ่านได้บนจอแคบ ที่ตารางถูกจัดใหม่เป็นรายการซ้อนกัน */}
      <td data-role="comparison-reference" data-label="ผลอ้างอิง">
        {render(reference)}
      </td>
      <td data-role="comparison-fi" data-label="ผลของแห่งนี้">
        {render(fiSpecific)}
      </td>
    </tr>
  );
}

function ComparisonTable({ reference, fiSpecific }: { reference: FiOutcomeView | null; fiSpecific: FiOutcomeView | null }) {
  return (
    <table className="fo-compare">
      <thead>
        <tr>
          <th scope="col">รายการ</th>
          <th scope="col">ผลอ้างอิง (เงื่อนไขของคุณ)</th>
          <th scope="col">ผลภายใต้เงื่อนไขของแห่งนี้</th>
        </tr>
      </thead>
      <tbody>
        <Row label="เส้นทาง" reference={reference?.route ?? null} fiSpecific={fiSpecific?.route ?? null} />
        <Row
          label="ระยะเวลาผ่อน"
          reference={reference ? `${reference.termMonths} เดือน` : null}
          fiSpecific={fiSpecific ? `${fiSpecific.termMonths} เดือน` : null}
        />
        <Row
          label="อัตราที่ใช้ประมาณการ"
          reference={reference ? `${reference.annualRatePct}%` : null}
          fiSpecific={fiSpecific ? `${fiSpecific.annualRatePct}%` : null}
        />
        <Row
          label="ค่างวดโดยประมาณ"
          reference={reference?.estimatedMonthlyInstallment ?? null}
          fiSpecific={fiSpecific?.estimatedMonthlyInstallment ?? null}
          format={baht}
        />
        <Row
          label="ภาระเทียบต่อวัน"
          reference={reference?.dailyEquivalentBurden ?? null}
          fiSpecific={fiSpecific?.dailyEquivalentBurden ?? null}
          format={baht}
        />
        <Row
          label="เงินที่พร้อมรองรับภาระ"
          reference={reference?.availableCash ?? null}
          fiSpecific={fiSpecific?.availableCash ?? null}
          format={baht}
        />
        <Row
          label="เหลือหลังรับภาระต่อวัน"
          reference={reference?.residual ?? null}
          fiSpecific={fiSpecific?.residual ?? null}
          format={baht}
        />
        <Row
          label="ส่วนที่ยังขาดต่อวัน"
          reference={reference?.affordabilityGap ?? null}
          fiSpecific={fiSpecific?.affordabilityGap ?? null}
          format={baht}
        />
        <Row
          label="Snapshot ที่ใช้ตัดสิน"
          reference={reference?.snapshotId ?? null}
          fiSpecific={fiSpecific?.snapshotId ?? null}
        />
      </tbody>
    </table>
  );
}

function FiCard({ applicationId, selection }: { applicationId: string; selection: FiSelectionView }) {
  const [consented, setConsented] = useState(selection.consented);
  const [handoffReady, setHandoffReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  async function giveConsent() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/fi-consents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fiId: selection.fiId })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "บันทึกความยินยอมไม่สำเร็จ");
      }
      setConsented(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  async function prepareHandoff() {
    setBusy(true);
    setError(null);
    setBlocked(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/fi-handoff`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fiId: selection.fiId })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        // ด่านฝั่งเซิร์ฟเวอร์ปฏิเสธ — แสดงเหตุผลตามจริง ไม่แปลงเป็นข้อความให้ดูดีกว่าที่เป็น
        setBlocked(body.error || "เตรียมส่งต่อไม่ได้");
        return;
      }
      setHandoffReady(Boolean(body.handoffPackage));
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  const ready = selection.fiSpecific?.route === "READY FOR FI";

  return (
    <article className="fo-fi-handoff" data-role="fi-handoff-card" data-fi-id={selection.fiId}>
      <header className="fo-fi-head">
        <div>
          <b>
            แห่งที่ {selection.slot} — {selection.fiName}
          </b>
          <span className="fo-fi-product">{selection.productName}</span>
        </div>
        <span
          className={`fo-fi-tag ${ready ? "participating" : "market"}`}
          data-role="fi-specific-route"
        >
          {selection.fiSpecific?.route ?? "ยังไม่มีผล"}
        </span>
      </header>

      {selection.materialChange ? (
        <p className="fo-protected-note" data-role="material-change-note">
          เงื่อนไขของแห่งนี้ต่างจากผลอ้างอิงอย่างมีนัยสำคัญ ({selection.changedFields.map((f) => f.label).join(", ")}) —
          ระบบจึงประเมินใหม่ด้วยเครื่องคำนวณกลางและได้ผลชุดใหม่เฉพาะแห่งนี้
        </p>
      ) : (
        <p className="fo-muted" data-role="material-change-note">
          เงื่อนไขของแห่งนี้ไม่ต่างจากผลอ้างอิงอย่างมีนัยสำคัญ จึงใช้ผลอ้างอิงเดิมได้
        </p>
      )}

      {selection.routeChanged ? (
        <p className="fo-protected-note" data-role="route-changed-note">
          เส้นทางเปลี่ยนจาก {selection.reference?.route} เป็น {selection.fiSpecific?.route} เมื่อใช้เงื่อนไขของแห่งนี้
        </p>
      ) : null}

      <div className="fo-compare-scroll">
        <ComparisonTable reference={selection.reference} fiSpecific={selection.fiSpecific} />
      </div>

      {error ? (
        <p className="fo-error" role="alert" data-role="handoff-error">
          {error}
        </p>
      ) : null}

      <div className="fo-handoff-actions">
        <button
          type="button"
          className="fo-secondary"
          disabled={consented || busy || !ready}
          onClick={giveConsent}
          data-role="fi-consent"
        >
          {consented ? `ให้ความยินยอมแล้ว (${selection.consentVersion ?? "RTO-FI-1.0"})` : "ให้ความยินยอมสำหรับแห่งนี้"}
        </button>
        <button
          type="button"
          className="fo-cta"
          disabled={busy}
          onClick={prepareHandoff}
          data-role="fi-prepare-handoff"
        >
          {busy ? "กำลังเตรียม…" : "เตรียมข้อมูลส่งต่อ"}
        </button>
      </div>

      {!ready ? (
        <p className="fo-muted" data-role="handoff-not-ready">
          ผลภายใต้เงื่อนไขของแห่งนี้ไม่ใช่ READY FOR FI จึงยังให้ความยินยอมและส่งต่อไม่ได้
        </p>
      ) : null}

      {blocked ? (
        <p className="fo-protected-note" data-role="handoff-blocked">
          {blocked}
        </p>
      ) : null}

      {handoffReady ? (
        <p className="fo-handoff-ready" data-role="handoff-ready">
          พร้อมส่งข้อมูลประกอบเข้าสู่การพิจารณาของสถาบันการเงิน — ชุดข้อมูลผูกกับ Snapshot{" "}
          {selection.fiSpecific?.snapshotId} ของแห่งนี้โดยเฉพาะ
        </p>
      ) : null}

      <p className="fo-muted" data-role="handoff-status-reason">
        สถานะปัจจุบัน: {selection.handoff.reason}
      </p>
    </article>
  );
}

export function FiHandoffPanel({ vm }: { vm: FiJourneyViewModel }) {
  return (
    <section className="fo-handoff" data-role="fi-handoff-panel">
      <p className="fo-muted" data-role="handoff-independence-note">
        แต่ละแห่งถูกประเมินและตัดสินแยกกันจากผลของตัวเอง ผล READY ของแห่งหนึ่งไม่ทำให้อีกแห่งส่งต่อได้
      </p>
      {vm.selections.map((selection) => (
        <FiCard key={selection.fiId} applicationId={vm.applicationId} selection={selection} />
      ))}
    </section>
  );
}
