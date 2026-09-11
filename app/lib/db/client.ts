import type { SqlClient } from "./sql.ts";
import { createSqlClient } from "./sql.ts";

/**
 * ตัวเชื่อมฐานข้อมูลของ Competition Registration
 *
 * - ตั้ง DATABASE_URL → ใช้ managed PostgreSQL (Neon / Vercel Postgres) สำหรับ preview และ production
 * - ไม่ตั้ง → ใช้ PGlite ซึ่งเป็น PostgreSQL ตัวจริงที่คอมไพล์เป็น WASM สำหรับ dev และ test
 *
 * ทั้งสองทางใช้ schema และ SQL ชุดเดียวกัน (db/migrations/*.sql)
 * บน production ต้องมี DATABASE_URL เสมอ เพราะดิสก์ของ serverless ไม่คงอยู่ข้าม request
 *
 * ตัวเชื่อมถูกเก็บไว้บน globalThis ไม่ใช่ตัวแปรระดับโมดูล
 * เพราะ Next แยก bundle ของ Route Handler กับของ Server Component ออกจากกัน
 * ตัวแปรระดับโมดูลจึงกลายเป็นคนละตัวและได้ฐานข้อมูลคนละชุด
 * ซึ่งทำให้ข้อมูลที่ POST ผ่าน API หายไปเมื่อหน้าเว็บอ่านกลับมา
 */
type DbGlobal = typeof globalThis & { __route2ownDb?: SqlClient | null };

export function getDb(): SqlClient {
  const store = globalThis as DbGlobal;
  if (!store.__route2ownDb) store.__route2ownDb = createSqlClient();
  return store.__route2ownDb;
}

/** ใช้ในเทสต์เพื่อเริ่มสถานะใหม่ */
export function resetDbForTests(): void {
  (globalThis as DbGlobal).__route2ownDb = null;
}
