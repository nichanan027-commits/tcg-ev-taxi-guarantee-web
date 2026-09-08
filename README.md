# Route to Own by บสย. — TCG EV Taxi Guarantee (Front Office)

**FINAL / FROZEN FOR COMPETITION**

แบบผลิตภัณฑ์ฉบับสุดท้ายสำหรับการประกวด การรับรองภายนอก การทำสัญญา และ Controlled Pilot
ดำเนินการหลังได้รับคัดเลือก • ข้อมูลตัวเลขในระบบเป็น **Illustrative / Competition Simulation**

หน้าหลักของเว็บคือ **Route to Own Front Office (Main Gateway)** ส่วนหน้าคำนวณเดิมย้ายไปเป็น
เครื่องมือตรวจสอบ Engine รายบุคคลที่ `/legacy-score`

## System Boundary

ระบบนี้เป็น **Front Office ก่อนอนุมัติ** เท่านั้น สิ้นสุดที่การส่งต่อ FI และติดตามผลอนุมัติ

```text
SYSTEM A — Front Office (repository นี้)
Discover → Consent → Eligibility → Income Evidence → Financial Passport
→ Credit Readiness → Appropriate Route → TCG Pre-Screen → FI Handoff

SYSTEM B — Post-Approval Operational Digital Twin (คนละ repository)
FI Approved → Child E-LG → Vehicle Activation → Protected PAYD
→ Adaptive Payment Reserve → EWS → PromptCure → Resolution → Recovery
→ Claim → RPC → Portfolio Economics
```

ห้ามนำระบบหลังอนุมัติเข้ามาใน repository นี้ ไม่ว่าจะเป็นการหักเงินจริง บัญชีหนี้ DPD
Claim Engine, RPC, Control Tower หรือ Case Management

## Base Product — เงินดาวน์ผู้ขับ 0%

`Borrower Down Payment = 0%` เป็นแบบผลิตภัณฑ์หลัก **แต่ไม่ใช่การอนุมัติสินเชื่ออัตโนมัติ**
ลำดับการตัดสินใจคือ

```text
Verified Income → Affordability → TCG Pre-Screen → FI Underwriting → FI Final Credit Decision
```

`normalize()` บังคับ `downPayment = 0` เสมอ วงเงินสินเชื่อจึงเท่ากับราคารถ

## Appropriate Route — สามเส้นทาง

เส้นทางตัดสินจาก **Affordability และ Principal Sustainability ก่อน** แล้วจึงดูความน่าเชื่อถือ
ของหลักฐานรายได้ — **คะแนน Pre-Score ไม่มีสิทธิ์ Override**

| รหัสภายใน | ข้อความที่แสดงต่อผู้ใช้ | เงื่อนไข | ส่งต่อ FI |
| --- | --- | --- | --- |
| `READY FOR FI` | READY FOR FI | รับภาระไหว เส้นเงินต้นปิดได้ และหลักฐานรายได้ไม่ต่ำ | ได้ |
| `BUILD READINESS` | BUILD READINESS / CONTINUE TO LEASE | รับภาระไหว แต่หลักฐานรายได้ยังต้องสะสม | ยังไม่ได้ |
| `NO NEW DEBT` | NO NEW DEBT | Affordability หรือ Principal Sustainability ไม่ผ่าน | ยังไม่ได้ |

รหัสภายใน (`ROUTES`) แยกจากข้อความสาธารณะ (`ROUTE_LABELS` / `routeLabelOf()`) โดยเจตนา
เพื่อให้แก้ถ้อยคำได้โดยไม่กระทบตรรกะ

`appropriateRouteOf()` รับ `affordabilityPassed` และ `principalSustainabilityPassed`
เป็น boolean ที่ผู้เรียกคำนวณมาแล้ว ฟังก์ชันนี้จึงไม่ถือ Policy Threshold ใด ๆ ไว้เอง

Integrity Gate ยังคุมการส่งต่อ FI แยกต่างหาก — `fiHandoffDecisionOf(route, integrityVerified)`
เปิดให้ส่งต่อเฉพาะ `READY FOR FI` และต้องผ่าน Integrity ก่อน

