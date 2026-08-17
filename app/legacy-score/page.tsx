'use client';

import { useMemo, useState } from 'react';

type Decision = 'APPROVE_FOR_PILOT' | 'WATCHLIST' | 'REJECT';

type ScoreResult = {
  decision: Decision;
  tier: 'A' | 'B' | 'C' | 'REJECT';
  annualFeeRate: number;
  dailyFee: number;
  monthlyGrossIncome: number;
  netIncome: number;
  dscr: number;
  stressDscr: number;
  readinessScore: number;
  reasons: string[];
};

type FormState = {
  driverName: string;
  coopName: string;
  isMember: boolean;
  hasCertificate: boolean;
  consent: boolean;
  dailyIncome: number;
  drivingDays: number;
  energyCost: number;
  fixedCost: number;
  monthlyInstallment: number;
  guaranteeAmount: number;
  tcgScore: number;
  stressDropPercent: number;
  chargingReady: 'ready' | 'pending' | 'not_ready';
};

const initialForm: FormState = {
  driverName: 'คุณสมชาย EV Taxi',
  coopName: 'สหกรณ์แท็กซี่เมืองใหม่',
  isMember: true,
  hasCertificate: true,
  consent: true,
  dailyIncome: 1850,
  drivingDays: 25,
  energyCost: 280,
  fixedCost: 5200,
  monthlyInstallment: 23500,
  guaranteeAmount: 800000,
  tcgScore: 82,
  stressDropPercent: 20,
  chargingReady: 'ready'
};

const examples: Record<string, Partial<FormState>> = {
  strong: {
    driverName: 'คุณอนันต์ วินัยดี',
    dailyIncome: 2200,
    drivingDays: 26,
    energyCost: 260,
    fixedCost: 4700,
    monthlyInstallment: 22000,
    guaranteeAmount: 780000,
    tcgScore: 88,
    chargingReady: 'ready'
  },
  standard: initialForm,
  watch: {
    driverName: 'คุณมานะ รอตรวจสอบ',
    dailyIncome: 1650,
    drivingDays: 24,
    energyCost: 310,
    fixedCost: 5900,
    monthlyInstallment: 25000,
    guaranteeAmount: 850000,
    tcgScore: 72,
    hasCertificate: false,
    chargingReady: 'pending'
  },
  reject: {
    driverName: 'คุณเดชา รายได้ผันผวน',
    dailyIncome: 1300,
    drivingDays: 20,
    energyCost: 340,
    fixedCost: 6700,
    monthlyInstallment: 27500,
    guaranteeAmount: 900000,
    tcgScore: 56,
    chargingReady: 'not_ready'
  }
};

const baht = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0
});

function formatNumber(value: number) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(value || 0);
}

function decisionText(decision: Decision) {
  if (decision === 'APPROVE_FOR_PILOT') return 'ผ่านทดลอง Pilot';
  if (decision === 'WATCHLIST') return 'ผ่านแบบต้องติดตาม';
  return 'ไม่ผ่านเบื้องต้น';
}

