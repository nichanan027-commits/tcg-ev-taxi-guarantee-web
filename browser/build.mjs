import { readFileSync, readdirSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";

import * as esbuild from "esbuild";

/**
 * ประกอบระบบทั้งชุดให้รันในเบราว์เซอร์ได้โดยไม่ต้องมีเซิร์ฟเวอร์
 *
 * หลักการ: ไม่เขียนตรรกะขึ้นใหม่เลย ใช้โค้ดชุดเดียวกับที่รันบน Next
 * แล้วเปลี่ยนเฉพาะสามจุดที่ผูกกับเซิร์ฟเวอร์
 *   1. ชั้นเก็บข้อมูล  — PGlite/Neon → ชั้นในหน่วยความจำ (ผ่าน globalThis.__route2ownDb)
 *   2. การเรียก API   — HTTP → เรียก route handler ตัวจริงในหน้า
 *   3. การย้ายหน้า    — เซิร์ฟเวอร์เรนเดอร์ → ตัวจัดเส้นทางในหน้า
 *
 * สิ่งที่ "ไม่" ถูกแตะ: Frozen Engine, การประเมิน, กฎเส้นทาง, ด่านความยินยอม,
 * เพดานสองสถาบันการเงิน, ข้อความกำกับ, F.A, Secure Verification
 */
const ROOT = process.cwd();
const OUT_DIR = process.argv[2] ?? path.join(ROOT, "browser/dist");

const migrationSql = readdirSync(path.join(ROOT, "db/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(ROOT, "db/migrations", f), "utf8"))
  .join("\n");

/** schema ถูกฝังเป็นสตริง เพราะเบราว์เซอร์อ่านไฟล์จากดิสก์ไม่ได้ */
const migrationsPlugin = {
  name: "migrations",
  setup(build) {
    build.onResolve({ filter: /^virtual:migrations$/ }, () => ({
      path: "virtual:migrations",
      namespace: "virtual"
    }));
    build.onLoad({ filter: /.*/, namespace: "virtual" }, () => ({
      contents: `export default ${JSON.stringify(migrationSql)};`,
      loader: "js"
    }));
  }
};

/**
 * แทนที่การย้ายหน้าด้วย window.location.href
 *
 * window.location เป็นสมบัติที่เบราว์เซอร์ไม่ยอมให้เขียนทับ จึงดักตอนรันไม่ได้
 * ขั้นตอน build จึงชี้ปลายทางไปที่ตัวจัดเส้นทางในหน้าแทน
 *
 * การแปลงนี้ทำกับผลลัพธ์ของ build เท่านั้น ไฟล์ในโปรเจกต์ไม่ถูกแก้
 * และถูกตรึงจำนวนไว้ ถ้าโค้ดต้นทางเปลี่ยนจำนวนจุด build จะล้มทันที
 * ไม่ปล่อยให้ผ่านไปแบบเงียบ ๆ
 */
const EXPECTED_NAV_REWRITES = 2;

const navigationPlugin = {
  name: "navigation",
  setup(build) {
    build.onLoad({ filter: /components\/frontoffice\/.*\.tsx$/ }, (args) => {
      const source = readFileSync(args.path, "utf8");
      if (!source.includes("window.location.href =")) return null;
      const rewritten = source.replace(
        /window\.location\.href\s*=\s*([^;]+);/g,
        "window.__route2ownNavigate($1);"
      );
      navRewrites += (source.match(/window\.location\.href\s*=/g) ?? []).length;
      return { contents: rewritten, loader: "tsx" };
    });
  }
};

let navRewrites = 0;

/**
 * ตัวแทนของโมดูลฝั่งเซิร์ฟเวอร์ที่ไม่ถูกใช้ในรุ่นนี้
 *
 * getDb() อ่าน globalThis.__route2ownDb ที่ติดตั้งไว้ก่อนแล้ว จึงไม่มีการเรียก createSqlClient
 * แต่ import graph ยังลากไดรเวอร์เข้ามา ตัวแทนนี้จึงกันไม่ให้ PGlite (หลายเมกะไบต์)
 * และ node:fs เข้าไปอยู่ใน bundle และจะโยนข้อผิดพลาดดัง ๆ ถ้ามีใครเรียกจริง
 */
const serverStubPlugin = {
  name: "server-stubs",
  setup(build) {
    build.onResolve({ filter: /^(@electric-sql\/pglite|@neondatabase\/serverless|node:fs|node:path)$/ }, (args) => ({
      path: args.path,
      namespace: "stub"
    }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({
      contents: `
        const fail = (name) => () => {
          throw new Error("รุ่นเบราว์เซอร์ไม่ได้ใช้ ${args.path} — ถ้าเห็นข้อความนี้แปลว่ามีเส้นทางที่ไม่ควรถูกเรียก");
        };
        export const readFileSync = fail("readFileSync");
        export const readdirSync = fail("readdirSync");
        export const PGlite = fail("PGlite");
        export const neon = fail("neon");
        export default { join: (...parts) => parts.join("/") };
      `,
      loader: "js"
    }));
  }
};

const result = await esbuild.build({
  entryPoints: [path.join(ROOT, "browser/entry.tsx")],
  bundle: true,
  format: "iife",
  target: "es2022",
  jsx: "automatic",
  platform: "browser",
  minify: true,
  sourcemap: false,
  metafile: true,
  outfile: path.join(OUT_DIR, "app.js"),
  alias: {
    "next/link": path.join(ROOT, "browser/shims/next-link.tsx"),
    "next/navigation": path.join(ROOT, "browser/shims/next-navigation.ts"),
    "next/server": path.join(ROOT, "browser/shims/next-server.ts")
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.DATABASE_URL": "undefined",
    "process.env.POSTGRES_URL": "undefined",
    "process.env.COMPETITION_CUTOFF_AT": "undefined",
    "process.env.ALLOW_EPHEMERAL_DB": "undefined"
  },
  loader: { ".css": "text" },
  plugins: [migrationsPlugin, navigationPlugin, serverStubPlugin],
  logLevel: "info"
});

if (navRewrites !== EXPECTED_NAV_REWRITES) {
  throw new Error(
    `การย้ายหน้าด้วย window.location.href มี ${navRewrites} จุด แต่คาดไว้ ${EXPECTED_NAV_REWRITES} จุด — ` +
      "ตรวจว่าโค้ดต้นทางเปลี่ยนไปอย่างไรก่อนปรับตัวเลขนี้"
  );
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(path.join(OUT_DIR, "app.css"), readFileSync(path.join(ROOT, "app/globals.css"), "utf8"));

const size = (p) => `${(statSync(p).size / 1024).toFixed(0)} KB`;
console.log(`app.js  ${size(path.join(OUT_DIR, "app.js"))}`);
console.log(`app.css ${size(path.join(OUT_DIR, "app.css"))}`);
console.log(`แทนที่การย้ายหน้า ${navRewrites} จุด`);
void result;
