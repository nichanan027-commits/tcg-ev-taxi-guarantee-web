import fs from "node:fs";

/**
 * รวมตัวเลือกรถเข้ากับ Front Office รุ่นที่เผยแพร่อยู่
 *
 * artifact ที่เผยแพร่อยู่มีงานที่ยังไม่อยู่ใน repository (ตารางค่างวดรายเดือน
 * ตารางความอ่อนไหว และ Scenario AION ES 929,900 บาท)
 * การ build ทับจากไฟล์ใน repo จะลบงานเหล่านั้นทิ้ง
 *
 * สคริปต์นี้จึงใช้ "ไฟล์ที่เผยแพร่อยู่" เป็นฐาน แล้ววางเฉพาะส่วนตัวเลือกรถลงไป
 * โดยดึงโค้ดส่วนนั้นมาจาก public/route2own.html เพื่อไม่ให้มีสำเนาที่สาม
 */
const [, , LIVE, OUT] = process.argv;
const REPO = "/home/user/tcg-ev-taxi-guarantee-web/public/route2own.html";

const repo = fs.readFileSync(REPO, "utf8");
let html = fs.readFileSync(LIVE, "utf8");

/** ดึงบล็อกตัวเลือกรถจากไฟล์ใน repo — ตั้งแต่คอมเมนต์หัวบล็อกจนถึงก่อน V4_BOUNDS */
const BLOCK_START = "/**\n * แคตตาล็อกรถของโหมดการแข่งขัน";
const BLOCK_END = "const V4_BOUNDS={existingDebt:";
const start = repo.indexOf(BLOCK_START);
const end = repo.indexOf(BLOCK_END);
if (start < 0 || end < 0 || end < start) throw new Error("หาบล็อกตัวเลือกรถใน repo ไม่เจอ");
const vehicleBlock = repo.slice(start, end);

const edits = [
  {
    name: "แทรกแคตตาล็อกและตัวช่วยก่อน V4_BOUNDS",
    from: "const V4_BOUNDS={existingDebt:",
    to: `${vehicleBlock}const V4_BOUNDS={existingDebt:`
  },
  {
    name: "วางตัวเลือกรุ่นรถไว้หน้าช่องราคารถ",
    from:
      "${stepField('vehiclePrice','ราคารถ EV ที่สนใจ',p.vehiclePrice??800000,25000,0,'ปรับครั้งละ 25,000 บาท')}",
    to:
      "${vehicleField()}\n" +
      "${stepField('vehiclePrice','ราคารถ EV ที่สนใจ',p.vehiclePrice??800000,25000,0,'เลือกรุ่นแล้วราคาอ้างอิงจะถูกเติมให้ ปรับเองได้ครั้งละ 25,000 บาท')}"
  },
  {
    name: "อ่านรุ่นที่เลือกไว้ใช้ตอนเรนเดอร์ผล",
    from: " const routeLabel=E.routeLabelOf?E.routeLabelOf(route):route;",
    to:
      " const routeLabel=E.routeLabelOf?E.routeLabelOf(route):route;\n" +
      " const chosenVehicle=getVehicle(currentVehicleId());"
  },
  {
    name: "แสดงรถที่ใช้ใน Scenario บนการ์ดค่าธรรมเนียม",
    from:
      '<h3>ค่าธรรมเนียมค้ำประกันอ้างอิง</h3><div class="result-row"><span>วงเงินสินเชื่อ (เงินดาวน์ 0%)</span>',
    to:
      '<h3>ค่าธรรมเนียมค้ำประกันอ้างอิง</h3>' +
      '<div class="result-row"><span>รถที่ใช้ใน Scenario</span><b>${chosenVehicle.name}</b></div>' +
      '<div class="result-row"><span>ราคารถที่ใช้คำนวณ</span><b>฿${money(res.input.vehiclePrice)}</b></div>' +
      '<div class="result-row"><span>วงเงินสินเชื่อ (เงินดาวน์ 0%)</span>'
  }
];

for (const edit of edits) {
  const hits = html.split(edit.from).length - 1;
  if (hits !== 1) throw new Error(`"${edit.name}" พบจุดยึด ${hits} จุด ต้องเป็น 1 จุดเท่านั้น`);
  html = html.replace(edit.from, edit.to);
  console.log(`ok  ${edit.name}`);
}

fs.writeFileSync(OUT, html);
console.log(`\nเขียน ${OUT}`);
console.log(`ขนาด ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB`);
console.log(`งานเดิมที่รักษาไว้: ตารางค่างวดรายเดือน ${/monthly-table/.test(html) ? "✓" : "✗"} · ` +
  `ตารางความอ่อนไหว ${/sens-table/.test(html) ? "✓" : "✗"} · ` +
  `Scenario AION 929,900 ${/929900/.test(html) ? "✓" : "✗"}`);
