import { readFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * ประกอบ Front Office ให้เป็นไฟล์เดียวที่เปิดใช้งานได้โดยไม่ต้องมีเซิร์ฟเวอร์
 *
 * นี่คือไฟล์ที่ถูกเผยแพร่เป็นลิงก์เดโมให้กรรมการ จึงต้องอยู่ใน version control
 * ไม่ใช่สคริปต์ชั่วคราวนอกโปรเจกต์
 *
 * ไม่แก้เนื้อหาหรือตรรกะใด ๆ เพียงฝังสิ่งที่ปกติอ้างด้วยพาธของเซิร์ฟเวอร์
 * หรือดึงจากอินเทอร์เน็ต เข้าไปในหน้าเดียว เพราะหน้าที่เผยแพร่ไม่มี
 * /route2own-engine.js, /assets หรือทางออกอินเทอร์เน็ตที่เชื่อถือได้เสมอ
 *
 * ใช้: node browser/build-frozen.mjs <ไฟล์ปลายทาง>
 */
const ROOT = process.cwd();
const OUT = process.argv[2];
if (!OUT) throw new Error("ต้องระบุไฟล์ปลายทาง");

let html = readFileSync(path.join(ROOT, "public/route2own.html"), "utf8");

const dataUri = (file, mime) =>
  `data:${mime};base64,${readFileSync(path.join(ROOT, "public/assets", file)).toString("base64")}`;

// 1. ฝัง engine แทนการอ้างพาธ — ต้องคง type="module" ไว้ถ้าเดิมเป็น module
const engineTag = html.match(/<script[^>]*src="\/route2own-engine\.js"[^>]*><\/script>/);
if (!engineTag) throw new Error("ไม่พบ script tag ของ engine");
const isModule = /type="module"/.test(engineTag[0]);
const engine = readFileSync(path.join(ROOT, "public/route2own-engine.js"), "utf8");
html = html.replace(engineTag[0], `<script${isModule ? ' type="module"' : ""}>\n${engine}\n</script>`);

/**
 * 2. ฝังตัวสร้าง PDF
 *
 * หน้าเดิมโหลด html2pdf จาก CDN ตอนกดปุ่ม ซึ่งใช้ได้เมื่อเน็ตดี
 * แต่ลิงก์นี้ถูกส่งให้กรรมการเปิดจากที่ไหนก็ได้ ถ้าเน็ตช้าหรือถูกบล็อก
 * ปุ่มดาวน์โหลดจะค้างแล้วล้มหลังหมดเวลา ซึ่งกรรมการจะเห็นว่า "กดแล้วไม่ทำงาน"
 *
 * การตั้ง window.html2pdf ไว้ก่อน ทำให้ loadPdfLib คืนค่าทันทีโดยไม่ออกเน็ตเลย
 * ตรรกะโหลดจาก CDN ยังอยู่ครบสำหรับการใช้งานที่มีเซิร์ฟเวอร์จริง
 */
const pdfLib = readFileSync(path.join(ROOT, "public/vendor/html2pdf.bundle.min.js"), "utf8");
const bodyOpen = html.indexOf("<body>") + "<body>".length;
if (bodyOpen < "<body>".length) throw new Error("ไม่พบ <body>");
html =
  html.slice(0, bodyOpen) +
  `\n<script>\n/* html2pdf ถูกฝังไว้เพื่อให้ปุ่มดาวน์โหลดทำงานได้แม้ไม่มีอินเทอร์เน็ต */\n${pdfLib}\n</script>\n` +
  html.slice(bodyOpen);

// 3. ฝังรูปภาพ
html = html.replace(/\/assets\/route2own-gateway-hero\.jpeg/g, dataUri("route2own-gateway-hero.jpeg", "image/jpeg"));
html = html.replace(/\/assets\/tcg-logo\.png/g, dataUri("tcg-logo.png", "image/png"));

// 4. ตัดโครงหน้าที่หน้าเผยแพร่ใส่ให้เองอยู่แล้ว
html = html
  .replace(/<!DOCTYPE[^>]*>\s*/i, "")
  .replace(/<html[^>]*>\s*/i, "")
  .replace(/<\/html>\s*$/i, "")
  .replace(/<head[^>]*>/i, "")
  .replace(/<\/head>/i, "")
  .replace(/<body([^>]*)>/i, (_m, attrs) => {
    const cls = /class="([^"]*)"/.exec(attrs);
    return cls ? `<div class="${cls[1]}">` : "<div>";
  })
  .replace(/<\/body>/i, "</div>");

html = html.replace(/<meta[^>]*charset[^>]*>\s*/gi, "");
html = html.replace(/<meta[^>]*name="viewport"[^>]*>\s*/gi, "");

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, html.trim());

const leftovers = (html.match(/"\/(assets|route2own-engine|vendor)/g) || []).length;
console.log(`เขียน ${OUT}`);
console.log(`ขนาด ${(statSync(OUT).size / 1024 / 1024).toFixed(2)} MB`);
console.log(`engine เป็น module: ${isModule}`);
console.log(`ตัวสร้าง PDF ฝังแล้ว: ${html.includes("html2pdf ถูกฝังไว้")}`);
console.log(`พาธของเซิร์ฟเวอร์ที่ยังเหลือ: ${leftovers}`);
if (leftovers > 0) throw new Error("ยังมีพาธที่ชี้ไปยังเซิร์ฟเวอร์เหลืออยู่");
