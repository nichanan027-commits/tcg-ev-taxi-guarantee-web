import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { databaseUrlFor } from "../app/lib/db/sql.ts";
import {
  LOCAL_DEVELOPMENT_CUTOFF,
  MISSING_CUTOFF_MESSAGE,
  resolveRetentionPolicy
} from "../app/lib/retention/retention-service.ts";

/**
 * ค่าตั้งค่าที่ต้องมาจากภายนอก ไม่ใช่จากค่าที่ฝังไว้ในโค้ด
 *
 * สองเรื่องนี้มีลักษณะเดียวกัน: ถ้าเดาเอาแล้วเดาผิด จะไม่มีอะไรพัง ณ ตอนนั้น
 * แต่จะลบข้อมูลผิดวัน หรือเขียนลงฐานข้อมูลผิดตัว ซึ่งรู้ตัวตอนสายเกินแก้
 * ค่าเริ่มต้นจึงต้องปลอดภัยในเครื่อง และต้องหยุดทำงานบนระบบจริงถ้าไม่ได้ตั้งค่า
 */

test("วันสิ้นสุดการแข่งขันที่ฝังไว้เป็นค่าสำหรับเครื่องนักพัฒนา ไม่ใช่ค่าจริง", () => {
  const service = fs.readFileSync("app/lib/retention/retention-service.ts", "utf8");

  // ชื่อของค่าต้องบอกตัวเองว่าเป็นค่าสำรองสำหรับงานในเครื่อง
  assert.ok(service.includes("LOCAL_DEVELOPMENT_CUTOFF"));
  assert.ok(
    service.includes("ค่านี้ไม่ใช่วันสิ้นสุดจริงของการแข่งขัน"),
    "ต้องระบุไว้ในโค้ดว่าค่านี้ไม่ใช่วันจริง เพื่อไม่ให้ใครหยิบไปใช้โดยเข้าใจผิด"
  );

  // ค่าที่ฝังไว้ต้องไม่ถูกอ้างอิงจาก competitionConfig อีกต่อไป
  const config = fs.readFileSync("app/lib/config/competition.ts", "utf8");
  assert.ok(
    !config.includes("competitionCutoffAt"),
    "วันสิ้นสุดการแข่งขันต้องไม่ถูกฝังไว้ใน competitionConfig"
  );
});

test("บน production ที่ไม่ได้ตั้งวันสิ้นสุด ระบบต้องหยุด ไม่ใช่ใช้ค่าสำรองเงียบ ๆ", () => {
  for (const env of [
    { VERCEL: "1" },
    { AWS_LAMBDA_FUNCTION_NAME: "route2own" },
    { VERCEL: "1", NODE_ENV: "production" }
  ]) {
    assert.throws(() => resolveRetentionPolicy(env), { message: MISSING_CUTOFF_MESSAGE });
  }

  // ค่าว่างหรือเว้นวรรคล้วน ไม่นับว่าตั้งค่าแล้ว
  for (const value of ["", "   "]) {
    assert.throws(() => resolveRetentionPolicy({ VERCEL: "1", COMPETITION_CUTOFF_AT: value }), {
      message: MISSING_CUTOFF_MESSAGE
    });
  }
});

test("เมื่อตั้งค่าไว้ ระบบใช้ค่านั้นและบอกที่มาได้", () => {
  const policy = resolveRetentionPolicy({
    VERCEL: "1",
    COMPETITION_CUTOFF_AT: "2027-01-15T16:59:59.000Z"
  });

  assert.equal(policy.competitionCutoffAt, "2027-01-15T16:59:59.000Z");
  assert.equal(policy.cutoffSource, "COMPETITION_CUTOFF_AT");
  assert.equal(policy.retentionDays, 30, "กติกา 30 วันไม่เปลี่ยน");
});

