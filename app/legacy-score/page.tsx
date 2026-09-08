'use client';

import { useState } from 'react';
import {
  PRODUCT_STATUS,
  RBP_DAY_COUNT_BASIS,
  RBP_STATUS,
  RESERVE_TARGET_DAYS,
  ROUTES,
  SCENARIO_COMPETITION,
  type ActivityEvidenceStatus,
  type IncomeEvidenceReliability,
  type RbpTier,
  type Route,
  type ScoreInput,
  type ScoreResult
} from '../lib/route2own';

type ScoreResponse = ScoreResult & {
  product: string;
  status: string;
  disclaimer: string;
  input: ScoreInput;
};

type FormState = ScoreInput & {
  driverName: string;
  coopName: string;
};

/** ค่าตั้งต้น = Competition Scenario ตรงกับ Front Office */
const initialForm: FormState = {
  ...SCENARIO_COMPETITION,
  driverName: 'คุณสมชาย EV Taxi',
  coopName: 'สหกรณ์แท็กซี่เมืองใหม่'
};

const examples: Record<string, Partial<FormState>> = {
  ready: {
    driverName: 'เคสพร้อมส่งต่อ FI',
    grossDaily: 2200,
    workDays: 26,
    verifiedPct: 95,
    gpsComplete: 95,
    downtimeDays: 0,
    existingDebt: 0
  },
  build: {
    driverName: 'เคสหลักฐานรายได้ยังไม่พอ',
    grossDaily: 3000,
    workDays: 25,
    verifiedPct: 55,
    gpsComplete: 80,
    downtimeDays: 2,
    existingDebt: 0
  },
  noDebt: {
    driverName: 'เคสยังไม่ควรเพิ่มหนี้ใหม่',
    grossDaily: 1150,
    workDays: 21,
    verifiedPct: 80,
    gpsComplete: 70,
    downtimeDays: 4,
    existingDebt: 2600
  }
};

type NumericKey = Exclude<
  keyof ScoreInput,
  'energyIncluded' | 'rbpTier' | 'guaranteeYear' | 'downPayment' | 'loanNeed'
>;

