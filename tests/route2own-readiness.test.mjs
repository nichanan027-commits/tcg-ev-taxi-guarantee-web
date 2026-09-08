import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ROUTES,
  ROUTE_LABELS,
  appropriateRouteOf,
  activityEvidenceStatusOf,
  evaluate,
  fiHandoffDecisionOf,
  incomeEvidenceReliabilityOf,
  routeLabelOf
} from '../public/route2own-engine.js';

const AFFORDABLE = { grossDaily: 2200, verifiedPct: 95, gpsComplete: 95, vehiclePrice: 800000 };
// รายได้สูงพอให้ผ่าน Affordability แม้ตรวจสอบย้อนกลับได้เพียงครึ่งเดียว
const AFFORDABLE_LOW_EVIDENCE = { ...AFFORDABLE, grossDaily: 3200, verifiedPct: 50 };

test('the public route contract contains only the three frozen routes', () => {
  const scenarios = [
    evaluate({ ...AFFORDABLE }),
    evaluate({ ...AFFORDABLE_LOW_EVIDENCE }),
    evaluate({ ...AFFORDABLE, grossDaily: 900 })
  ];

  const allowed = new Set([ROUTES.READY_FOR_FI, ROUTES.BUILD_READINESS, ROUTES.NO_NEW_DEBT]);
  for (const result of scenarios) {
    assert.ok(allowed.has(result.readiness.route), `unexpected route ${result.readiness.route}`);
  }
});

test('affordability decides the route before the pre-score does', () => {
  // หลักฐานรายได้เกือบสมบูรณ์ แต่กระแสเงินสดไม่ไหว — คะแนนสูงต้องไม่ยกระดับเส้นทาง
  const result = evaluate({ ...AFFORDABLE, grossDaily: 900, verifiedPct: 99, gpsComplete: 99 });
  assert.equal(result.readiness.route, ROUTES.NO_NEW_DEBT);
});

test('weak income evidence holds an affordable applicant at build readiness', () => {
  const result = evaluate({ ...AFFORDABLE_LOW_EVIDENCE });
  assert.ok(result.calc.dscr >= 1, `expected an affordable case, got DSCR ${result.calc.dscr}`);
  assert.equal(result.readiness.route, ROUTES.BUILD_READINESS);
  assert.equal(result.readiness.incomeEvidenceReliability, 'LOW');
});

test('FI handoff opens only for READY FOR FI and only when integrity passed', () => {
  assert.deepEqual(fiHandoffDecisionOf(ROUTES.READY_FOR_FI, true), {
    eligible: true,
    reason: 'READY_FOR_FI'
  });
  assert.deepEqual(fiHandoffDecisionOf(ROUTES.READY_FOR_FI, false), {
    eligible: false,
    reason: 'INTEGRITY_REVIEW'
  });
  assert.deepEqual(fiHandoffDecisionOf(ROUTES.BUILD_READINESS, true), {
    eligible: false,
    reason: 'BUILD_READINESS'
  });
  assert.deepEqual(fiHandoffDecisionOf(ROUTES.NO_NEW_DEBT, true), {
    eligible: false,
    reason: 'NO_NEW_DEBT'
  });
});

test('activity data never raises income evidence reliability', () => {
  const rich = evaluate({ ...AFFORDABLE, verifiedPct: 85, gpsComplete: 95 });
  const sparse = evaluate({ ...AFFORDABLE, verifiedPct: 85, gpsComplete: 20 });

  assert.equal(rich.readiness.incomeEvidenceReliability, sparse.readiness.incomeEvidenceReliability);
  assert.notEqual(rich.readiness.activityEvidenceStatus, sparse.readiness.activityEvidenceStatus);
});

test('evidence helpers band on their own input only', () => {
  assert.equal(incomeEvidenceReliabilityOf(95), 'HIGH');
  assert.equal(incomeEvidenceReliabilityOf(70), 'MEDIUM');
  assert.equal(incomeEvidenceReliabilityOf(69), 'LOW');

  assert.equal(activityEvidenceStatusOf(95), 'CONSISTENT');
  assert.equal(activityEvidenceStatusOf(70), 'REVIEW');
  assert.equal(activityEvidenceStatusOf(69), 'LIMITED');
});

test('the route engine takes explicit gates and holds no policy threshold of its own', () => {
  const pass = { affordabilityPassed: true, principalSustainabilityPassed: true };
  assert.equal(
    appropriateRouteOf({ ...pass, affordabilityPassed: false, incomeEvidenceReliability: 'HIGH' }),
    ROUTES.NO_NEW_DEBT
  );
  assert.equal(
    appropriateRouteOf({ ...pass, principalSustainabilityPassed: false, incomeEvidenceReliability: 'HIGH' }),
    ROUTES.NO_NEW_DEBT
  );
  assert.equal(
    appropriateRouteOf({ ...pass, incomeEvidenceReliability: 'LOW' }),
    ROUTES.BUILD_READINESS
  );
  assert.equal(
    appropriateRouteOf({ ...pass, incomeEvidenceReliability: 'MEDIUM' }),
    ROUTES.READY_FOR_FI
  );
});

test('the engine reports the gates it used, so routing stays auditable', () => {
  const ready = evaluate({ ...AFFORDABLE });
  assert.equal(ready.calc.affordabilityPassed, true);
  assert.equal(ready.calc.principalSustainabilityPassed, true);

  const noDebt = evaluate({ ...AFFORDABLE, grossDaily: 900 });
  assert.equal(noDebt.calc.affordabilityPassed, false);
});

test('the public route label is separate from the internal route code', () => {
  assert.equal(ROUTES.BUILD_READINESS, 'BUILD READINESS');
  assert.equal(ROUTE_LABELS[ROUTES.BUILD_READINESS], 'BUILD READINESS / CONTINUE TO LEASE');
  assert.equal(routeLabelOf(ROUTES.BUILD_READINESS), 'BUILD READINESS / CONTINUE TO LEASE');
  assert.equal(routeLabelOf(ROUTES.READY_FOR_FI), 'READY FOR FI');
  assert.equal(routeLabelOf(ROUTES.NO_NEW_DEBT), 'NO NEW DEBT');
});

test('an indicative tier is offered only when the route is READY FOR FI', () => {
  const ready = evaluate({ ...AFFORDABLE });
  assert.equal(ready.readiness.route, ROUTES.READY_FOR_FI);
  assert.ok(['A', 'B', 'C'].includes(ready.readiness.tier));

  const notReady = evaluate({ ...AFFORDABLE, grossDaily: 900 });
  assert.equal(notReady.readiness.tier, '—');
});

test('the pre-score stays visible and explainable but never routes', () => {
  const result = evaluate({ ...AFFORDABLE, grossDaily: 900, verifiedPct: 99, gpsComplete: 99 });
  assert.equal(result.readiness.preScore.status, 'COMPLETED');
  assert.ok(result.readiness.readinessScore >= 0 && result.readiness.readinessScore <= 100);
  assert.equal(result.readiness.breakdown.length, 5);
  assert.equal(result.readiness.route, ROUTES.NO_NEW_DEBT);
});
