"use client";

import { useState } from "react";

import type { FiJourneyViewModel } from "../../app/lib/fi/journey-view-model.ts";

/**
 * เลือกสถาบันการเงินเพื่อเตรียมส่งต่อ (สูงสุด 2 แห่ง)
 *
 * หน้าจอนี้ไม่ตัดสินอะไรเอง — ปุ่มที่ปิดไว้เป็นเพียงชั้นเสริม
 * เซิร์ฟเวอร์เป็นผู้บังคับทั้งจำนวนสูงสุด เส้นทางที่อนุญาต และความสอดคล้องกับโครงสร้างโครงการ
 * เมื่อเงื่อนไขของ FI ต่างจากผลอ้างอิง เซิร์ฟเวอร์จะประเมินใหม่ผ่านเครื่องคำนวณกลาง
 */
const baht = (value: number) => `฿${Math.round(value).toLocaleString("th-TH")}`;

export function FiComparison({ vm }: { vm: FiJourneyViewModel }) {
  const preselected = vm.selections.map((selection) => selection.fiId);
  const [picked, setPicked] = useState<string[]>(preselected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const max = 2;

  function toggle(fiId: string) {
    setError(null);
    setPicked((current) => {
      if (current.includes(fiId)) return current.filter((id) => id !== fiId);
      if (current.length >= max) {
        setError(`เลือกได้สูงสุด ${max} แห่ง — เอาแห่งที่เลือกไว้ออกก่อนจึงจะเลือกแห่งใหม่ได้`);
        return current;
      }
      return [...current, fiId];
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/applications/${vm.applicationId}/fi-selections`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fiIds: picked })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "บันทึกการเลือกไม่สำเร็จ");
      }
      window.location.href = `/apply/${vm.applicationId}/handoff`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      setBusy(false);
    }
  }

  return (
    <section className="fo-fi" data-role="fi-comparison">
      <p className="fo-muted" data-role="fi-max-note">
        {vm.maxSelections}
      </p>

      {error ? (
        <p className="fo-error" role="alert" data-role="fi-error">
          {error}
        </p>
      ) : null}

      <p className="fo-muted" data-role="fi-picked-count">
        เลือกไว้ {picked.length} / {max} แห่ง
      </p>

      <ul className="fo-fi-list">
        {vm.options.map((option) => {
          const selected = picked.includes(option.id);
          const disabled = !vm.canSelect || !option.selectableForHandoff;
          return (
            <li
              key={option.id}
              className={`fo-fi-card${selected ? " selected" : ""}${disabled ? " reference-only" : ""}`}
              data-role="fi-option"
              data-fi-id={option.id}
              data-presentation={option.presentation}
            >
              <header className="fo-fi-head">
                <div>
                  <b>{option.fiName}</b>
                  <span className="fo-fi-product">{option.productName}</span>
                </div>
                <span
                  className={`fo-fi-tag ${option.presentation === "ROUTE_TO_OWN_PARTICIPATING" ? "participating" : "market"}`}
                  data-role="fi-presentation"
                >
                  {option.presentation === "ROUTE_TO_OWN_PARTICIPATING"
                    ? "เสนอเป็นทางเลือกส่งต่อได้"
                    : "ข้อมูลอ้างอิงตลาด — เลือกส่งต่อไม่ได้"}
                </span>
              </header>

              <dl className="fo-fi-figures">
                <div>
                  <dt>อัตราที่ใช้ประมาณการ</dt>
                  <dd data-role="fi-rate">{option.indicativeRatePct}% ต่อปี</dd>
                </div>
                <div>
                  <dt>ระยะเวลาที่รองรับ</dt>
                  <dd data-role="fi-terms">{option.termMonths.join(" / ")} เดือน</dd>
                </div>
                <div>
                  <dt>ค่างวดโดยประมาณของคุณ</dt>
                  <dd data-role="fi-installment">{baht(option.applicantEstimatedMonthlyInstallment)} / เดือน</dd>
                </div>
                <div>
                  <dt>ภาระเทียบต่อวัน</dt>
                  <dd data-role="fi-daily-burden">{baht(option.applicantDailyBurden)} / วัน</dd>
                </div>
              </dl>

              <ul className="fo-fi-fit">
                {option.fitNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>

              <p className="fo-fi-source" data-role="fi-source">
                ที่มาข้อมูล: {option.sourceLabel} · ตรวจเมื่อ {option.checkedAt}
              </p>
              <p className="fo-fi-compat" data-role="fi-compatibility-status">
                {option.compatibilityStatusCopy}
              </p>

              <button
                type="button"
                className={selected ? "fo-secondary" : "fo-cta"}
                disabled={disabled || busy}
                onClick={() => toggle(option.id)}
                data-role="fi-select-toggle"
              >
                {selected ? "เอาออกจากรายการที่เลือก" : disabled ? "เลือกเพื่อส่งต่อไม่ได้" : "เลือกแห่งนี้"}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="fo-wizard-nav">
        <span className="fo-muted">{vm.checkWithFi}</span>
        <button
          type="button"
          className="fo-cta"
          disabled={!vm.canSelect || picked.length === 0 || busy}
          onClick={save}
          data-role="fi-save-selections"
        >
          {busy ? "กำลังประเมินตามเงื่อนไขของแต่ละแห่ง…" : "ยืนยันการเลือกและประเมินตามเงื่อนไขของแต่ละแห่ง"}
        </button>
      </div>
      <p className="fo-muted">
        เมื่อยืนยัน ระบบจะประเมินใบสมัครของคุณใหม่ภายใต้เงื่อนไขของแต่ละแห่งแยกกัน
        ผลของแห่งหนึ่งไม่ถูกใช้แทนอีกแห่ง
      </p>
    </section>
  );
}
