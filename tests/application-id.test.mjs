import test from "node:test";
import assert from "node:assert/strict";

import { competitionConfig } from "../app/lib/config/competition.ts";
import {
  createApplication,
  getApplication,
  listStatusHistory,
  updateApplication
} from "../app/lib/registration/application-service.ts";
import { listConsents, recordCompetitionConsent } from "../app/lib/registration/consent-service.ts";

const registrationInput = {
  profile: {
    displayName: "ผู้ทดลอง",
    phone: "0812345678",
    province: "กรุงเทพมหานคร",
    driverStatus: "RENTING",
    yearsDriving: 6,
    ownershipGoal: "OWN_WITHIN_5_YEARS"
  },
  financial: {
    averageDailyIncome: 1850.52,
    incomeChannels: ["APP_TRANSFER", "CASH"],
    workingDaysPerMonth: 26,
    verifiedPct: 85,
    currentRentDaily: 700,
    fuelDaily: 300,
    batteryServiceDaily: 0,
    otherOpexDaily: 60,
    householdMonthly: 15000,
    existingDebtMonthly: 0,
    activityConsistency: 88,
    vehicleId: "AION_ES",
    vehiclePrice: 800000,
    termMonths: 60,
    annualRatePct: 4.5
  }
};

test("a new application gets a real sequential competition ID", async () => {
  const first = await createApplication();
  const second = await createApplication();

  assert.match(first.id, /^RTO-C26-\d{6}$/);
  assert.match(second.id, /^RTO-C26-\d{6}$/);
  assert.notEqual(first.id, second.id, "IDs must be unique");

  const firstNumber = Number(first.id.slice(-6));
  const secondNumber = Number(second.id.slice(-6));
  assert.equal(secondNumber, firstNumber + 1, "the public application number is sequential, not random");

  assert.equal(first.status, "DRAFT");
  assert.ok(first.createdAt);
});

test("an application persists and can be read back by ID", async () => {
  const created = await createApplication();
  const loaded = await getApplication(created.id);

  assert.ok(loaded, "the application must be retrievable after creation");
  assert.equal(loaded.id, created.id);
  assert.equal(loaded.status, "DRAFT");
  assert.equal(loaded.profile, null, "a draft has no profile yet");
});

test("consent is an append-only versioned record with a timestamp", async () => {
  const application = await createApplication();
  const consent = await recordCompetitionConsent(application.id);

  assert.equal(consent.version, "RTO-COMP-1.0");
  assert.equal(consent.version, competitionConfig.consentVersion);
  assert.equal(consent.accepted, true);
  assert.ok(consent.acceptedAt);
  assert.equal(consent.scope, "COMPETITION");

  // ยินยอมซ้ำต้องได้แถวใหม่ ไม่ใช่การเขียนทับ boolean เดิม
  const again = await recordCompetitionConsent(application.id);
  assert.notEqual(again.id, consent.id);

  const history = await listConsents(application.id);
  assert.equal(history.length, 2, "consent history is append-only");

  const afterConsent = await getApplication(application.id);
  assert.equal(afterConsent.status, "CONSENTED");
});

test("competition mode never requires OTP", async () => {
  const application = await createApplication();
  await recordCompetitionConsent(application.id);
  const updated = await updateApplication(application.id, registrationInput);

  assert.equal(updated.profile.phoneVerificationStatus, "NOT_REQUIRED_COMPETITION");
});

test("saving registration data persists profile and financial inputs and advances status", async () => {
  const application = await createApplication();
  await recordCompetitionConsent(application.id);
  const updated = await updateApplication(application.id, registrationInput);

  assert.equal(updated.status, "DATA_COMPLETE");
  assert.equal(updated.profile.displayName, "ผู้ทดลอง");
  assert.equal(updated.profile.province, "กรุงเทพมหานคร");
  assert.equal(updated.financial.averageDailyIncome, 1850.52);
  assert.equal(updated.financial.vehicleId, "AION_ES");
  assert.equal(updated.financial.workingDaysPerMonth, 26);

  const reloaded = await getApplication(application.id);
  assert.equal(reloaded.financial.averageDailyIncome, 1850.52, "money survives the round trip exactly");
  assert.equal(reloaded.profile.yearsDriving, 6);
});

test("saving rejects unknown and sensitive fields instead of storing them", async () => {
  const application = await createApplication();
  const updated = await updateApplication(application.id, {
    profile: { ...registrationInput.profile, nationalId: "1234567890123" },
    financial: { ...registrationInput.financial, bankAccountNumber: "1234567890" }
  });

  const serialized = JSON.stringify(updated);
  assert.doesNotMatch(serialized, /nationalId|bankAccountNumber|1234567890123/);
});

test("invalid registration data is rejected and nothing is persisted", async () => {
  const application = await createApplication();
  await assert.rejects(() =>
    updateApplication(application.id, {
      profile: registrationInput.profile,
      financial: { ...registrationInput.financial, averageDailyIncome: -100 }
    })
  );

  const reloaded = await getApplication(application.id);
  assert.equal(reloaded.financial, null, "a rejected save must not partially persist");
  assert.equal(reloaded.status, "DRAFT");
});

test("status changes are recorded in history rather than silently overwritten", async () => {
  const application = await createApplication();
  await recordCompetitionConsent(application.id);
  await updateApplication(application.id, registrationInput);

  const history = await listStatusHistory(application.id);
  const transitions = history.map((row) => row.toStatus);
  assert.deepEqual(transitions, ["DRAFT", "CONSENTED", "DATA_COMPLETE"]);
});

test("an unknown application ID returns null rather than throwing", async () => {
  assert.equal(await getApplication("RTO-C26-999999"), null);
});
