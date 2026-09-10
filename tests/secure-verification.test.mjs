import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  SECURE_VERIFICATION_COPY,
  SECURE_VERIFICATION_FIELDS,
  SECURE_VERIFICATION_ROLES,
  fieldsForRole
} from "../app/lib/verification/secure-verification.ts";

/**
 * Secure Verification — สาธิตหน้าตาของการตรวจสอบข้อมูลอ่อนไหว โดยไม่เก็บและไม่ส่งค่าจริง
 *
 * โมดูลนี้ต่างจากส่วนอื่นตรงที่ "สิ่งที่ต้องพิสูจน์คือสิ่งที่ไม่เกิดขึ้น"
 * จึงตรวจที่ตัวโค้ดโดยตรง ไม่ใช่แค่ตรวจพฤติกรรมที่มองเห็น
 * เพราะการรั่วของข้อมูลอ่อนไหวเป็นสิ่งที่มองจากหน้าจอไม่เห็น
 */
const PANEL = "components/frontoffice/SecureVerificationPanel.tsx";
const PAGE = "app/apply/[applicationId]/verification/page.tsx";
const MODULE = "app/lib/verification/secure-verification.ts";

const SOURCES = [PANEL, PAGE, MODULE];

function read(path) {
  return fs.readFileSync(path, "utf8");
}

/**
 * โค้ดจริงโดยไม่นับคอมเมนต์
 *
 * คอมเมนต์ที่อธิบายว่า "ห้ามเก็บสิ่งนี้" ต้องเขียนได้ ไม่งั้นเทสต์จะฟ้องเอกสารของตัวเอง
 * รองรับทั้ง // ของ TypeScript และ -- ของ SQL
 */
function codeOnly(path) {
  return read(path)
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return (
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("--") &&
        !trimmed.startsWith("*") &&
        !trimmed.startsWith("/*")
      );
    })
    .join("\n");
}

