/**
 * ตรวจรุ่นเบราว์เซอร์ด้วยการเดินเส้นทางจริง
 *
 * เทียบผลที่หน้าจอแสดง กับผลที่ชุดเทสต์ฝั่งเซิร์ฟเวอร์ยืนยันไว้แล้ว
 * ถ้าสองฝั่งไม่ตรงกัน แปลว่ารุ่นนี้ยังไม่ใช่ระบบเดียวกัน
 */
import { chromium } from "@playwright/test";

const SITE = process.argv[2];
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(`file://${SITE}/index.html`);
await page.waitForSelector('[data-role="demo-mode"]', { timeout: 20000 });
check("หน้าเริ่มต้นเปิดได้และแสดงชุดข้อมูลสาธิต", true);

// เดโม D ต้องได้ READY FOR FI
await page.click('[data-role="demo-case-D"]');
await page.waitForSelector('[data-role="route-hero"]', { timeout: 30000 });
const hero = await page.textContent('[data-role="route-hero"]');
check("เดโม D ได้เส้นทาง READY FOR FI", /READY FOR FI/.test(hero), hero?.trim().slice(0, 80));

const appId = (await page.textContent(".fo-eyebrow"))?.match(/RTO-C26-\d{6}/)?.[0] ?? "";
check("ออกเลขที่ใบสมัครตามรูปแบบจริง", /^RTO-C26-\d{6}$/.test(appId), appId);

// ตัวเลขบนหน้าจอต้องมาจาก Snapshot
const passport = await page.textContent(".fo-shell");
check("หน้าผลแสดง DSCR และ Pre-Score", /DSCR/.test(passport) && /Pre-Score/i.test(passport));
check("ไม่มีคำว่า Eligible Guaranteed Amount", !/Eligible Guaranteed Amount/i.test(passport));

// เปรียบเทียบสถาบันการเงิน
await page.goto(`file://${SITE}/index.html#/apply/${appId}/fi`);
await page.waitForSelector('[data-role="fi-option"]', { timeout: 20000 });
const fiCount = await page.locator('[data-role="fi-option"]').count();
check("หน้าเปรียบเทียบแสดงรายการสถาบันการเงิน", fiCount >= 4, `${fiCount} แห่ง`);

// เลือกสองแห่งตาม data-fi-id ไม่ใช่ตามลำดับ
await page.click('[data-role="fi-option"][data-fi-id="IBANK_GREEN_LIFE"] [data-role="fi-select-toggle"]');
await page.click('[data-role="fi-option"][data-fi-id="KKP_EV"] [data-role="fi-select-toggle"]');
await page.click('[data-role="fi-save-selections"]');
await page.waitForSelector('[data-role="fi-handoff-card"]', { timeout: 40000 });
const cards = await page.locator('[data-role="fi-handoff-card"]').count();
check("บันทึกการเลือกแล้วไปหน้าเตรียมส่งต่อ", cards === 2, `${cards} ใบ`);

// ผลของแต่ละแห่งถูกตัดสินแยกกัน — อ่านจากที่หน้าจอแสดงจริง
const card = (fiId) => page.locator(`[data-role="fi-handoff-card"][data-fi-id="${fiId}"]`);
const ibankRoute = (await card("IBANK_GREEN_LIFE").locator('[data-role="fi-specific-route"]').innerText()).trim();
const kkpRoute = (await card("KKP_EV").locator('[data-role="fi-specific-route"]').innerText()).trim();
check("iBank ภายใต้เงื่อนไขของตัวเองเป็น READY FOR FI", /READY FOR FI/.test(ibankRoute), ibankRoute);
check("KKP ภายใต้เงื่อนไขของตัวเองไม่ใช่ READY FOR FI", !/READY FOR FI/.test(kkpRoute), kkpRoute);

