'use client';

import { useMemo, useState } from 'react';
import {
  RBP_DAY_COUNT_BASIS,
  RBP_RATE,
  RBP_STATUS,
  SCENARIO_V13,
  type DataConfidence,
  type Route,
  type RbpTier,
  type ScoreInput,
  type ScoreResult
} from '../lib/route2own';

type ScoreResponse = ScoreResult & {
  scenario: string;
  disclaimer: string;
  input: ScoreInput;
};

type FormState = ScoreInput & {
  driverName: string;
  coopName: string;
};

/** ค่าตั้งต้น = Competition Working Scenario v1.3 (800K / BaaS 400) ตรงกับหน้าบ้าน */
const initialForm: FormState = {
  ...SCENARIO_V13,
  driverName: 'คุณสมชาย EV Taxi',
  coopName: 'สหกรณ์แท็กซี่เมืองใหม่'
};

const examples: Record<string, Partial<FormState>> = {
  standard: initialForm,
  strong: {
    driverName: 'คุณอนันต์ วินัยดี',
    grossDaily: 2200,
    workDays: 26,
    verifiedPct: 98,
    gpsComplete: 98,
    householdMonthly: 14000,
    rbpTier: 'A'
  },
  build: {
    driverName: 'คุณมานะ ข้อมูลยังไม่ครบ',
    grossDaily: 1900,
    workDays: 25,
    verifiedPct: 92,
    gpsComplete: 55,
    downtimeDays: 3,
    householdMonthly: 14000
  },
  reject: {
    driverName: 'คุณเดชา รายได้ผันผวน',
    grossDaily: 1300,
    workDays: 22,
    verifiedPct: 80,
    gpsComplete: 75,
    existingDebt: 3500,
    householdMonthly: 16000
  }
};

type NumericKey = Exclude<keyof ScoreInput, 'energyIncluded' | 'rbpTier' | 'guaranteeYear'>;

const fieldGroups: { title: string; fields: { key: NumericKey; label: string; step?: number }[] }[] = [
  {
    title: 'A. รายได้และการทำงาน',
    fields: [
      { key: 'grossDaily', label: 'รายได้รวมต่อวัน (บาท)', step: 0.01 },
      { key: 'workDays', label: 'Eligible Day ต่อเดือน' },
      { key: 'verifiedPct', label: 'สัดส่วนรายได้ที่ Verify ได้ (%)' },
      { key: 'commissionPct', label: 'ค่าคอมมิชชั่นแพลตฟอร์ม (%)' },
      { key: 'rentDaily', label: 'ค่าเช่ารถเดิมต่อวัน (บาท)' },
      { key: 'fuelDaily', label: 'ค่าเชื้อเพลิงเดิมต่อวัน (บาท)' }
    ]
  },
  {
    title: 'B. Mobility / Data Confidence',
    fields: [
      { key: 'serviceKm', label: 'ระยะรับผู้โดยสาร (กม./วัน)' },
      { key: 'repositionKm', label: 'ระยะวิ่งเปล่า (กม./วัน)' },
      { key: 'chargingKm', label: 'ระยะไปจุดชาร์จ (กม./วัน)' },
      { key: 'downtimeDays', label: 'Downtime (วัน/เดือน)' },
      { key: 'gpsComplete', label: 'ความครบถ้วนของ GPS (%)' }
    ]
  },
  {
    title: 'C. ค่าใช้จ่าย EV / BaaS',
    fields: [
      { key: 'baasDaily', label: 'BaaS / Battery Service ต่อวัน (บาท)' },
      { key: 'electricityRate', label: 'ค่าไฟ (บาท/kWh)', step: 0.01 },
      { key: 'kwhKm', label: 'อัตราใช้พลังงาน (kWh/กม.)', step: 0.001 },
      { key: 'maintKm', label: 'ค่าบำรุงรักษา (บาท/กม.)', step: 0.00001 },
      { key: 'tireKm', label: 'ค่ายาง (บาท/กม.)', step: 0.01 },
      { key: 'insuranceMonthly', label: 'ประกัน + ทะเบียน (บาท/เดือน)' },
      { key: 'otherOpEx', label: 'ค่าใช้จ่ายอื่น (บาท/เดือน)' }
    ]
  },
  {
    title: 'D. ภาระหนี้และ Protected Cash',
    fields: [
      { key: 'existingDebt', label: 'ภาระหนี้เดิม (บาท/เดือน)' },
      { key: 'householdMonthly', label: 'ค่าใช้จ่ายครัวเรือน (บาท/เดือน)' },
      { key: 'nextShiftDaily', label: 'เงินทุนหมุนเวียนกะถัดไป (บาท/วัน)' }
    ]
  },
  {
    title: 'E. โครงสร้างสินเชื่อ (Scenario)',
    fields: [
      { key: 'vehiclePrice', label: 'ราคารถ (บาท)' },
      { key: 'downPayment', label: 'เงินดาวน์ (บาท)' },
      { key: 'loanNeed', label: 'วงเงินสินเชื่อ / ค้ำประกัน (บาท)' },
      { key: 'interest', label: 'ดอกเบี้ยต่อปี (%)', step: 0.01 },
      { key: 'tenor', label: 'ระยะเวลาผ่อน (เดือน)' }
    ]
  }
];

