import { readFileSync } from "node:fs";
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

export function migrationSql(): string {
  return readFileSync(path.join(process.cwd(), "db/migrations/0001_competition_registration.sql"), "utf8");
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

export function createSqlClient(): SqlClient {
  const url = process.env.DATABASE_URL;
  if (url) return createNeonClient(url);

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_EPHEMERAL_DB !== "true") {
    throw new Error(
      "DATABASE_URL is required in production. PGlite เขียนลงดิสก์ชั่วคราวของ serverless ซึ่งไม่คงอยู่ข้าม request"
    );
  }

  // ไม่ระบุ path = เก็บในหน่วยความจำ เหมาะกับเทสต์; ระบุ PGLITE_DATA_DIR เพื่อให้ข้อมูล dev อยู่ข้ามการรีสตาร์ท
  return createPgliteClient(process.env.PGLITE_DATA_DIR);
}
