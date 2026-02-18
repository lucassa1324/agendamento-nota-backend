import { db } from "../../../infrastructure/drizzle/database";
import { companies, companySiteCustomizations } from "../../../../db/schema";
import { eq, and } from "drizzle-orm";
export class BusinessRepository {
    async findAllByUserId(userId) {
        const results = await db
            .select({
            id: companies.id,
            name: companies.name,
            slug: companies.slug,
            createdAt: companies.createdAt,
            siteCustomization: {
                layoutGlobal: companySiteCustomizations.layoutGlobal,
                home: companySiteCustomizations.home,
                gallery: companySiteCustomizations.gallery,
                aboutUs: companySiteCustomizations.aboutUs,
                appointmentFlow: companySiteCustomizations.appointmentFlow,
            }
        })
            .from(companies)
            .leftJoin(companySiteCustomizations, eq(companies.id, companySiteCustomizations.companyId))
            .where(eq(companies.ownerId, userId));
        return results;
    }
    async findBySlug(slug) {
        const result = await db
            .select({
            id: companies.id,
            name: companies.name,
            slug: companies.slug,
            ownerId: companies.ownerId,
            createdAt: companies.createdAt,
            updatedAt: companies.updatedAt,
            siteCustomization: {
                layoutGlobal: companySiteCustomizations.layoutGlobal,
                home: companySiteCustomizations.home,
                gallery: companySiteCustomizations.gallery,
                aboutUs: companySiteCustomizations.aboutUs,
                appointmentFlow: companySiteCustomizations.appointmentFlow,
            }
        })
            .from(companies)
            .leftJoin(companySiteCustomizations, eq(companies.id, companySiteCustomizations.companyId))
            .where(eq(companies.slug, slug))
            .limit(1);
        return result[0] || null;
    }
    async findById(id) {
        const result = await db
            .select({
            id: companies.id,
            name: companies.name,
            slug: companies.slug,
            ownerId: companies.ownerId,
            createdAt: companies.createdAt,
            updatedAt: companies.updatedAt,
            siteCustomization: {
                layoutGlobal: companySiteCustomizations.layoutGlobal,
                home: companySiteCustomizations.home,
                gallery: companySiteCustomizations.gallery,
                aboutUs: companySiteCustomizations.aboutUs,
                appointmentFlow: companySiteCustomizations.appointmentFlow,
            }
        })
            .from(companies)
            .leftJoin(companySiteCustomizations, eq(companies.id, companySiteCustomizations.companyId))
            .where(eq(companies.id, id))
            .limit(1);
        return result[0] || null;
    }
    async create(data) {
        return await db.transaction(async (tx) => {
            const [newCompany] = await tx.insert(companies).values({
                id: data.id,
                name: data.name,
                slug: data.slug,
                ownerId: data.ownerId,
            }).returning();
            const [newCustomization] = await tx.insert(companySiteCustomizations).values({
                id: crypto.randomUUID(),
                companyId: newCompany.id,
            }).returning();
            return {
                ...newCompany,
                siteCustomization: newCustomization
            };
        });
    }
    async updateConfig(id, userId, config) {
        return await db.transaction(async (tx) => {
            // Verifica se a empresa pertence ao usuário
            const [company] = await tx
                .select()
                .from(companies)
                .where(and(eq(companies.id, id), eq(companies.ownerId, userId)))
                .limit(1);
            if (!company)
                return null;
            // Atualiza ou insere a customização
            const [updatedCustomization] = await tx
                .insert(companySiteCustomizations)
                .values({
                id: crypto.randomUUID(),
                companyId: id,
                ...config
            })
                .onConflictDoUpdate({
                target: companySiteCustomizations.companyId,
                set: config
            })
                .returning();
            return {
                ...company,
                siteCustomization: updatedCustomization
            };
        });
    }
}
