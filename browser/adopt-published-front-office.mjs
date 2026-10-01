import fs from "node:fs";

/**
 * ดึง Front Office ที่เผยแพร่อยู่กลับเข้า repository
 *
 * งานหลายอย่าง (ตารางค่างวดรายเดือน ตารางความอ่อนไหว Scenario AION ES 929,900
 * และการปรับถ้อยคำเป็นไทยล้วน) ถูกเผยแพร่เป็น artifact โดยไม่ได้ commit ไว้ที่ใด
 * ถ้าไม่ดึงกลับ การ build ครั้งต่อไปจากไฟล์ใน repo จะลบงานเหล่านั้นทิ้งทั้งหมด
 *
 * สคริปต์นี้ย้อนขั้นตอนของ build-frozen: ถอดโครงหน้าที่ artifact ใส่ให้
 * คืน engine และรูปภาพให้เป็นการอ้างพาธตามเดิม แล้วประกอบกลับเป็นไฟล์เต็ม
 *
 * ตรวจผลได้ด้วยการ build ใหม่แล้วเทียบกับไฟล์ที่เผยแพร่ ส่วนต่างต้องมีเพียง
 * ตำแหน่งของ CSS ที่ถูกย้ายกลับเข้า <style> เท่านั้น
 */
const [, , PUBLISHED, OUT] = process.argv;
const ROOT = "/home/user/tcg-ev-taxi-guarantee-web";

const published = fs.readFileSync(PUBLISHED, "utf8");

// 1. ถอดโครงหน้าที่ artifact ใส่ให้ — มีจุดแบ่งเพียงจุดเดียว
const SPLIT = "</style></head><body>\n";
const at = published.indexOf(SPLIT);
if (at < 0) throw new Error("หาจุดแบ่งโครงหน้าของ artifact ไม่เจอ");
const skeleton = published.slice(0, at);
let page = published.slice(at + SPLIT.length).replace(/<\/body><\/html>\s*$/, "");

// 2. CSS ของหน้าที่หลุดไปอยู่บนสุด ต้องถูกพากลับเข้า <style> ของหน้า
const DEFAULT_CSS_END = "[hidden]:not([hidden=until-found i]){display:none!important}";
const cssAt = skeleton.indexOf(DEFAULT_CSS_END);
if (cssAt < 0) throw new Error("หาปลาย CSS เริ่มต้นของ artifact ไม่เจอ");
const strayCss = skeleton.slice(cssAt + DEFAULT_CSS_END.length).trim();

const styleClose = page.indexOf("</style>");
if (styleClose < 0) throw new Error("หา </style> ของหน้าไม่เจอ");
if (strayCss) page = `${page.slice(0, styleClose)}${strayCss}\n${page.slice(styleClose)}`;
console.log(`CSS ที่พากลับเข้า <style>: ${strayCss.split("\n").length} บรรทัด`);

// 3. คืน engine ให้เป็นการอ้างพาธ แทนการฝังทั้งก้อน
const engine = fs.readFileSync(`${ROOT}/public/route2own-engine.js`, "utf8");
const inlinedEngine = `<script type="module">\n${engine}\n</script>`;
if (!page.includes(inlinedEngine)) throw new Error("ไม่พบ engine ที่ถูกฝังไว้แบบตรงกันทุกตัวอักษร");
page = page.replace(inlinedEngine, '<script type="module" src="/route2own-engine.js"></script>');

// 4. คืนรูปภาพให้เป็นการอ้างพาธ
const assets = [
  ["route2own-gateway-hero.jpeg", "image/jpeg"],
  ["tcg-logo.png", "image/png"]
];
for (const [file, mime] of assets) {
  const uri = `data:${mime};base64,${fs.readFileSync(`${ROOT}/public/assets/${file}`).toString("base64")}`;
  const hits = page.split(uri).length - 1;
  if (hits === 0) throw new Error(`ไม่พบรูป ${file} ที่ถูกฝังไว้`);
  page = page.split(uri).join(`/assets/${file}`);
  console.log(`คืนพาธรูป ${file}: ${hits} จุด`);
}

// 5. ประกอบกลับเป็นเอกสารเต็ม — ส่วนหัวจบที่ </style> ของหน้า
const headEnd = page.indexOf("</style>") + "</style>".length;
const head = page.slice(0, headEnd).trim();
const body = page.slice(headEnd);

const out =
  `<!DOCTYPE html>\n<html lang="th">\n<head>\n` +
  `<meta charset="utf-8" />\n` +
  `<meta name="viewport" content="width=device-width, initial-scale=1" />\n` +
  `${head}\n</head>\n<body>${body}\n</body>\n</html>\n`;

fs.writeFileSync(OUT, out);

const marker = (needle) => (out.includes(needle) ? "✓" : "✗");
console.log(`\nเขียน ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
console.log(
  `ตารางค่างวดรายเดือน ${marker("monthly-table")} · ` +
    `ตารางความอ่อนไหว ${marker("sens-table")} · ` +
    `Scenario AION 929,900 ${marker("929900")} · ` +
    `ถ้อยคำไทยล้วน ${marker("พร้อมส่ง สถาบันการเงิน")} · ` +
    `ตัวเลือกรถ ${marker("applyVehicleChoice")} · ` +
    `ป้าย FROZEN ${marker("FINAL / FROZEN FOR COMPETITION")}`
);
