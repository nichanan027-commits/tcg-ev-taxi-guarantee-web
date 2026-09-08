import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEMO_CASES,
  FOLLOW_UP_QUESTIONS,
  RBP_DAY_COUNT_BASIS,
  RBP_RATE,
  RBP_STATUS,
  ROUTES,
  SCENARIO_COMPETITION,
  evaluate,
  followUpSubmissionOf
} from '../public/route2own-engine.js';

const dailyFeeExamples = [
  { eligibleGuaranteedAmount: 800_000, tier: 'A', expected: 26.3 },
  { eligibleGuaranteedAmount: 800_000, tier: 'B', expected: 32.88 },
  { eligibleGuaranteedAmount: 800_000, tier: 'C', expected: 39.45 },
  { eligibleGuaranteedAmount: 900_000, tier: 'A', expected: 29.59 },
  { eligibleGuaranteedAmount: 900_000, tier: 'B', expected: 36.99 },
  { eligibleGuaranteedAmount: 900_000, tier: 'C', expected: 44.38 },
  { eligibleGuaranteedAmount: 1_000_000, tier: 'A', expected: 32.88 },
  { eligibleGuaranteedAmount: 1_000_000, tier: 'B', expected: 41.1 },
  { eligibleGuaranteedAmount: 1_000_000, tier: 'C', expected: 49.32 },
  { eligibleGuaranteedAmount: 1_500_000, tier: 'A', expected: 49.32 },
  { eligibleGuaranteedAmount: 1_500_000, tier: 'B', expected: 61.64 },
  { eligibleGuaranteedAmount: 1_500_000, tier: 'C', expected: 73.97 }
];

function roundToSatang(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

test('Daily RBP uses A 1.20%, B 1.50%, C 1.80% on a 365-day basis', () => {
  for (const example of dailyFeeExamples) {
    const result = evaluate({
      ...SCENARIO_COMPETITION,
      vehiclePrice: example.eligibleGuaranteedAmount,
      eligibleGuaranteedAmount: example.eligibleGuaranteedAmount,
      rbpTier: example.tier,
      guaranteeYear: 4
    });

    assert.equal(
      roundToSatang(result.calc.rbpReferenceDay),
      example.expected,
      `${example.tier} at ${example.eligibleGuaranteedAmount.toLocaleString('en-US')} THB`
    );
  }
});

test('the reference fee is charged on the eligible guarantee base, not the whole loan', () => {
  const partial = evaluate({
    ...SCENARIO_COMPETITION,
    vehiclePrice: 900_000,
    eligibleGuaranteedAmount: 450_000,
    rbpTier: 'B',
    guaranteeYear: 4
  });

  assert.equal(partial.calc.eligibleGuaranteedAmount, 450_000);
  assert.equal(roundToSatang(partial.calc.rbpReferenceDay), roundToSatang((450_000 * 0.015) / 365));
});

test('fee waiver changes the customer charge but not the daily RBP reference', () => {
  // Fee Waiver ปิดเป็นค่าตั้งต้น จึงต้องเปิดอย่างจงใจในฐานะ Scenario option
  const waived = evaluate({
    ...SCENARIO_COMPETITION,
    vehiclePrice: 900_000,
    eligibleGuaranteedAmount: 900_000,
    rbpTier: 'C',
    guaranteeYear: 1,
    feeWaiverEnabled: true
  });

  assert.equal(roundToSatang(waived.calc.rbpReferenceDay), 44.38);
  assert.equal(waived.calc.customerRbpDay, 0);

  const notWaived = evaluate({
    ...SCENARIO_COMPETITION,
    vehiclePrice: 900_000,
    eligibleGuaranteedAmount: 900_000,
    rbpTier: 'C',
    guaranteeYear: 1
  });
  assert.equal(roundToSatang(notWaived.calc.rbpReferenceDay), 44.38);
  assert.equal(notWaived.calc.customerRbpDay, notWaived.calc.rbpReferenceDay);
});

test('RBP result exposes the 365-day basis and the competition parameter status', () => {
  const result = evaluate({
    ...SCENARIO_COMPETITION,
    vehiclePrice: 900_000,
    rbpTier: 'A',
    guaranteeYear: 4
  });

  assert.equal(result.calc.rbpDayCountBasis, 365);
  assert.equal(RBP_DAY_COUNT_BASIS, 365);
  assert.equal(result.calc.rbpStatus, RBP_STATUS);
  assert.match(RBP_STATUS, /Competition Design Parameter/);
  assert.deepEqual(RBP_RATE, { A: 0.012, B: 0.015, C: 0.018 });
});

test('the demo cases cover exactly the three frozen routes', () => {
  const expected = {
    READY: ROUTES.READY_FOR_FI,
    BUILD: ROUTES.BUILD_READINESS,
    NODEBT: ROUTES.NO_NEW_DEBT
  };

  assert.deepEqual(Object.keys(DEMO_CASES).sort(), Object.keys(expected).sort());

  for (const [id, route] of Object.entries(expected)) {
    const result = evaluate(DEMO_CASES[id].input);
    assert.equal(result.readiness.route, route, `demo case ${id}`);
    assert.equal(result.readiness.preScore.status, 'COMPLETED', `pre-score for case ${id}`);
    assert.ok(
      result.readiness.readinessScore >= 0 && result.readiness.readinessScore <= 100,
      `pre-score range for case ${id}`
    );
  }
});

test('the five follow-up questions allow skipping and require separate consent before submission', () => {
  assert.equal(FOLLOW_UP_QUESTIONS.length, 5);
  assert.ok(FOLLOW_UP_QUESTIONS.every((question) => question.options.includes('ข้ามตอนนี้')));

  assert.equal(followUpSubmissionOf({}, false).status, 'SKIPPED');
  assert.equal(
    followUpSubmissionOf({ incomeOutlook: 'ใกล้เคียงเดิม' }, false).status,
    'CONSENT_REQUIRED'
  );
  assert.equal(followUpSubmissionOf({ incomeOutlook: 'ใกล้เคียงเดิม' }, true).status, 'READY');
});

test('demo reasons explain the route in frozen language', () => {
  const build = evaluate(DEMO_CASES.BUILD.input);
  const noDebt = evaluate(DEMO_CASES.NODEBT.input);

  assert.ok(build.reasons.some((reason) => reason.includes('Income Evidence Reliability')));
  assert.ok(noDebt.reasons.some((reason) => reason.includes('Affordability')));
});
