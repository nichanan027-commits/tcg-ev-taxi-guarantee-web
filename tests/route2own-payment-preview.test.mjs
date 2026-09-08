import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTIVITY_EVIDENCE_THRESHOLDS,
  CALIBRATION_STATUS,
  COMPETITION_DESIGN_PARAMETERS,
  DSCR_GATE,
  ELIGIBLE_GUARANTEE_DESIGN_PARAMETER,
  INCOME_EVIDENCE_THRESHOLDS,
  RESERVE_CONTRIBUTION_RATE,
  RESERVE_TARGET_DAYS,
  evaluate
} from '../public/route2own-engine.js';

test('the competition base product forces borrower down payment to zero', () => {
  const result = evaluate({ vehiclePrice: 900000, downPayment: 200000 });
  assert.equal(result.input.downPayment, 0);
  assert.equal(result.input.loanNeed, 900000);
});

test('RBP uses the eligible guaranteed amount and caps it at the loan need', () => {
  const result = evaluate({
    vehiclePrice: 900000,
    eligibleGuaranteedAmount: 600000,
    rbpTier: 'A',
    guaranteeYear: 4
  });

  assert.equal(result.calc.eligibleGuaranteedAmount, 600000);
  assert.equal(Math.round(result.calc.rbpReferenceDay * 100) / 100, 19.73);

  const capped = evaluate({
    vehiclePrice: 900000,
    eligibleGuaranteedAmount: 5000000,
    rbpTier: 'A',
    guaranteeYear: 4
  });
  assert.equal(capped.calc.eligibleGuaranteedAmount, 900000);
});

test('guarantee coverage is never hard-coded to the full loan', () => {
  const result = evaluate({ vehiclePrice: 800000 });
  assert.equal(result.calc.coveragePct, undefined);
  assert.equal(result.calc.guaranteedOutstanding, undefined);
});

test('monitoring and cure reserve are gone from the borrower daily obligation', () => {
  const result = evaluate({ grossDaily: 2200, verifiedPct: 95, vehiclePrice: 800000 });
  assert.equal(result.calc.monitoring, undefined);
  assert.equal(result.calc.cure, undefined);
});

test('reserve preview contributes 10% of the PAYD target up to a five-day target', () => {
  const result = evaluate({
    grossDaily: 2200,
    verifiedPct: 95,
    vehiclePrice: 800000,
    reserveBalance: 0
  });

  assert.equal(
    Math.round(result.calc.reserveTarget * 100),
    Math.round(result.calc.paydTarget * RESERVE_TARGET_DAYS * 100)
  );
  assert.ok(
    result.calc.reserveContributionPreview <=
      result.calc.paydTarget * RESERVE_CONTRIBUTION_RATE + 0.01
  );
  assert.ok(result.calc.reserveContributionPreview > 0);
});

test('reserve preview is zero when available cash cannot cover the PAYD target', () => {
  const result = evaluate({
    grossDaily: 800,
    verifiedPct: 95,
    vehiclePrice: 800000,
    reserveBalance: 0
  });

  assert.equal(result.calc.reserveContributionPreview, 0);
});

test('reserve preview stops once the reserve balance has reached its target', () => {
  const base = evaluate({
    grossDaily: 2200,
    verifiedPct: 95,
    vehiclePrice: 800000,
    reserveBalance: 0
  });
  const funded = evaluate({
    grossDaily: 2200,
    verifiedPct: 95,
    vehiclePrice: 800000,
    reserveBalance: base.calc.reserveTarget
  });

  assert.equal(funded.calc.reserveContributionPreview, 0);
});

test('PAYD capacity is available cash and never negative', () => {
  const thin = evaluate({ grossDaily: 600, verifiedPct: 95, vehiclePrice: 800000 });
  assert.ok(thin.calc.paydCapacity >= 0);

  const healthy = evaluate({ grossDaily: 2200, verifiedPct: 95, vehiclePrice: 800000 });
  assert.equal(
    Math.round(healthy.calc.paydCapacity * 100),
    Math.round(Math.max(0, healthy.calc.rawAvailDaily) * 100)
  );
});

test('front office reports PAYD as a preview, not an executed sweep', () => {
  const result = evaluate({ grossDaily: 2200, verifiedPct: 95, vehiclePrice: 800000 });
  assert.equal(typeof result.calc.paydTarget, 'number');
  assert.equal(result.calc.actualSweep, undefined);
});

