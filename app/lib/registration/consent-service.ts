import { competitionConfig } from "../config/competition.ts";
import { ensureSchema, iso, rowId, str } from "../db/schema.ts";
import { setStatus } from "./application-service.ts";
import type { ConsentRecord } from "./types.ts";

/**
 * ความยินยอมของโหมดการแข่งขัน
 *
 * เป็นแถวใหม่ที่มีเวอร์ชันและเวลาเสมอ ไม่ใช่ boolean ตัวเดียวที่ถูกเขียนทับ
 * ทำให้ตรวจย้อนได้ว่าให้ความยินยอมเวอร์ชันใด เมื่อใด
 */
export async function recordCompetitionConsent(applicationId: string): Promise<ConsentRecord> {
  const sql = await ensureSchema();

  const [application] = await sql`select id from applications where id = ${applicationId}`;
  if (!application) throw new Error(`ไม่พบใบสมัคร ${applicationId}`);

  const id = rowId("consent");
  const [row] = await sql`
    insert into consent_records (id, application_id, version, scope, accepted)
    values (${id}, ${applicationId}, ${competitionConfig.consentVersion}, ${"COMPETITION"}, ${true})
    returning id, application_id, version, scope, accepted, accepted_at
  `;

  await setStatus(applicationId, "CONSENTED", `ให้ความยินยอมเวอร์ชัน ${competitionConfig.consentVersion}`);

  return hydrate(row);
}

export async function listConsents(applicationId: string): Promise<ConsentRecord[]> {
  const sql = await ensureSchema();
  const rows = await sql`
    select id, application_id, version, scope, accepted, accepted_at
    from consent_records where application_id = ${applicationId}
    order by accepted_at, id
  `;
  return rows.map(hydrate);
}

export async function hasCompetitionConsent(applicationId: string): Promise<boolean> {
  const sql = await ensureSchema();
  const [row] = await sql`
    select 1 as ok from consent_records
    where application_id = ${applicationId} and accepted = true and scope = ${"COMPETITION"}
    limit 1
  `;
  return Boolean(row);
}

function hydrate(row: Record<string, unknown>): ConsentRecord {
  return {
    id: str(row.id),
    applicationId: str(row.application_id),
    version: str(row.version),
    scope: str(row.scope),
    accepted: row.accepted === true || row.accepted === "true",
    acceptedAt: iso(row.accepted_at)
  };
}
