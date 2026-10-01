import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { VEHICLE_CATALOGUE } from "../app/lib/financing/vehicle-catalogue.ts";

/**
 * แคตตาล็อกรถมีอยู่สองที่ และต้องตรงกันเสมอ
 *
 * Front Office รุ่น Frozen เป็นไฟล์เดียวที่รันได้โดยไม่ต้องมีเซิร์ฟเวอร์
 * จึง import จาก TypeScript ไม่ได้ ต้องมีสำเนาอยู่ในไฟล์นั้นเอง
 *
 * สำเนาที่ไม่มีใครตรวจคือสำเนาที่จะเพี้ยน เทสต์ชุดนี้จึงตรึงไว้ว่า
 * ถ้าฝั่งใดฝั่งหนึ่งเปลี่ยน ต้องเปลี่ยนอีกฝั่งด้วย ไม่งั้นล้มทันที
 */
const html = fs.readFileSync("public/route2own.html", "utf8");

function frozenCatalogue() {
  const block = /const VEHICLE_CATALOGUE=\[([\s\S]*?)\];/.exec(html);
  assert.ok(block, "ต้องพบ VEHICLE_CATALOGUE ใน public/route2own.html");
  return [
    ...block[1].matchAll(
      /\{id:'([^']+)',name:'([^']+)',segment:'([^']+)',referencePrice:(\d+),rangeKm:(\d+|null),source:'([^']+)'\}/g
    )
  ].map((m) => ({
    id: m[1],
    name: m[2],
    segment: m[3],
    referencePrice: Number(m[4]),
    rangeKm: m[5] === "null" ? null : Number(m[5]),
    sourceLabel: m[6]
  }));
}

test("แคตตาล็อกรถของ Front Office รุ่น Frozen ตรงกับแคตตาล็อกกลางทุกรายการ", () => {
  const frozen = frozenCatalogue();
  assert.equal(frozen.length, VEHICLE_CATALOGUE.length, "จำนวนรุ่นต้องเท่ากัน");

  VEHICLE_CATALOGUE.forEach((canonical, index) => {
    const mirror = frozen[index];
    assert.equal(mirror.id, canonical.id, `ลำดับที่ ${index} id ต้องตรงกัน`);
    assert.equal(mirror.name, canonical.name, `${canonical.id} ชื่อต้องตรงกัน`);
    assert.equal(mirror.segment, canonical.segment, `${canonical.id} segment ต้องตรงกัน`);
    assert.equal(
      mirror.referencePrice,
      canonical.referencePrice,
      `${canonical.id} ราคาอ้างอิงต้องตรงกัน`
    );
    assert.equal(mirror.rangeKm, canonical.rangeKm, `${canonical.id} ระยะทางอ้างอิงต้องตรงกัน`);
    assert.equal(
      mirror.sourceLabel,
      canonical.sourceLabel,
      `${canonical.id} คำกำกับที่มาของราคาต้องตรงกัน`
    );
  });
});

test("ราคารถถูกกำกับว่าเป็นค่าอ้างอิง ไม่ใช่ราคาขายที่ยืนยันแล้ว", () => {
  for (const vehicle of VEHICLE_CATALOGUE) {
    assert.ok(
      /ปรับได้ตามใบเสนอราคาจริง|ระบุราคาเอง/.test(vehicle.sourceLabel),
      `${vehicle.id} ต้องบอกชัดว่าราคายังปรับได้ ไม่ใช่ราคาที่ยืนยันแล้ว`
    );
  }
  assert.ok(
    html.includes("COMPETITION_ILLUSTRATION"),
    "สถานะแหล่งที่มาต้องระบุว่าเป็นภาพประกอบการแข่งขัน"
  );
  assert.ok(
    VEHICLE_CATALOGUE.every((vehicle) => vehicle.sourceStatus === "COMPETITION_ILLUSTRATION"),
    "แคตตาล็อกกลางต้องไม่มีรายการใดอ้างว่าเป็นราคายืนยันแล้ว"
  );
});

test("การเลือกรุ่นรถเปลี่ยนได้แค่ราคา ไม่เพิ่มกติกาการให้คะแนน", () => {
  const handler = /function applyVehicleChoice\(\)\{([\s\S]*?)\n\}/.exec(html);
  assert.ok(handler, "ต้องพบ applyVehicleChoice");
  const body = handler[1];

  // ช่องที่ตัวเลือกรถได้รับอนุญาตให้แตะมีเพียงราคารถและวงเงินค้ำที่ต้องไม่เกินราคารถ
  const touched = [...body.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(touched)].sort(),
    ["eligibleGuaranteedAmount", "vehicleId", "vehicleNote", "vehiclePrice"],
    "ตัวเลือกรถต้องไม่ไปแก้ช่องอื่นนอกจากราคารถและวงเงินค้ำ"
  );

  for (const forbidden of ["route", "tier", "preScore", "dscr", "readiness"]) {
    assert.ok(
      !new RegExp(`\\b${forbidden}\\b`, "i").test(body),
      `applyVehicleChoice ต้องไม่ยุ่งกับ ${forbidden}`
    );
  }
});

test("เลือกรถรุ่นอื่นแล้วราคาที่ผู้ขับกรอกเองต้องไม่ถูกทับ", () => {
  const handler = /function applyVehicleChoice\(\)\{([\s\S]*?)\n\}/.exec(html);
  assert.match(
    handler[1],
    /if\(v\.id!=='OTHER'\)\{/,
    "การเติมราคาอ้างอิงต้องอยู่ใต้เงื่อนไขว่าไม่ใช่รถรุ่นอื่น"
  );
});