## Evidence Semantics — แยกหลักฐานรายได้ออกจากหลักฐานกิจกรรม

| ค่า | คิดจาก | ใช้ทำอะไร |
| --- | --- | --- |
| `incomeEvidenceReliability` (HIGH / MEDIUM / LOW) | สัดส่วนรายได้ที่ตรวจสอบย้อนกลับได้ **เท่านั้น** | กำหนดเส้นทางร่วมกับ Affordability |
| `activityEvidenceStatus` (CONSISTENT / REVIEW / LIMITED) | ความครบถ้วนของข้อมูลกิจกรรม (GPS / Trips / KM) | Cross-Validation และความต่อเนื่องของอาชีพ |

```text
Activity Data ≠ Income
```

ข้อมูลกิจกรรมไม่เพิ่มความน่าเชื่อถือของหลักฐานรายได้โดยเด็ดขาด มีเทสต์กำกับข้อนี้ไว้

## Price Separation

Front Office แยกสามก้อนออกจากกัน: **ราคารถ**, **วงเงินสินเชื่อ** และ **ค่าบริการแบตเตอรี่ / การสลับ**
ค่าบริการแบตเตอรี่ไม่รวมอยู่ในสินเชื่อซื้อรถ และใช้ได้เฉพาะรถที่ออกแบบรองรับการสลับจากโรงงาน

ไม่มี `Guarantee Coverage = 100%` แบบ hard-coded ในระบบอีกต่อไป

## RBP — ค่าธรรมเนียมค้ำประกันอ้างอิง

| Tier | อัตราต่อปี |
| --- | --- |
| A | 1.20% |
| B | 1.50% |
| C | 1.80% |

```text
Reference Daily RBP = Eligible Guaranteed Amount × Annual RBP Rate ÷ 365
```

- Day-count basis: **365 วันปฏิทิน**
- ฐานคิด: **วงเงินค้ำที่เข้าเกณฑ์** ไม่ใช่วงเงินสินเชื่อทั้งก้อน
- ค่าตั้งต้นมาจาก `ELIGIBLE_GUARANTEE_DESIGN_PARAMETER` ซึ่งเป็น Competition Design Parameter
  ที่ประกาศไว้ตรง ๆ **ไม่ได้ default เป็น `loanNeed`** เพื่อไม่ให้เกิดสมมติฐานค้ำเต็มวงเงินโดยปริยาย
  แล้วจึง cap ไม่ให้เกินวงเงินสินเชื่อ
- สถานะ: **Competition Design Parameter — Pilot Calibration after Selection**
- เสนอ Fee Waiver ปี 1–3

หลังอนุมัติ ระบบหลังบ้านจึงคิด `Actual Guarantee Fee = Actual Guaranteed Outstanding × Fee Rate × Time`

## PAYD และ Adaptive Payment Reserve — Preview เท่านั้น

```text
Available Cash = max(0, Verified Revenue − Eligible OpEx − Protected Cash)
Reserve Contribution Target = 10% × PAYD Target
Reserve Target = 5 × PAYD Target
ลำดับ: Protected Cash → PAYD → Adaptive Payment Reserve
```

หากเงินไม่พอสะสมถึง PAYD Target ระบบจะแสดง Reserve Contribution Preview = 0

**ระบบนี้ไม่หักเงินและไม่ถือเงินของผู้ขับ** — Actual Sweep เกิดหลัง FI อนุมัติในระบบหลังอนุมัติ
`No Verified Income → No Forced Sweep` • `Target ≠ Actual Sweep ≠ Contractual Due` • `FI Ledger = Source of Truth`

เงินคงเหลือหลังจัดสรรถูกแยกเป็นสองค่า: `residualCash` (เหลือจริง ไม่ติดลบ) และ
`affordabilityGap` (ยังขาดเท่าไร ไม่ติดลบ) จึงไม่มีการแสดงเงินคงเหลือติดลบให้ผู้ใช้เห็น

## Explainable Pre-Score

คะแนนรวม 100 จาก 5 หมวด: ความต่อเนื่องของงาน 25 • คุณภาพและเสถียรภาพรายได้ 25 •
กระแสเงินสดและความสามารถรับภาระ 25 • ความพร้อมเอกสารและพันธมิตร 15 • ความพร้อมต่อเนื่อง 10

