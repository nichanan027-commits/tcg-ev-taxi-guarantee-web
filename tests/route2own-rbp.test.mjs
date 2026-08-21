import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEMO_CASES,
  FOLLOW_UP_QUESTIONS,
  SCENARIO_V13,
  evaluate,
  fiHandoffDecisionOf,
  followUpSubmissionOf,
  readinessLevelOf
} from '../public/route2own-engine.js';

const dailyFeeExamples = [
  { guaranteedAmount: 800_000, tier: 'A', expected: 26.3 },
  { guaranteedAmount: 800_000, tier: 'B', expected: 32.88 },
  { guaranteedAmount: 800_000, tier: 'C', expected: 39.45 },
  { guaranteedAmount: 900_000, tier: 'A', expected: 29.59 },
  { guaranteedAmount: 900_000, tier: 'B', expected: 36.99 },
  { guaranteedAmount: 900_000, tier: 'C', expected: 44.38 },
  { guaranteedAmount: 1_000_000, tier: 'A', expected: 32.88 },
  { guaranteedAmount: 1_000_000, tier: 'B', expected: 41.1 },
  { guaranteedAmount: 1_000_000, tier: 'C', expected: 49.32 },
  { guaranteedAmount: 1_500_000, tier: 'A', expected: 49.32 },
  { guaranteedAmount: 1_500_000, tier: 'B', expected: 61.64 },
  { guaranteedAmount: 1_500_000, tier: 'C', expected: 73.97 }
];

function roundToSatang(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

test('Daily RBP uses A 1.20%, B 1.50%, C 1.80% on a 365-day basis', () => {
  for (const example of dailyFeeExamples) {
    const result = evaluate({
      ...SCENARIO_V13,
      vehiclePrice: example.guaranteedAmount,
      downPayment: 0,
      loanNeed: example.guaranteedAmount,
      rbpTier: example.tier,
      guaranteeYear: 4
    });

    assert.equal(
      roundToSatang(result.calc.rbpReferenceDay),
      example.expected,
      `${example.tier} at ${example.guaranteedAmount.toLocaleString('en-US')} THB`
    );
  }
});

test('fee waiver changes the customer charge but not the daily RBP reference', () => {
  const waived = evaluate({
    ...SCENARIO_V13,
    vehiclePrice: 900_000,
    loanNeed: 900_000,
    rbpTier: 'C',
    guaranteeYear: 1
  });

  assert.equal(roundToSatang(waived.calc.rbpReferenceDay), 44.38);
  assert.equal(waived.calc.customerRbpDay, 0);
});

test('RBP result exposes the 365-day basis and calibration status', () => {
  const result = evaluate({
    ...SCENARIO_V13,
    vehiclePrice: 900_000,
    loanNeed: 900_000,
    rbpTier: 'A',
    guaranteeYear: 4
  });

  assert.equal(result.calc.rbpDayCountBasis, 365);
  assert.equal(result.calc.rbpStatus, 'Proposed – Calibration Required');
});

test('readiness levels keep Case B on a 30-day plan and still send Case C to FI', () => {
  const boundaries = [
    { score: 100, code: 'READY_TO_OWN', fi: true, planDays: 0 },
    { score: 80, code: 'READY_TO_OWN', fi: true, planDays: 0 },
    { score: 79, code: 'BUILD_READINESS', fi: true, planDays: 30 },
    { score: 60, code: 'BUILD_READINESS', fi: true, planDays: 30 },
    { score: 59, code: 'NEED_SUPPORT', fi: true, planDays: 0 },
    { score: 40, code: 'NEED_SUPPORT', fi: true, planDays: 0 },
    { score: 39, code: 'START_WITH_FOUNDATION', fi: false, planDays: 0 },
    { score: 0, code: 'START_WITH_FOUNDATION', fi: false, planDays: 0 }
  ];

  for (const expected of boundaries) {
    const level = readinessLevelOf(expected.score);
    assert.equal(level.code, expected.code, `score ${expected.score}`);
    assert.equal(level.fiHandoffEligible, expected.fi, `FI handoff at score ${expected.score}`);
    assert.equal(level.planDays, expected.planDays, `plan days at score ${expected.score}`);
  }
});

test('readiness score is the visible sum of five weighted components', () => {
  const result = evaluate({ ...SCENARIO_V13, guaranteeYear: 4 });
  const breakdown = result.readiness.breakdown;

  assert.deepEqual(
    breakdown.map(({ id, maxPoints }) => [id, maxPoints]),
    [
      ['work_continuity', 25],
      ['income_quality', 25],
      ['cashflow_capacity', 25],
      ['documents_partner', 15],
      ['continuous_readiness', 10]
    ]
  );
  assert.equal(
    breakdown.reduce((total, component) => total + component.points, 0),
    result.readiness.readinessScore
  );
  assert.ok(breakdown.every((component) => component.points >= 0 && component.points <= component.maxPoints));
  assert.ok(breakdown.every((component) => component.explanation && component.improvementActions.length > 0));
  assert.equal(result.readiness.recommendations.length, 3);
});

test('ready-made demo cases cover the four public readiness outcomes', () => {
  const expectedLevels = {
    A: 'READY_TO_OWN',
    B: 'BUILD_READINESS',
    C: 'NEED_SUPPORT',
    F: 'START_WITH_FOUNDATION'
  };

  for (const [caseId, expectedLevel] of Object.entries(expectedLevels)) {
    const result = evaluate(DEMO_CASES[caseId].input);
    assert.equal(result.readiness.level.code, expectedLevel, `demo case ${caseId}`);
    assert.equal(result.readiness.preScore.status, 'COMPLETED', `pre-score status for case ${caseId}`);
    assert.ok(
      result.readiness.preScore.score >= 0 && result.readiness.preScore.score <= 100,
      `pre-score range for case ${caseId}`
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
  assert.equal(
    followUpSubmissionOf({ incomeOutlook: 'ใกล้เคียงเดิม' }, true).status,
    'READY'
  );
});

test('pre-scoring still completes when integrity needs review but FI handoff remains blocked', () => {
  const result = evaluate(DEMO_CASES.A.input);
  assert.equal(result.readiness.preScore.status, 'COMPLETED');
  assert.equal(fiHandoffDecisionOf(result.readiness.readinessScore, false).eligible, false);
  assert.equal(fiHandoffDecisionOf(result.readiness.readinessScore, false).reason, 'INTEGRITY_REVIEW');
  assert.equal(fiHandoffDecisionOf(result.readiness.readinessScore, true).eligible, true);
});

test('demo B and C explain the approved FI handoff policy', () => {
  const build = evaluate(DEMO_CASES.B.input);
  const support = evaluate(DEMO_CASES.C.input);

  assert.ok(build.reasons.some((reason) => reason.includes('FI') && reason.includes('30 วัน')));
  assert.ok(support.reasons.some((reason) => reason.includes('FI') && reason.includes('Need Support')));
});
