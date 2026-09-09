import test from "node:test";
import assert from "node:assert/strict";

import {
  BasicEligibilitySchema,
  ELIGIBILITY_COPY,
  basicEligibilityOf,
  isFormComplete
} from "../app/lib/eligibility/types.ts";

const valid = {
  taxiOccupationStatus: "ACTIVE_TAXI_DRIVER",
  publicDriverLicenseStatus: "TO_VERIFY",
  currentVehicleRelationship: "RENT",
  cooperativeOrOperator: "สหกรณ์แท็กซี่ตัวอย่าง",
  yearsProfessionalDriving: 6,
  serviceProvince: "กรุงเทพมหานคร",
  occupationalEvidenceStatus: "DECLARED"
};

test("basic eligibility captures occupational metadata without sensitive documents", () => {
  const parsed = BasicEligibilitySchema.parse(valid);

  assert.equal(parsed.taxiOccupationStatus, "ACTIVE_TAXI_DRIVER");
  assert.equal(parsed.publicDriverLicenseStatus, "TO_VERIFY");
  assert.equal(parsed.currentVehicleRelationship, "RENT");
  assert.equal(parsed.yearsProfessionalDriving, 6);

  // ต้องเป็น metadata เท่านั้น ไม่มีเลขที่ใบขับขี่หรือภาพเอกสาร
  const serialized = JSON.stringify(parsed);
  assert.doesNotMatch(serialized, /licenseNumber|licenseImage|nationalId|idCard/i);
});

test("a filled-in form is not the same thing as an eligible applicant", () => {
  const eligibility = basicEligibilityOf(valid);

  assert.equal(isFormComplete(valid), true);
  assert.equal(eligibility.verified, false, "Form complete ≠ Eligible Applicant");
  assert.equal(eligibility.occupationalEvidenceStatus, "DECLARED");
  assert.equal(eligibility.statusCopy, ELIGIBILITY_COPY.declared);
  assert.equal(eligibility.statusCopy, "ข้อมูลอาชีพที่ผู้สมัครระบุ — รอยืนยันในขั้นตอนจริง");
});

test("competition mode never claims an identity or occupation is verified", () => {
  for (const status of ["DECLARED", "SUPPORTED", "TO_VERIFY"]) {
    const eligibility = basicEligibilityOf({ ...valid, occupationalEvidenceStatus: status });
    assert.equal(eligibility.verified, false, `${status} ต้องไม่ถือว่า verified ในโหมดแข่งขัน`);
    assert.doesNotMatch(eligibility.statusCopy, /Identity Verified/i);
    assert.doesNotMatch(eligibility.statusCopy, /Occupational Identity Verified/i);
    assert.doesNotMatch(eligibility.statusCopy, /ยืนยันตัวตนแล้ว/);
  }
});

test("the identity state is explicitly deferred in competition mode", () => {
  const eligibility = basicEligibilityOf(valid);
  assert.equal(eligibility.identityState, "Identity verification deferred — Competition Mode");
});

test("negative professional driving years are rejected", () => {
  assert.throws(() => BasicEligibilitySchema.parse({ ...valid, yearsProfessionalDriving: -1 }));
  assert.doesNotThrow(() => BasicEligibilitySchema.parse({ ...valid, yearsProfessionalDriving: 0 }));
});

test("unknown occupational and licence values are rejected, not coerced", () => {
  assert.throws(() => BasicEligibilitySchema.parse({ ...valid, taxiOccupationStatus: "ASTRONAUT" }));
  assert.throws(() => BasicEligibilitySchema.parse({ ...valid, publicDriverLicenseStatus: "YES" }));
  assert.throws(() => BasicEligibilitySchema.parse({ ...valid, currentVehicleRelationship: "LEASE_TO_OWN_MAYBE" }));
});

test("the cooperative or operator is optional", () => {
  const withoutCoop = { ...valid };
  delete withoutCoop.cooperativeOrOperator;
  assert.doesNotThrow(() => BasicEligibilitySchema.parse(withoutCoop));
});

test("an incomplete form is reported as incomplete rather than silently accepted", () => {
  assert.equal(isFormComplete({ ...valid, serviceProvince: "" }), false);
  assert.equal(isFormComplete({}), false);
});

test("basic eligibility declares no health data field", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("../app/lib/eligibility/types.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /health/i);
});
