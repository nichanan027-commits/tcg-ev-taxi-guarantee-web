import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { databaseUrlFor } from "../app/lib/db/sql.ts";
import { resolveRetentionPolicy } from "../app/lib/retention/retention-service.ts";

/**
 * ค่าตั้งค่าที่ต้องมาจากภายนอก ไม่ใช่จากค่าที่ฝังไว้ในโค้ด
 */

test("production source และ env example ไม่มีวันสิ้นสุดการแข่งขันที่สมมติขึ้น", () => {
  const service = fs.readFileSync("app/lib/retention/retention-service.ts", "utf8");
  const config = fs.readFileSync("app/lib/config/competition.ts", "utf8");
  const example = fs.readFileSync(".env.example", "utf8");

  assert.doesNotMatch(service, /2026-10-31/);
  assert.doesNotMatch(config, /2026-10-31/);
  assert.doesNotMatch(example, /2026-10-31/);
  assert.ok(!config.includes("competitionCutoffAt"), "วันสิ้นสุดการแข่งขันต้องไม่ถูกฝังไว้ใน competitionConfig");
});

test("แอป runtime ทำงานได้แม้ยังไม่มี COMPETITION_CUTOFF_AT", () => {
  for (const env of [
    {},
    { VERCEL: "1" },
    { AWS_LAMBDA_FUNCTION_NAME: "route2own" },
    { VERCEL: "1", NODE_ENV: "production" },
    { VERCEL: "1", COMPETITION_CUTOFF_AT: "" },
    { VERCEL: "1", COMPETITION_CUTOFF_AT: "   " }
  ]) {
    assert.equal(resolveRetentionPolicy(env), null);
  }
});

test("เมื่อตั้ง cutoff ระบบใช้ค่านั้นและบอกที่มาได้", () => {
  const policy = resolveRetentionPolicy({
    VERCEL: "1",
    COMPETITION_CUTOFF_AT: "2027-01-15T16:59:59.000Z"
  });

  assert.ok(policy);
  assert.equal(policy.competitionCutoffAt, "2027-01-15T16:59:59.000Z");
  assert.equal(policy.cutoffSource, "COMPETITION_CUTOFF_AT");
  assert.equal(policy.retentionDays, 30, "กติกา 30 วันไม่เปลี่ยน");
});

test("วันสิ้นสุดที่รูปแบบไม่ถูกต้องถูกปฏิเสธ ไม่ใช่ตีความเอาเอง", () => {
  for (const value of ["สิ้นเดือนตุลาคม", "31/10/2026", "not-a-date"]) {
    assert.throws(() => resolveRetentionPolicy({ COMPETITION_CUTOFF_AT: value }), /ISO 8601/);
  }
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

  assert.deepEqual(databaseUrlFor({ DATABASE_URL: "postgres://a", POSTGRES_URL: "postgres://b" }), {
    url: "postgres://a",
    source: "DATABASE_URL"
  });

  assert.deepEqual(databaseUrlFor({}), { url: null, source: null });
});

test("การ deploy จริงต้องไม่ตกไปใช้ PGlite", () => {
  const sqlLayer = fs.readFileSync("app/lib/db/sql.ts", "utf8");

  assert.match(sqlLayer, /VERCEL \|\| process\.env\.AWS_LAMBDA_FUNCTION_NAME/);
  assert.match(sqlLayer, /throw new Error\(\s*\n?\s*"DATABASE_URL \(หรือ POSTGRES_URL\) is required/);

  const resolver = sqlLayer.slice(
    sqlLayer.indexOf("export function databaseUrlFor"),
    sqlLayer.indexOf("export function createSqlClient")
  );
  assert.ok(resolver.includes("env.DATABASE_URL"), "databaseUrlFor ต้องเป็นที่ที่อ่าน DATABASE_URL");
  assert.ok(resolver.includes("env.POSTGRES_URL"), "databaseUrlFor ต้องเป็นที่ที่อ่าน POSTGRES_URL");

  const elsewhere = sqlLayer.replace(resolver, "");
  for (const name of ["DATABASE_URL", "POSTGRES_URL"]) {
    const reads = [...elsewhere.matchAll(new RegExp(`env\\.${name}`, "g"))].length;
    assert.equal(reads, 0, `${name} ต้องถูกอ่านเฉพาะใน databaseUrlFor เท่านั้น`);
  }
});
