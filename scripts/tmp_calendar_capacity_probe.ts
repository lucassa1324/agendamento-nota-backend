import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL || "", { max: 1 });

async function main() {
  const slug = "aura-teste";

  const companies = await sql`
    select id, name, slug, owner_id
    from companies
    where lower(slug) = lower(${slug})
    limit 1
  `;

  if (companies.length === 0) {
    console.log("COMPANY_NOT_FOUND");
    return;
  }

  const company = companies[0] as {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
  };

  const ownerRows = await sql`
    select id, email
    from "user"
    where id = ${company.owner_id}
    limit 1
  `;

  const owner = ownerRows[0] as { id: string; email: string } | undefined;

  const serviceWithCompetency = await sql`
    select
      s.id as service_id,
      s.name as service_name,
      s.duration,
      count(distinct st.id) as professional_count
    from services s
    join staff_services_competency ssc
      on ssc.service_id = s.id
     and ssc.is_active = true
    join staff st
      on st.id = ssc.staff_id
     and st.is_active = true
     and st.is_professional = true
    where s.company_id = ${company.id}
      and coalesce(s.is_visible, true) = true
    group by s.id, s.name, s.duration
    having count(distinct st.id) >= 2
    order by professional_count asc, s.name asc
    limit 10
  `;

  const serviceWithStaffLegacy = await sql`
    select
      s.id as service_id,
      s.name as service_name,
      s.duration,
      count(distinct st.id) as professional_count
    from services s
    join staff_services ss
      on ss.service_id = s.id
    join staff st
      on st.id = ss.staff_id
     and st.is_active = true
     and st.is_professional = true
    where s.company_id = ${company.id}
      and coalesce(s.is_visible, true) = true
    group by s.id, s.name, s.duration
    having count(distinct st.id) >= 2
    order by professional_count asc, s.name asc
    limit 10
  `;

  const selectedService =
    (serviceWithCompetency[0] as
      | {
          service_id: string;
          service_name: string;
          duration: string;
          professional_count: string;
        }
      | undefined) ||
    (serviceWithStaffLegacy[0] as
      | {
          service_id: string;
          service_name: string;
          duration: string;
          professional_count: string;
        }
      | undefined);

  const activeProfessionals = await sql`
    select id, name, email
    from staff
    where company_id = ${company.id}
      and is_active = true
      and is_professional = true
    order by name asc
  `;

  let servicePros: Array<{ id: string; name: string; email: string }> = [];

  if (selectedService) {
    servicePros = (await sql`
      select distinct st.id, st.name, st.email
      from staff st
      where st.id in (
        select ssc.staff_id
        from staff_services_competency ssc
        where ssc.service_id = ${selectedService.service_id}
          and ssc.is_active = true
        union
        select ss.staff_id
        from staff_services ss
        where ss.service_id = ${selectedService.service_id}
      )
      and st.is_active = true
      and st.is_professional = true
      order by st.name asc
    `) as Array<{ id: string; name: string; email: string }>;
  }

  console.log(
    JSON.stringify(
      {
        company,
        owner,
        activeProfessionals,
        selectedService,
        serviceWithCompetency,
        serviceWithStaffLegacy,
        servicePros,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end();
  });