const baht = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0
});

function formatNumber(value: number) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(value || 0);
}

function routeText(route: Route) {
  if (route === 'OWN READY') return 'Route A — OWN READY';
  if (route === 'BUILD READINESS') return 'Route B — BUILD READINESS';
  return 'Route C — NO NEW DEBT';
}

function routeClass(route: Route) {
  if (route === 'OWN READY') return 'decision approve';
  if (route === 'BUILD READINESS') return 'decision watch';
  return 'decision reject';
}

function confidenceText(confidence: DataConfidence) {
  if (confidence === 'HIGH') return 'HIGH — ข้อมูลครบพร้อมส่ง FI';
  if (confidence === 'MEDIUM') return 'MEDIUM — ควรสะสมข้อมูลเพิ่ม';
  return 'LOW — ข้อมูลยังไม่พอจัด Route A';
}

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<ScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const portfolio = useMemo(() => {
    const cars = 500;
    const exposure = cars * form.loanNeed; // Guarantee Coverage 100%
    const maxClaim = exposure * 0.2;
    const chargeableYears = Math.max(0, form.tenor / 12 - 3); // Proposed Fee Waiver ปี 1–3
    const feePool = exposure * RBP_RATE[form.rbpTier] * chargeableYears;
    const sinkingFund = exposure * 0.092;
    return { cars, exposure, maxClaim, feePool, sinkingFund, chargeableYears };
  }, [form.loanNeed, form.rbpTier, form.tenor]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!response.ok) throw new Error(`API ตอบกลับสถานะ ${response.status}`);
      setResult((await response.json()) as ScoreResponse);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : 'เรียก API ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <main>
      <nav className="topbar">
        <div className="brand">
          <div className="logo" aria-hidden="true">∞</div>
          <div>
            <strong>TCG Route2Own EV Taxi Guarantee</strong>
            <span>Scoring API — Working Scenario v1.3</span>
          </div>
        </div>
        <div className="navlinks">
          <a href="/">← หน้าหลัก Route2Own</a>
          <a href="#demo">ทดลองระบบ</a>
          <a href="#dashboard">Dashboard</a>
          <a href="#deploy">Deploy</a>
        </div>
      </nav>

      <section className="hero">
        <div className="heroText">
          <div className="eyebrow">COMPETITION WORKING SCENARIO v1.3 • 800K • BAAS 400</div>
          <h1>เปลี่ยนรายได้รายวัน<br /><span>ให้เป็นเครดิตยุคใหม่</span></h1>
          <p>
            หน้านี้เรียก <code>/api/score</code> ซึ่งใช้ตรรกะเดียวกับ Front Office ของ Route2Own
            ทั้ง Daily Financial X-Ray, DSCR, PAI, Principal Sustainability และการจัด Route A/B/C
            บนสมมติฐาน วงเงิน 800,000 บาท • BaaS 400 บาท/วัน (Energy Included) • ค้ำ 100% • RBP Waiver ปี 1–3
          </p>
          <div className="actions">
            <a className="button" href="#demo">เริ่มทดลอง</a>
            <a className="button ghost" href="#deploy">ดูวิธี Deploy</a>
          </div>
          <div className="heroStats">
            <div><b>800K</b><span>วงเงินใน Scenario</span></div>
            <div><b>1.00x</b><span>DSCR Gate</span></div>
            <div><b>ปี 1–3</b><span>Proposed Fee Waiver</span></div>
          </div>
        </div>

        <div className="controlCard">
          <div className="radar">
            <div className="scanLine" />
            <div className="evCar">EV</div>
          </div>
          <div className="statusRows">
            <div><span>Scenario</span><b>800K / BaaS 400</b></div>
            <div><span>Guarantee Coverage</span><b>100%</b></div>
            <div><span>RBP A / B / C</span><b>1.20% / 1.50% / 1.80%</b></div>
          </div>
        </div>
      </section>

      <section className="modules">
        <article>
          <span>01</span>
          <h3>Financial + Occupational Passport</h3>
          <p>รายได้ที่ Verify ได้ วันทำงาน Mobility ต้นทุน BaaS/พลังงาน ภาระหนี้ และ Protected Cash</p>
        </article>
        <article>
          <span>02</span>
          <h3>Credit Readiness Engine</h3>
          <p>คำนวณ Available Cash, DSCR Base/−15%/−30%, PAI, TCO และ Principal Sustainability</p>
        </article>
        <article>
          <span>03</span>
          <h3>Route A / B / C + RBP</h3>
          <p>จัด Route และ Indicative Tier พร้อมค่าธรรมเนียม RBP แบบโปร่งใส โดย FI เป็นผู้อนุมัติจริง</p>
        </article>
      </section>

      <section className="demo" id="demo">
        <div className="sectionTitle">
          <p>Interactive Demo</p>
          <h2>ทดลองกรอกข้อมูลและคำนวณทันที</h2>
        </div>

        <div className="demoGrid">
          <div className="panel">
            <div className="scenarioBar">
              <button onClick={() => setForm({ ...initialForm, ...examples.standard })}>เคสมาตรฐาน v1.3</button>
              <button onClick={() => setForm({ ...initialForm, ...examples.strong })}>เคสแข็งแรง</button>
              <button onClick={() => setForm({ ...initialForm, ...examples.build })}>ข้อมูลยังไม่พอ</button>
              <button onClick={() => setForm({ ...initialForm, ...examples.reject })}>ไม่ควรสร้างหนี้ใหม่</button>
            </div>

            <div className="formGrid">
              <label>ชื่อผู้ขับ
                <input value={form.driverName} onChange={(e) => update('driverName', e.target.value)} />
              </label>
              <label>สหกรณ์
                <input value={form.coopName} onChange={(e) => update('coopName', e.target.value)} />
              </label>
            </div>

            {fieldGroups.map((group) => (
              <div key={group.title}>
                <div className="eyebrow" style={{ marginTop: 18 }}>{group.title}</div>
                <div className="formGrid">
                  {group.fields.map((field) => (
                    <label key={field.key}>{field.label}
                      <input
                        type="number"
                        step={field.step ?? 1}
                        value={form[field.key]}
                        onChange={(e) => update(field.key, Number(e.target.value))}
                      />
                    </label>
                  ))}
                  {group.title.startsWith('C.') && (
                    <label>การรวมพลังงานใน BaaS
                      <select
                        value={form.energyIncluded}
                        onChange={(e) => update('energyIncluded', e.target.value as ScoreInput['energyIncluded'])}
                      >
                        <option value="included">รวมค่าไฟ / Energy Included</option>
                        <option value="excluded">ไม่รวมค่าไฟ / Energy Excluded</option>
                      </select>
                    </label>
                  )}
                </div>
              </div>
            ))}

            <div className="eyebrow" style={{ marginTop: 18 }}>F. Guarantee / RBP</div>
            <div className="formGrid">
              <label>RBP Fee Scenario
                <select value={form.rbpTier} onChange={(e) => update('rbpTier', e.target.value as RbpTier)}>
                  <option value="A">A — 1.20% p.a.</option>
                  <option value="B">B — 1.50% p.a.</option>
                  <option value="C">C — 1.80% p.a.</option>
                </select>
              </label>
              <label>ปีของสัญญาค้ำ (Guarantee Year)
                <select
                  value={form.guaranteeYear}
                  onChange={(e) => update('guaranteeYear', Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((year) => (
                    <option key={year} value={year}>
                      ปีที่ {year}{year <= 3 ? ' — Proposed Fee Waiver' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button className="button wide" onClick={calculate} disabled={loading}>
              {loading ? 'กำลังคำนวณ...' : 'คำนวณผ่าน API'}
            </button>
          </div>

          <div className="panel resultPanel">
            {result ? (
              <>
                <div className={routeClass(result.readiness.route)}>
                  <span>Route2Own Explainable Pre-Score • {result.readiness.preScore.status}</span>
                  <h2>Case {result.readiness.level.caseId} — {result.readiness.level.label}</h2>
                  <p>
                    คะแนนความพร้อม {result.readiness.readinessScore}/100 • Indicative Tier: {result.readiness.tier} •
                    Data Confidence: {result.readiness.dataConfidence}
                  </p>
                  <p>
                    {result.readiness.level.fiHandoffEligible
                      ? result.readiness.level.planDays === 30
                        ? 'ส่ง FI ได้ พร้อมแผนเติมความพร้อม 30 วัน — FI ตัดสินสินเชื่อขั้นสุดท้าย'
                        : 'ส่ง Readiness Package ให้ FI ได้ — FI ตัดสินสินเชื่อขั้นสุดท้าย'
                      : 'สร้างฐานข้อมูลและความพร้อมก่อนส่งต่อ FI'}
                  </p>
                </div>

                <div className="kpiGrid">
                  <div><span>Available Cash / วัน</span><b>{baht.format(result.calc.rawAvailDaily)}</b></div>
                  <div><span>DSCR Base</span><b>{result.calc.dscr.toFixed(2)}x</b></div>
                  <div><span>PAI</span><b>{result.calc.pai.toFixed(2)}</b></div>
                  <div>
                    <span>Principal Maturity</span>
                    <b>{result.calc.maturity <= 1000 ? 'CLOSE' : baht.format(result.calc.maturity)}</b>
                  </div>
                </div>

                <div className="kpiGrid">
                  <div><span>PAYD Reference / Eligible Day</span><b>{baht.format(result.calc.paydRefDaily)}</b></div>
                  <div><span>Stress DSCR −15% / −30%</span><b>{result.calc.dscr15.toFixed(2)}x / {result.calc.dscr30.toFixed(2)}x</b></div>
                  <div>
                    <span>Customer RBP / วัน</span>
                    <b>{result.calc.customerRbpDay > 0 ? baht.format(result.calc.customerRbpDay) : 'ยกเว้นปี 1–3'}</b>
                  </div>
                  <div>
                    <span>TCO เทียบเช่ารถเดิม</span>
                    <b>{result.calc.tcoDelta >= 0 ? '+' : '−'}{baht.format(Math.abs(result.calc.tcoDelta))}</b>
                  </div>
                </div>

                <div className="kpiGrid">
                  <div><span>Guaranteed Outstanding</span><b>{baht.format(result.calc.guaranteedOutstanding)}</b></div>
                  <div><span>Annual RBP Rate</span><b>{(result.calc.rbpRate * 100).toFixed(2)}%</b></div>
                  <div><span>RBP Reference / วัน</span><b>{baht.format(result.calc.rbpReferenceDay)}</b></div>
                  <div><span>Day-count / Status</span><b>{RBP_DAY_COUNT_BASIS} วัน • {RBP_STATUS}</b></div>
                </div>

                <div className="kpiGrid">
                  <div><span>ยอดผ่อนชำระรวมตลอดสัญญา</span><b>{baht.format(result.calc.totalRepayment)}</b></div>
                  <div><span>ดอกเบี้ยรวมที่ต้องจ่าย</span><b>{baht.format(result.calc.totalInterest)}</b></div>
                  <div><span>จุดคุ้มทุน / วัน</span><b>{baht.format(result.calc.breakEven.requiredGrossDaily)}</b></div>
                  <div><span>ส่วนต่างคงเหลือ / วัน</span><b>{baht.format(result.calc.breakEven.marginDaily)}</b></div>
                </div>

                <div className="reasonBox">
                  <h3>องค์ประกอบ Pre-Score — รวมจาก 5 หมวด</h3>
                  <ul>
                    {result.readiness.breakdown.map((component) => (
                      <li key={component.id}>
                        <b>{component.label}: {component.points}/{component.maxPoints}</b> — {component.explanation}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="reasonBox">
                  <h3>เหตุผลของระบบ • {confidenceText(result.readiness.dataConfidence)}</h3>
                  <ul>
                    {result.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                  <p>{result.disclaimer}</p>
                </div>
              </>
            ) : (
              <div className="emptyState">
                <h2>{error ? 'คำนวณไม่สำเร็จ' : 'ยังไม่ได้คำนวณ'}</h2>
                <p>
                  {error ??
                    'กดปุ่ม “คำนวณผ่าน API” เพื่อส่งข้อมูลไปที่ Vercel Function แล้วรับผล Route2Own Credit Readiness กลับมา'}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="dashboard" id="dashboard">
        <div className="sectionTitle">
          <p>Executive View</p>
          <h2>Dashboard จำลองสำหรับนำเสนอผู้บริหาร</h2>
        </div>
        <div className="dashGrid">
          <div><span>จำนวนรถ Pilot</span><b>{formatNumber(portfolio.cars)}</b></div>
          <div><span>วงเงินค้ำรวม (ค้ำ 100%)</span><b>{baht.format(portfolio.exposure)}</b></div>
          <div><span>Claim Cap 20%</span><b>{baht.format(portfolio.maxClaim)}</b></div>
          <div>
            <span>Fee Pool หลัง Waiver ({formatNumber(portfolio.chargeableYears)} ปี)</span>
            <b>{baht.format(portfolio.feePool)}</b>
          </div>
          <div className="wideCard"><span>Sinking Fund</span><b>{baht.format(portfolio.sinkingFund)}</b></div>
        </div>
      </section>

      <section className="deploy" id="deploy">
        <div className="sectionTitle">
          <p>Beginner Deployment Guide</p>
          <h2>วิธีเอาโค้ดนี้ขึ้น Vercel แบบไม่มีพื้นฐาน</h2>
        </div>
        <ol>
          <li>แตกไฟล์ ZIP ที่ได้รับ จะเห็นโฟลเดอร์ <code>tcg-vercel-nextjs-neon</code></li>
          <li>สมัครหรือเข้าสู่ระบบ GitHub แล้วสร้าง repository ใหม่</li>
          <li>อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้เข้า GitHub</li>
          <li>เข้า Vercel แล้วเลือก Add New Project</li>
          <li>เลือก repository ที่เพิ่งสร้าง แล้วกด Deploy</li>
          <li>หลัง Deploy สำเร็จ Vercel จะให้ URL สำหรับเปิดเว็บไซต์จริง</li>
        </ol>
      </section>
    </main>
  );
}
