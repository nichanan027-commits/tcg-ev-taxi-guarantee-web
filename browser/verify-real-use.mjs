/**
 * เดินเส้นทางแบบผู้ใช้จริง — ไม่แตะปุ่มชุดข้อมูลสาธิตเลย
 *
 * การทดสอบก่อนหน้านี้ใช้ปุ่มสาธิตซึ่งกรอกข้อมูลให้ล่วงหน้าทุกช่อง
 * จึงไม่เคยพิสูจน์ว่า "คนที่เปิดมาแล้วกรอกเอง" เดินจนจบได้จริงหรือไม่
 * ซึ่งเป็นสิ่งเดียวที่สำคัญเมื่อลิงก์ถูกส่งให้กรรมการไปแล้ว
 *
 * ใช้ http ไม่ใช่ file:// เพราะ artifact เสิร์ฟผ่าน http
 */
import { chromium } from "@playwright/test";

const URL = process.argv[2];
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });

/**
 * ตัดทางออกอินเทอร์เน็ตทั้งหมด
 *
 * ลิงก์นี้ถูกส่งให้กรรมการเปิดจากที่ไหนก็ได้ ถ้ายังต้องพึ่ง CDN
 * เน็ตที่ช้าหรือถูกบล็อกจะทำให้ปุ่มดาวน์โหลด "กดแล้วไม่ทำงาน"
 * เทสต์นี้จึงบล็อกทุกคำขอที่ออกนอกเครื่อง เพื่อพิสูจน์ว่าไม่ต้องพึ่งเน็ตจริง
 */
let blockedExternal = 0;
await context.route("**://**", async (route) => {
  const url = route.request().url();
  if (url.startsWith("http://localhost")) return route.continue();
  blockedExternal += 1;
  await route.abort("blockedbyclient");
});

const page = await context.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
page.on("requestfailed", (r) => errors.push(`requestfailed: ${r.url().slice(0, 90)} ${r.failure()?.errorText ?? ""}`));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

check("หน้าแรกโหลดผ่าน http ได้", (await page.locator("body").innerText()).includes("สำหรับผู้ขับแท็กซี่"));
check("engine โหลดสำเร็จ", await page.evaluate(() => typeof window.Route2OwnEngine === "object"));

await page.getByRole("button", { name: /สำหรับผู้ขับแท็กซี่/ }).click();
await page.waitForTimeout(1200);

const step = () => page.evaluate(() => currentDriverStep);
const bodyText = () => page.locator("body").innerText();

/** กรอกทุกช่องที่ว่างในขั้นปัจจุบัน เหมือนคนกรอกเอง */
async function fillCurrentStep() {
  const inputs = page.locator("#driverStepContainer input:not([disabled]):not([readonly])");
  for (let i = 0; i < (await inputs.count()); i += 1) {
    const el = inputs.nth(i);
    const type = await el.getAttribute("type");
    if (type === "checkbox") {
      if (!(await el.isChecked())) await el.check();
      continue;
    }
    const value = await el.inputValue();
    if (value !== "") continue;
    const id = (await el.getAttribute("id")) ?? "";
    if (type === "number") await el.fill("5");
    else if (/phone/i.test(id)) await el.fill("0812345678");
    else if (/province/i.test(id)) await el.fill("กรุงเทพมหานคร");
    else if (/name/i.test(id)) await el.fill("ผู้ทดลองใช้งาน");
    else await el.fill("ทดสอบ");
  }
}

