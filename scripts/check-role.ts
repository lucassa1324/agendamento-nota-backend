import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function checkUserRole(email: string) {
	try {
		const users = await db
			.select()
			.from(schema.user)
			.where(eq(schema.user.email, email))
			.limit(1);

		if (users.length === 0) {
			console.log(`❌ Usuário com e-mail ${email} não encontrado.`);
		} else {
			console.log(`✅ Usuário: ${users[0].email}`);
			console.log(`🔑 Role atual: ${users[0].role}`);
		}
	} catch (error) {
		console.error("❌ Erro ao buscar usuário:", error);
	} finally {
		process.exit();
	}
}

const email = process.argv[2];
if (!email) {
	console.log("Uso: bun scripts/check-role.ts <email>");
	process.exit(1);
}

checkUserRole(email);
