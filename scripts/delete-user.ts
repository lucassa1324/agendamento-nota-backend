import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function deleteUserByEmail(email: string) {
	try {
		console.log(`🔍 Buscando usuário: ${email}`);

		const users = await db
			.select()
			.from(schema.user)
			.where(eq(schema.user.email, email))
			.limit(1);

		if (users.length === 0) {
			console.log(`❌ Usuário com e-mail ${email} não encontrado.`);
			return;
		}

		const targetUser = users[0];
		console.log(
			`🗑️ Removendo usuário ${targetUser.id} e todos os dados vinculados (cascade)...`,
		);

		// Devido às constraints de foreign key com 'cascade', remover o usuário
		// deve remover automaticamente suas sessões, contas e empresas (se configurado no schema).
		// No schema.ts, ownerId em companies tem onDelete: "cascade".

		await db.delete(schema.user).where(eq(schema.user.id, targetUser.id));

		console.log(`✅ Usuário ${email} removido com sucesso.`);
	} catch (error) {
		console.error("❌ Erro ao remover usuário:", error);
	} finally {
		process.exit();
	}
}

const email = process.argv[2];
if (!email) {
	console.log("Uso: bun scripts/delete-user.ts <email>");
	process.exit(1);
}

deleteUserByEmail(email);
