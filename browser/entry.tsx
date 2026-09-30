/**
 * จุดเริ่มของรุ่นที่รันในเบราว์เซอร์
 *
 * ลำดับสำคัญ: ติดตั้งชั้นเก็บข้อมูลก่อนที่โค้ดชั้นบนจะเรียก getDb() ครั้งแรก
 * getDb() อ่านจาก globalThis.__route2ownDb ซึ่งเป็นช่องที่มีอยู่ในโค้ดจริงแล้ว
 * จึงไม่ต้องแก้ไฟล์ใดในแอปเพื่อให้รันที่นี่
 */
import { createRoot } from "react-dom/client";

import MIGRATION_SQL from "virtual:migrations";

import { createMemorySqlClient } from "./memory-sql.mjs";
import { App, installFormInterception } from "./app.tsx";
import { installFetchInterception } from "./api-router.ts";
import { installNavigationInterception, currentPath, navigate } from "./router.ts";

const client = createMemorySqlClient();
client.__setMigration(MIGRATION_SQL);
(globalThis as unknown as { __route2ownDb: unknown }).__route2ownDb = client;

installFetchInterception();
installNavigationInterception();
installFormInterception();

if (!currentPath().startsWith("/")) navigate("/", { replace: true });
else if (!window.location.hash) navigate("/", { replace: true });

const host = document.getElementById("root");
if (!host) throw new Error("ไม่พบที่ยึดของหน้า");
createRoot(host).render(<App />);
