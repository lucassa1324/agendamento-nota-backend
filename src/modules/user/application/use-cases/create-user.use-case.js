import { auth } from "../../../infrastructure/auth/auth";
import { db } from "../../../infrastructure/drizzle/database";
import { companies, account, companySiteCustomizations, user } from "../../../../db/schema";
import { generateUniqueSlug } from "../../../../shared/utils/slug";
import { eq } from "drizzle-orm";
export class CreateUserUseCase {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async execute(data) {
        const alreadyExists = await this.userRepository.findByEmail(data.email);
        if (alreadyExists) {
            const userCompany = await db
                .select()
                .from(companies)
                .where(eq(companies.ownerId, alreadyExists.id))
                .limit(1);
            if (userCompany.length > 0) {
                return {
                    user: alreadyExists,
                    session: null,
                    business: userCompany[0],
                    slug: userCompany[0].slug
                };
            }
            const slug = await generateUniqueSlug(data.studioName);
            const result = await db.transaction(async (tx) => {
                const [newCompany] = await tx.insert(companies).values({
                    id: crypto.randomUUID(),
                    name: data.studioName,
                    slug,
                    ownerId: alreadyExists.id,
                }).returning();
                await tx.insert(companySiteCustomizations).values({
                    id: crypto.randomUUID(),
                    companyId: newCompany.id,
                });
                await tx.update(account).set({ scope: "ADMIN" }).where(eq(account.userId, alreadyExists.id));
                return { newCompany, slug };
            }).catch(async (err) => {
                const code = err?.code || err?.cause?.code;
                if (code === "23505") {
                    const fallbackSlug = await generateUniqueSlug(`${data.studioName}-${Date.now()}`);
                    const result = await db.transaction(async (tx) => {
                        const [newCompany] = await tx.insert(companies).values({
                            id: crypto.randomUUID(),
                            name: data.studioName,
                            slug: fallbackSlug,
                            ownerId: alreadyExists.id,
                        }).returning();
                        await tx.insert(companySiteCustomizations).values({
                            id: crypto.randomUUID(),
                            companyId: newCompany.id,
                        });
                        await tx.update(account).set({ scope: "ADMIN" }).where(eq(account.userId, alreadyExists.id));
                        return { newCompany, slug: fallbackSlug };
                    });
                    return result;
                }
                throw err;
            });
            return {
                user: alreadyExists,
                session: null,
                business: result.newCompany,
                slug: result.slug
            };
        }
        console.log(`[USER_REGISTER_USE_CASE] Iniciando signUpEmail para: ${data.email}`);
        const response = await auth.api.signUpEmail({
            body: {
                email: data.email,
                password: data.password,
                name: data.name,
                role: "ADMIN",
                active: true,
            },
        });
        if (!response || !response.user) {
            console.error(`[USER_REGISTER_USE_CASE] Falha no signUpEmail:`, response);
            throw new Error("Failed to create user");
        }
        console.log(`[USER_REGISTER_USE_CASE] signUpEmail concluído com sucesso para: ${response.user.email}`);
        // Atualiza a role do usuário se fornecida, caso contrário define como "ADMIN" por padrão para quem vem da landing page
        const finalRole = data.role || "ADMIN";
        await db.update(user).set({ role: finalRole }).where(eq(user.id, response.user.id));
        console.log(`[USER_REGISTER_USE_CASE] Role '${finalRole}' aplicada ao usuário ${response.user.id}`);
        const slug = await generateUniqueSlug(data.studioName);
        const { newCompany, finalSlug } = await db.transaction(async (tx) => {
            await tx.update(account).set({ scope: "ADMIN" }).where(eq(account.userId, response.user.id));
            const [created] = await tx.insert(companies).values({
                id: crypto.randomUUID(),
                name: data.studioName,
                slug,
                ownerId: response.user.id,
            }).returning();
            await tx.insert(companySiteCustomizations).values({
                id: crypto.randomUUID(),
                companyId: created.id,
            });
            return { newCompany: created, finalSlug: slug };
        }).catch(async (err) => {
            const code = err?.code || err?.cause?.code;
            if (code === "23505") {
                const fallbackSlug = await generateUniqueSlug(`${data.studioName}-${Date.now()}`);
                const result = await db.transaction(async (tx) => {
                    await tx.update(account).set({ scope: "ADMIN" }).where(eq(account.userId, response.user.id));
                    const [created] = await tx.insert(companies).values({
                        id: crypto.randomUUID(),
                        name: data.studioName,
                        slug: fallbackSlug,
                        ownerId: response.user.id,
                    }).returning();
                    await tx.insert(companySiteCustomizations).values({
                        id: crypto.randomUUID(),
                        companyId: created.id,
                    });
                    return { newCompany: created, finalSlug: fallbackSlug };
                });
                return result;
            }
            throw err;
        });
        return {
            ...response,
            business: newCompany,
            slug: finalSlug
        };
    }
}