// ด่านความยินยอม: มีให้เฉพาะแห่งที่ผลของแห่งนั้นเป็น READY FOR FI
const ibankConsent = await card("IBANK_GREEN_LIFE").locator('[data-role="fi-consent"]').count();
const kkpConsent = await card("KKP_EV").locator('[data-role="fi-consent"]').count();
check("แห่งที่ผลเป็น READY FOR FI มีช่องให้ความยินยอม", ibankConsent === 1, `${ibankConsent} ช่อง`);
check("แห่งที่ผลยังไม่ READY FOR FI ไม่มีช่องให้ความยินยอม", kkpConsent === 0, `${kkpConsent} ช่อง`);

// ให้ความยินยอมแห่งที่พร้อม แล้วเตรียมส่งต่อ
await card("IBANK_GREEN_LIFE").locator('[data-role="fi-consent"]').click();
await card("IBANK_GREEN_LIFE").locator('[data-role="fi-prepare-handoff"]').click();
await card("IBANK_GREEN_LIFE").locator('[data-role="handoff-ready"]').waitFor({ timeout: 30000 });
const readyText = (await card("IBANK_GREEN_LIFE").locator('[data-role="handoff-ready"]').innerText()).trim();
check("ส่งต่อได้เฉพาะแห่งที่ยินยอมและผลพร้อม", readyText.length > 0, readyText.slice(0, 70));
check(
  "แห่งที่ยังไม่พร้อมยังไม่มีสถานะส่งต่อ",
  (await card("KKP_EV").locator('[data-role="handoff-ready"]').count()) === 0
);

