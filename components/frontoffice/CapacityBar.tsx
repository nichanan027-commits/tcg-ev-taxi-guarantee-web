import type { ResultViewModel } from "../../app/lib/result/view-model.ts";

const baht = (value: number) => `฿${Math.round(value).toLocaleString("th-TH")}`;

/**
 * Capacity Bar — เงินเทียบเงิน
 *
 * ตอบคำถามเดียวให้ได้ใน 3–5 วินาที: "ฉันรับภาระรถไหวไหม"
 * ไม่ใช้ DSCR เป็นภาพหลัก และไม่แสดงเงินคงเหลือติดลบเป็น "เงินเหลือ"
 * ค่าทั้งหมดมาจาก Evaluation Snapshot ผ่าน view model
 */
export function CapacityBar({ capacity }: { capacity: ResultViewModel["capacity"] }) {
  const scale = Math.max(capacity.availableCash, capacity.estimatedObligation, 1);
  const availablePct = (capacity.availableCash / scale) * 100;
  const obligationPct = (capacity.estimatedObligation / scale) * 100;
  const isGap = capacity.state === "GAP";

  return (
    <section className="fo-capacity" aria-labelledby="capacity-heading">
      <h2 id="capacity-heading" className="fo-h2">
        ความสามารถรับภาระ
      </h2>

      <div className="fo-capacity-row">
        <div className="fo-capacity-label">
          <span>{capacity.availableCashLabel}</span>
          <b>{baht(capacity.availableCash)} / วัน</b>
        </div>
        <div className="fo-capacity-track">
          <div
            className="fo-capacity-fill available"
            style={{ width: `${availablePct}%` }}
            data-role="available-cash-bar"
          />
        </div>
      </div>

      <div className="fo-capacity-row">
        <div className="fo-capacity-label">
          <span>{capacity.estimatedObligationLabel}</span>
          <b>{baht(capacity.estimatedObligation)} / วัน</b>
        </div>
        <div className="fo-capacity-track">
          <div
            className={`fo-capacity-fill obligation${isGap ? " over" : ""}`}
            style={{ width: `${obligationPct}%` }}
            data-role="estimated-obligation-bar"
          />
        </div>
      </div>

      <p className={`fo-capacity-verdict ${isGap ? "gap" : "residual"}`} data-role="capacity-verdict">
        {isGap ? (
          <>
            <span>Affordability Gap — {capacity.label}</span>
            <b data-role="affordability-gap">{baht(capacity.gap)} / วัน</b>
          </>
        ) : (
          <>
            <span>Residual — {capacity.label}</span>
            <b data-role="residual-cash">+{baht(capacity.residual)} / วัน</b>
          </>
        )}
      </p>
    </section>
  );
}
