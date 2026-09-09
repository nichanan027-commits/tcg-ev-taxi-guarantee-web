import { ensureSchema, iso, isoOrNull, num, numOrNull, rowId, str, strOrNull } from "../db/schema.ts";
import { competitionConfig } from "../config/competition.ts";
import type { ApplicationStatus } from "../config/competition.ts";
import { RegistrationInputSchema } from "./validation.ts";
import type { ApplicationRecord, FinancialInput, ProfileInput } from "./types.ts";

/** เลขที่ใบสมัครที่แสดงต่อผู้ใช้: RTO-C26-000001 — เรียงลำดับจริง ไม่ใช่ค่าสุ่ม */
export function formatApplicationId(sequenceValue: number): string {
  return `${competitionConfig.applicationIdPrefix}-${String(sequenceValue).padStart(6, "0")}`;
}

export async function createApplication(): Promise<ApplicationRecord> {
  const sql = await ensureSchema();
  const [seq] = await sql<{ nextval: string }>`select nextval('application_number_seq') as nextval`;
  const id = formatApplicationId(Number(seq.nextval));

  const [row] = await sql`
    insert into applications (id, status) values (${id}, ${"DRAFT"})
    returning id, status, created_at, updated_at, pii_anonymized_at
  `;
  await recordStatus(id, null, "DRAFT", "สร้างใบสมัครจากหน้าลงทะเบียน");

  return hydrate(row, null, null);
}

export async function getApplication(applicationId: string): Promise<ApplicationRecord | null> {
  const sql = await ensureSchema();
  const [application] = await sql`
    select id, status, created_at, updated_at, pii_anonymized_at
    from applications where id = ${applicationId}
  `;
  if (!application) return null;

  const [profile] = await sql`
    select display_name, phone, province, driver_status, years_driving, ownership_goal, phone_verification
    from application_profiles where application_id = ${applicationId}
  `;
  const [financial] = await sql`
    select average_daily_income, income_channels, working_days_per_month, verified_pct,
           current_rent_daily, fuel_daily, battery_service_daily, other_opex_daily,
           household_monthly, existing_debt_monthly, activity_consistency,
           vehicle_id, vehicle_price, term_months, annual_rate_pct
    from financial_inputs where application_id = ${applicationId}
  `;

  return hydrate(application, profile ?? null, financial ?? null);
}

/**
 * บันทึกข้อมูลใบสมัคร
 *
 * ตรวจด้วย Zod ก่อนเสมอ ค่าที่ไม่ได้ประกาศไว้จะถูกตัดทิ้งตั้งแต่ชั้น schema
 * ถ้าข้อมูลไม่ผ่าน จะไม่มีการเขียนลงฐานข้อมูลเลยแม้แต่ส่วนเดียว
 */
export async function updateApplication(applicationId: string, input: unknown): Promise<ApplicationRecord> {
  const parsed = RegistrationInputSchema.parse(input);
  const sql = await ensureSchema();

  const existing = await getApplication(applicationId);
  if (!existing) throw new Error(`ไม่พบใบสมัคร ${applicationId}`);

  const p = parsed.profile;
  await sql`
    insert into application_profiles (
      application_id, display_name, phone, province, driver_status,
      years_driving, ownership_goal, phone_verification, updated_at
    ) values (
      ${applicationId}, ${p.displayName}, ${p.phone}, ${p.province}, ${p.driverStatus},
      ${p.yearsDriving}, ${p.ownershipGoal}, ${p.phoneVerificationStatus}, now()
    )
    on conflict (application_id) do update set
      display_name = excluded.display_name,
      phone = excluded.phone,
      province = excluded.province,
      driver_status = excluded.driver_status,
      years_driving = excluded.years_driving,
      ownership_goal = excluded.ownership_goal,
      phone_verification = excluded.phone_verification,
      updated_at = now()
  `;

  const f = parsed.financial;
  await sql`
    insert into financial_inputs (
      application_id, average_daily_income, income_channels, working_days_per_month, verified_pct,
      current_rent_daily, fuel_daily, battery_service_daily, other_opex_daily,
      household_monthly, existing_debt_monthly, activity_consistency,
      vehicle_id, vehicle_price, term_months, annual_rate_pct, updated_at
    ) values (
      ${applicationId}, ${f.averageDailyIncome}, ${f.incomeChannels.join(",")}, ${f.workingDaysPerMonth}, ${f.verifiedPct},
      ${f.currentRentDaily}, ${f.fuelDaily}, ${f.batteryServiceDaily}, ${f.otherOpexDaily},
      ${f.householdMonthly}, ${f.existingDebtMonthly}, ${f.activityConsistency},
      ${f.vehicleId}, ${f.vehiclePrice}, ${f.termMonths}, ${f.annualRatePct}, now()
    )
    on conflict (application_id) do update set
      average_daily_income = excluded.average_daily_income,
      income_channels = excluded.income_channels,
      working_days_per_month = excluded.working_days_per_month,
      verified_pct = excluded.verified_pct,
      current_rent_daily = excluded.current_rent_daily,
      fuel_daily = excluded.fuel_daily,
      battery_service_daily = excluded.battery_service_daily,
      other_opex_daily = excluded.other_opex_daily,
      household_monthly = excluded.household_monthly,
      existing_debt_monthly = excluded.existing_debt_monthly,
      activity_consistency = excluded.activity_consistency,
      vehicle_id = excluded.vehicle_id,
      vehicle_price = excluded.vehicle_price,
      term_months = excluded.term_months,
      annual_rate_pct = excluded.annual_rate_pct,
      updated_at = now()
  `;

  await setStatus(applicationId, "DATA_COMPLETE", "บันทึกข้อมูลอาชีพและรายได้ครบถ้วน");

  const updated = await getApplication(applicationId);
  if (!updated) throw new Error(`ไม่พบใบสมัคร ${applicationId} หลังบันทึก`);
  return updated;
}