คะแนนนี้ใช้ **สื่อสารกับผู้ขับว่าอะไรควรปรับปรุง** ไม่ใช่ Credit Score และไม่ใช่ตัวกำหนดเส้นทาง

## Authority Boundary

| | ขอบเขต |
| --- | --- |
| Route to Own / บสย. | Eligibility • Readiness • Guarantee Eligibility • Portfolio Monitoring |
| FI | Underwriting • Final Credit Decision • Contract • Debt Ledger • DPD • Restructure |

ผล Pre-Score ไม่ใช่ Loan Approval

## Front Office Journey — 8 ขั้น

1. รู้จักคุณ (Application & Consent)
2. ตรวจสิทธิ (Eligibility + Regulatory / Occupational Gate)
3. สร้าง Financial Passport
4. ดูว่ารถคันนี้รับภาระไหวหรือไม่ (Affordability + PAYD Preview)
5. Credit Readiness (Pre-Score + Appropriate Route)
6. Route to Own Credit Readiness Certificate
7. ส่งต่อสถาบันการเงิน (FI Handoff)
8. ติดตามผล FI + Post-Approval Handoff

## Partner Gateway

ประเภทพาร์ทเนอร์: สหกรณ์ / Fleet • FI / Leasing • GAC / OEM / Dealer • Battery Swap Provider •
Insurance • Payment Servicer • Recovery / Resale • Data Provider

**กรมการขนส่งทางบก (DLT)** แสดงแยกเป็น **Regulatory Evidence Layer** ไม่ใช่พาร์ทเนอร์เชิงพาณิชย์

Readiness Gate 5 ข้อ: Legal & Authority • Data Readiness • Operational SLA • Risk Ownership •
Technical Integration — ผลการตรวจไม่ใช่ข้อผูกพันหรือ MOU

## เส้นทางหน้าเว็บ

| URL | เนื้อหา |
| --- | --- |
| `/` | Route to Own Front Office — Gateway, เส้นทางผู้ขับ 8 ขั้น, Partner Gateway, หน้าติดต่อ |
| `/legacy-score` | Legacy Calculation / Engine Diagnostic View — ตรวจผล Engine รายบุคคล |
| `/api/score` | API คำนวณ ใช้ Engine ไฟล์เดียวกับหน้าบ้าน |

## โครงสร้างหลัก

- `public/route2own-engine.js` — **ระบบคำนวณหลักหนึ่งเดียว** ใช้ร่วมกันทั้งหน้าบ้าน `/api/score` และ `/legacy-score`
- `public/route2own-engine.d.ts` — type declarations ของ engine
- `app/lib/route2own.ts` — ชั้น re-export ที่มี type เท่านั้น ห้ามใส่ตรรกะคำนวณ
- `public/route2own.html` — หน้า Front Office ทั้งหมด (HTML/CSS/JS ในไฟล์เดียว)
- `next.config.ts` — rewrite `/` ไปยัง `/route2own.html`
- `app/api/score/route.ts` — API handler
- `app/legacy-score/page.tsx` — Engine Diagnostic View
- `docs/pdf-demo-checklist.md` — เช็กลิสต์การสาธิตและการออกรายงาน PDF

## ทดลองบนเครื่อง

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000` และ `http://localhost:3000/legacy-score`

## ทดสอบและ build

```bash
npm test          # node --test tests/*.test.mjs
npm run build     # production build ของ Next.js
npx tsc --noEmit  # ตรวจ type
```

## Deploy ขึ้น Vercel

1. Push โค้ดขึ้น GitHub
2. เข้า Vercel → Add New Project
3. เลือก repository → Deploy

## หมายเหตุ

นี่คือ Front Office ต้นแบบเพื่อการประกวด ไม่ใช่ระบบอนุมัติสินเชื่อจริง
ตัวเลขที่ไม่ได้ระบุว่าเป็นข้อเท็จจริงเป็น Competition Scenario เพื่อสาธิตระบบ
และต้องผ่าน Real Data Replay / Risk / FI Validation ก่อน Pilot
