/**
 * ตรวจตัวเลือกรถใน Front Office รุ่น Frozen
 *
 * สิ่งที่ต้องจริง: เลือกรุ่นแล้วราคาเปลี่ยน วงเงินสินเชื่อเดินตาม
 * ผลการประเมินคำนวณใหม่จาก engine ตัวเดิม และ "รถรุ่นอื่น" ต้องไม่ทับราคาที่กรอกเอง
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

await page.goto(`file://${FILE}`);
await page.waitForTimeout(1200);

// หน้าแรกเป็นหน้าเลือกทางเข้า ต้องเข้าเส้นทางผู้ขับก่อน แล้วค่อยใช้ชุดข้อมูลสาธิต
await page.getByRole("button", { name: /สำหรับผู้ขับแท็กซี่/ }).click();
await page.waitForTimeout(1200);
// ชื่อปุ่มต่างกันระหว่างรุ่นใน repo กับรุ่นที่เผยแพร่ (รุ่นหลังปรับถ้อยคำเป็นไทยล้วน)
await page.getByRole("button", { name: /พร้อมส่ง (FI|สถาบันการเงิน)/ }).click();
await page.waitForTimeout(1500);

// ชุดข้อมูลสาธิตกระโดดไปขั้น Credit Readiness ย้อนกลับมาขั้น Financial Passport ที่มีช่องราคารถ
await page.evaluate(() => window.jumpDriver(2));
await page.waitForTimeout(1200);
const priceBox = page.locator("#vehiclePrice");
check("ไปถึงขั้น Financial Passport ที่มีช่องราคารถ", (await priceBox.count()) === 1);

const picker = page.locator("#vehicleId");
check("มีตัวเลือกรุ่นรถในหน้าเดียวกับราคารถ", (await picker.count()) === 1);

const options = await picker.locator("option").allInnerTexts();
check("รายการรุ่นครบตามแคตตาล็อก", options.length === 5, options.join(" / "));

// เลือกรุ่นที่แพงกว่า ราคาและวงเงินสินเชื่อต้องเดินตาม
await picker.selectOption("AION_V");
await page.waitForTimeout(900);
const priceAfter = await priceBox.inputValue();
const loanAfter = await page.locator("#loanNeed").inputValue();
check("เลือก AION V แล้วราคาเป็น 1,100,000", Number(priceAfter) === 1_100_000, priceAfter);
check("วงเงินสินเชื่อเดินตามราคารถ (ดาวน์ 0%)", Number(loanAfter) === 1_100_000, loanAfter);

const noteV = await page.locator("#vehicleNote").innerText();
check("คำกำกับบอกว่าเป็นราคาอ้างอิง ไม่ใช่ราคายืนยัน", /ราคาอ้างอิงตั้งต้นของโครงการ/.test(noteV), noteV.slice(0, 70));

// ผลการประเมินต้องคำนวณใหม่จริง
await page.waitForTimeout(600);
const bodyAfterV = await page.locator("body").innerText();
check("หน้าจอแสดงรถที่ใช้ใน Scenario", /AION V/.test(bodyAfterV));

// เลือกรุ่นถูกลง ผลต้องเปลี่ยนไปอีกทาง
await picker.selectOption("AION_UT");
await page.waitForTimeout(900);
check("เลือก AION UT แล้วราคาเป็น 700,000", Number(await priceBox.inputValue()) === 700_000, await priceBox.inputValue());

// รถรุ่นอื่น — ต้องไม่ทับราคาที่ผู้ขับกรอกเอง
await priceBox.fill("645000");
await picker.selectOption("OTHER");
await page.waitForTimeout(900);
const custom = await priceBox.inputValue();
check("เลือกรถรุ่นอื่นแล้วราคาที่กรอกเองไม่ถูกทับ", Number(custom) === 645_000, custom);
const noteOther = await page.locator("#vehicleNote").innerText();
check("รถรุ่นอื่นบอกชัดว่าระบบไม่ได้ยืนยันราคา", /ไม่ได้ยืนยันราคา/.test(noteOther), noteOther.slice(0, 70));

// ราคาที่ต่างกันต้องให้ DSCR ต่างกันจริง — พิสูจน์ว่าผ่าน engine ไม่ใช่ป้ายเฉย ๆ
// อ่านค่าที่แอปคำนวณไว้เอง ไม่ใช่จับข้อความบนจอ เพราะป้ายกำกับต่างกันระหว่างรุ่น
const dscrOf = async (vehicleId) => {
  await picker.selectOption(vehicleId);
  await page.waitForTimeout(900);
  return page.evaluate(() => state.calc.dscr);
};
const dscrCheap = await dscrOf("AION_UT");
const dscrDear = await dscrOf("AION_V");
check(
  "รถแพงกว่าให้ DSCR ต่ำกว่า — ตัวเลขมาจาก engine จริง",
  Number.isFinite(dscrCheap) && Number.isFinite(dscrDear) && dscrDear < dscrCheap,
  `UT ${dscrCheap}x · V ${dscrDear}x`
);

// มือถือ
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check("จอมือถือไม่ล้นแนวนอน", overflow <= 1, `เกิน ${overflow}px`);

check("ไม่มีข้อผิดพลาดใน console", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ผ่าน`);
if (failed.length) process.exit(1);