/**
 * เปลี่ยนสถานะใบสมัคร
 *
 * สถานะเดินหน้าเท่านั้น การเรียกด้วยสถานะที่ถอยหลังกว่าเดิมจะไม่ทำอะไร
 * เพื่อไม่ให้การกลับไปแก้ข้อมูลลบร่องรอยว่าเคยประเมินหรือเลือก FI แล้ว
 */
const STATUS_ORDER: ApplicationStatus[] = [
  "DRAFT",
  "CONSENTED",
  "DATA_COMPLETE",
  "ASSESSED",
  "ROUTED",
  "FI_SELECTED",
  "FI_CONSENTED",
  "FA_REQUESTED"
];

export async function setStatus(
  applicationId: string,
  next: ApplicationStatus,
  note?: string
): Promise<ApplicationStatus> {
  const sql = await ensureSchema();
  const [row] = await sql`select status from applications where id = ${applicationId}`;
  if (!row) throw new Error(`ไม่พบใบสมัคร ${applicationId}`);

  const current = str(row.status) as ApplicationStatus;
  if (STATUS_ORDER.indexOf(next) <= STATUS_ORDER.indexOf(current)) return current;

  await sql`update applications set status = ${next}, updated_at = now() where id = ${applicationId}`;
  await recordStatus(applicationId, current, next, note);
  return next;
}

async function recordStatus(
  applicationId: string,
  from: ApplicationStatus | null,
  to: ApplicationStatus,
  note?: string
) {
  const sql = await ensureSchema();
  await sql`
    insert into status_history (id, application_id, from_status, to_status, note)
    values (${rowId("sh")}, ${applicationId}, ${from}, ${to}, ${note ?? null})
  `;
}

export type StatusHistoryRow = {
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  note: string | null;
  createdAt: string;
};

export async function listStatusHistory(applicationId: string): Promise<StatusHistoryRow[]> {
  const sql = await ensureSchema();
  const rows = await sql`
    select from_status, to_status, note, created_at
    from status_history where application_id = ${applicationId}
    order by created_at, id
  `;
  return rows.map((row) => ({
    fromStatus: strOrNull(row.from_status) as ApplicationStatus | null,
    toStatus: str(row.to_status) as ApplicationStatus,
    note: strOrNull(row.note),
    createdAt: iso(row.created_at)
  }));
}

function hydrate(
  application: Record<string, unknown>,
  profileRow: Record<string, unknown> | null,
  financialRow: Record<string, unknown> | null
): ApplicationRecord {
  const profile: ProfileInput | null = profileRow
    ? {
        displayName: str(profileRow.display_name),
        phone: str(profileRow.phone),
        province: str(profileRow.province),
        driverStatus: str(profileRow.driver_status) as ProfileInput["driverStatus"],
        yearsDriving: num(profileRow.years_driving),
        ownershipGoal: str(profileRow.ownership_goal) as ProfileInput["ownershipGoal"],
        phoneVerificationStatus: "NOT_REQUIRED_COMPETITION"
      }
    : null;

  const financial: FinancialInput | null = financialRow
    ? {
        averageDailyIncome: num(financialRow.average_daily_income),
        incomeChannels: str(financialRow.income_channels)
          .split(",")
          .filter(Boolean) as FinancialInput["incomeChannels"],
        workingDaysPerMonth: num(financialRow.working_days_per_month),
        verifiedPct: num(financialRow.verified_pct),
        currentRentDaily: num(financialRow.current_rent_daily),
        fuelDaily: num(financialRow.fuel_daily),
        batteryServiceDaily: num(financialRow.battery_service_daily),
        otherOpexDaily: num(financialRow.other_opex_daily),
        householdMonthly: num(financialRow.household_monthly),
        existingDebtMonthly: num(financialRow.existing_debt_monthly),
        activityConsistency: num(financialRow.activity_consistency),
        vehicleId: str(financialRow.vehicle_id) as FinancialInput["vehicleId"],
        vehiclePrice: num(financialRow.vehicle_price),
        termMonths: num(financialRow.term_months),
        annualRatePct: num(financialRow.annual_rate_pct)
      }
    : null;

  return {
    id: str(application.id),
    status: str(application.status) as ApplicationStatus,
    createdAt: iso(application.created_at),
    updatedAt: iso(application.updated_at),
    piiAnonymizedAt: isoOrNull(application.pii_anonymized_at),
    profile,
    financial
  };
}

export { numOrNull };