test("วันสิ้นสุดที่รูปแบบไม่ถูกต้องถูกปฏิเสธ ไม่ใช่ตีความเอาเอง", () => {
  for (const value of ["สิ้นเดือนตุลาคม", "31/10/2026", "not-a-date"]) {
    assert.throws(() => resolveRetentionPolicy({ COMPETITION_CUTOFF_AT: value }), /ISO 8601/);
  }
});

test("ในเครื่องนักพัฒนาใช้ค่าสำรองได้ แต่ต้องประกาศที่มาอย่างชัดเจน", () => {
  const policy = resolveRetentionPolicy({});
  assert.equal(policy.competitionCutoffAt, LOCAL_DEVELOPMENT_CUTOFF);
  assert.equal(policy.cutoffSource, "LOCAL_DEVELOPMENT_FALLBACK");

  // รายงานทุกฉบับพกที่มาของวันสิ้นสุดไปด้วย จึงตรวจย้อนได้ว่าลบด้วยวันไหน
  const service = fs.readFileSync("app/lib/retention/retention-service.ts", "utf8");
  assert.ok(service.includes("policy: RetentionPolicy"), "รายงานต้องแนบนโยบายที่ใช้จริง");
});

test("แหล่งเชื่อมต่อฐานข้อมูลมีลำดับความสำคัญที่แน่นอน", () => {
  assert.deepEqual(databaseUrlFor({ DATABASE_URL: "postgres://a" }), {
    url: "postgres://a",
    source: "DATABASE_URL"
  });

  assert.deepEqual(databaseUrlFor({ POSTGRES_URL: "postgres://b" }), {
    url: "postgres://b",
    source: "POSTGRES_URL"
  });

  // ตั้งทั้งสองตัว DATABASE_URL ต้องชนะเสมอ ไม่ใช่แล้วแต่ลำดับการอ่าน
  assert.deepEqual(databaseUrlFor({ DATABASE_URL: "postgres://a", POSTGRES_URL: "postgres://b" }), {
    url: "postgres://a",
    source: "DATABASE_URL"
  });

  assert.deepEqual(databaseUrlFor({}), { url: null, source: null });
});

test("การ deploy จริงต้องไม่ตกไปใช้ PGlite", () => {
  const sqlLayer = fs.readFileSync("app/lib/db/sql.ts", "utf8");

  // มีด่านที่โยนข้อผิดพลาดเมื่อ deploy แบบ serverless โดยไม่มีฐานข้อมูลจริง
  assert.match(sqlLayer, /VERCEL \|\| process\.env\.AWS_LAMBDA_FUNCTION_NAME/);
  assert.match(sqlLayer, /throw new Error\(\s*\n?\s*"DATABASE_URL \(หรือ POSTGRES_URL\) is required/);

  // ลำดับความสำคัญถูกตัดสินในฟังก์ชันเดียว ไม่กระจายเป็นการอ่าน env หลายที่
  const resolver = sqlLayer.slice(
    sqlLayer.indexOf("export function databaseUrlFor"),
    sqlLayer.indexOf("export function createSqlClient")
  );
  assert.ok(resolver.includes("env.DATABASE_URL"), "databaseUrlFor ต้องเป็นที่ที่อ่าน DATABASE_URL");
  assert.ok(resolver.includes("env.POSTGRES_URL"), "databaseUrlFor ต้องเป็นที่ที่อ่าน POSTGRES_URL");

  // นอกฟังก์ชันนั้น ทั้งสองชื่อปรากฏได้เฉพาะในข้อความแจ้งเตือน ไม่ใช่การอ่านค่า
  const elsewhere = sqlLayer.replace(resolver, "");
  for (const name of ["DATABASE_URL", "POSTGRES_URL"]) {
    const reads = [...elsewhere.matchAll(new RegExp(`env\\.${name}`, "g"))].length;
    assert.equal(reads, 0, `${name} ต้องถูกอ่านเฉพาะใน databaseUrlFor เท่านั้น`);
  }
});
