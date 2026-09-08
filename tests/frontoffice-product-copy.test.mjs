import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/route2own.html', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../public/route2own-engine.js', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const legacy = readFileSync(new URL('../app/legacy-score/page.tsx', import.meta.url), 'utf8');
const scoreApi = readFileSync(new URL('../app/api/score/route.ts', import.meta.url), 'utf8');

test('front office drops the retired four-outcome vocabulary', () => {
  assert.doesNotMatch(html, /Ready to Own/);
  assert.doesNotMatch(html, /Need Support/);
  assert.doesNotMatch(html, /Start with Foundation/);
  assert.doesNotMatch(html, /OWN READY/);
});

test('front office drops hard-coded guarantee coverage and fixed scenario costs', () => {
  assert.doesNotMatch(html, /Guarantee Coverage[^<]{0,40}100/i);
  assert.doesNotMatch(html, /ค้ำ 100%/);
  assert.doesNotMatch(html, /BaaS 400/);
  assert.doesNotMatch(html, /Cure Reserve/i);
  assert.doesNotMatch(html, /Monitoring \/ Eligible Day/);
});

test('front office carries the frozen product status and the three routes', () => {
  assert.match(html, /FINAL \/ FROZEN FOR COMPETITION/);
  assert.match(html, /READY FOR FI/);
  assert.match(html, /BUILD READINESS/);
  assert.match(html, /NO NEW DEBT/);
});

test('front office states the frozen brand and the 0% down proposition', () => {
  assert.match(html, /Route to Own by บสย\./);
  assert.match(html, /เงินดาวน์ 0% แต่ไม่ใช่ความเสี่ยง 0%/);
});

