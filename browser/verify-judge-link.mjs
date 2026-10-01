/**
 * ตรวจเส้นทางที่กรรมการใช้จริง บนไฟล์ที่ถูกเสิร์ฟจากลิงก์เดโม
 *
 * ลิงก์ถูกส่งให้กรรมการไปแล้ว การตรวจจึงต้องทำกับไฟล์ที่เสิร์ฟจริง
 * ไม่ใช่ไฟล์ที่เราสร้างไว้ในเครื่อง เพราะสองอย่างนี้อาจไม่เหมือนกัน
 */
import { chromium } from "@playwright/test";

const FILE = process.argv[2];
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const text = () => page.locator("body").innerText();

await page.goto(`file://${FILE}`);
await page.waitForTimeout(1500);
check("หน้าแรกเปิดได้", /สำหรับผู้ขับแท็กซี่/.test(await text()));

await page.getByRole("button", { name: /สำหรับผู้ขับแท็กซี่/ }).click();
await page.waitForTimeout(1200);
check("เข้าเส้นทางผู้ขับได้", (await page.locator("#driverStepContainer").count()) === 1);

// ชุดข้อมูลสาธิตต้องให้เส้นทางต่างกันจริง
const routeOf = async (label) => {
  await page.getByRole("button", { name: label }).click();
  await page.waitForTimeout(1600);
  return page.evaluate(() => state.readiness.route);
};
const ready = await routeOf(/^พร้อมส่ง สถาบันการเงิน$/);
const build = await routeOf(/^สร้างความพร้อม$/);
const noDebt = await routeOf(/^ยังไม่ควรกู้$/);
const aion = await routeOf(/AION ES จริง/);
check("เคส 'พร้อมส่ง สถาบันการเงิน' ได้ READY FOR FI", ready === "READY FOR FI", ready);
check("เคส 'สร้างความพร้อม' ได้ BUILD READINESS", build === "BUILD READINESS", build);
check("เคส 'ยังไม่ควรกู้' ได้ NO NEW DEBT", noDebt === "NO NEW DEBT", noDebt);
check("เคส 'AION ES จริง' ได้ READY FOR FI", aion === "READY FOR FI", aion);

const aionPrice = await page.evaluate(() => state.passport.vehiclePrice);
check("เคส AION ใช้ราคา 929,900", Number(aionPrice) === 929_900, String(aionPrice));

/**
 * เดินทั้งเส้นทางด้วยปุ่มจริง ไม่ใช่การสั่งกระโดด
 *
 * แอปกันการกระโดดข้ามขั้นที่ยังไปไม่ถึง การสั่ง jumpDriver ไปข้างหน้าจึงเงียบ ๆ ไม่ไป
 * ถ้าไม่ตรวจว่า "ไปถึงจริงไหม" การทดสอบจะผ่านโดยอ่านหน้าผิดขั้น
 */
await page.getByRole("button", { name: /^พร้อมส่ง สถาบันการเงิน$/ }).click();
await page.waitForTimeout(1600);
await page.evaluate(() => window.jumpDriver(0));
await page.waitForTimeout(900);

const reached = [];
for (let i = 0; i < 8; i += 1) {
  const landed = await page.evaluate(() => currentDriverStep);
  const title = (await page.locator(".content-head h2").first().innerText().catch(() => "")).trim();
  const broken = /undefined|NaN|\[object Object\]/.test(await text());
  check(
    `ขั้นที่ ${i + 1} เดินถึงและแสดงผลได้: ${title.slice(0, 26)}`,
    landed === i && title.length > 0 && !broken,
    landed === i ? "" : `อยู่ขั้น ${landed + 1} แทน`
  );
  reached.push(landed);
  if (i === 7) break;

  // ขั้นส่งต่อต้องเลือกสถาบันการเงินก่อน เป็นด่านของตัวผลิตภัณฑ์ ไม่ใช่ข้อบกพร่อง
  const pickFi = page.locator("#driverStepContainer button").filter({ hasText: /^เลือก สถาบันการเงิน นี้$/ });
  if (await pickFi.count()) {
    await pickFi.first().click();
    await page.waitForTimeout(700);
  }

  const next = page.locator("#driverStepContainer .actions button.btn.primary").last();
  if (!(await next.count())) {
    check(`ขั้นที่ ${i + 1} มีปุ่มไปต่อ`, false, "ไม่พบปุ่มไปต่อ");
    break;
  }
  await next.click();
  await page.waitForTimeout(1100);
}

// ตารางค่างวดรายเดือน และตารางความอ่อนไหว อยู่ในขั้นความสามารถรับภาระ
await page.evaluate(() => window.jumpDriver(3));
await page.waitForTimeout(1200);
check("ย้อนกลับมาขั้นความสามารถรับภาระได้", (await page.evaluate(() => currentDriverStep)) === 3);
const afterAfford = await text();
const monthlyRows = await page.locator(".monthly-table tbody tr").count();
const sensRows = await page.locator(".sens-table tbody tr").count();
check("ตารางค่างวดรายเดือนมีข้อมูล", monthlyRows > 0, `${monthlyRows} แถว`);
check("ตารางความอ่อนไหวมีข้อมูล", sensRows > 0, `${sensRows} แถว`);
check("หน้าความสามารถรับภาระไม่มีค่าว่าง", !/undefined|NaN/.test(afterAfford));

// ใบรับรองความพร้อม และปุ่มดาวน์โหลด — ต้องยืนยันว่าไปถึงขั้นนั้นจริงก่อนตรวจ
await page.getByRole("button", { name: /^พร้อมส่ง สถาบันการเงิน$/ }).click();
await page.waitForTimeout(1600);
await page.evaluate(() => window.jumpDriver(5));
await page.waitForTimeout(1300);
const atCert = (await page.evaluate(() => currentDriverStep)) === 5;
check("ไปถึงขั้นใบรับรองความพร้อมได้", atCert, atCert ? "" : "ไปไม่ถึง");
const cert = await text();
check("ใบรับรองแสดงเส้นทาง", /READY FOR FI|BUILD READINESS|ยังไม่|NO NEW DEBT/.test(cert));
const downloadBtn = page
  .locator("#driverStepContainer button")
  .filter({ hasText: /ดาวน์โหลด/ });
check("มีปุ่มดาวน์โหลดใบรับรอง", (await downloadBtn.count()) > 0);
check("ฟังก์ชันสร้างเอกสารพร้อมใช้", await page.evaluate(() => typeof downloadReport === "function"));

// ถ้อยคำไทยล้วนที่ตกลงกันไว้
const sidebar = await page.locator(".sidebar, aside").first().innerText().catch(() => "");
check("ใช้คำว่า 'สถาบันการเงิน' แทน 'FI' ในปุ่มสาธิต", /พร้อมส่ง สถาบันการเงิน/.test(sidebar));

// เส้นทางพาร์ทเนอร์
await page.getByRole("button", { name: /^พาร์ทเนอร์$/ }).click();
await page.waitForTimeout(1200);
check("เส้นทางพาร์ทเนอร์เปิดได้", !/undefined|NaN/.test(await text()));

// มือถือ
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`file://${FILE}`);
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /สำหรับผู้ขับแท็กซี่/ }).click();
await page.waitForTimeout(1200);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check("จอมือถือไม่ล้นแนวนอน", overflow <= 1, `เกิน ${overflow}px`);

check("ไม่มีข้อผิดพลาดใน console ตลอดเส้นทาง", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ผ่าน`);
if (failed.length) {
  console.log("ที่ยังไม่ผ่าน:");
  for (const f of failed) console.log(`  - ${f.name} ${f.detail}`);
  process.exit(1);
}