const fieldGroups: { title: string; fields: { key: NumericKey; label: string; step?: number }[] }[] = [
  {
    title: 'A. รายได้และการทำงาน',
    fields: [
      { key: 'grossDaily', label: 'รายได้รวมต่อวัน (บาท)', step: 0.01 },
      { key: 'workDays', label: 'Eligible Day ต่อเดือน' },
      { key: 'verifiedPct', label: 'สัดส่วนรายได้ที่ตรวจสอบย้อนกลับได้ (%)' },
      { key: 'commissionPct', label: 'ค่าคอมมิชชั่นแพลตฟอร์ม (%)' },
      { key: 'rentDaily', label: 'ค่าเช่ารถเดิมต่อวัน (บาท)' },
      { key: 'fuelDaily', label: 'ค่าเชื้อเพลิงเดิมต่อวัน (บาท)' }
    ]
  },
  {
    title: 'B. หลักฐานกิจกรรม (Cross-Validation เท่านั้น)',
    fields: [
      { key: 'serviceKm', label: 'ระยะรับผู้โดยสาร (กม./วัน)' },
      { key: 'repositionKm', label: 'ระยะวิ่งเปล่า (กม./วัน)' },
      { key: 'chargingKm', label: 'ระยะไปจุดชาร์จ (กม./วัน)' },
      { key: 'downtimeDays', label: 'Downtime (วัน/เดือน)' },
      { key: 'gpsComplete', label: 'ความครบถ้วนของข้อมูลกิจกรรม (%)' }
    ]
  },
  {
    title: 'C. ต้นทุนเดินรถ และค่าบริการแบตเตอรี่ (แยกจากสินเชื่อ)',
    fields: [
      { key: 'batteryServiceDaily', label: 'ค่าบริการแบตเตอรี่ / การสลับ (บาท/วัน)' },
      { key: 'electricityRate', label: 'ค่าไฟ (บาท/kWh)', step: 0.01 },
      { key: 'kwhKm', label: 'อัตราใช้พลังงาน (kWh/กม.)', step: 0.001 },
      { key: 'maintKm', label: 'ค่าบำรุงรักษา (บาท/กม.)', step: 0.00001 },
      { key: 'tireKm', label: 'ค่ายาง (บาท/กม.)', step: 0.01 },
      { key: 'insuranceMonthly', label: 'ประกัน + ทะเบียน (บาท/เดือน)' },
      { key: 'otherOpEx', label: 'ค่าใช้จ่ายอื่น (บาท/เดือน)' }
    ]
  },
  {
    title: 'D. ภาระหนี้ Protected Cash และเงินสำรอง',
    fields: [
      { key: 'existingDebt', label: 'ภาระหนี้เดิม (บาท/เดือน)' },
      { key: 'householdMonthly', label: 'ค่าใช้จ่ายครัวเรือน (บาท/เดือน)' },
      { key: 'nextShiftDaily', label: 'เงินทุนหมุนเวียนกะถัดไป (บาท/วัน)' },
      { key: 'reserveBalance', label: 'ยอด Adaptive Payment Reserve ที่สะสมแล้ว (บาท)' }
    ]
  },
  {
    title: 'E. โครงสร้างสินเชื่อและวงเงินค้ำ (Scenario)',
    fields: [
      { key: 'vehiclePrice', label: 'ราคารถ (บาท)' },
      { key: 'eligibleGuaranteedAmount', label: 'วงเงินค้ำที่เข้าเกณฑ์ (บาท)' },
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

function routeText(route: Route) {
  if (route === ROUTES.READY_FOR_FI) return 'READY FOR FI';
  if (route === ROUTES.BUILD_READINESS) return 'BUILD READINESS / CONTINUE TO LEASE';
  return 'NO NEW DEBT';
}

function routeClass(route: Route) {
  if (route === ROUTES.READY_FOR_FI) return 'decision approve';
  if (route === ROUTES.BUILD_READINESS) return 'decision watch';
  return 'decision reject';
}

function routeAction(route: Route) {
  if (route === ROUTES.READY_FOR_FI) {
    return 'ส่ง Readiness Package ให้ FI ได้ — FI เป็นผู้ Underwrite และตัดสินสินเชื่อขั้นสุดท้าย';
  }
  if (route === ROUTES.BUILD_READINESS) {
    return 'สะสมหลักฐานรายได้เพิ่มหรือเช่าต่อก่อน แล้วประเมินใหม่ — ยังไม่เปิดส่งต่อ FI';
  }
  return 'Affordability ยังไม่รองรับหนี้ใหม่ จึงไม่ควรเพิ่มภาระในขณะนี้ — ยังไม่เปิดส่งต่อ FI';
}

function incomeEvidenceText(reliability: IncomeEvidenceReliability) {
  if (reliability === 'HIGH') return 'HIGH — รายได้ตรวจสอบย้อนกลับได้ครบถ้วน';
  if (reliability === 'MEDIUM') return 'MEDIUM — ควรสะสมหลักฐานรายได้เพิ่ม';
  return 'LOW — หลักฐานรายได้ยังไม่พอต่อการส่งต่อ FI';
}

function activityEvidenceText(status: ActivityEvidenceStatus) {
  if (status === 'CONSISTENT') return 'CONSISTENT — ข้อมูลกิจกรรมสอดคล้องกับรายได้ที่แจ้ง';
  if (status === 'REVIEW') return 'REVIEW — ควรตรวจความสอดคล้องเพิ่มเติม';
  return 'LIMITED — ข้อมูลกิจกรรมยังน้อย ใช้ Cross-Validation ได้จำกัด';
}

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<ScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            <strong>Route to Own by บสย.</strong>
            <span>Legacy Calculation / Engine Diagnostic View</span>
          </div>
        </div>
        <div className="navlinks">
          <a href="/">← หน้าหลัก Route to Own</a>
          <a href="#demo">ทดลองเรียก Engine</a>
        </div>
      </nav>

      <section className="hero">
        <div className="heroText">
          <div className="eyebrow">{PRODUCT_STATUS} • ENGINE DIAGNOSTIC VIEW</div>
          <h1>ตรวจผลลัพธ์ของ Engine<br /><span>ทีละเคส</span></h1>
          <p>
            หน้านี้เป็นเครื่องมือตรวจสอบระดับบุคคล เรียก <code>/api/score</code> ซึ่งใช้ตรรกะไฟล์เดียวกับ
            Front Office ทั้ง Daily Financial X-Ray, DSCR, PAI, Principal Sustainability,
            การแยกหลักฐานรายได้ออกจากหลักฐานกิจกรรม และการจัดเส้นทางแบบ Affordability-first
            ไม่มีการรวมภาพพอร์ตหรือระบบหลังอนุมัติในหน้านี้
          </p>
          <div className="actions">
            <a className="button" href="#demo">เริ่มทดลอง</a>
          </div>
          <div className="heroStats">
            <div><b>0%</b><span>เงินดาวน์ผู้ขับ</span></div>
            <div><b>1.00x</b><span>DSCR Gate</span></div>
            <div><b>3</b><span>เส้นทางผลลัพธ์</span></div>
          </div>
        </div>

        <div className="controlCard">
          <div className="radar">
            <div className="scanLine" />
            <div className="evCar">EV</div>
          </div>
          <div className="statusRows">
            <div><span>Base Product</span><b>เงินดาวน์ 0%</b></div>
            <div><span>ฐานคิด RBP</span><b>วงเงินค้ำที่เข้าเกณฑ์</b></div>
            <div><span>RBP A / B / C</span><b>1.20% / 1.50% / 1.80%</b></div>
          </div>
        </div>
      </section>

      <section className="modules">
        <article>
          <span>01</span>
          <h3>Financial + Occupational Passport</h3>
          <p>รายได้ที่ตรวจสอบย้อนกลับได้ วันทำงาน ต้นทุนเดินรถ ค่าบริการแบตเตอรี่ ภาระหนี้ และ Protected Cash</p>
        </article>
        <article>
          <span>02</span>
          <h3>Credit Readiness Engine</h3>
          <p>คำนวณ Available Cash, DSCR Base/−15%/−30%, PAI, TCO และ Principal Sustainability</p>
        </article>
        <article>
          <span>03</span>
          <h3>Appropriate Route + RBP</h3>
          <p>จัดเส้นทางจาก Affordability ก่อนคะแนน พร้อมค่าธรรมเนียมอ้างอิงบนวงเงินค้ำที่เข้าเกณฑ์</p>
        </article>
      </section>

      <section className="demo" id="demo">
        <div className="sectionTitle">
          <p>Engine Diagnostic</p>
          <h2>กรอกข้อมูลรายบุคคลแล้วตรวจผลทันที</h2>
        </div>

        <div className="demoGrid">
          <div className="panel">
            <div className="scenarioBar">
              <button onClick={() => setForm({ ...initialForm })}>เคสตั้งต้น</button>
              <button onClick={() => setForm({ ...initialForm, ...examples.ready })}>พร้อมส่งต่อ FI</button>
              <button onClick={() => setForm({ ...initialForm, ...examples.build })}>สร้างความพร้อม</button>
              <button onClick={() => setForm({ ...initialForm, ...examples.noDebt })}>ยังไม่ควรเพิ่มหนี้</button>
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
                    <label>แพ็กเกจแบตเตอรี่รวมค่าไฟหรือไม่
                      <select
                        value={form.energyIncluded}
                        onChange={(e) => update('energyIncluded', e.target.value as ScoreInput['energyIncluded'])}
                      >
                        <option value="excluded">ไม่รวมค่าไฟ / Energy Excluded</option>
                        <option value="included">รวมค่าไฟแล้ว / Energy Included</option>
                      </select>
                    </label>
                  )}
                  {group.title.startsWith('E.') && (
                    <label>เงินดาวน์ผู้ขับ (บาท)
                      <input type="number" value={0} disabled readOnly />
                    </label>
                  )}
                </div>
                {group.title.startsWith('E.') && (
                  <p className="eyebrow" style={{ marginTop: 6 }}>
                    เงินดาวน์ผู้ขับล็อกไว้ที่ 0% เป็นแบบผลิตภัณฑ์หลัก • วงเงินค้ำที่เข้าเกณฑ์ไม่ใช่สิทธิอัตโนมัติ
                    และถูกจำกัดไม่ให้เกินวงเงินสินเชื่อรถ
                  </p>
                )}
              </div>
            ))}

            <div className="eyebrow" style={{ marginTop: 18 }}>F. ค่าธรรมเนียมค้ำประกันอ้างอิง</div>
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
                  <span>Appropriate Route • {result.status}</span>
                  <h2>{routeText(result.readiness.route)}</h2>
                  <p>
                    Pre-Score {result.readiness.readinessScore}/100 (ประกอบการสื่อสาร ไม่ใช่ตัวกำหนดเส้นทาง) •
                    Indicative Tier: {result.readiness.tier}
                  </p>
                  <p>{routeAction(result.readiness.route)}</p>
                </div>

                <div className="kpiGrid">
                  <div><span>Available Cash / วัน</span><b>{baht.format(result.calc.rawAvailDaily)}</b></div>
                  <div><span>DSCR Base</span><b>{result.calc.dscr.toFixed(2)}x</b></div>
                  <div><span>PAI</span><b>{result.calc.pai.toFixed(2)}</b></div>
                  <div>
                    <span>Principal Sustainability</span>
                    <b>{result.calc.maturity <= 1000 ? 'CLOSE' : baht.format(result.calc.maturity)}</b>
                  </div>
                </div>

                <div className="kpiGrid">
                  <div><span>Income Evidence Reliability</span><b>{result.readiness.incomeEvidenceReliability}</b></div>
                  <div><span>Activity Evidence</span><b>{result.readiness.activityEvidenceStatus}</b></div>
                  <div><span>Stress DSCR −15% / −30%</span><b>{result.calc.dscr15.toFixed(2)}x / {result.calc.dscr30.toFixed(2)}x</b></div>
                  <div>
                    <span>TCO เทียบเช่ารถเดิม</span>
                    <b>{result.calc.tcoDelta >= 0 ? '+' : '−'}{baht.format(Math.abs(result.calc.tcoDelta))}</b>
                  </div>
                </div>

                <div className="kpiGrid">
                  <div><span>PAYD Target Preview / วัน</span><b>{baht.format(result.calc.paydTarget)}</b></div>
                  <div><span>PAYD Capacity / วัน</span><b>{baht.format(result.calc.paydCapacity)}</b></div>
                  <div>
                    <span>Reserve สะสม / วัน (Preview)</span>
                    <b>{baht.format(result.calc.reserveContributionPreview)}</b>
                  </div>
                  <div>
                    <span>Reserve Target ({RESERVE_TARGET_DAYS} วัน)</span>
                    <b>{baht.format(result.calc.reserveTarget)}</b>
                  </div>
                </div>

                <div className="kpiGrid">
                  <div><span>วงเงินค้ำที่เข้าเกณฑ์</span><b>{baht.format(result.calc.eligibleGuaranteedAmount)}</b></div>
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
                  <h3>เหตุผลของระบบ</h3>
                  <p>
                    <b>หลักฐานรายได้:</b> {incomeEvidenceText(result.readiness.incomeEvidenceReliability)}<br />
                    <b>หลักฐานกิจกรรม:</b> {activityEvidenceText(result.readiness.activityEvidenceStatus)}
                  </p>
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
                    'กดปุ่ม “คำนวณผ่าน API” เพื่อส่งข้อมูลไปที่ Engine แล้วรับผล Credit Readiness กลับมา'}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
