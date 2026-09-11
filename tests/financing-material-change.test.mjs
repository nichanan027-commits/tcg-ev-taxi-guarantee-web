import test from "node:test";
import assert from "node:assert/strict";

import { hasMaterialFinancingChange, materialChangeReport } from "../app/lib/financing/material-change.ts";

const assessed = {
  loanAmount: 800_000,
  annualRatePct: 4.5,
  termMonths: 60,
  estimatedMonthlyInstallment: 14_910,
  dailyEquivalentBurden: 470
};

test("a heavier FI scenario is a material change that requires re-evaluation", () => {
  const candidate = { ...assessed, annualRatePct: 7.5, estimatedMonthlyInstallment: 16_030, dailyEquivalentBurden: 650 };

  assert.equal(hasMaterialFinancingChange(assessed, candidate), true);

  const report = materialChangeReport(assessed, candidate);
  assert.equal(report.requiresReevaluation, true);
  assert.ok(report.changedFields.includes("annualRatePct"));
  assert.ok(report.changedFields.includes("dailyEquivalentBurden"));
  assert.ok(report.dailyBurdenDelta > 0);
});

test("an identical scenario is not a material change", () => {
  assert.equal(hasMaterialFinancingChange(assessed, { ...assessed }), false);
  assert.equal(materialChangeReport(assessed, { ...assessed }).requiresReevaluation, false);
});

test("a rounding-level difference in the daily burden is not material", () => {
  const candidate = { ...assessed, dailyEquivalentBurden: 470.4, estimatedMonthlyInstallment: 14_910.2 };
  assert.equal(hasMaterialFinancingChange(assessed, candidate), false);
});

test("a cheaper FI scenario is still a material change because the result must be recomputed", () => {
  const candidate = { ...assessed, annualRatePct: 2.9, estimatedMonthlyInstallment: 14_330, dailyEquivalentBurden: 400 };

  assert.equal(hasMaterialFinancingChange(assessed, candidate), true);
  const report = materialChangeReport(assessed, candidate);
  assert.ok(report.dailyBurdenDelta < 0, "ภาระลดลงก็ยังต้องประเมินใหม่ ไม่ใช่ยกผลเดิมมาใช้");
});

test("each of loan amount, rate and term counts on its own", () => {
  assert.equal(hasMaterialFinancingChange(assessed, { ...assessed, loanAmount: 900_000 }), true);
  assert.equal(hasMaterialFinancingChange(assessed, { ...assessed, termMonths: 48 }), true);
  assert.equal(hasMaterialFinancingChange(assessed, { ...assessed, annualRatePct: 6 }), true);
});

test("the report names every field that moved", () => {
  const candidate = { loanAmount: 900_000, annualRatePct: 6, termMonths: 48, estimatedMonthlyInstallment: 21_100, dailyEquivalentBurden: 812 };
  const report = materialChangeReport(assessed, candidate);

  assert.deepEqual(report.changedFields.sort(), [
    "annualRatePct",
    "dailyEquivalentBurden",
    "estimatedMonthlyInstallment",
    "loanAmount",
    "termMonths"
  ]);
});

test("a missing assessed scenario forces re-evaluation rather than assuming no change", () => {
  assert.equal(hasMaterialFinancingChange(null, assessed), true);
  assert.equal(hasMaterialFinancingChange(assessed, null), true);
});

test("the helper decides nothing about routing — it only reports the difference", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("../app/lib/financing/material-change.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /READY FOR FI|NO NEW DEBT|BUILD READINESS/);
  assert.doesNotMatch(source, /affordabilityPassed|preScore/);
});
