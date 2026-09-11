"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * แบบฟอร์มลงทะเบียนของผู้สมัคร
 *
 * หน้าที่ของคอมโพเนนต์นี้คือ "เก็บข้อมูลแล้วส่ง" เท่านั้น
 * ไม่คำนวณคะแนน ไม่ตัดสินเส้นทาง ไม่ประเมินความสามารถรับภาระ
 * เซิร์ฟเวอร์เป็นผู้เรียก Frozen Engine และสร้าง Evaluation Snapshot
 * ตัวเลขที่แสดงระหว่างกรอกมีเพียงผลรวมรายได้ที่ผู้สมัครระบุเอง ซึ่งเป็นการบวกเลขล้วน
 */
const STEPS = [
  "ความยินยอม",
  "รู้จักคุณ",
  "สถานะอาชีพ",
  "รายได้และหลักฐาน",
  "ค่าใช้จ่ายในการทำงาน",
  "เงินจำเป็นที่ต้องกันไว้",
  "รถที่สนใจ",
  "ประมาณการภาระ",
  "ตรวจสอบข้อมูล"
] as const;

const CHANNELS = [
  { id: "PLATFORM", label: "แอปเรียกรถ / แพลตฟอร์ม", evidenceHint: "มีรายการโอนเข้าเป็นหลักฐาน" },
  { id: "QR", label: "QR / พร้อมเพย์", evidenceHint: "มีรายการรับเงินเป็นหลักฐาน" },
  { id: "BANK_TRANSFER", label: "โอนเข้าบัญชี", evidenceHint: "มีรายการเดินบัญชีเป็นหลักฐาน" },
  { id: "CASH", label: "เงินสด", evidenceHint: "ไม่มีหลักฐานธุรกรรม ใช้ตรวจสอบไขว้กับข้อมูลการวิ่ง" },
  { id: "OTHER", label: "อื่น ๆ", evidenceHint: "ระบุได้ตามจริง" }
] as const;

const VEHICLES = [
  { id: "AION_ES", name: "AION ES", price: 800000 },
  { id: "AION_Y_PLUS", name: "AION Y Plus", price: 900000 },
  { id: "AION_UT", name: "AION UT", price: 700000 },
  { id: "AION_V", name: "AION V", price: 1100000 },
  { id: "OTHER", name: "รถรุ่นอื่น (ระบุราคาเอง)", price: 800000 }
] as const;

type ChannelRow = { channel: string; dailyAmount: number; hasTransactionEvidence: boolean };

const baht = (value: number) => `฿${Math.round(value).toLocaleString("th-TH")}`;

