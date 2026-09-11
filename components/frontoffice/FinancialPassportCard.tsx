import type { ResultViewModel } from "../../app/lib/result/view-model.ts";

const baht = (value: number) => `฿${Math.round(value).toLocaleString("th-TH")}`;

/**
 * Financial Passport
 *
 * แสดงรายได้เป็นสามชั้นแยกกันชัดเจน:
 *   ที่ผู้สมัครระบุ → สถานะหลักฐาน → ที่ใช้ประเมิน → (ถ้ามีจริง) ที่มีหลักฐานรองรับ
 * ห้ามเรียกตัวเลขที่ผู้สมัครพิมพ์เองว่า Verified Revenue
 */
export function FinancialPassportCard({ passport }: { passport: ResultViewModel["passport"] }) {
  return (
    <section className="fo-passport" aria-labelledby="passport-heading">
      <h3 id="passport-heading" className="fo-h3">
        Financial Passport
      </h3>

      <dl className="fo-passport-list">
        <div className="fo-passport-row">
          <dt>{passport.declared.label}</dt>
          <dd data-role="declared-revenue">{baht(passport.declared.value)} / วัน</dd>
        </div>

        <div className="fo-passport-row evidence">
          <dt>สถานะหลักฐานรายได้</dt>
          <dd data-role="evidence-status">
            <span className="fo-chip">{passport.evidenceStatus.code}</span>
            <small>{passport.evidenceStatus.copy}</small>
          </dd>
        </div>

        <div className="fo-passport-row highlight">
          <dt>{passport.assessment.label}</dt>
          <dd data-role="assessment-revenue">{baht(passport.assessment.value)} / วัน</dd>
        </div>

        {passport.verified ? (
          <div className="fo-passport-row">
            <dt>{passport.verified.label}</dt>
            <dd data-role="verified-revenue">{baht(passport.verified.value)} / วัน</dd>
          </div>
        ) : null}

        <div className="fo-passport-row minus">
          <dt>{passport.eligibleOpEx.label}</dt>
          <dd>− {baht(passport.eligibleOpEx.value)} / วัน</dd>
        </div>

        <div className="fo-passport-row minus">
          <dt>{passport.protectedCash.label}</dt>
          <dd>− {baht(passport.protectedCash.value)} / วัน</dd>
        </div>

        <div className="fo-passport-row total">
          <dt>{passport.availableCash.label}</dt>
          <dd data-role="available-cash">{baht(passport.availableCash.value)} / วัน</dd>
        </div>
      </dl>
    </section>
  );
}
