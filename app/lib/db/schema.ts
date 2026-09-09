import { getDb } from "./client.ts";
import type { SqlClient } from "./sql.ts";

let migrated: Promise<void> | null = null;

/**
 * เตรียม schema ให้พร้อมใช้งาน
 *
 * PGlite (dev/test) สร้าง schema ให้อัตโนมัติเพราะเริ่มจากฐานว่างทุกครั้ง
 * ส่วน managed PostgreSQL ต้องรัน migration อย่างชัดเจนด้วย `npm run db:migrate`
 * เพื่อไม่ให้ request ปกติไปแก้โครงสร้างฐานข้อมูลของ production
 */
export async function ensureSchema(): Promise<SqlClient> {
  const sql = getDb();
  if (sql.driver === "pglite") {
    if (!migrated) migrated = sql.migrate();
    await migrated;
  }
  return sql;
}

/** ใช้ในเทสต์เพื่อบังคับให้ migrate ใหม่ */
export function resetSchemaForTests(): void {
  migrated = null;
}

/** แปลงค่า numeric ของ PostgreSQL (ที่คืนมาเป็นสตริง) ให้เป็นตัวเลข */
export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

export function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : Number(value);
}

export function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

export function strOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

export function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return value ? String(value) : new Date().toISOString();
}

export function isoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return iso(value);
}

/** ตัวสร้าง id ภายในของแถวย่อย (ไม่ใช่เลขที่ใบสมัครที่แสดงต่อผู้ใช้) */
export function rowId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}