function decisionClass(decision: Decision) {
  if (decision === 'APPROVE_FOR_PILOT') return 'decision approve';
  if (decision === 'WATCHLIST') return 'decision watch';
  return 'decision reject';
}

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);

  const portfolio = useMemo(() => {
    const cars = 500;
    const exposure = cars * form.guaranteeAmount;
    const maxClaim = exposure * 0.2;
    const feePool = exposure * 0.0155 * 6;
    const sinkingFund = exposure * 0.092;
    return { cars, exposure, maxClaim, feePool, sinkingFund };
  }, [form.guaranteeAmount]);

  async function calculate() {
    setLoading(true);
    const response = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = (await response.json()) as ScoreResult;
    setResult(data);
    setLoading(false);
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
            <strong>TCG Co-op EV Taxi Guarantee</strong>
            <span>Advanced Vercel Prototype</span>
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
          <div className="eyebrow">BLUE • WHITE • NEON GREEN • STANDARD FONT</div>
          <h1>เปลี่ยนรายได้รายวัน<br /><span>ให้เป็นเครดิตยุคใหม่</span></h1>
          <p>
            โค้ดต้นแบบสำหรับนำขึ้น Vercel โดยตรง ธีมฟ้า-ขาว-เขียวนีออนแบบสุภาพ
            ใช้ฟอนต์มาตรฐานของระบบ ไม่ต้องโหลดฟอนต์ภายนอก และมี API สำหรับคำนวณคะแนนเบื้องต้น
          </p>
          <div className="actions">
            <a className="button" href="#demo">เริ่มทดลอง</a>
            <a className="button ghost" href="#deploy">ดูวิธี Deploy</a>
          </div>
          <div className="heroStats">
            <div><b>500</b><span>รถใน Pilot</span></div>
            <div><b>20%</b><span>Max Claim Cap</span></div>
            <div><b>API</b><span>Vercel Function</span></div>
          </div>
        </div>

        <div className="controlCard">
          <div className="radar">
            <div className="scanLine" />
            <div className="evCar">EV</div>
          </div>
          <div className="statusRows">
            <div><span>System</span><b>Ready</b></div>
            <div><span>Theme</span><b>Blue / White / Neon Green</b></div>
            <div><span>Deploy Target</span><b>Vercel + Next.js</b></div>
          </div>
        </div>
      </section>

      <section className="modules">
        <article>
          <span>01</span>
          <h3>Landing Page</h3>
          <p>หน้าแรกสำหรับอธิบายโครงการให้คนทั่วไปเข้าใจเร็ว ดูน่าเชื่อถือและทันสมัย</p>
        </article>
        <article>
          <span>02</span>
          <h3>Smart Form</h3>
          <p>กรอกข้อมูลผู้ขับ รายได้ ต้นทุน ค่างวด TCG Score และความพร้อมด้านสถานีชาร์จ</p>
        </article>
        <article>
          <span>03</span>
          <h3>Scoring API</h3>
          <p>คำนวณ DSCR, Stress DSCR, Risk Tier และค่าธรรมเนียมรายวันผ่าน API route</p>
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
              <button onClick={() => setForm({ ...form, ...examples.strong })}>เคสแข็งแรง</button>
              <button onClick={() => setForm({ ...form, ...examples.standard })}>เคสมาตรฐาน</button>
              <button onClick={() => setForm({ ...form, ...examples.watch })}>ต้องติดตาม</button>
              <button onClick={() => setForm({ ...form, ...examples.reject })}>ไม่ผ่าน</button>
            </div>

            <div className="formGrid">
              <label>ชื่อผู้ขับ
                <input value={form.driverName} onChange={(e) => update('driverName', e.target.value)} />
              </label>
              <label>สหกรณ์
                <input value={form.coopName} onChange={(e) => update('coopName', e.target.value)} />
              </label>
              <label>เป็นสมาชิกสหกรณ์
                <select value={form.isMember ? 'yes' : 'no'} onChange={(e) => update('isMember', e.target.value === 'yes')}>
                  <option value="yes">ใช่</option>
                  <option value="no">ไม่ใช่</option>
                </select>
              </label>
              <label>มี Pre-Scored Certificate
                <select value={form.hasCertificate ? 'yes' : 'no'} onChange={(e) => update('hasCertificate', e.target.value === 'yes')}>
                  <option value="yes">มี</option>
                  <option value="no">ยังไม่มี</option>
                </select>
              </label>
              <label>รายได้เฉลี่ยต่อวัน
                <input type="number" value={form.dailyIncome} onChange={(e) => update('dailyIncome', Number(e.target.value))} />
              </label>
              <label>วันที่ขับจริงต่อเดือน
                <input type="number" value={form.drivingDays} onChange={(e) => update('drivingDays', Number(e.target.value))} />
              </label>
              <label>ค่าไฟ/พลังงานต่อวัน
                <input type="number" value={form.energyCost} onChange={(e) => update('energyCost', Number(e.target.value))} />
              </label>
              <label>ต้นทุนคงที่ต่อเดือน
                <input type="number" value={form.fixedCost} onChange={(e) => update('fixedCost', Number(e.target.value))} />
              </label>
              <label>ค่างวดต่อเดือน
                <input type="number" value={form.monthlyInstallment} onChange={(e) => update('monthlyInstallment', Number(e.target.value))} />
              </label>
              <label>วงเงินค้ำประกัน
                <input type="number" value={form.guaranteeAmount} onChange={(e) => update('guaranteeAmount', Number(e.target.value))} />
              </label>
              <label>TCG Score
                <input type="number" value={form.tcgScore} onChange={(e) => update('tcgScore', Number(e.target.value))} />
              </label>
              <label>Stress Test รายได้ลดลง %
                <input type="number" value={form.stressDropPercent} onChange={(e) => update('stressDropPercent', Number(e.target.value))} />
              </label>
              <label>Charging Readiness
                <select value={form.chargingReady} onChange={(e) => update('chargingReady', e.target.value as FormState['chargingReady'])}>
                  <option value="ready">พร้อม</option>
                  <option value="pending">รอตรวจสอบ</option>
                  <option value="not_ready">ยังไม่พร้อม</option>
                </select>
              </label>
              <label>ยินยอมให้ใช้ข้อมูล
                <select value={form.consent ? 'yes' : 'no'} onChange={(e) => update('consent', e.target.value === 'yes')}>
                  <option value="yes">ยินยอม</option>
                  <option value="no">ไม่ยินยอม</option>
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
                <div className={decisionClass(result.decision)}>
                  <span>ผลประเมิน</span>
                  <h2>{decisionText(result.decision)}</h2>
                  <p>Tier: {result.tier} • Readiness Score: {result.readinessScore}/100</p>
                </div>

                <div className="kpiGrid">
                  <div><span>รายได้สุทธิ</span><b>{baht.format(result.netIncome)}</b></div>
                  <div><span>DSCR</span><b>{result.dscr.toFixed(2)}x</b></div>
                  <div><span>Stress DSCR</span><b>{result.stressDscr.toFixed(2)}x</b></div>
                  <div><span>Micro-Sweep</span><b>{result.dailyFee > 0 ? baht.format(result.dailyFee) + '/วัน' : '—'}</b></div>
                </div>

                <div className="reasonBox">
                  <h3>เหตุผลของระบบ</h3>
                  <ul>
                    {result.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>
              </>
            ) : (
              <div className="emptyState">
                <h2>ยังไม่ได้คำนวณ</h2>
                <p>กดปุ่ม “คำนวณผ่าน API” เพื่อส่งข้อมูลไปที่ Vercel Function แล้วรับผลประเมินกลับมา</p>
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
          <div><span>วงเงินค้ำรวม</span><b>{baht.format(portfolio.exposure)}</b></div>
          <div><span>Claim Cap 20%</span><b>{baht.format(portfolio.maxClaim)}</b></div>
          <div><span>Fee Pool 6 ปี</span><b>{baht.format(portfolio.feePool)}</b></div>
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
