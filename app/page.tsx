import Link from "next/link";

import { DEMO_BADGE, DEMO_CASE_LIST, DEMO_NOTICE } from "./lib/demo/cases.ts";

/**
 * Route to Own — Competition Registration landing (System A / Front Office)
 *
 * หน้านี้เป็นจุดเข้าใหม่ของ Front Office แทนการ rewrite ไปที่ public/route2own.html
 * Front Office รุ่น Frozen ยังเปิดดูได้ที่ /route2own.html
 */
export const metadata = {
  title: "Route to Own by บสย. — Competition Registration"
};

const JOURNEY = [
  "ลงทะเบียน",
  "Financial Passport",
  "ประมาณการค่างวด",
  "ความสามารถรับภาระ",
  "Pre-Score",
  "เส้นทางที่เหมาะสม"
];

export default function HomePage() {
  return (
    <main className="fo-shell">
      <header className="fo-hero">
        <p className="fo-eyebrow">Route to Own by บสย.</p>
        <h1 className="fo-title">เริ่มเส้นทาง Route to Own</h1>
        <p className="fo-lede">จากรายได้จริง → สู่ความพร้อมทางเครดิต → เส้นทางที่เหมาะสม</p>
        <p className="fo-governance">Competition Registration — ไม่ใช่การยื่นขอสินเชื่อจริง</p>

        <form action="/api/applications" method="post" className="fo-cta-form">
          <button type="submit" className="fo-cta">
            ทดลองสมัคร Route to Own
          </button>
        </form>
        <p className="fo-note">
          เมื่อเริ่ม ระบบจะออกเลขที่ใบสมัครจริงในรูปแบบ <code>RTO-C26-000000</code> เพื่อใช้ติดตามผล
        </p>
      </header>

      <section className="fo-section" aria-labelledby="journey-heading">
        <h2 id="journey-heading" className="fo-h2">
          เส้นทางที่คุณจะผ่าน
        </h2>
        <ol className="fo-journey">
          {JOURNEY.map((step, index) => (
            <li key={step} className="fo-journey-step">
              <span className="fo-journey-index">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="fo-section" aria-labelledby="demo-heading" data-role="demo-mode">
        <h2 id="demo-heading" className="fo-h2">
          ชุดข้อมูลสาธิต
        </h2>
        <div className="fo-demo">
          <span className="fo-demo-badge" data-role="demo-badge">
            {DEMO_BADGE}
          </span>
          <p className="fo-muted">{DEMO_NOTICE}</p>
          <div className="fo-demo-grid">
            {DEMO_CASE_LIST.map((demo) => (
              <form
                key={demo.id}
                action={`/api/demo/${demo.id}`}
                method="post"
                className="fo-demo-card"
              >
                <button type="submit" data-role={`demo-case-${demo.id}`}>
                  <b>{demo.title}</b>
                  <span className="fo-demo-expect">{demo.expectation}</span>
                  <small>{demo.demonstrates}</small>
                </button>
              </form>
            ))}
          </div>
          <p className="fo-muted">
            ทุกเคสเดินผ่านเส้นทางเดียวกับผู้สมัครจริง — สร้างใบสมัคร ให้ความยินยอม บันทึกข้อมูล
            แล้วประเมินด้วยเครื่องคำนวณกลาง ผลที่เห็นจึงไม่ได้ถูกเขียนไว้ล่วงหน้า
          </p>
        </div>
      </section>

      <section className="fo-section" aria-labelledby="rules-heading">
        <h2 id="rules-heading" className="fo-h2">
          สิ่งที่ระบบนี้เป็น และไม่เป็น
        </h2>
        <ul className="fo-rules">
          <li>
            <b>Pre-Score ≠ Loan Approval</b> — คะแนนความพร้อมไม่ใช่ผลอนุมัติสินเชื่อ
          </li>
          <li>
            <b>0% Down ≠ 100% Guarantee</b> — เงินดาวน์ผู้ขับ 0% ไม่ได้แปลว่าค้ำประกันเต็มจำนวน
          </li>
          <li>
            <b>Activity Data ≠ Income</b> — ข้อมูลการวิ่งใช้ตรวจสอบความสม่ำเสมอ ไม่ใช่รายได้
          </li>
          <li>สถาบันการเงินเป็นผู้ตัดสินสินเชื่อขั้นสุดท้าย บสย. ดูแลความพร้อมและสิทธิ์ค้ำประกัน</li>
        </ul>
      </section>

      <footer className="fo-footer">
        <p>
          ดู Front Office รุ่น Frozen ที่ใช้เป็น Competition Baseline ได้ที่{" "}
          <Link href="/route2own.html">/route2own.html</Link>
        </p>
        <p className="fo-muted">FINAL / FROZEN FOR COMPETITION · Illustrative / Competition Simulation</p>
      </footer>
    </main>
  );
}
