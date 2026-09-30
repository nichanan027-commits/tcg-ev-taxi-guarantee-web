/**
 * ติดตั้งชั้นเก็บข้อมูลในหน่วยความจำแทน PGlite เพื่อรันชุดเทสต์เดิมทับตัวมัน
 *
 * จุดประสงค์เดียวของไฟล์นี้คือ "การพิสูจน์": ถ้าชุดเทสต์ทั้งหมดที่คุม Front Office
 * ผ่านโดยเปลี่ยนเฉพาะชั้นเก็บข้อมูล ก็แสดงว่าตัวที่จะรันในเบราว์เซอร์
 * ให้ผลเหมือนของจริง ไม่ใช่การเขียนตรรกะขึ้นใหม่
 *
 * ใช้ด้วย: node --import ./browser/install-memory-sql.mjs --test tests/*.test.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { createMemorySqlClient } from "./memory-sql.mjs";

const dir = path.join(process.cwd(), "db/migrations");
const migrationSql = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(dir, f), "utf8"))
  .join("\n");

const client = createMemorySqlClient();
client.__setMigration(migrationSql);
globalThis.__route2ownDb = client;
globalThis.__route2ownMemorySql = client;
