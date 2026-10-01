# Route to Own by บสย. — Front Office (ไฟล์สำหรับเผยแพร่)

`index.html` ในโฟลเดอร์นี้คือ Front Office ทั้งระบบในไฟล์เดียว

- ไม่ต้องมีเซิร์ฟเวอร์ ไม่ต้องมีฐานข้อมูล ไม่ต้องต่ออินเทอร์เน็ต
- engine, รูปภาพ และตัวสร้าง PDF ถูกฝังไว้ในไฟล์แล้วทั้งหมด

สร้างใหม่ได้ด้วย `node browser/build-frozen.mjs docs/index.html --standalone`
อย่าแก้ไฟล์นี้ด้วยมือ ให้แก้ `public/route2own.html` แล้ว build ใหม่

## วิธีเปิดให้เป็นลิงก์สาธารณะ

ที่หน้า repo → **Settings** → **Pages** → ตั้ง Source เป็น
**Deploy from a branch** → branch `competition/frontoffice-model-alignment-20260909`
→ โฟลเดอร์ `/docs` → **Save**

รอประมาณ 1–2 นาที แล้วลิงก์จะใช้งานได้ที่
`https://nichanan027-commits.github.io/tcg-ev-taxi-guarantee-web/`

หมายเหตุ: ถ้า repo เป็นแบบ private การใช้ GitHub Pages ต้องใช้แพ็กเกจแบบเสียเงิน
ทางที่ง่ายกว่าคือเปลี่ยน repo เป็น public แล้ว Pages จะใช้ได้ทันทีโดยไม่มีค่าใช้จ่าย
