import type { SqlClient } from "./sql.ts";
import { createSqlClient } from "./sql.ts";

let cached: SqlClient | null = null;

/**
 * ตัวเชื่อมฐานข้อมูลของ Competition Registration
 *
 * - ตั้ง DATABASE_URL → ใช้ managed PostgreSQL (Neon / Vercel Postgres) สำหรับ preview และ production
 * - ไม่ตั้ง → ใช้ PGlite ซึ่งเป็น PostgreSQL ตัวจริงที่คอมไพล์เป็น WASM สำหรับ dev และ test
 *
 * ทั้งสองทางใช้ schema และ SQL ชุดเดียวกัน (db/migrations/0001_competition_registration.sql)
 * บน production ต้องมี DATABASE_URL เสมอ เพราะดิสก์ของ serverless ไม่คงอยู่ข้าม request
 */
export function getDb(): SqlClient {
  if (!cached) cached = createSqlClient();
  return cached;
}

/** ใช้ในเทสต์เพื่อเริ่มสถานะใหม่ */
export function resetDbForTests(): void {
  cached = null;
}
