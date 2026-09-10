import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * ชั้นเข้าถึง PostgreSQL แบบ parameterized เพียงชั้นเดียว
 *
 * ใช้ SQL ชุดเดียวกันได้ทั้งสองไดรเวอร์:
 *  - Neon serverless  → managed PostgreSQL บน preview/production (ต้องมี DATABASE_URL)
 *  - PGlite (WASM)    → PostgreSQL ตัวจริงในเครื่อง สำหรับ dev และ test
 *
 * ค่าทุกตัวถูกส่งเป็น parameter ($1, $2, ...) เสมอ ไม่มีการต่อสตริงเข้ากับ SQL
 */
export type SqlRow = Record<string, unknown>;

export interface SqlClient {
  /** ใช้แบบ tagged template: sql`select * from applications where id = ${id}` */
  <T extends SqlRow = SqlRow>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
  /** รันคำสั่งดิบ เช่น ไฟล์ migration ที่มีหลายคำสั่ง */
  exec(statements: string): Promise<void>;
  /** ชื่อไดรเวอร์ที่กำลังใช้ ใช้ในหน้า diagnostic และ runbook */
  driver: "neon" | "pglite";
  /** สร้าง schema ให้พร้อมใช้งาน เรียกซ้ำได้ */
  migrate(): Promise<void>;
}

function buildQuery(strings: TemplateStringsArray, values: unknown[]) {
  let text = "";
  for (let i = 0; i < strings.length; i += 1) {
    text += strings[i];
    if (i < values.length) text += `$${i + 1}`;
  }
  return { text, values };
}

/**
 * รวม migration ทุกไฟล์เรียงตามชื่อ
 *
 * ทุกคำสั่งเขียนแบบ idempotent (`if not exists`) จึงรันซ้ำได้โดยไม่พัง
 * และไฟล์ที่เพิ่มทีหลังจะต่อท้ายเสมอ ไม่แก้ของเดิม
 */
export function migrationSql(): string {
  const dir = path.join(process.cwd(), "db/migrations");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(path.join(dir, file), "utf8"))
    .join("\n");
}

function createNeonClient(url: string): SqlClient {
  // นำเข้าแบบ lazy เพื่อไม่ให้ dev/test ที่ใช้ PGlite ต้องโหลดไดรเวอร์นี้
  let pool: { query: (text: string, params: unknown[]) => Promise<{ rows: SqlRow[] }> } | null = null;

  async function connection() {
    if (!pool) {
      const { Pool } = await import("@neondatabase/serverless");
      pool = new Pool({ connectionString: url }) as unknown as typeof pool;
    }
    return pool!;
  }

  const client = (async <T extends SqlRow>(strings: TemplateStringsArray, ...values: unknown[]) => {
    const { text, values: params } = buildQuery(strings, values);
    const result = await (await connection()).query(text, params);
    return result.rows as T[];
  }) as SqlClient;

  client.driver = "neon";
  client.exec = async (statements: string) => {
    await (await connection()).query(statements, []);
  };
  client.migrate = async () => {
    await client.exec(migrationSql());
  };

  return client;
}

function createPgliteClient(dataDir: string | undefined): SqlClient {
  type Pglite = { query: (text: string, params?: unknown[]) => Promise<{ rows: SqlRow[] }>; exec: (s: string) => Promise<unknown> };
  let instance: Promise<Pglite> | null = null;

  function connection() {
    if (!instance) {
      instance = import("@electric-sql/pglite").then(({ PGlite }) =>
        dataDir ? (new PGlite(dataDir) as unknown as Pglite) : (new PGlite() as unknown as Pglite)
      );
    }
    return instance;
  }

  const client = (async <T extends SqlRow>(strings: TemplateStringsArray, ...values: unknown[]) => {
    const { text, values: params } = buildQuery(strings, values);
    const db = await connection();
    const result = await db.query(text, params);
    return result.rows as T[];
  }) as SqlClient;

  client.driver = "pglite";
  client.exec = async (statements: string) => {
    const db = await connection();
    await db.exec(statements);
  };
  client.migrate = async () => {
    await client.exec(migrationSql());
  };

  return client;
}

/**
 * ลำดับความสำคัญของแหล่งเชื่อมต่อฐานข้อมูล — มีคำตอบเดียวเสมอ
 *
 *   1. DATABASE_URL   แหล่งหลัก
 *   2. POSTGRES_URL   ชื่อที่ผู้ให้บริการบางรายตั้งให้ รองรับไว้เพื่อความเข้ากันได้
 *   3. PGlite         เฉพาะเครื่องนักพัฒนาและการทดสอบเท่านั้น
 *
 * ถ้าตั้งทั้งสองตัว DATABASE_URL ชนะเสมอ ไม่ใช่ "แล้วแต่ว่าตัวไหนถูกอ่านก่อน"
 * เพราะการมีสองแหล่งที่ไม่รู้ว่าอันไหนถูกใช้ คือทางที่ทำให้เขียนลงฐานข้อมูลผิดตัว
 */
export function databaseUrlFor(env: NodeJS.ProcessEnv = process.env): {
  url: string | null;
  source: "DATABASE_URL" | "POSTGRES_URL" | null;
} {
  if (env.DATABASE_URL) return { url: env.DATABASE_URL, source: "DATABASE_URL" };
  if (env.POSTGRES_URL) return { url: env.POSTGRES_URL, source: "POSTGRES_URL" };
  return { url: null, source: null };
}

export function createSqlClient(): SqlClient {
  const { url } = databaseUrlFor();
  if (url) return createNeonClient(url);

  // อันตรายจริงคือดิสก์ของ serverless ที่ไม่คงอยู่ข้าม request ไม่ใช่ค่า NODE_ENV
  // การรัน `next start` ในเครื่องจึงยังใช้ PGlite ได้ ส่วนการ deploy จริงต้องมีฐานข้อมูลจริง
  const isServerlessDeploy = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isServerlessDeploy && process.env.ALLOW_EPHEMERAL_DB !== "true") {
    throw new Error(
      "DATABASE_URL (หรือ POSTGRES_URL) is required on a serverless deployment. " +
        "PGlite เขียนลงดิสก์ชั่วคราวซึ่งไม่คงอยู่ข้าม request"
    );
  }

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[route2own] ไม่ได้ตั้ง DATABASE_URL หรือ POSTGRES_URL — กำลังใช้ PGlite ในเครื่อง ข้อมูลจะอยู่เท่าที่โปรเซสนี้ยังทำงาน"
    );
  }

  // ไม่ระบุ path = เก็บในหน่วยความจำ เหมาะกับเทสต์; ระบุ PGLITE_DATA_DIR เพื่อให้ข้อมูล dev อยู่ข้ามการรีสตาร์ท
  return createPgliteClient(process.env.PGLITE_DATA_DIR);
}
