import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { GUARANTEE_COPY, guaranteeBaseOf } from "../app/lib/evaluation/guarantee-wording.ts";

function newSources() {
  const roots = ["app", "components"];
  const files = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { recursive: true })) {
      const p = `${root}/${entry}`;
      if (/\.(ts|tsx)$/.test(p) && fs.statSync(p).isFile()) files.push(p);
    }
  }
  // app/lib/route2own.ts เป็น re-export ของ Frozen Engine ซึ่งห้ามแก้
  return files.filter((p) => p !== "app/lib/route2own.ts");
}

/**
 * ตรวจเฉพาะข้อความที่ไปถึงผู้ใช้จริง
 * บรรทัดคอมเมนต์ที่อธิบายว่า "ทำไมถึงห้ามใช้คำนี้" ต้องเขียนได้ ไม่ใช่ความผิด
 */
function codeOnly(body) {
  return body
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

test("the applicant-facing base is called an indicative guarantee-eligible base", () => {
  assert.equal(GUARANTEE_COPY.label, "Indicative Guarantee-Eligible Base");
  assert.equal(GUARANTEE_COPY.labelTh, "วงเงินฐานอ้างอิงที่อาจเข้าเกณฑ์การค้ำประกัน");
  assert.match(GUARANTEE_COPY.disclaimer, /ไม่ใช่วงเงินค้ำประกันที่ บสย\. อนุมัติแล้ว/);
  assert.match(GUARANTEE_COPY.disclaimer, /ก่อนการตัดสินสินเชื่อขั้นสุดท้ายของสถาบันการเงิน/);
});

test("no new applicant-facing source presents an approved guaranteed amount", () => {
  for (const file of newSources()) {
    const body = codeOnly(fs.readFileSync(file, "utf8"));
    assert.doesNotMatch(
      body,
      /Eligible Guaranteed Amount/,
      `${file} ต้องใช้ Indicative Guarantee-Eligible Base แทน`
    );
  }
});

test("the four money concepts stay separate and are never equated", () => {
  const base = guaranteeBaseOf({
    vehiclePrice: 800_000,
    illustrativeLoanAmount: 800_000,
    indicativeGuaranteeEligibleBase: 800_000
  });

  assert.equal(base.vehiclePrice, 800_000);
  assert.equal(base.illustrativeLoanAmount, 800_000);
  assert.equal(base.indicativeGuaranteeEligibleBase, 800_000);

  // แม้ตัวเลขจะเท่ากัน ชื่อและความหมายต้องแยกกันเสมอ
  assert.deepEqual(Object.keys(base).sort(), [
    "disclaimer",
    "illustrativeLoanAmount",
    "indicativeGuaranteeEligibleBase",
    "label",
    "labelTh",
    "vehiclePrice"
  ]);
  assert.equal(base.label, GUARANTEE_COPY.label);
});

test("the front office never mentions a final Child E-LG amount", () => {
  for (const file of newSources()) {
    const body = codeOnly(fs.readFileSync(file, "utf8"));
    assert.doesNotMatch(body, /Final Child E-?LG/i, `${file} เป็นเรื่องของ System B`);
  }
});

test("the disclaimer is attached to the number, not left to the caller to remember", () => {
  const base = guaranteeBaseOf({
    vehiclePrice: 900_000,
    illustrativeLoanAmount: 900_000,
    indicativeGuaranteeEligibleBase: 800_000
  });
  assert.ok(base.disclaimer.length > 0);
  assert.equal(base.disclaimer, GUARANTEE_COPY.disclaimer);
});