test('the eligible guarantee base is an explicit design parameter, never an implicit copy of the loan', () => {
  // ราคารถสูงกว่าพารามิเตอร์ที่ประกาศไว้ — วงเงินค้ำต้องไม่วิ่งตามวงเงินสินเชื่อเอง
  const bigger = evaluate({ vehiclePrice: 1_200_000 });
  assert.equal(bigger.input.loanNeed, 1_200_000);
  assert.equal(bigger.calc.eligibleGuaranteedAmount, ELIGIBLE_GUARANTEE_DESIGN_PARAMETER);
  assert.notEqual(bigger.calc.eligibleGuaranteedAmount, bigger.input.loanNeed);

  // ราคารถต่ำกว่าพารามิเตอร์ — ต้องถูก cap ไม่ให้เกินวงเงินสินเชื่อ
  const smaller = evaluate({ vehiclePrice: 500_000 });
  assert.equal(smaller.calc.eligibleGuaranteedAmount, 500_000);
});

test('residual cash never goes negative and the shortfall is reported separately', () => {
  const thin = evaluate({ grossDaily: 900, verifiedPct: 95, vehiclePrice: 800000 });
  assert.ok(thin.calc.residualCash >= 0, `residualCash was ${thin.calc.residualCash}`);
  assert.ok(thin.calc.affordabilityGap > 0);
  assert.equal(thin.calc.remaining, undefined);

  const healthy = evaluate({ grossDaily: 2200, verifiedPct: 95, vehiclePrice: 800000 });
  assert.ok(healthy.calc.residualCash > 0);
  assert.equal(healthy.calc.affordabilityGap, 0);
});

test('available cash follows the frozen formula and never goes negative', () => {
  const thin = evaluate({ grossDaily: 700, verifiedPct: 95, vehiclePrice: 800000 });
  assert.equal(thin.calc.availableCash, 0);
  assert.ok(thin.calc.cashShortfallBeforeObligations > 0);
  assert.ok(thin.calc.rawAvailDaily < 0, 'raw diagnostic keeps the signed value');

  const healthy = evaluate({ grossDaily: 2200, verifiedPct: 95, vehiclePrice: 800000 });
  const c = healthy.calc;
  assert.equal(
    Math.round(c.availableCash * 100),
    Math.round(Math.max(0, c.verified - c.dailyOpEx - c.protectedDaily) * 100)
  );
  assert.equal(c.cashShortfallBeforeObligations, 0);
  assert.equal(c.paydCapacity, c.availableCash);
});

test('the RBP fee waiver is off by default and never changes the reference fee', () => {
  const off = evaluate({ guaranteeYear: 1, rbpTier: 'B' });
  assert.equal(off.input.feeWaiverEnabled, false);
  assert.equal(off.calc.feeWaiverApplied, false);
  assert.equal(off.calc.customerRbpDay, off.calc.rbpReferenceDay);
  assert.match(off.calc.feeWaiverStatus, /Proposed \/ Not Frozen/);

  const on = evaluate({ guaranteeYear: 1, rbpTier: 'B', feeWaiverEnabled: true });
  assert.equal(on.calc.feeWaiverApplied, true);
  assert.equal(on.calc.customerRbpDay, 0);
  // ค่าธรรมเนียมอ้างอิงต้องเท่าเดิมไม่ว่าเปิดหรือปิด waiver
  assert.equal(on.calc.rbpReferenceDay, off.calc.rbpReferenceDay);
});

test('the residual/gap allocation deducts the customer RBP the driver actually pays', () => {
  const base = {
    grossDaily: 2200,
    verifiedPct: 95,
    vehiclePrice: 800000,
    eligibleGuaranteedAmount: 800000,
    rbpTier: 'B',
    guaranteeYear: 1,
    reserveBalance: 0
  };

  // Fee Waiver ปิด — ผู้ขับจ่าย RBP จริง เงินคงเหลือจึงต้องลดลงเท่ากับ customerRbpDay
  const charged = evaluate(base).calc;
  assert.ok(charged.customerRbpDay > 0, 'the default scenario must actually charge RBP');
  assert.equal(
    Math.round(charged.residualCash * 100),
    Math.round(
      (charged.availableCash -
        charged.paydTarget -
        charged.customerRbpDay -
        charged.reserveContributionPreview) *
        100
    )
  );

  // Fee Waiver เปิด — เมื่อ input อื่นเท่ากัน เงินคงเหลือต้องเพิ่มขึ้นเท่ากับ RBP ที่ถูกยกเว้น
  const waived = evaluate({ ...base, feeWaiverEnabled: true }).calc;
  assert.equal(waived.customerRbpDay, 0);
  assert.equal(waived.reserveContributionPreview, charged.reserveContributionPreview);
  assert.equal(
    Math.round((waived.residualCash - charged.residualCash) * 100),
    Math.round(charged.customerRbpDay * 100),
    'waiving the RBP must return exactly that amount to the driver'
  );
});

