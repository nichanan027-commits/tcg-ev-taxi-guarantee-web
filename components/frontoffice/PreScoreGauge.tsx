import type { ResultViewModel } from "../../app/lib/result/view-model.ts";

/**
 * Pre-Score Gauge — เกจครึ่งวงกลมเชิงสถาบัน
 *
 * ไม่ใช้หน้าปัดรถยนต์สมจริง และไม่ใช้สีเขียว/แดงสื่อว่าอนุมัติหรือปฏิเสธ
 * ใช้เฉดเดียวไล่ความเข้ม เพราะคะแนนนี้เป็นข้อมูลประกอบ ไม่ใช่คำตัดสิน
 */
export function PreScoreGauge({ preScore }: { preScore: ResultViewModel["preScore"] }) {
  const score = Math.max(0, Math.min(preScore.max, preScore.score));
  const fraction = score / preScore.max;

  // ครึ่งวงกลมรัศมี 90 กว้าง 220 สูง 120
  const cx = 110;
  const cy = 105;
  const r = 88;
  const circumference = Math.PI * r;
  const dash = circumference * fraction;

  return (
    <section className="fo-gauge" aria-labelledby="prescore-heading">
      {/* เป็นหัวเรื่องระดับรอง — Route คือหัวเรื่องหลักของหน้า */}
      <h3 id="prescore-heading" className="fo-h3">
        คะแนนความพร้อม (Pre-Score)
      </h3>

      <svg viewBox="0 0 220 130" className="fo-gauge-svg" role="img"
        aria-label={`Pre-Score ${score} จาก ${preScore.max}`}>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--fo-line)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--fo-blue)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          data-role="prescore-arc"
        />
      </svg>

      {/* ตัวเลขอยู่นอก SVG เพื่อให้ขนาดถูกคุมด้วย CSS ของหน้า
          ไม่ถูกขยายตาม viewBox จนใหญ่กว่าหัวเรื่อง Route */}
      <p className="fo-gauge-readout">
        <b className="fo-gauge-score" data-role="prescore-value">{score}</b>
        <span className="fo-gauge-max">/ {preScore.max}</span>
      </p>

      {preScore.tierCopy ? (
        <p className="fo-gauge-tier" data-role="tier-copy">
          {preScore.tierCopy}
        </p>
      ) : null}

      <p className="fo-gauge-disclaimer" data-role="prescore-disclaimer">
        {preScore.disclaimer}
      </p>
    </section>
  );
}