test('front office separates vehicle price from battery service cost', () => {
  assert.match(html, /id="batteryServiceDaily"/);
  // ช่องนี้สร้างผ่าน stepField() จึงยืนยันที่จุดเรียกใช้ ไม่ใช่ที่ literal id
  assert.match(html, /stepField\('eligibleGuaranteedAmount'/);
  assert.match(html, /id="eligibleGuaranteedAmountCalc"/);
  assert.match(html, /<input id="downPayment"[^>]*disabled/);
});

test('front office labels PAYD as a preview and defers the sweep to post-approval', () => {
  assert.match(html, /PAYD Target/);
  assert.match(html, /Actual Sweep/);
  assert.match(html, /หลัง FI อนุมัติ/);
});

test('front office keeps post-approval modules out of this repository', () => {
  assert.doesNotMatch(html, /PromptCure/);
  assert.doesNotMatch(html, /Control Tower/);
  assert.doesNotMatch(html, /Claim Cap/i);
  assert.doesNotMatch(html, /Sinking Fund/i);
});

test('partner gateway shows DLT as a regulatory evidence layer, not a commercial partner', () => {
  assert.match(html, /Regulatory Evidence Layer/);
  assert.match(html, /Battery Swap Provider/);
  assert.match(html, /Payment Servicer/);
});

test('engine and docs no longer advertise the retired constants', () => {
  assert.doesNotMatch(engine, /GUARANTEE_COVERAGE/);
  assert.doesNotMatch(engine, /MONITORING_DAILY/);
  assert.doesNotMatch(engine, /CURE_RESERVE_CAP/);
  assert.match(readme, /FINAL \/ FROZEN FOR COMPETITION/);
});

test('legacy score drops the portfolio dashboard that contradicts the frozen model', () => {
  assert.doesNotMatch(legacy, /portfolio/i);
  assert.doesNotMatch(legacy, /จำนวนรถ Pilot/);
  assert.doesNotMatch(legacy, /Claim Cap/i);
  assert.doesNotMatch(legacy, /Sinking Fund/i);
  assert.doesNotMatch(legacy, /0\.092|9\.2%/);
  assert.doesNotMatch(legacy, /ค้ำ 100%/);
  assert.match(legacy, /Engine Diagnostic View/);
});

test('the UI never renders a negative Available Cash from the raw diagnostic', () => {
  // ทุกจุดที่พิมพ์คำว่า Available Cash ต้องผูกกับ availableCash ไม่ใช่ rawAvailDaily
  assert.doesNotMatch(html, /rawAvailDaily/);
  assert.doesNotMatch(legacy, /rawAvailDaily/);
  assert.match(html, /money\(availableCash\)|money0\(c\.availableCash\)|'฿'\+money0\(c\.availableCash\)/);
  assert.match(legacy, /result\.calc\.availableCash/);
});

test('the public /api/score payload omits the internal raw diagnostic', () => {
  // rawAvailDaily ต้องถูกถอดออกก่อน serialize และต้องไม่ถูกส่งกลับใน calc
  assert.match(scoreApi, /const \{ rawAvailDaily, \.\.\.publicCalc \} = calc;/);
  assert.match(scoreApi, /calc: publicCalc/);
  assert.doesNotMatch(scoreApi, /^\s*calc,\s*$/m);
  // ค่าที่ใช้แสดงผลต้องยังอยู่ครบใน publicCalc ผ่าน engine
  assert.match(engine, /availableCash,/);
  assert.match(engine, /cashShortfallBeforeObligations,/);
});

test('the allocation chart reads the same engine values as the Daily Financial X-Ray', () => {
  const chart = html.slice(
    html.indexOf('function allocationChart('),
    html.indexOf('function ', html.indexOf('function allocationChart(') + 10)
  );
  assert.ok(chart.length > 0, 'allocationChart() must exist');

  // Customer RBP และ Adaptive Payment Reserve ต้องเป็นคนละ segment
  assert.match(chart, /\{k:'Customer RBP',v:c\.customerRbpDay,/);
  assert.match(chart, /\{k:'Adaptive Payment Reserve Preview',v:c\.reserveContributionPreview,/);

  // เงินคงเหลือและส่วนที่ขาดต้องมาจาก Engine SSOT ตัวเดียวกับ Waterfall
  assert.match(chart, /c\.residualCash/);
  assert.match(chart, /c\.affordabilityGap/);

  // ห้ามยุบ RBP เข้าไปในก้อน Reserve และห้ามใช้ marginDaily เป็น Residual
  assert.doesNotMatch(chart, /reserveContributionPreview\s*\+\s*c\.customerRbpDay/);
  assert.doesNotMatch(chart, /customerRbpDay\s*\+\s*c\.reserveContributionPreview/);
  assert.doesNotMatch(chart, /k:'Residual Cash[^}]*marginDaily/);
  assert.doesNotMatch(chart, /marginDaily[^}]*k:'Residual Cash/);

  // ส่วนที่ขาดต้องถูกเรียกว่า Affordability Gap ไม่ใช่ Residual
  assert.match(chart, /Affordability Gap/);

  // marginDaily ยังอยู่ได้ แต่ต้องใช้เฉพาะข้อความ Break-even
  assert.match(chart, /breakeven-note/);
});

test('the affordability gap is an overlay on the uncovered obligations, never an extra segment', () => {
  const chart = html.slice(
    html.indexOf('function allocationChart('),
    html.indexOf('function ', html.indexOf('function allocationChart(') + 10)
  );

  // segsTotal รวม PAYD + RBP + Reserve อยู่แล้ว การบวก gap เข้าไปในสเกลคือการนับซ้ำ
  assert.doesNotMatch(chart, /segsTotal\s*\+\s*gapDaily/);
  assert.match(chart, /const scale=Math\.max\(c\.verified,be\.dailyObligation,segsTotal,1\)/);

  // hatch ต้องเริ่มที่จุดที่เงินของผู้ขับหมด ไม่ใช่ต่อท้าย segment สุดท้าย
  assert.match(
    chart,
    /const affordabilityStart=c\.dailyOpEx\+c\.protectedDaily\+c\.availableCash;/
  );
  assert.match(chart, /x="\$\{\(\(affordabilityStart\/scale\)\*W\)\.toFixed\(1\)\}"/);
  assert.doesNotMatch(chart, /x="\$\{\(\(segsTotal\/scale\)\*W\)/);

  // ความกว้างของ hatch ต้องเท่ากับ affordabilityGap ตรง ๆ
  assert.match(chart, /width="\$\{\(\(gapDaily\/scale\)\*W\)\.toFixed\(1\)\}"/);

  // เส้นบอกรายได้ที่ Verify ได้ต้องยังอยู่
  assert.match(chart, /stroke-dasharray/);
  assert.match(chart, /incomeMark/);

  // metadata สำหรับ browser test — ต้องผูกกับ data-role ไม่ใช่สีหรือ <title>
  assert.match(chart, /data-role="affordability-gap"/);
  assert.match(chart, /data-role="verified-income-marker"/);
  // hatch ต้องถูกวาดเฉพาะเมื่อขาดจริง จึงอยู่ในฝั่ง truthy ของ gapDaily>0 เท่านั้น
  assert.match(chart, /const deficit=gapDaily>0\?`<rect data-role="affordability-gap"/);
  assert.match(chart, /height="\$\{H\}" fill="url\(#v4hatch\)"><title>Affordability Gap:[^`]*`:''/);
});

test('principal sustainability status comes from the engine boolean, not a local threshold', () => {
  assert.doesNotMatch(html, /maturity\s*<=?\s*1000/);
  assert.doesNotMatch(legacy, /maturity\s*<=?\s*1000/);
  assert.match(html, /principalSustainabilityPassed/);
  assert.match(legacy, /principalSustainabilityPassed/);
});

test('the calculator prints the public route label, never the internal code', () => {
  assert.match(html, /<span>Appropriate Route<\/span><b>\$\{routeLabel\}<\/b>/);
  assert.match(html, /routeLabelOf\(/);
});

test('the fee waiver is presented as proposed and off by default', () => {
  assert.match(html, /Proposed \/ Not Frozen/);
  assert.match(html, /feeWaiverApplied/);
  assert.match(legacy, /FEE_WAIVER_STATUS/);
});

test('design parameters are surfaced with their calibration status', () => {
  assert.match(html, /Competition Design Parameters/);
  assert.match(html, /Pilot Calibration after Selection/);
  assert.match(html, /ไม่ใช่กติกาการพิจารณาสินเชื่อขั้นสุดท้ายของสถาบันการเงิน/);
  assert.match(legacy, /Competition Design Parameters/);
  assert.match(readme, /Pilot Calibration after Selection/);
});

test('the observed daily revenue is labelled as a field-survey input, not a market average', () => {
  assert.match(html, /Observed Input/);
  assert.match(html, /ชุดสำรวจภาคสนามของโครงการ/);
  assert.match(html, /ไม่ใช่ค่าเฉลี่ยแท็กซี่ทั้งตลาด/);
  // ต้องแยก Observed Input ออกจากป้าย Simulation ไม่ปนกันในประโยคเดียว
  assert.match(html, /Illustrative \/ Competition Simulation/);
});
