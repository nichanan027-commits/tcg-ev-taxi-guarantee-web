# TCG Co-op EV Taxi Guarantee — Vercel Next.js Prototype

ธีม: ฟ้า / ขาว / เขียวนีออน แบบสุภาพ ใช้ฟอนต์มาตรฐานของระบบ

## โครงสร้างหลัก

- `app/page.tsx` — หน้าเว็บไซต์หลัก
- `app/globals.css` — ธีม สี และ UI ทั้งหมด
- `app/api/score/route.ts` — API สำหรับคำนวณ DSCR, Stress Test, Tier และ Daily Fee
- `package.json` — รายการ dependency และคำสั่ง run/build

## ทดลองบนเครื่อง

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000`

## Deploy ขึ้น Vercel

1. สร้าง repository ใน GitHub
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้
3. เข้า Vercel
4. Add New Project
5. เลือก repository
6. Deploy

## หมายเหตุ

นี่คือ Prototype เพื่อทดลองแนวคิด ไม่ใช่ระบบอนุมัติสินเชื่อจริง
