import { defineConfig, devices } from "@playwright/test";

/**
 * เทสต์เส้นทางผู้ใช้จริงบนเบราว์เซอร์
 *
 * รันบนเซิร์ฟเวอร์ที่ build แล้ว (`next build` + `next start`) ไม่ใช่โหมด dev
 * เพราะสิ่งที่กรรมการเปิดดูคือรุ่นที่ build แล้ว
 *
 * ฐานข้อมูลเป็น PGlite ในหน่วยความจำ จึงเริ่มจากศูนย์ทุกครั้งและไม่แตะข้อมูลจริง
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined
    }
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      }
});