const journey = [];
for (let i = 0; i < 8; i += 1) {
  const landed = await step();
  const title = (await page.locator(".content-head h2").first().innerText().catch(() => "")).trim();
  journey.push(`${landed + 1}. ${title}`);

  const broken = /undefined|NaN|\[object Object\]/.test(await bodyText());
  check(
    `ขั้นที่ ${i + 1} เดินถึงและไม่มีค่าเสีย: ${title.slice(0, 24)}`,
    landed === i && title.length > 0 && !broken,
    landed === i ? "" : `อยู่ขั้น ${landed + 1}`
  );

  if (i === 7) break;

  await fillCurrentStep();
  await page.waitForTimeout(400);

  const pickFi = page.locator("#driverStepContainer button").filter({ hasText: /^เลือก สถาบันการเงิน นี้$/ });
  if (await pickFi.count()) {
    await pickFi.first().click();
    await page.waitForTimeout(700);
  }

  const next = page.locator("#driverStepContainer .actions button.btn.primary").last();
  if (!(await next.count())) {
    check(`ขั้นที่ ${i + 1} มีปุ่มไปต่อ`, false, "ไม่พบปุ่ม");
    break;
  }
  const enabled = await next.isEnabled();
  check(`ขั้นที่ ${i + 1} ปุ่มไปต่อกดได้หลังกรอกครบ`, enabled, enabled ? "" : await next.innerText());
  if (!enabled) break;

  await next.click();
  await page.waitForTimeout(1200);
}

// ผลการประเมินต้องเกิดจากข้อมูลที่กรอกเอง ไม่ใช่ค่าที่ค้างจากชุดสาธิต
const readiness = await page.evaluate(() => ({
  route: state.readiness.route,
  score: state.readiness.readinessScore,
  dscr: state.calc.dscr,
  demoCase: state.demoCase
}));
check("ไม่ได้ใช้ชุดข้อมูลสาธิต", !readiness.demoCase, `demoCase="${readiness.demoCase}"`);
check(
  "ได้เส้นทางจริงจากข้อมูลที่กรอกเอง",
  ["READY FOR FI", "BUILD READINESS", "NO NEW DEBT"].includes(readiness.route),
  `${readiness.route} · Pre-Score ${readiness.score} · DSCR ${Number(readiness.dscr).toFixed(2)}x`
);

// ดาวน์โหลดใบรับรองต้องได้ไฟล์จริง — ทำก่อนไปแก้ตัวเลขให้เส้นทางเปลี่ยน
await page.evaluate(() => window.jumpDriver(5));
await page.waitForTimeout(1400);
const dl = page.locator("#driverStepContainer button").filter({ hasText: /ดาวน์โหลด/ });
check("ขั้นใบรับรองมีปุ่มดาวน์โหลด", (await dl.count()) > 0);
if (await dl.count()) {
  const waitDownload = page.waitForEvent("download", { timeout: 60000 }).catch(() => null);
  await dl.first().click();
  const download = await waitDownload;
  const name = download ? await download.suggestedFilename() : "";
  check("กดดาวน์โหลดแล้วได้ไฟล์จริง", Boolean(download), name || "ไม่มีไฟล์ออกมา");
  if (download) {
    const path = await download.path();
    const { statSync } = await import("node:fs");
    const bytes = path ? statSync(path).size : 0;
    check("ไฟล์ที่ได้มีเนื้อหา", bytes > 20_000, `${(bytes / 1024).toFixed(0)} KB · ${name}`);
  }
  check(
    "ทำงานได้โดยไม่ต้องออกอินเทอร์เน็ตเลย",
    blockedExternal === 0,
    blockedExternal === 0 ? "ไม่มีคำขอออกนอกเครื่อง" : `มีคำขอออกนอก ${blockedExternal} ครั้ง`
  );
}

// แก้ตัวเลขแล้วผลต้องขยับตาม — นี่คือหัวใจของ "ทดลองใช้งานจริง"
await page.evaluate(() => window.jumpDriver(2));
await page.waitForTimeout(1000);
const before = await page.evaluate(() => state.calc.dscr);
await page.locator("#vehiclePrice").fill("1500000");
await page.locator("#vehiclePrice").dispatchEvent("input");
await page.waitForTimeout(1200);
const after = await page.evaluate(() => state.calc.dscr);
check("แก้ราคารถแล้วผลคำนวณขยับตามทันที", after < before, `${before.toFixed(2)}x → ${after.toFixed(2)}x`);

console.log("\nเส้นทางที่เดินจริง:");
for (const s of journey) console.log(`  ${s}`);

check("ไม่มีข้อผิดพลาดระหว่างใช้งาน", errors.length === 0, errors.slice(0, 4).join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ผ่าน`);
if (failed.length) {
  console.log("ที่ยังไม่ผ่าน:");
  for (const f of failed) console.log(`  - ${f.name} ${f.detail}`);
  process.exit(1);
}
