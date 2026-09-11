-- Route to Own — Competition Registration schema (System A / Front Office only)
--
-- ห้ามมีคอลัมน์ข้อมูลอ่อนไหวจากหน้า Secure Verification:
-- national_id, bank_account_number, statement_blob, id_card_blob,
-- driver_license_blob, credit_report, health_*
-- ข้อมูลเหล่านั้นอยู่ในหน่วยความจำเบราว์เซอร์เท่านั้น ไม่ถูกส่งหรือบันทึก
--
-- ห้ามมีตารางของ System B (Post-Approval): child_elg, sweep, dpd,
-- debt_ledger, claim, recovery, control_tower

create sequence if not exists application_number_seq start with 1;
create sequence if not exists fa_case_number_seq start with 1;

create table if not exists applications (
  id                text primary key,                     -- RTO-C26-000001
  status            text not null default 'DRAFT',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  pii_anonymized_at timestamptz
);

create table if not exists application_profiles (
  application_id     text primary key references applications (id) on delete cascade,
  display_name       text,
  phone              text,
  province           text,
  driver_status      text,
  years_driving      integer,
  ownership_goal     text,
  phone_verification text not null default 'NOT_REQUIRED_COMPETITION',
  updated_at         timestamptz not null default now()
);

create table if not exists basic_eligibility (
  application_id               text primary key references applications (id) on delete cascade,
  taxi_occupation_status       text not null,
  public_driver_license_status text not null,
  current_vehicle_relationship text not null,
  cooperative_or_operator      text,
  years_professional_driving   integer not null,
  service_province             text not null,
  occupational_evidence_status text not null,
  updated_at                   timestamptz not null default now()
);

-- หลักฐานรายได้รายช่องทาง เก็บเฉพาะจำนวนเงินและสถานะหลักฐาน
-- ไม่เก็บเลขบัญชี ไม่เก็บ statement และไม่เก็บไฟล์ใด ๆ
create table if not exists income_evidence (
  id                      text primary key,
  application_id          text not null references applications (id) on delete cascade,
  channel                 text not null,
  daily_amount            numeric(12, 2) not null,
  has_transaction_evidence boolean not null default false,
  updated_at              timestamptz not null default now()
);

create index if not exists income_evidence_application_idx on income_evidence (application_id);

create table if not exists financial_inputs (
  application_id          text primary key references applications (id) on delete cascade,
  average_daily_income    numeric(12, 2),
  income_channels         text,
  working_days_per_month  integer,
  verified_pct            integer,
  current_rent_daily      numeric(12, 2),
  fuel_daily              numeric(12, 2),
  battery_service_daily   numeric(12, 2),
  other_opex_daily        numeric(12, 2),
  household_monthly       numeric(12, 2),
  existing_debt_monthly   numeric(12, 2),
  activity_consistency    integer,
  vehicle_id              text not null default 'AION_ES',
  vehicle_price           numeric(12, 2),
  term_months             integer,
  annual_rate_pct         numeric(6, 3),
  updated_at              timestamptz not null default now()
);

create table if not exists consent_records (
  id             text primary key,
  application_id text not null references applications (id) on delete cascade,
  version        text not null,
  scope          text not null default 'COMPETITION',
  accepted       boolean not null,
  accepted_at    timestamptz not null default now()
);

create index if not exists consent_records_application_idx on consent_records (application_id);

