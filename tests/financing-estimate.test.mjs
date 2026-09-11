import test from "node:test";
import assert from "node:assert/strict";

import { competitionConfig } from "../app/lib/config/competition.ts";
import {
  DEFAULT_VEHICLE,
  VEHICLE_CATALOGUE,
  getVehicle,
  vehicleScenarioOf
} from "../app/lib/financing/vehicle-catalogue.ts";
import { estimateFinancing, financingScenarioOf } from "../app/lib/financing/estimate.ts";

test("the default competition vehicle is AION ES with zero borrower down payment", () => {
  assert.equal(DEFAULT_VEHICLE.id, "AION_ES");
  assert.equal(DEFAULT_VEHICLE.id, competitionConfig.defaultVehicleId);

  const scenario = vehicleScenarioOf("AION_ES", DEFAULT_VEHICLE.referencePrice);
  assert.equal(scenario.borrowerDownPayment, 0);
  assert.equal(scenario.vehicleId, "AION_ES");
});

test("every catalogue vehicle carries an explicit source status", () => {
  assert.ok(VEHICLE_CATALOGUE.length >= 5);
  for (const vehicle of VEHICLE_CATALOGUE) {
    assert.ok(
      ["VERIFIED_BY_FI", "PUBLIC_SOURCE_REFERENCE", "COMPETITION_ILLUSTRATION"].includes(vehicle.sourceStatus),
      `${vehicle.id} needs a source status`
    );
    assert.ok(vehicle.name.length > 0);
  }

  const ids = VEHICLE_CATALOGUE.map((v) => v.id);
  assert.deepEqual(ids, ["AION_ES", "AION_Y_PLUS", "AION_UT", "AION_V", "OTHER"]);
});

test("the daily burden is the monthly instalment spread over working days", () => {
  const workingDaysPerMonth = 26;
  const result = estimateFinancing({
    vehiclePrice: 800_000,
    loanAmount: 800_000,
    annualRatePct: 4.5,
    termMonths: 60,
    workingDaysPerMonth
  });

  assert.ok(result.estimatedMonthlyInstallment > 0);
  assert.equal(result.dailyEquivalentBurden, result.estimatedMonthlyInstallment / workingDaysPerMonth);
});

test("a zero-rate loan amortises as a straight division", () => {
  const result = estimateFinancing({
    vehiclePrice: 600_000,
    loanAmount: 600_000,
    annualRatePct: 0,
    termMonths: 60,
    workingDaysPerMonth: 25
  });

  assert.equal(Math.round(result.estimatedMonthlyInstallment * 100) / 100, 10_000);
});

test("the instalment matches the standard amortising formula", () => {
  const loanAmount = 800_000;
  const annualRatePct = 4.5;
  const termMonths = 60;
  const monthlyRate = annualRatePct / 100 / 12;
  const expected = (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));

  const result = estimateFinancing({
    vehiclePrice: loanAmount,
    loanAmount,
    annualRatePct,
    termMonths,
    workingDaysPerMonth: 26
  });

  assert.equal(Math.round(result.estimatedMonthlyInstallment * 100), Math.round(expected * 100));
});

test("invalid rate and term are rejected rather than silently coerced", () => {
  const base = { vehiclePrice: 800_000, loanAmount: 800_000, annualRatePct: 4.5, termMonths: 60, workingDaysPerMonth: 26 };

  assert.throws(() => estimateFinancing({ ...base, termMonths: 0 }));
  assert.throws(() => estimateFinancing({ ...base, termMonths: -12 }));
  assert.throws(() => estimateFinancing({ ...base, annualRatePct: -1 }));
  assert.throws(() => estimateFinancing({ ...base, workingDaysPerMonth: 0 }));
  assert.throws(() => estimateFinancing({ ...base, loanAmount: 0 }));
});

test("the financing scenario is labelled illustrative, never an approved offer", () => {
  const scenario = financingScenarioOf({
    vehiclePrice: 800_000,
    loanAmount: 800_000,
    annualRatePct: 4.5,
    termMonths: 60,
    workingDaysPerMonth: 26
  });

  assert.equal(scenario.label, "ILLUSTRATIVE_FINANCING_ESTIMATE");
  assert.equal(scenario.termMonths, 60);
  assert.ok(scenario.estimatedMonthlyInstallment > 0);
  assert.ok(scenario.dailyEquivalentBurden > 0);
});

test("the estimator never reimplements the frozen readiness engine", async () => {
  const source = await import("node:fs").then((fs) =>
    fs.readFileSync(new URL("../app/lib/financing/estimate.ts", import.meta.url), "utf8")
  );

  // ตัวประมาณค่างวดเป็นเครื่องคิดเลขแยก ห้ามแตะเกณฑ์เส้นทางหรือคะแนน
  assert.doesNotMatch(source, /DSCR_GATE|readinessScore|appropriateRouteOf|ROUTES\./);
  assert.doesNotMatch(source, /route2own-engine/);
});

test("an unknown vehicle falls back to the configurable OTHER entry", () => {
  assert.equal(getVehicle("AION_V").id, "AION_V");
  assert.equal(getVehicle("SOMETHING_ELSE").id, "OTHER");
});
