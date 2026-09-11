/**
 * รัน migration กับฐานข้อมูลที่ DATABASE_URL ชี้ไป
 *
 * แยกออกมาเป็นคำสั่งของตัวเอง ไม่ให้ request ปกติไปแก้โครงสร้างฐานข้อมูล
 * เพราะการ migrate ระหว่างให้บริการอยู่คือการเปลี่ยนโครงสร้างใต้เท้าผู้ใช้
 *
 * รันด้วย:
 *   DATABASE_URL="postgresql://..." npm run db:migrate
 */
import { getDb } from "../app/lib/db/client.ts";

if (!process.env.DATABASE_URL) {
  console.error("ต้องตั้ง DATABASE_URL ก่อนจึงจะ migrate ได้");
  console.error('  DATABASE_URL="postgresql://user:password@host/db?sslmode=require" npm run db:migrate');
  process.exit(2);
}

const sql = getDb();
console.log(`driver: ${sql.driver}`);

await sql.migrate();

const tables = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name
`;

console.log(`migrated — ${tables.length} tables:`);
for (const row of tables) console.log(`  ${row.table_name}`);
