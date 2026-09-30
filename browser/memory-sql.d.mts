/** ชนิดของชั้นเก็บข้อมูลในหน่วยความจำ (ตัวจริงเขียนเป็น .mjs เพื่อให้รันได้ทั้งใน Node และเบราว์เซอร์) */
import type { SqlClient } from "../app/lib/db/sql.ts";

export type MemorySqlClient = SqlClient & {
  __setMigration: (sql: string) => void;
  __dump: () => Record<string, Record<string, unknown>[]>;
};

export function createMemorySqlClient(): MemorySqlClient;
