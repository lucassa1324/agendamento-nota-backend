import fs from "fs";
import postgres from "postgres";

function readStagingDbUrl() {
  const txt = fs.readFileSync("scripts/backup.env/backup.env", "utf8");
  const match = txt.match(/url stagin DATABASE_URL="([^"]+)"/);
  if (!match?.[1]) throw new Error("DATABASE_URL de staging nao encontrada");
  return match[1];
}

const sql = postgres(readStagingDbUrl(), { max: 1 });

try {
  await sql`alter table companies add column if not exists financial_password text`;
  console.log("[OK] companies.financial_password");

  await sql`
    create table if not exists staff (
      id text primary key not null,
      company_id text not null,
      user_id text,
      name text not null,
      email text not null,
      is_admin boolean default false not null,
      is_secretary boolean default false not null,
      is_professional boolean default false not null,
      commission_rate integer default 0 not null,
      is_active boolean default true not null,
      created_at timestamp default now() not null,
      updated_at timestamp default now() not null,
      calendar_color varchar(7)
    )
  `;
  console.log("[OK] table staff");

  await sql`
    create table if not exists schedule_blocks (
      id text primary key not null,
      staff_id text not null,
      start_time timestamp not null,
      end_time timestamp not null,
      reason text,
      is_overrideable boolean default false not null,
      created_at timestamp default now() not null,
      updated_at timestamp default now() not null
    )
  `;
  console.log("[OK] table schedule_blocks");

  await sql`
    create table if not exists staff_services (
      staff_id text not null,
      service_id text not null,
      created_at timestamp default now() not null
    )
  `;
  console.log("[OK] table staff_services");

  await sql`
    create table if not exists staff_services_competency (
      id text primary key,
      staff_id text not null references staff(id) on delete cascade,
      service_id text not null references services(id) on delete cascade,
      is_active boolean default true not null,
      priority_score integer default 5 not null,
      created_at timestamp default now() not null,
      updated_at timestamp default now() not null
    )
  `;
  console.log("[OK] table staff_services_competency");

  await sql`create unique index if not exists staff_services_staff_service_unique on staff_services (staff_id, service_id)`;
  await sql`create unique index if not exists staff_services_competency_staff_service_unique on staff_services_competency (staff_id, service_id)`;
  await sql`create index if not exists staff_services_competency_staff_idx on staff_services_competency (staff_id)`;
  await sql`create index if not exists staff_services_competency_service_idx on staff_services_competency (service_id)`;
  await sql`create index if not exists staff_services_competency_active_idx on staff_services_competency (is_active)`;
  console.log("[OK] indexes");

  await sql`
    do $$
    begin
      if not exists (select 1 from pg_constraint where conname = 'staff_company_id_companies_id_fk') then
        alter table staff add constraint staff_company_id_companies_id_fk foreign key (company_id) references companies(id) on delete cascade;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'staff_user_id_user_id_fk') then
        alter table staff add constraint staff_user_id_user_id_fk foreign key (user_id) references "user"(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'schedule_blocks_staff_id_staff_id_fk') then
        alter table schedule_blocks add constraint schedule_blocks_staff_id_staff_id_fk foreign key (staff_id) references staff(id) on delete cascade;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'staff_services_staff_id_staff_id_fk') then
        alter table staff_services add constraint staff_services_staff_id_staff_id_fk foreign key (staff_id) references staff(id) on delete cascade;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'staff_services_service_id_services_id_fk') then
        alter table staff_services add constraint staff_services_service_id_services_id_fk foreign key (service_id) references services(id) on delete cascade;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'appointments_staff_id_staff_id_fk') then
        alter table appointments add constraint appointments_staff_id_staff_id_fk foreign key (staff_id) references staff(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'appointments_created_by_user_id_fk') then
        alter table appointments add constraint appointments_created_by_user_id_fk foreign key (created_by) references "user"(id) on delete set null;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'staff_services_competency_priority_score_check') then
        alter table staff_services_competency
        add constraint staff_services_competency_priority_score_check
        check (priority_score >= 0 and priority_score <= 10);
      end if;
    end
    $$;
  `;
  console.log("[OK] constraints");

  await sql`
    insert into staff_services_competency (
      id, staff_id, service_id, is_active, priority_score, created_at, updated_at
    )
    select
      ('ssc_' || md5(random()::text || clock_timestamp()::text || ss.staff_id || ss.service_id)),
      ss.staff_id,
      ss.service_id,
      true,
      5,
      now(),
      now()
    from staff_services ss
    left join staff_services_competency ssc
      on ssc.staff_id = ss.staff_id and ssc.service_id = ss.service_id
    where ssc.id is null
  `;
  console.log("[OK] backfill staff_services_competency");
} finally {
  await sql.end();
}