-- Snapshot เป็น append-only ห้าม update แถวเดิม
create table if not exists evaluation_snapshots (
  id                              text primary key,
  application_id                  text not null references applications (id) on delete cascade,
  input_version                   integer not null default 1,
  basic_eligibility               jsonb,
  declared_daily_revenue          numeric(12, 2),
  assessment_daily_revenue        numeric(12, 2),
  verified_daily_revenue          numeric(12, 2),
  revenue_evidence_status         text,
  vehicle_scenario                jsonb not null,
  financing_scenario              jsonb not null,
  verified_revenue                numeric(12, 2) not null,
  eligible_opex                   numeric(12, 2) not null,
  protected_cash                  numeric(12, 2) not null,
  available_cash                  numeric(12, 2) not null,
  estimated_obligation            numeric(12, 2) not null,
  residual                        numeric(12, 2) not null,
  affordability_gap               numeric(12, 2) not null,
  affordability_passed            boolean not null,
  principal_sustainability_passed boolean not null,
  income_evidence_reliability     text not null,
  activity_evidence_status        text not null,
  pre_score                       integer not null,
  tier                            text,
  route                           text not null,
  reason_codes                    jsonb not null,
  rbp_tier                        text,
  rbp_rate                        numeric(6, 4),
  indicative_guarantee_eligible_base numeric(14, 2),
  engine_status                   text not null,
  spec_version                    text not null,
  evaluated_at                    timestamptz not null default now()
);

create index if not exists evaluation_snapshots_application_idx
  on evaluation_snapshots (application_id, evaluated_at desc);

create table if not exists fi_catalogue (
  id                 text primary key,
  fi_name            text not null,
  product_name       text not null,
  vehicle_categories text not null,
  financing_min      numeric(14, 2),
  financing_max      numeric(14, 2),
  term_options       text,
  rate_info          text,
  down_payment_note  text,
  product_notes      text,
  source_label       text not null,
  source_url         text,
  source_status      text not null,
  checked_at         date,
  enabled            boolean not null default true
);

-- การเลือก FI เป็น append-only: เปลี่ยน FI จะปิดแถวเดิมแล้วเพิ่มแถวใหม่
-- แต่ละแถวผูกกับ Snapshot ของ FI รายนั้นโดยเฉพาะ เพราะภาระต่อวันของแต่ละแห่งไม่เท่ากัน
create table if not exists fi_selections (
  id                     text primary key,
  application_id         text not null references applications (id) on delete cascade,
  fi_id                  text not null,
  slot                   integer not null,
  evaluation_snapshot_id text references evaluation_snapshots (id),
  financing_scenario     jsonb,
  material_change        boolean not null default false,
  active                 boolean not null default true,
  created_at             timestamptz not null default now()
);

create index if not exists fi_selections_application_idx on fi_selections (application_id, active);

-- ความยินยอมรายสถาบันการเงิน แยกจากความยินยอมของการแข่งขัน และเป็น append-only
create table if not exists fi_consent_records (
  id             text primary key,
  application_id text not null references applications (id) on delete cascade,
  fi_id          text not null,
  version        text not null,
  accepted       boolean not null,
  accepted_at    timestamptz not null default now()
);

create index if not exists fi_consent_records_application_idx on fi_consent_records (application_id);

create table if not exists fa_cases (
  id                     text primary key,                -- FA-C26-000001
  application_id         text not null references applications (id) on delete cascade,
  evaluation_snapshot_id text not null references evaluation_snapshots (id),
  route                  text not null,
  tier                   text,
  pre_score              integer not null,
  affordability_passed   boolean not null,
  available_cash         numeric(12, 2) not null,
  estimated_obligation   numeric(12, 2) not null,
  residual               numeric(12, 2) not null,
  affordability_gap      numeric(12, 2) not null,
  evidence_reliability   text not null,
  primary_reason         text,
  reason_codes           jsonb not null,
  preferred_contact_time text not null,
  preferred_channel      text not null,
  status                 text not null default 'NEW',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists fa_cases_status_idx on fa_cases (status, created_at desc);
create index if not exists fa_cases_application_idx on fa_cases (application_id);

create table if not exists fa_case_events (
  id         text primary key,
  case_id    text not null references fa_cases (id) on delete cascade,
  from_status text,
  to_status  text not null,
  note       text,
  next_action text,
  follow_up_on date,
  created_at timestamptz not null default now()
);

create index if not exists fa_case_events_case_idx on fa_case_events (case_id, created_at);

create table if not exists status_history (
  id             text primary key,
  application_id text not null references applications (id) on delete cascade,
  from_status    text,
  to_status      text not null,
  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists status_history_application_idx on status_history (application_id, created_at);
