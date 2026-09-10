"use client";

import { useState } from "react";

/**
 * ขอคำปรึกษาเพื่อสร้างความพร้อมก่อนสินเชื่อ
 *
 * แบบฟอร์มนี้เก็บเพียงช่วงเวลาและช่องทางที่สะดวกให้ติดต่อกลับ
 * ข้อมูลการเงินทั้งหมดมาจากผลการประเมินที่บันทึกไว้แล้ว ไม่ต้องกรอกซ้ำ
 * และไม่มีการถามข้อมูลอ่อนไหวใด ๆ ที่นี่
 */
const TIMES = [
  { id: "MORNING", label: "ช่วงเช้า (09:00–12:00)" },
  { id: "AFTERNOON", label: "ช่วงบ่าย (13:00–16:00)" },
  { id: "EVENING", label: "ช่วงเย็น (16:00–19:00)" }
] as const;

const CHANNELS = [
  { id: "PHONE", label: "โทรศัพท์" },
  { id: "LINE", label: "LINE" }
] as const;

export function FaAdvisoryForm({
  applicationId,
  snapshotId,
  existingCaseId
}: {
  applicationId: string;
  snapshotId: string;
  existingCaseId: string | null;
}) {
  const [time, setTime] = useState<string>("MORNING");
  const [channel, setChannel] = useState<string>("PHONE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(existingCaseId);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/fa-request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          preferredContactTime: time,
          preferredChannel: channel,
          evaluationSnapshotId: snapshotId
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "เปิดคำขอคำปรึกษาไม่สำเร็จ");
      setCaseId(body.case.caseId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  if (caseId) {
    return (
      <div className="fo-fa-confirmed" data-role="fa-case-confirmed">
        <p className="fo-fa-case-id">
          เลขที่คำขอ <b data-role="fa-case-id">{caseId}</b>
        </p>
        <p>
          ทีมที่ปรึกษาจะติดต่อกลับตามช่วงเวลาและช่องทางที่คุณเลือกไว้
          เพื่อวางแผนสร้างความพร้อมก่อนขอสินเชื่อ
        </p>
        <p className="fo-muted">
          การขอคำปรึกษาไม่ใช่การยื่นขอสินเชื่อ และไม่มีผลผูกพันกับสถาบันการเงินใด
        </p>
      </div>
    );
  }

  return (
    <div className="fo-fa-form" data-role="fa-advisory-form">
      {error ? (
        <p className="fo-error" role="alert" data-role="fa-error">
          {error}
        </p>
      ) : null}

      <fieldset className="fo-fieldset">
        <legend>ช่วงเวลาที่สะดวกให้ติดต่อกลับ</legend>
        <div className="fo-choice-row">
          {TIMES.map((option) => (
            <label key={option.id} className={`fo-choice${time === option.id ? " selected" : ""}`}>
              <input
                type="radio"
                name="fa-time"
                value={option.id}
                checked={time === option.id}
                onChange={() => setTime(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="fo-fieldset">
        <legend>ช่องทางที่สะดวก</legend>
        <div className="fo-choice-row">
          {CHANNELS.map((option) => (
            <label key={option.id} className={`fo-choice${channel === option.id ? " selected" : ""}`}>
              <input
                type="radio"
                name="fa-channel"
                value={option.id}
                checked={channel === option.id}
                onChange={() => setChannel(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button type="button" className="fo-cta" disabled={busy} onClick={submit} data-role="fa-submit">
        {busy ? "กำลังเปิดคำขอ…" : "ขอคำปรึกษาเพื่อสร้างความพร้อม"}
      </button>
      <p className="fo-muted">
        ใช้ผลการประเมินที่บันทึกไว้แล้ว (Snapshot {snapshotId}) ไม่ต้องกรอกข้อมูลการเงินซ้ำ
      </p>
    </div>
  );
}
