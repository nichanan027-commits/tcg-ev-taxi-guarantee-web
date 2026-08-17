# Route2Own by บสย. — TCG EV Taxi Guarantee (Vercel Next.js Prototype)

หน้าหลักของเว็บคือ **Route2Own Front Office (Main Gateway)** เวอร์ชัน v1.2 ส่วนต้นแบบเดิมที่เป็นฟอร์มคำนวณคะแนน ย้ายไปอยู่ที่ `/legacy-score`

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