export function RegistrationWizard({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [consented, setConsented] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("กรุงเทพมหานคร");
  const [yearsDriving, setYearsDriving] = useState(5);
  const [driverStatus, setDriverStatus] = useState("RENTING");
  const [ownershipGoal, setOwnershipGoal] = useState("OWN_WITHIN_5_YEARS");

  const [taxiOccupationStatus, setTaxi] = useState("ACTIVE_TAXI_DRIVER");
  const [publicDriverLicenseStatus, setLicense] = useState("TO_VERIFY");
  const [currentVehicleRelationship, setRelationship] = useState("RENT");
  const [cooperativeOrOperator, setCoop] = useState("");
  const [occupationalEvidenceStatus, setOccEvidence] = useState("DECLARED");

  const [rows, setRows] = useState<ChannelRow[]>([
    { channel: "PLATFORM", dailyAmount: 1200, hasTransactionEvidence: true },
    { channel: "CASH", dailyAmount: 650, hasTransactionEvidence: false }
  ]);
  const [activityConsistency, setActivity] = useState(90);

  const [workingDaysPerMonth, setWorkDays] = useState(26);
  const [currentRentDaily, setRent] = useState(700);
  const [fuelDaily, setFuel] = useState(300);
  const [batteryServiceDaily, setBattery] = useState(0);
  const [otherOpexDaily, setOtherOpex] = useState(60);

  const [householdMonthly, setHousehold] = useState(15000);
  const [existingDebtMonthly, setExistingDebt] = useState(0);

  const [vehicleId, setVehicleId] = useState("AION_ES");
  const [vehiclePrice, setVehiclePrice] = useState(800000);
  const [termMonths, setTerm] = useState(60);
  const [annualRatePct, setRate] = useState(4.5);

  // การบวกเลขล้วน ไม่ใช่ตรรกะผลิตภัณฑ์
  const declaredTotal = useMemo(() => rows.reduce((sum, row) => sum + (row.dailyAmount || 0), 0), [rows]);
  const evidencedTotal = useMemo(
    () =>
      rows
        .filter((row) => row.hasTransactionEvidence && row.channel !== "CASH")
        .reduce((sum, row) => sum + (row.dailyAmount || 0), 0),
    [rows]
  );

  function updateRow(index: number, patch: Partial<ChannelRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function acceptConsent() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/consent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accepted: true })
      });
      if (!response.ok) throw new Error("บันทึกความยินยอมไม่สำเร็จ");
      setConsented(true);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      // payload เขียนออกทีละสนามตามที่ประกาศไว้ ไม่ส่งสถานะภายในของหน้าจอไปด้วย
      const save = await fetch(`/api/applications/${applicationId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile: { displayName, phone, province, driverStatus, yearsDriving, ownershipGoal },
          eligibility: {
            taxiOccupationStatus,
            publicDriverLicenseStatus,
            currentVehicleRelationship,
            cooperativeOrOperator: cooperativeOrOperator || undefined,
            yearsProfessionalDriving: yearsDriving,
            serviceProvince: province,
            occupationalEvidenceStatus
          },
          financial: {
            incomeEntries: rows.filter((row) => row.dailyAmount > 0),
            workingDaysPerMonth,
            currentRentDaily,
            fuelDaily,
            batteryServiceDaily,
            otherOpexDaily,
            householdMonthly,
            existingDebtMonthly,
            activityConsistency,
            vehicleId,
            vehiclePrice,
            termMonths,
            annualRatePct
          }
        })
      });
      if (!save.ok) {
        const body = await save.json().catch(() => ({}));
        throw new Error(body.detail || body.error || "ข้อมูลไม่ผ่านการตรวจสอบ");
      }

      // เซิร์ฟเวอร์เป็นผู้ประเมินและสร้าง Snapshot — หน้าจอเพียงรอผลแล้วไปแสดง
      const evaluated = await fetch(`/api/applications/${applicationId}/evaluate`, { method: "POST" });
      if (!evaluated.ok) throw new Error("ประเมินไม่สำเร็จ กรุณาลองอีกครั้ง");

      router.refresh();
      window.location.href = `/apply/${applicationId}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      setBusy(false);
    }
  }

  const canNext = step === 0 ? consented : step === 1 ? displayName.trim() !== "" && phone.trim() !== "" : true;

  return (
    <section className="fo-wizard" data-role="registration-wizard">
      <ol className="fo-steps" aria-label="ขั้นตอนการลงทะเบียน">
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? "current" : index < step ? "done" : ""}>
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {error ? (
        <p className="fo-error" role="alert" data-role="wizard-error">
          {error}
        </p>
      ) : null}

      {/* 1 — ความยินยอม */}
      {step === 0 ? (
        <div className="fo-step">
          <h2 className="fo-h2">ความยินยอมสำหรับการแข่งขัน</h2>
          <p>
            ข้อมูลที่คุณกรอกจะถูกใช้เพื่อสร้าง Financial Passport และประเมินความพร้อมทางเครดิตในระบบการแข่งขันนี้
            เท่านั้น
          </p>
          <p className="fo-governance">Competition Registration — ไม่ใช่การยื่นขอสินเชื่อจริง</p>
          <p className="fo-muted">Phone Verification: Not required — Competition Mode</p>
          <label className="fo-check">
            <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
            <span>ฉันยินยอมให้ใช้ข้อมูลนี้ในระบบการแข่งขัน (เวอร์ชัน RTO-COMP-1.0)</span>
          </label>
          <button type="button" className="fo-cta" disabled={!consented || busy} onClick={acceptConsent}>
            {busy ? "กำลังบันทึก…" : "ยินยอมและดำเนินการต่อ"}
          </button>
        </div>
      ) : null}

      {/* 2 — รู้จักคุณ */}
      {step === 1 ? (
        <div className="fo-step">
          <h2 className="fo-h2">รู้จักคุณ</h2>
          <div className="fo-field-grid">
            <label>
              ชื่อ
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
            <label>
              เบอร์โทรศัพท์
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
            </label>
            <label>
              จังหวัดที่ให้บริการ
              <input value={province} onChange={(e) => setProvince(e.target.value)} />
            </label>
            <label>
              ปีที่ขับรับจ้าง
              <input
                type="number"
                min={0}
                value={yearsDriving}
                onChange={(e) => setYearsDriving(Number(e.target.value))}
              />
            </label>
            <label>
              สถานะรถปัจจุบัน
              <select value={driverStatus} onChange={(e) => setDriverStatus(e.target.value)}>
                <option value="RENTING">เช่ารถขับ</option>
                <option value="OWN_ICE">มีรถสันดาปของตัวเอง</option>
                <option value="EMPLOYED_DRIVER">เป็นลูกจ้างขับรถ</option>
                <option value="OTHER">อื่น ๆ</option>
              </select>
            </label>
            <label>
              เป้าหมายการเป็นเจ้าของ
              <select value={ownershipGoal} onChange={(e) => setOwnershipGoal(e.target.value)}>
                <option value="OWN_WITHIN_3_YEARS">อยากเป็นเจ้าของภายใน 3 ปี</option>
                <option value="OWN_WITHIN_5_YEARS">อยากเป็นเจ้าของภายใน 5 ปี</option>
                <option value="STILL_DECIDING">ยังตัดสินใจไม่แน่</option>
              </select>
            </label>
          </div>
        </div>
      ) : null}

      {/* 3 — สถานะอาชีพ */}
      {step === 2 ? (
        <div className="fo-step">
          <h2 className="fo-h2">สถานะอาชีพ</h2>
          <p className="fo-muted" data-role="eligibility-note">
            ข้อมูลอาชีพที่ผู้สมัครระบุ — รอยืนยันในขั้นตอนจริง
          </p>
          <div className="fo-field-grid">
            <label>
              สถานะการขับรับจ้าง
              <select value={taxiOccupationStatus} onChange={(e) => setTaxi(e.target.value)}>
                <option value="ACTIVE_TAXI_DRIVER">ขับแท็กซี่อยู่ในปัจจุบัน</option>
                <option value="OTHER_PROFESSIONAL_DRIVER">ขับรถรับจ้างประเภทอื่น</option>
                <option value="OTHER">อื่น ๆ</option>
              </select>
            </label>
            <label>
              ใบขับขี่สาธารณะ
              <select value={publicDriverLicenseStatus} onChange={(e) => setLicense(e.target.value)}>
                <option value="VALID">มีและยังไม่หมดอายุ</option>
                <option value="TO_VERIFY">ต้องยืนยันภายหลัง</option>
                <option value="NOT_AVAILABLE">ยังไม่มี</option>
              </select>
            </label>
            <label>
              ความสัมพันธ์กับรถปัจจุบัน
              <select value={currentVehicleRelationship} onChange={(e) => setRelationship(e.target.value)}>
                <option value="RENT">เช่า</option>
                <option value="OWNER">เป็นเจ้าของ</option>
                <option value="OTHER">อื่น ๆ</option>
              </select>
            </label>
            <label>
              สหกรณ์ / ผู้ประกอบการ (ถ้ามี)
              <input value={cooperativeOrOperator} onChange={(e) => setCoop(e.target.value)} />
            </label>
            <label>
              สถานะหลักฐานอาชีพ
              <select value={occupationalEvidenceStatus} onChange={(e) => setOccEvidence(e.target.value)}>
                <option value="DECLARED">ผู้สมัครระบุเอง</option>
                <option value="SUPPORTED">มีข้อมูลประกอบ</option>
                <option value="TO_VERIFY">ต้องยืนยันภายหลัง</option>
              </select>
            </label>
          </div>
          <p className="fo-muted">การกรอกข้อมูลครบถ้วนไม่ใช่การผ่านคุณสมบัติ</p>
        </div>
      ) : null}

      {/* 4 — รายได้และหลักฐาน */}
      {step === 3 ? (
        <div className="fo-step">
          <h2 className="fo-h2">รายได้และหลักฐาน</h2>
          <p className="fo-muted">
            ระบุรายได้แยกตามช่องทาง ระบบจะคำนวณสัดส่วนหลักฐานจากสิ่งที่คุณระบุ ไม่ใช่ตัวเลขที่กรอกเอง
          </p>

          <table className="fo-income-table">
            <thead>
              <tr>
                <th>ช่องทาง</th>
                <th>บาท / วัน</th>
                <th>มีหลักฐานธุรกรรม</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const channel = CHANNELS.find((c) => c.id === row.channel);
                const isCash = row.channel === "CASH";
                return (
                  <tr key={index}>
                    <td>
                      <select value={row.channel} onChange={(e) => updateRow(index, { channel: e.target.value })}>
                        {CHANNELS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <small>{channel?.evidenceHint}</small>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        value={row.dailyAmount}
                        onChange={(e) => updateRow(index, { dailyAmount: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      {isCash ? (
                        <span className="fo-muted">เงินสด — ตรวจสอบไขว้เท่านั้น</span>
                      ) : (
                        <label className="fo-check compact">
                          <input
                            type="checkbox"
                            checked={row.hasTransactionEvidence}
                            onChange={(e) => updateRow(index, { hasTransactionEvidence: e.target.checked })}
                          />
                          <span>มี</span>
                        </label>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <button
            type="button"
            className="fo-secondary"
            onClick={() => setRows((r) => [...r, { channel: "QR", dailyAmount: 0, hasTransactionEvidence: false }])}
          >
            + เพิ่มช่องทางรายได้
          </button>

          <dl className="fo-inline-summary">
            <div>
              <dt>รายได้ที่ผู้สมัครระบุ</dt>
              <dd data-role="wizard-declared">{baht(declaredTotal)} / วัน</dd>
            </div>
            <div>
              <dt>ส่วนที่มีหลักฐานธุรกรรม</dt>
              <dd data-role="wizard-evidenced">{baht(evidencedTotal)} / วัน</dd>
            </div>
          </dl>
          <p className="fo-muted">
            ตัวเลขนี้เป็นเพียงผลรวมที่คุณระบุ ระบบจะประเมินสถานะหลักฐานและความพร้อมในขั้นตอนถัดไป
          </p>

          <label className="fo-slider">
            ความสม่ำเสมอของการวิ่ง (GPS / เที่ยว / ชั่วโมง) — {activityConsistency}%
            <input
              type="range"
              min={0}
              max={100}
              value={activityConsistency}
              onChange={(e) => setActivity(Number(e.target.value))}
            />
          </label>
          <p className="fo-muted">ใช้ตรวจความสอดคล้องเท่านั้น ไม่ใช่รายได้ — Activity Data ≠ Income</p>
        </div>
      ) : null}

      {/* 5 — ค่าใช้จ่ายในการทำงาน */}
      {step === 4 ? (
        <div className="fo-step">
          <h2 className="fo-h2">ค่าใช้จ่ายในการทำงาน</h2>
          <div className="fo-field-grid">
            <label>
              วันทำงานต่อเดือน
              <input type="number" min={1} max={31} value={workingDaysPerMonth} onChange={(e) => setWorkDays(Number(e.target.value))} />
            </label>
            <label>
              ค่าเช่ารถปัจจุบัน / วัน
              <input type="number" min={0} value={currentRentDaily} onChange={(e) => setRent(Number(e.target.value))} />
            </label>
            <label>
              ค่าเชื้อเพลิง / พลังงาน ต่อวัน
              <input type="number" min={0} value={fuelDaily} onChange={(e) => setFuel(Number(e.target.value))} />
            </label>
            <label>
              ค่าบริการแบตเตอรี่ / วัน
              <input type="number" min={0} value={batteryServiceDaily} onChange={(e) => setBattery(Number(e.target.value))} />
            </label>
            <label>
              ค่าใช้จ่ายเดินรถอื่น / วัน
              <input type="number" min={0} value={otherOpexDaily} onChange={(e) => setOtherOpex(Number(e.target.value))} />
            </label>
          </div>
        </div>
      ) : null}

      {/* 6 — เงินจำเป็นที่ต้องกันไว้ */}
      {step === 5 ? (
        <div className="fo-step">
          <h2 className="fo-h2">เงินจำเป็นที่ต้องกันไว้</h2>
          <p className="fo-protected-note" data-role="protected-cash-note">
            เงินจำเป็นที่ต้องกันไว้สำหรับการดำรงชีพและภาระที่ต้องรักษา —
            <b> ไม่ใช่เงินที่นำไปผ่อนรถได้</b> ระบบจะกันส่วนนี้ออกก่อนเสมอ
          </p>
          <div className="fo-field-grid">
            <label>
              ค่าใช้จ่ายครัวเรือน / เดือน
              <input type="number" min={0} value={householdMonthly} onChange={(e) => setHousehold(Number(e.target.value))} />
            </label>
            <label>
              ภาระหนี้เดิม / เดือน
              <input type="number" min={0} value={existingDebtMonthly} onChange={(e) => setExistingDebt(Number(e.target.value))} />
            </label>
          </div>
        </div>
      ) : null}

      {/* 7 — รถที่สนใจ */}
      {step === 6 ? (
        <div className="fo-step">
          <h2 className="fo-h2">รถที่สนใจ</h2>
          <div className="fo-vehicle-grid">
            {VEHICLES.map((vehicle) => (
              <button
                type="button"
                key={vehicle.id}
                className={`fo-vehicle-card${vehicleId === vehicle.id ? " selected" : ""}`}
                onClick={() => {
                  setVehicleId(vehicle.id);
                  setVehiclePrice(vehicle.price);
                }}
              >
                <b>{vehicle.name}</b>
                <span>{baht(vehicle.price)}</span>
              </button>
            ))}
          </div>
          <label className="fo-inline-field">
            ราคารถที่ใช้ประเมิน
            <input type="number" min={1} value={vehiclePrice} onChange={(e) => setVehiclePrice(Number(e.target.value))} />
          </label>
          <p className="fo-muted">ราคาตั้งต้นเป็นค่าอ้างอิงของโครงการ ปรับได้ตามใบเสนอราคาจริง</p>
        </div>
      ) : null}

      {/* 8 — ประมาณการภาระ */}
      {step === 7 ? (
        <div className="fo-step">
          <h2 className="fo-h2">ลองประมาณภาระรถของคุณ</h2>
          <div className="fo-field-grid">
            <label>
              ระยะเวลาผ่อน (เดือน)
              <input type="number" min={12} max={96} value={termMonths} onChange={(e) => setTerm(Number(e.target.value))} />
            </label>
            <label>
              อัตราดอกเบี้ยที่ใช้ประมาณการ (% ต่อปี)
              <input type="number" min={0} max={36} step={0.1} value={annualRatePct} onChange={(e) => setRate(Number(e.target.value))} />
            </label>
          </div>
          <p className="fo-muted">เงินดาวน์ผู้ขับ 0% — 0% Down ≠ 100% Guarantee</p>
          <p className="fo-governance">
            ประมาณการเบื้องต้น (Illustrative Financing Estimate) — ไม่ใช่ข้อเสนอสินเชื่อหรือค่างวดที่ FI อนุมัติจริง
          </p>
          <p className="fo-muted">ค่างวดโดยประมาณจะถูกคำนวณโดยระบบพร้อมผลการประเมินในขั้นถัดไป</p>
        </div>
      ) : null}

      {/* 9 — ตรวจสอบข้อมูล */}
      {step === 8 ? (
        <div className="fo-step">
          <h2 className="fo-h2">ตรวจสอบข้อมูลก่อนประเมิน</h2>
          <dl className="fo-review">
            <div>
              <dt>ชื่อ</dt>
              <dd>{displayName || "—"}</dd>
            </div>
            <div>
              <dt>จังหวัด</dt>
              <dd>{province}</dd>
            </div>
            <div>
              <dt>รายได้ที่ระบุ</dt>
              <dd>{baht(declaredTotal)} / วัน</dd>
            </div>
            <div>
              <dt>ส่วนที่มีหลักฐานธุรกรรม</dt>
              <dd>{baht(evidencedTotal)} / วัน</dd>
            </div>
            <div>
              <dt>วันทำงาน</dt>
              <dd>{workingDaysPerMonth} วัน / เดือน</dd>
            </div>
            <div>
              <dt>เงินจำเป็นที่กันไว้</dt>
              <dd>{baht(householdMonthly)} / เดือน</dd>
            </div>
            <div>
              <dt>รถ</dt>
              <dd>
                {VEHICLES.find((v) => v.id === vehicleId)?.name} · {baht(vehiclePrice)}
              </dd>
            </div>
            <div>
              <dt>ประมาณการ</dt>
              <dd>
                {termMonths} เดือน · {annualRatePct}% ต่อปี
              </dd>
            </div>
          </dl>
          <button type="button" className="fo-cta" disabled={busy} onClick={submit} data-role="submit-evaluate">
            {busy ? "กำลังประเมิน…" : "ประเมินความพร้อม"}
          </button>
          <p className="fo-muted">ระบบจะประเมินด้วยเครื่องคำนวณกลางแล้วบันทึกผลเป็น Snapshot ที่แก้ไม่ได้</p>
        </div>
      ) : null}

      {step > 0 ? (
        <div className="fo-wizard-nav">
          <button
            type="button"
            className="fo-secondary"
            disabled={busy}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            data-role="wizard-back"
          >
            ย้อนกลับ
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="fo-cta"
              disabled={!canNext}
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              data-role="wizard-next"
            >
              ดำเนินการต่อ
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
