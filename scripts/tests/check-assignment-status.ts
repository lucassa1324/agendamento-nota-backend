import postgres from "postgres";

const LOCAL_URL = "postgres://postgres:admin123@localhost:5432/postgres";

async function main() {
  const sql = postgres(LOCAL_URL);

  try {
    const rows = await sql`
      select
        a.id,
        a.customer_name,
        a.scheduled_at,
        a.staff_id,
        a.assigned_by,
        a.validation_status,
        s.name as staff_name,
        s.calendar_color
      from appointments a
      left join staff s on s.id = a.staff_id
      where a.customer_name in ('LUCAS ALVES DE SA', 'teste4.1', 'ATRO SILVA', 'Evellyn', 'Teste 5')
      order by a.scheduled_at desc
      limit 50
    `;

    const aggregate = await sql`
      select
        count(*) filter (where staff_id is null) as sem_staff,
        count(*) filter (where staff_id is not null) as com_staff
      from appointments
    `;

    console.log("\n=== AMOSTRA DE AGENDAMENTOS ===");
    console.table(rows);

    console.log("\n=== RESUMO GERAL ===");
    console.table(aggregate);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
