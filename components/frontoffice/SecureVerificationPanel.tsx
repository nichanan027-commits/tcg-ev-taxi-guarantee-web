"use client";

import { useState } from "react";

import {
  SECURE_VERIFICATION_COPY,
  SECURE_VERIFICATION_ROLES,
  fieldsForRole
} from "../../app/lib/verification/secure-verification.ts";
import type { SecureVerificationRoleId } from "../../app/lib/verification/secure-verification.ts";

/**
 * แผงสาธิตการตรวจสอบข้อมูลอ่อนไหว
 *
 * ค่าทุกตัวอยู่ใน state ของ React เท่านั้น ไม่มีการส่งออก ไม่มีการเก็บ
 * ไม่มีการอ่านเนื้อไฟล์ และไม่มีการเขียน log
 *
 * การเปลี่ยนบทบาทล้างค่าทั้งหมดทิ้ง ไม่ใช่เพื่อความสวยงามของ UX
 * แต่เพราะบทบาทหนึ่งไม่ควรเห็นสิ่งที่อีกบทบาทหนึ่งพิมพ์ไว้
 * และการรีเฟรชล้างค่าเองอยู่แล้ว เพราะไม่มีที่ใดเก็บค่าไว้เลย
 */
type Values = Record<string, string>;
type FileNames = Record<string, { name: string; type: string }>;

export function SecureVerificationPanel() {
  const [roleId, setRoleId] = useState<SecureVerificationRoleId>("TCG_STAFF");
  const [values, setValues] = useState<Values>({});
  const [fileNames, setFileNames] = useState<FileNames>({});

  const fields = fieldsForRole(roleId);

  function switchRole(next: SecureVerificationRoleId) {
    // ล้างก่อนเปลี่ยน — ค่าของบทบาทเดิมต้องไม่ค้างให้บทบาทใหม่เห็น
    setValues({});
    setFileNames({});
    setRoleId(next);
  }

  function clearAll() {
    setValues({});
    setFileNames({});
  }

  return (
    <section className="fo-verify" data-role="secure-verification">
      <p className="fo-verify-notice" data-role="verification-not-persisted">
        {SECURE_VERIFICATION_COPY.notPersisted}
      </p>

      <div className="fo-verify-roles" role="group" aria-label="บทบาทสำหรับสาธิต">
        {SECURE_VERIFICATION_ROLES.map((role) => (
          <button
            key={role.id}
            type="button"
            className={`fo-role-chip${roleId === role.id ? " selected" : ""}`}
            onClick={() => switchRole(role.id)}
            data-role={`verification-role-${role.id}`}
            aria-pressed={roleId === role.id}
          >
            <b>{role.label}</b>
            <span>{role.description}</span>
          </button>
        ))}
      </div>

      <p className="fo-muted" data-role="verification-role-note">
        บทบาทเป็นมุมมองการแสดงผลเท่านั้น ไม่ใช่ลำดับขั้นการอนุมัติ
      </p>

      <div className="fo-verify-fields">
        {fields.map((field) =>
          field.kind === "TEXT" ? (
            <label key={field.id} className="fo-verify-field">
              {field.label}
              <input
                type="text"
                value={values[field.id] ?? ""}
                onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                data-role={`verification-input-${field.id}`}
                autoComplete="off"
                spellCheck={false}
              />
              <small>{field.hint}</small>
            </label>
          ) : (
            <label key={field.id} className="fo-verify-field">
              {field.label}
              <input
                type="file"
                data-role={`verification-file-${field.id}`}
                onChange={(event) => {
                  // อ่านเฉพาะ metadata ที่เบราว์เซอร์ให้มาแล้ว ไม่แตะเนื้อไฟล์
                  const picked = event.target.files?.[0];
                  setFileNames((current) => {
                    if (!picked) {
                      const next = { ...current };
                      delete next[field.id];
                      return next;
                    }
                    return { ...current, [field.id]: { name: picked.name, type: picked.type } };
                  });
                }}
              />
              {fileNames[field.id] ? (
                <span className="fo-verify-filename" data-role={`verification-filename-${field.id}`}>
                  {fileNames[field.id].name}
                  {fileNames[field.id].type ? ` · ${fileNames[field.id].type}` : ""}
                </span>
              ) : null}
              <small data-role="verification-file-notice">{SECURE_VERIFICATION_COPY.fileNotUploaded}</small>
            </label>
          )
        )}
      </div>

      <div className="fo-verify-actions">
        <button type="button" className="fo-secondary" onClick={clearAll} data-role="verification-clear">
          ล้างค่าที่กรอกไว้
        </button>
      </div>

      <dl className="fo-status-grid">
        <div>
          <dt>สถานะการยืนยันตัวตน</dt>
          <dd data-role="verification-identity-state">{SECURE_VERIFICATION_COPY.identityState}</dd>
        </div>
        <div>
          <dt>การยืนยันเบอร์โทรศัพท์</dt>
          <dd data-role="verification-phone-state">{SECURE_VERIFICATION_COPY.phoneVerification}</dd>
        </div>
      </dl>

      <p className="fo-muted" data-role="verification-bureau-context">
        {SECURE_VERIFICATION_COPY.bureauContext}
      </p>
      <p className="fo-muted" data-role="verification-cleared-note">
        {SECURE_VERIFICATION_COPY.clearedOnReload}
      </p>
      <p className="fo-governance" data-role="verification-no-decision">
        {SECURE_VERIFICATION_COPY.noDecisionPower}
      </p>
    </section>
  );
}
