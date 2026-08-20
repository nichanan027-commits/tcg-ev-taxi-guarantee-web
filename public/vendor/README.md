# Vendored third-party libraries

## html2pdf.bundle.min.js

| | |
|---|---|
| Library | [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) |
| Version | 0.14.0 |
| License | MIT (see `html2pdf.bundle.min.js.LICENSE.txt` for the bundled licences of html2canvas and jsPDF) |
| Source | npm registry — `npm install html2pdf.js@0.14.0`, file copied from `dist/html2pdf.bundle.min.js` |

ใช้สำหรับปุ่ม "ดาวน์โหลดใบรายงานความพร้อมและแผนธุรกิจ v1.4" ใน `public/route2own.html`

ไฟล์นี้ถูก **โหลดแบบ lazy เฉพาะตอนผู้ใช้กดปุ่มดาวน์โหลด** เท่านั้น จึงไม่กระทบเวลาโหลดหน้าเว็บปกติ
และเก็บไว้ใน repo แทนการเรียกจาก CDN ตอน runtime เพื่อให้ระบบไม่ล่มตามโฮสต์ภายนอก
หากต้องการสลับไปใช้ CDN ให้แก้ค่า `PDF_LIB_URL` ในไฟล์ `public/route2own.html`

การโหลดมี timeout 12 วินาที (`PDF_LIB_TIMEOUT_MS`) ถ้าเกินนั้นระบบจะตกไปใช้หน้าต่างพิมพ์ของเบราว์เซอร์แทน
ขั้นตอนซ้อมก่อนวันแข่งและวิธีเก็บ log ดูที่ [`docs/pdf-demo-checklist.md`](../../docs/pdf-demo-checklist.md)

การอัปเดตเวอร์ชัน: `npm install html2pdf.js@<version> --no-save` แล้วคัดลอก `dist/html2pdf.bundle.min.js`
และไฟล์ `.LICENSE.txt` มาทับ พร้อมแก้ตารางด้านบน
