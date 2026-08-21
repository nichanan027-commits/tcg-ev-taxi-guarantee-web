# Route2Own by บสย. — TCG EV Taxi Guarantee (Vercel Next.js Prototype)

หน้าหลักของเว็บคือ **Route2Own Front Office (Main Gateway)** เวอร์ชัน v1.2 ส่วนต้นแบบเดิมที่เป็นฟอร์มคำนวณคะแนน ย้ายไปอยู่ที่ `/legacy-score`

> **System Boundary:** โครงการนี้เป็น Front Office ก่อนอนุมัติเท่านั้น ระบบ Post-Approval เช่น My Route2Own, Partner Console, Control Tower และ F.A. Center ต้องพัฒนาและเผยแพร่เป็นระบบแยก ห้ามรวมเข้ากับ Front Office นี้

## RBP Daily Fee — Proposed Calibration

- Tier A = 1.20% ต่อปี
- Tier B = 1.50% ต่อปี
- Tier C = 1.80% ต่อปี
- สูตร: `Daily RBP = Guaranteed Outstanding × Annual RBP Rate ÷ 365`
- Day-count basis: 365 วันปฏิทิน
- สถานะ: **Proposed – Calibration Required**

## Explainable Pre-Scoring

ผู้สมัครทุกเคสต้องผ่าน Pre-Score ก่อนเข้าสู่ขั้นถัดไป คะแนนรวม 100 คะแนนมาจาก 5 หมวดที่แสดงเหตุผลและแนวทางปรับปรุงได้: ความต่อเนื่องในการทำงาน 25, คุณภาพรายได้ 25, ความสามารถรองรับภาระ 25, เอกสาร/พาร์ตเนอร์ 15 และความพร้อมต่อเนื่อง 10 คะแนน

| คะแนน | ระดับ | การส่งต่อ FI |
| --- | --- | --- |
| 80–100 | Ready to Own | ส่งต่อได้ |
| 60–79 | Build Readiness | ส่งต่อได้พร้อมแผน 30 วัน |
| 40–59 | Need Support | ส่งต่อได้พร้อม Support Flag (รวม Case C) |
| 0–39 | Start with Foundation | ยังไม่ส่งต่อ ให้สร้างฐานและ Pre-Score ใหม่ |

FI เป็นผู้ Underwrite และตัดสินสินเชื่อขั้นสุดท้าย การแนะนำ F.A. Center เป็นเพียง referral ไปยังบริการแยก ไม่ฝังระบบ F.A. หรือระบบหลังอนุมัติไว้ใน Front Office ส่วน Integrity Gate ใช้ควบคุมการส่งต่อ FI แต่ไม่ข้ามหรือยกเลิกขั้น Pre-Score

## เส้นทางหน้าเว็บ

| URL | เนื้อหา |
| --- | --- |
| `/` | Route2Own Front Office — Main Gateway, เส้นทางผู้ขับ 8 ขั้น, Partner Gateway, หน้าติดต่อ |
| `/legacy-score` | ต้นแบบเดิม ฟอร์มคำนวณ DSCR / Stress Test / Tier / Daily Fee |
| `/api/score` | API คำนวณของต้นแบบเดิม |

## โครงสร้างหลัก

- `public/route2own.html` — หน้า Route2Own Front Office ทั้งหมด (HTML/CSS/JS ในไฟล์เดียว ไม่มี dependency ภายนอก)
- `next.config.ts` — rewrite `/` ไปยัง `/route2own.html`
- `app/legacy-score/page.tsx` — ต้นแบบเดิม
- `app/globals.css` — ธีมของต้นแบบเดิม (ฟ้า / ขาว / เขียวนีออน)
- `app/api/score/route.ts` — API สำหรับคำนวณ DSCR, Stress Test, Tier และ Daily Fee
- `package.json` — รายการ dependency และคำสั่ง run/build

## ทดลองบนเครื่อง

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000` จะได้หน้า Route2Own Gateway และ `http://localhost:3000/legacy-score` จะได้ฟอร์มคำนวณเดิม

## แก้ไขหน้าหลัก

หน้าหลักเป็นไฟล์ HTML ไฟล์เดียวแบบ standalone แก้ไขที่ `public/route2own.html` ได้โดยตรง ไม่ต้อง build ใหม่ในโหมด dev

## Deploy ขึ้น Vercel

1. Push โค้ดขึ้น GitHub
2. เข้า Vercel → Add New Project
3. เลือก repository → Deploy

## หมายเหตุ

นี่คือ Prototype เพื่อทดลองแนวคิด ไม่ใช่ระบบอนุมัติสินเชื่อจริง ตัวเลขที่ไม่ได้ระบุว่าเป็นข้อเท็จจริงเป็น Scenario เพื่อสาธิตระบบ