test("ไม่มีการส่งค่าอ่อนไหวออกจากเบราว์เซอร์ด้วยวิธีใดเลย", () => {
  const forbidden = [
    [/\bfetch\s*\(/, "fetch"],
    [/\baxios\b/, "axios"],
    [/XMLHttpRequest/, "XMLHttpRequest"],
    [/navigator\.sendBeacon/, "sendBeacon"],
    [/new\s+FormData/, "FormData"],
    [/new\s+WebSocket/, "WebSocket"],
    [/EventSource/, "EventSource"],
    [/"use server"/, "server action"],
    [/\bimport\s*\(\s*["'].*api/, "dynamic import ของ API"]
  ];

  for (const path of SOURCES) {
    const code = codeOnly(path);
    for (const [pattern, name] of forbidden) {
      assert.ok(!pattern.test(code), `${path} ต้องไม่ใช้ ${name} — ค่าอ่อนไหวห้ามออกจากเครื่อง`);
    }
  }
});

test("ไม่มีการเก็บค่าอ่อนไหวลงที่เก็บถาวรใด ๆ ของเบราว์เซอร์", () => {
  const forbidden = [
    [/localStorage/, "localStorage"],
    [/sessionStorage/, "sessionStorage"],
    [/indexedDB/i, "IndexedDB"],
    [/document\.cookie/, "cookie"],
    [/caches\./, "Cache Storage"]
  ];

  for (const path of SOURCES) {
    const code = codeOnly(path);
    for (const [pattern, name] of forbidden) {
      assert.ok(!pattern.test(code), `${path} ต้องไม่เก็บค่าลง ${name}`);
    }
  }
});

test("ไม่มีการอ่านเนื้อไฟล์ — ใช้ได้เพียงชื่อและชนิดไฟล์", () => {
  const forbidden = [
    [/FileReader/, "FileReader"],
    [/\.arrayBuffer\s*\(/, "arrayBuffer()"],
    [/\.text\s*\(\s*\)/, "text()"],
    [/\.stream\s*\(/, "stream()"],
    [/\.slice\s*\(\s*0/, "การตัดไบต์ของไฟล์"],
    [/btoa|base64|toDataURL/i, "base64"],
    [/createObjectURL/, "createObjectURL"]
  ];

  for (const path of SOURCES) {
    const code = codeOnly(path);
    for (const [pattern, name] of forbidden) {
      assert.ok(!pattern.test(code), `${path} ต้องไม่ใช้ ${name}`);
    }
  }

  // ใช้ได้เฉพาะ metadata ของไฟล์
  const panel = codeOnly(PANEL);
  assert.ok(/\.name\b/.test(panel), "แสดงชื่อไฟล์ในเครื่องได้");
});

test("ไม่มีการเขียนค่าอ่อนไหวลง log หรือ telemetry", () => {
  for (const path of SOURCES) {
    const code = codeOnly(path);
    for (const pattern of [/console\.(log|info|warn|error|debug)/, /analytics/i, /telemetry/i, /gtag|dataLayer/]) {
      assert.ok(!pattern.test(code), `${path} ต้องไม่บันทึกหรือส่งค่าออกผ่าน ${pattern}`);
    }
  }
});

test("ไม่มีคอลัมน์อ่อนไหวหรือ API สำหรับ Secure Verification ในระบบ", () => {
  const migrations = fs
    .readdirSync("db/migrations")
    .filter((file) => file.endsWith(".sql"))
    .map((file) => codeOnly(`db/migrations/${file}`))
    .join("\n");

  // ตรวจที่ "ค่าอ่อนไหว" ไม่ใช่ทุกคำที่ฟังดูคล้าย
  // public_driver_license_status เป็นสถานะคุณสมบัติที่ผู้สมัครระบุ ไม่ใช่ภาพใบขับขี่
  // การห้ามคำกว้าง ๆ จะทำให้เทสต์ฟ้องสิ่งที่ถูกต้อง แล้วนำไปสู่การปิดเทสต์ทิ้ง
  for (const forbidden of [
    /national_id/,
    /citizen_id/,
    /bank_account/,
    /\bstatement_(blob|file|content|data)/,
    /id_card_(blob|file|image|data)/,
    /driver_license_(blob|file|image|data)/,
    /credit_report/,
    /credit_bureau/
  ]) {
    assert.doesNotMatch(migrations, forbidden, `schema ต้องไม่มีคอลัมน์ ${forbidden}`);
  }

  // ไม่มีเส้นทาง API ใดที่รับค่าอ่อนไหว
  const routes = fs
    .readdirSync("app/api", { recursive: true })
    .filter((p) => String(p).endsWith("route.ts"));
  for (const route of routes) {
    assert.doesNotMatch(
      String(route),
      /(verification|verify|kyc|bureau|document|upload)/i,
      `API ${route} ไม่ควรมีอยู่ — Secure Verification ไม่ส่งอะไรไปเซิร์ฟเวอร์`
    );
  }
});

test("ไม่มีข้อมูลสุขภาพในระบบจริง", () => {
  const productionFiles = [];
  for (const dir of ["app", "components", "db"]) {
    for (const p of fs.readdirSync(dir, { recursive: true })) {
      const full = `${dir}/${p}`;
      if (/\.(ts|tsx|sql)$/.test(full) && fs.statSync(full).isFile()) productionFiles.push(full);
    }
  }

  // ตรวจเฉพาะโค้ดจริง ไม่นับคอมเมนต์ที่อธิบายว่าห้ามเก็บข้อมูลเหล่านี้
  const terms = [
    /\bhealth[A-Z_]/,
    /\bmedical\b/i,
    /\bdiagnosis\b/i,
    /\bdisease\b/i,
    /\bmedication\b/i,
    /\bhospital\b/i,
    /\bpatient\b/i,
    /health_/
  ];

  for (const file of productionFiles) {
    const code = codeOnly(file);
    for (const term of terms) {
      assert.doesNotMatch(code, term, `${file} ต้องไม่มีข้อมูลสุขภาพ (${term})`);
    }
  }
});

test("ข้อความกำกับตรงตามที่กำหนดทุกประโยค", () => {
  assert.equal(
    SECURE_VERIFICATION_COPY.notPersisted,
    "ข้อมูลส่วนนี้ไม่ถูกบันทึกหรือส่งออกจากอุปกรณ์ในระบบการแข่งขัน"
  );
  assert.equal(SECURE_VERIFICATION_COPY.identityState, "Identity verification deferred — Competition Mode");
  assert.equal(SECURE_VERIFICATION_COPY.phoneVerification, "Not required — Competition Mode");
  assert.equal(SECURE_VERIFICATION_COPY.fileNotUploaded, "ไฟล์นี้ยังไม่ถูกอัปโหลดหรือส่งออกจากอุปกรณ์");
  assert.equal(
    SECURE_VERIFICATION_COPY.bureauContext,
    "ดำเนินการภายใต้ความยินยอมและช่องทางที่สถาบันการเงินหรือผู้ให้บริการที่เกี่ยวข้องกำหนด"
  );

  // ข้อความทั้งหมดต้องถูกใช้จริงบนหน้าจอ ไม่ใช่ประกาศไว้เฉย ๆ
  const panel = read(PANEL);
  for (const key of ["notPersisted", "identityState", "fileNotUploaded", "bureauContext"]) {
    assert.ok(panel.includes(`SECURE_VERIFICATION_COPY.${key}`), `หน้าจอต้องแสดง ${key}`);
  }
});

test("ไม่มีสถานะที่อ้างว่าตรวจสอบผ่านหรืออนุมัติแล้ว", () => {
  const forbidden = [
    "Identity Verified",
    "KYC Passed",
    "KYC Verified",
    "Credit Bureau Passed",
    "Loan Approved",
    "Guarantee Approved",
    "ยืนยันตัวตนแล้ว",
    "อนุมัติแล้ว"
  ];

  for (const path of SOURCES) {
    const source = read(path);
    for (const phrase of forbidden) {
      assert.ok(!source.includes(phrase), `${path} ต้องไม่แสดงสถานะ "${phrase}"`);
    }
  }
});

test("มีสองบทบาทสำหรับสาธิต และเป็นมุมมองเท่านั้น", () => {
  assert.deepEqual(
    SECURE_VERIFICATION_ROLES.map((role) => role.id),
    ["TCG_STAFF", "FI_STAFF"]
  );

  // ทั้งสองบทบาทเห็นสนามที่ต่างกันได้ แต่ไม่มีบทบาทใดเป็นด่านอนุมัติ
  for (const role of SECURE_VERIFICATION_ROLES) {
    assert.ok(fieldsForRole(role.id).length > 0);
    assert.ok(!/approve|อนุมัติ|gate|ผ่าน/i.test(role.description), `บทบาท ${role.id} ต้องไม่สื่อว่าเป็นด่านอนุมัติ`);
  }
});

test("โมดูลนี้ไม่มีทางแตะการประเมิน ความยินยอม หรือการส่งต่อ", () => {
  const forbidden = [
    /evaluate/i,
    /snapshot/i,
    /insertSnapshot/,
    /recordFiConsent/,
    /recordCompetitionConsent/,
    /setFiSelections/,
    /buildHandoffPackage/,
    /requestFaAdvisory/,
    /route2own/i,
    /ensureSchema/,
    /getDb/
  ];

  for (const path of SOURCES) {
    const code = codeOnly(path);
    for (const pattern of forbidden) {
      assert.doesNotMatch(code, pattern, `${path} ต้องไม่เกี่ยวข้องกับ ${pattern} — โมดูลนี้ไม่มีอำนาจตัดสินใด ๆ`);
    }
  }
});

test("สนามอ่อนไหวถูกประกาศไว้ว่าอยู่ในหน่วยความจำเท่านั้น", () => {
  for (const field of SECURE_VERIFICATION_FIELDS) {
    assert.equal(field.retention, "MEMORY_ONLY");
    assert.ok(field.label.length > 0);
  }

  // สนามไฟล์ต้องไม่ถูกอ่านเนื้อหา
  const files = SECURE_VERIFICATION_FIELDS.filter((field) => field.kind === "FILE");
  assert.ok(files.length >= 3, "ต้องมีตัวอย่างไฟล์ให้เห็นอย่างน้อยสามรายการ");
  for (const field of files) {
    assert.equal(field.readsContent, false);
  }
});