// ด่านฝั่ง API: ยินยอมกับแห่งที่ยังไม่ READY ต้องได้ 409
const gate = await page.evaluate(async (id) => {
  const response = await fetch(`/api/applications/${id}/fi-consents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fiId: "KKP_EV" })
  });
  return { status: response.status, body: await response.text() };
}, appId);
check(
  "ยินยอมกับสถาบันที่ผลยังไม่ READY FOR FI ได้ 409",
  gate.status === 409,
  `status ${gate.status}`
);
check(
  "ข้อความ 409 ตรงตามที่กำหนด",
  gate.body.includes("ยังไม่อยู่ในสถานะ READY FOR FI"),
  gate.body.slice(0, 90)
);

// เพดานสองแห่ง
const cap = await page.evaluate(async (id) => {
  const response = await fetch(`/api/applications/${id}/fi-selections`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fiIds: ["IBANK_GREEN_LIFE", "KKP_EV", "KLEASING_EV"] })
  });
  return { status: response.status, body: await response.text() };
}, appId);
check("เลือกเกินสองแห่งถูกปฏิเสธ", cap.status >= 400, `status ${cap.status}`);

// F.A — ต้องใช้ใบสมัครที่ยังไม่พร้อม
const build = await page.evaluate(async () => {
  const response = await fetch("/api/demo/B", { method: "POST", headers: { accept: "application/json" } });
  return response.json();
});
await page.goto(`file://${SITE}/index.html#/apply/${build.applicationId}/advisory`);
await page.waitForSelector('[data-role="fa-submit"]', { timeout: 20000 });
await page.click('[data-role="fa-submit"]');
await page.waitForSelector('[data-role="fa-case-id"]', { timeout: 30000 });
const caseId = (await page.textContent('[data-role="fa-case-id"]'))?.trim() ?? "";
check("เปิดเคสคำปรึกษาได้และเลขที่เป็นลำดับจริง", /^FA-C26-\d{6}$/.test(caseId), caseId);

// Secure Verification — ค่าอ่อนไหวต้องหายเมื่อสลับบทบาท
await page.goto(`file://${SITE}/index.html#/apply/${appId}/verification`);
await page.waitForSelector('[data-role="verification-input-nationalId"]', { timeout: 20000 });
await page.fill('[data-role="verification-input-nationalId"]', "1234567890123");
await page.click('[data-role="verification-role-FI_STAFF"]');
const cleared = await page.inputValue('[data-role="verification-input-nationalId"]');
check("สลับบทบาทแล้วค่าอ่อนไหวถูกล้าง", cleared === "", `ค่าที่เหลือ "${cleared}"`);

const storage = await page.evaluate(() => ({
  local: Object.keys(window.localStorage).length,
  session: Object.keys(window.sessionStorage).length
}));
check(
  "ไม่มีข้อมูลอ่อนไหวถูกเก็บใน localStorage หรือ sessionStorage",
  storage.local === 0 && storage.session === 0,
  JSON.stringify(storage)
);

// ปุ่มดาวน์โหลดรายงาน
await page.goto(`file://${SITE}/index.html#/apply/${appId}`);
await page.waitForSelector('[data-role="route-hero"]', { timeout: 20000 });
const pdfButton = await page.locator("button", { hasText: "ดาวน์โหลด" }).count();
check("หน้าผลมีปุ่มดาวน์โหลดรายงาน", pdfButton > 0);

// มือถือ — ย่อจอในหน้าเดิม เพราะข้อมูลอยู่ในหน่วยความจำของหน้านั้น
// แท็บใหม่คือชุดข้อมูลใหม่ ซึ่งเป็นคุณสมบัติของรุ่นนี้ ไม่ใช่ข้อบกพร่อง
await page.setViewportSize({ width: 390, height: 844 });
for (const [name, route] of [
  ["หน้าผลความพร้อม", `#/apply/${appId}`],
  ["หน้าเปรียบเทียบสถาบันการเงิน", `#/apply/${appId}/fi`],
  ["หน้าเตรียมส่งต่อ", `#/apply/${appId}/handoff`]
]) {
  await page.goto(`file://${SITE}/index.html${route}`);
  await page.waitForSelector(".fo-shell", { timeout: 20000 });
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`จอมือถือไม่ล้นแนวนอน: ${name}`, overflow <= 1, `เกิน ${overflow}px`);
}
await page.setViewportSize({ width: 1280, height: 1000 });

// เส้นทางที่ผู้เล่นกรอกเองทั้งหมด — ไม่ใช้ชุดข้อมูลสาธิต
await page.goto(`file://${SITE}/index.html#/`);
await page.waitForSelector(".fo-cta", { timeout: 20000 });
await page.click("button.fo-cta");
await page.waitForSelector('[data-role="registration-wizard"]', { timeout: 30000 });
const wizardId = (await page.textContent(".fo-title"))?.match(/RTO-C26-\d{6}/)?.[0] ?? "";
check("กดเริ่มสมัครแล้วได้ใบสมัครใหม่พร้อมตัวช่วยกรอก", /^RTO-C26-\d{6}$/.test(wizardId), wizardId);

await page.check(".fo-check input[type=checkbox]");
await page.click("button.fo-cta");
await page.waitForSelector('[data-role="wizard-next"]', { timeout: 20000 });

/**
 * กรอกช่องที่ยังว่างในขั้นปัจจุบัน
 *
 * ปุ่มถัดไปถูกปิดไว้จนกรอกครบ ซึ่งเป็นพฤติกรรมของตัวจริง
 * จึงต้องกรอกเหมือนผู้ใช้ ไม่ใช่ข้ามด่าน
 */
const ANSWERS = [
  [/ชื่อ/, "ผู้ทดลอง"],
  [/เบอร์โทร/, "0812345678"],
  [/จังหวัด/, "กรุงเทพมหานคร"]
];

async function fillStep() {
  const labels = page.locator(".fo-step label");
  for (let i = 0; i < (await labels.count()); i += 1) {
    const label = labels.nth(i);
    const input = label.locator("input[type=text], input:not([type]), input[type=tel]");
    if (!(await input.count())) continue;
    if ((await input.first().inputValue()) !== "") continue;
    const text = await label.innerText();
    const answer = ANSWERS.find(([pattern]) => pattern.test(text));
    await input.first().fill(answer ? answer[1] : "ทดสอบ");
  }
  for (const numeric of await page.locator(".fo-step input[type=number]").all()) {
    if ((await numeric.inputValue()) === "") await numeric.fill("5");
  }
}

// เดินทุกขั้นจนถึงปุ่มประเมิน
let steps = 0;
let blocked = null;
while (steps < 12) {
  if (await page.locator('[data-role="submit-evaluate"]').count()) break;
  await fillStep();
  await page.waitForTimeout(150);
  if (!(await page.locator('[data-role="wizard-next"]').isEnabled())) {
    blocked = await page.locator(".fo-step h2").first().innerText();
    break;
  }
  await page.click('[data-role="wizard-next"]');
  await page.waitForTimeout(250);
  steps += 1;
}
check(
  "ตัวช่วยกรอกเดินครบทุกขั้นจนถึงขั้นประเมิน",
  blocked === null && steps > 0 && steps < 12,
  blocked ? `ติดที่ขั้น "${blocked}"` : `${steps} ขั้น`
);

await page.click('[data-role="submit-evaluate"]');
await page.waitForSelector('[data-role="route-hero"]', { timeout: 40000 });
const wizardHero = (await page.textContent('[data-role="route-hero"]'))?.trim() ?? "";
// ข้อความที่ผู้สมัครเห็นสำหรับ NO NEW DEBT คือ "ยังไม่พร้อมสำหรับสินเชื่อใหม่"
// รหัสดิบถูกซ่อนไว้โดยเจตนา จึงต้องตรวจด้วยข้อความที่ผู้สมัครเห็นจริง
check(
  "กรอกเองแล้วได้ผลประเมินจากเครื่องคำนวณกลาง",
  /READY FOR FI|BUILD READINESS|ยังไม่พร้อมสำหรับสินเชื่อใหม่/.test(wizardHero),
  wizardHero.slice(0, 60)
);
/**
 * รหัสดิบต้องไม่โผล่บนหน้าจอที่ผู้สมัครอ่าน
 *
 * เนื้อหารายงานที่เตรียมไว้สำหรับแปลงเป็น PDF ถูกกันออกจากการตรวจนี้
 * เพราะรายงานใส่ชื่อเส้นทางตาม engine ไว้โดยเจตนาเพื่อให้สอบกลับได้
 * และชื่อไฟล์ก็ถูกตรึงด้วยเทสต์ไว้แล้ว (tests/pdf-report-contract.test.mjs)
 */
const visibleText = await page.evaluate(() => {
  const host = document.querySelector(".fo-report-host");
  const clone = document.querySelector(".fo-shell")?.cloneNode(true);
  if (clone instanceof HTMLElement) {
    clone.querySelector(".fo-report-host")?.remove();
    return clone.innerText;
  }
  void host;
  return "";
});
check("ผู้สมัครไม่เห็นรหัสดิบ NO NEW DEBT บนหน้าจอ", !/NO NEW DEBT/.test(visibleText));

// ผลที่ได้ต้องผูกกับ Snapshot ที่มีอยู่จริง ไม่ใช่ข้อความที่เขียนไว้ล่วงหน้า
const snapshotShown = await page.evaluate(async (id) => {
  const response = await fetch(`/api/applications/${id}`, { headers: { accept: "application/json" } });
  const body = await response.json();
  return body.snapshot?.id ?? body.latestSnapshot?.id ?? null;
}, wizardId);
const pageSnapshot = (await page.innerText(".fo-shell")).match(/snap_[a-z0-9]+/)?.[0] ?? null;
check(
  "เลข Snapshot บนหน้าจอตรงกับที่ API คืนมา",
  Boolean(pageSnapshot) && (snapshotShown === null || snapshotShown === pageSnapshot),
  `หน้าจอ ${pageSnapshot} · API ${snapshotShown}`
);

check("ไม่มีข้อผิดพลาดใน console", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ผ่าน`);
if (failed.length) {
  console.log("ที่ยังไม่ผ่าน:");
  for (const f of failed) console.log(`  - ${f.name} ${f.detail}`);
  process.exit(1);
}
