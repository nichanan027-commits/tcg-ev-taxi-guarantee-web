import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ELIGIBLE_GUARANTEE_DESIGN_PARAMETER,
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