test('the daily waterfall reconciles to residual cash minus the affordability gap', () => {
  for (const scenario of [
    { grossDaily: 2200, verifiedPct: 95 },
    { grossDaily: 1400, verifiedPct: 90 },
    { grossDaily: 900, verifiedPct: 95 }
  ]) {
    const c = evaluate({
      ...scenario,
      vehiclePrice: 800000,
      eligibleGuaranteedAmount: 800000,
      rbpTier: 'C',
      guaranteeYear: 4,
      reserveBalance: 0
    }).calc;

    // เอกลักษณ์ของ Waterfall: Available Cash − PAYD − RBP − Reserve = Residual − Gap
    assert.equal(
      Math.round(
        (c.availableCash - c.paydTarget - c.customerRbpDay - c.reserveContributionPreview) * 100
      ),
      Math.round((c.residualCash - c.affordabilityGap) * 100),
      `waterfall must reconcile for ${JSON.stringify(scenario)}`
    );
    assert.ok(c.residualCash >= 0);
    assert.ok(c.affordabilityGap >= 0);
    assert.ok(
      c.residualCash === 0 || c.affordabilityGap === 0,
      'residual and gap can never both be positive'
    );
  }
});

test('design thresholds are exposed together with their calibration status', () => {
  const p = COMPETITION_DESIGN_PARAMETERS;
  assert.equal(p.status, CALIBRATION_STATUS);
  assert.match(p.status, /Pilot Calibration after Selection/);
  assert.equal(p.notFinalUnderwritingRule, true);
  assert.equal(p.affordability.dscrGate, DSCR_GATE);
  assert.deepEqual(p.incomeEvidence, INCOME_EVIDENCE_THRESHOLDS);
  assert.deepEqual(p.activityEvidence, ACTIVITY_EVIDENCE_THRESHOLDS);
  assert.equal(p.incomeEvidence.HIGH, 90);
  assert.equal(p.incomeEvidence.MEDIUM, 70);
  assert.equal(p.activityEvidence.CONSISTENT, 90);
  assert.equal(p.activityEvidence.REVIEW, 70);
  assert.equal(p.feeWaiver.enabledByDefault, false);
  assert.equal(p.eligibleGuarantee.designParameter, ELIGIBLE_GUARANTEE_DESIGN_PARAMETER);
});

test('the pre-score breakdown sums to the total and every component explains itself', () => {
  for (const scenario of [
    { grossDaily: 2200, verifiedPct: 95 },
    { grossDaily: 3200, verifiedPct: 50 },
    { grossDaily: 900, verifiedPct: 95 }
  ]) {
    const r = evaluate({ ...scenario, vehiclePrice: 800000 }).readiness;
    const sum = r.breakdown.reduce((total, c) => total + c.points, 0);
    assert.equal(sum, r.readinessScore, `breakdown must sum to the score for ${JSON.stringify(scenario)}`);
    assert.equal(r.preScore.score, r.readinessScore);
    assert.equal(r.breakdown.length, 5);
    assert.equal(
      r.breakdown.reduce((total, c) => total + c.maxPoints, 0),
      100,
      'the five components must be worth 100 points in total'
    );
    for (const c of r.breakdown) {
      assert.ok(c.explanation && c.explanation.length > 0, `${c.id} needs an explanation`);
      assert.ok(c.improvementActions.length > 0, `${c.id} needs improvement actions`);
      assert.ok(c.points >= 0 && c.points <= c.maxPoints, `${c.id} points out of range`);
    }
    assert.equal(r.recommendations.length, 3);
  }
});
