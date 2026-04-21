import { db } from "../modules/infrastructure/drizzle/database";
import { companySiteCustomizations, siteDrafts } from "../db/schema";
async function main() {
    console.log(">>> [DB_READ] Buscando customizações do site (Publicadas)...");
    const results = await db
        .select({
        id: companySiteCustomizations.id,
        companyId: companySiteCustomizations.companyId,
        appointmentFlow: companySiteCustomizations.appointmentFlow,
    })
        .from(companySiteCustomizations);
    results.forEach((row, index) => {
        console.log(`\n--- Empresa ${index + 1} (PUBLISHED) (ID: ${row.companyId}) ---`);
        console.log("Appointment Flow:");
        console.log(JSON.stringify(row.appointmentFlow, null, 2));
    });
    console.log("\n>>> [DB_READ] Buscando Rascunhos (Drafts)...");
    const drafts = await db
        .select({
        id: siteDrafts.id,
        companyId: siteDrafts.companyId,
        appointmentFlow: siteDrafts.appointmentFlow,
    })
        .from(siteDrafts);
    drafts.forEach((row, index) => {
        console.log(`\n--- Empresa ${index + 1} (DRAFT) (ID: ${row.companyId}) ---`);
        console.log("Appointment Flow:");
        console.log(JSON.stringify(row.appointmentFlow, null, 2));
    });
}
main().catch((err) => {
    console.error("❌ Erro ao ler banco de dados:", err);
    process.exit(1);
});
