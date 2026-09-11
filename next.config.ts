import type { NextConfig } from "next";

/**
 * Route to Own — System A (Front Office) only.
 *
 * "/" เสิร์ฟหน้า Competition Registration ที่ app/page.tsx
 * Front Office รุ่น Frozen (Competition Baseline 3a10d37) ยังเปิดได้ที่ /route2own.html
 * ในฐานะ reference implementation ที่ไม่ถูกแก้
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PGlite โหลด WASM ของตัวเอง จึงต้องอยู่นอก bundle ของเซิร์ฟเวอร์
  // ไม่กระทบ production ที่ใช้ DATABASE_URL เพราะไดรเวอร์นั้นถูก import แบบ lazy
  serverExternalPackages: ["@electric-sql/pglite"]
};

export default nextConfig;
