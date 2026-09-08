import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/route2own.html', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../public/route2own-engine.js', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const legacy = readFileSync(new URL('../app/legacy-score/page.tsx', import.meta.url), 'utf8');

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
