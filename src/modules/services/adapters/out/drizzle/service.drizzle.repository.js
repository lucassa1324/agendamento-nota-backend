import { db } from "../../../../infrastructure/drizzle/database";
import { services, serviceResources } from "../../../../../db/schema";
import { eq } from "drizzle-orm";
export class DrizzleServiceRepository {
    async findById(id) {
        const [result] = await db
            .select()
            .from(services)
            .where(eq(services.id, id))
            .limit(1);
        if (!result)
            return null;
        // Busca os recursos vinculados
        const resources = await db
            .select()
            .from(serviceResources)
            .where(eq(serviceResources.serviceId, id));
        return {
            ...result,
            resources: resources
        };
    }
    async findAllByCompanyId(companyId) {
        const results = await db
            .select()
            .from(services)
            .where(eq(services.companyId, companyId));
        // Para cada serviço, busca seus recursos (pode ser otimizado futuramente com join ou Promise.all)
        const servicesWithResources = await Promise.all(results.map(async (service) => {
            const resources = await db
                .select()
                .from(serviceResources)
                .where(eq(serviceResources.serviceId, service.id));
            return {
                ...service,
                resources: resources
            };
        }));
        return servicesWithResources;
    }
    async create(data) {
        const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        const serviceId = data.id && isUUID(data.id) ? data.id : crypto.randomUUID();
        console.log(`[DrizzleServiceRepository] Executando Upsert para ID: ${serviceId}`);
        // Mapeia advancedRules para garantir o formato {"conflicts": []}
        let finalAdvancedRules = { conflicts: [] };
        const rawRules = data.advancedRules;
        if (rawRules) {
            if (rawRules.conflicts && Array.isArray(rawRules.conflicts)) {
                finalAdvancedRules = { conflicts: rawRules.conflicts };
            }
            else if (Array.isArray(rawRules)) {
                finalAdvancedRules = { conflicts: rawRules };
            }
            else if (typeof rawRules === 'object') {
                finalAdvancedRules = rawRules.conflicts ? { conflicts: rawRules.conflicts } : { conflicts: [], ...rawRules };
            }
        }
        try {
            const [newService] = await db
                .insert(services)
                .values({
                id: serviceId,
                companyId: data.companyId,
                name: data.name,
                description: data.description,
                price: data.price.toString(),
                duration: data.duration.toString(),
                icon: data.icon,
                isVisible: data.isVisible ?? true,
                showOnHome: data.showOnHome ?? false,
                advancedRules: finalAdvancedRules,
            })
                .onConflictDoUpdate({
                target: services.id,
                set: {
                    name: data.name,
                    description: data.description,
                    price: data.price.toString(),
                    duration: data.duration.toString(),
                    icon: data.icon,
                    isVisible: data.isVisible ?? true,
                    showOnHome: data.showOnHome ?? false,
                    advancedRules: finalAdvancedRules,
                    updatedAt: new Date(),
                },
            })
                .returning();
            // Gerencia os recursos (estoque) vinculados
            if (data.resources) {
                // Primeiro remove os antigos
                await db
                    .delete(serviceResources)
                    .where(eq(serviceResources.serviceId, serviceId));
                // Insere os novos
                if (data.resources.length > 0) {
                    await db.insert(serviceResources).values(data.resources.map(res => ({
                        id: crypto.randomUUID(),
                        serviceId: serviceId,
                        inventoryId: res.inventoryId,
                        quantity: res.quantity.toString(),
                        unit: res.unit,
                        useSecondaryUnit: res.useSecondaryUnit
                    })));
                }
            }
            const resources = await db
                .select()
                .from(serviceResources)
                .where(eq(serviceResources.serviceId, serviceId));
            return {
                ...newService,
                resources: resources
            };
        }
        catch (dbError) {
            console.error(`[DrizzleServiceRepository] Erro no banco:`, dbError);
            throw dbError;
        }
    }
    async update(id, data) {
        console.log(`\n[DrizzleServiceRepository] >>> INICIANDO UPDATE PARA ID: ${id}`);
        console.log(`[DrizzleServiceRepository] DADOS RECEBIDOS:`, JSON.stringify(data, null, 2));
        const updatePayload = {
            updatedAt: new Date(),
        };
        // Mapeamento explícito de campos básicos
        if (data.name !== undefined)
            updatePayload.name = data.name;
        if (data.description !== undefined)
            updatePayload.description = data.description;
        if (data.price !== undefined)
            updatePayload.price = data.price.toString();
        if (data.duration !== undefined)
            updatePayload.duration = data.duration.toString();
        if (data.icon !== undefined)
            updatePayload.icon = data.icon;
        if (data.isVisible !== undefined)
            updatePayload.isVisible = data.isVisible;
        if (data.showOnHome !== undefined)
            updatePayload.showOnHome = data.showOnHome;
        // Tratamento ultra-rigoroso para advancedRules (advanced_rules no banco)
        if (data.advancedRules !== undefined) {
            let finalRules = { conflicts: [] };
            const rawRules = data.advancedRules;
            if (rawRules) {
                // Se já vier no formato { conflicts: [...] }
                if (rawRules.conflicts && Array.isArray(rawRules.conflicts)) {
                    finalRules = { conflicts: rawRules.conflicts };
                }
                // Se vier apenas o array [...]
                else if (Array.isArray(rawRules)) {
                    finalRules = { conflicts: rawRules };
                }
                // Se vier como objeto genérico
                else if (typeof rawRules === 'object') {
                    finalRules = rawRules.conflicts ? { conflicts: rawRules.conflicts } : { conflicts: [], ...rawRules };
                }
            }
            updatePayload.advancedRules = finalRules;
            console.log(`[DrizzleServiceRepository] AdvancedRules mapeado para:`, JSON.stringify(finalRules));
        }
        console.log(`[DrizzleServiceRepository] PAYLOAD FINAL ENVIADO AO DRIZZLE:`, JSON.stringify(updatePayload, null, 2));
        try {
            const [updated] = await db
                .update(services)
                .set(updatePayload)
                .where(eq(services.id, id))
                .returning();
            if (!updated) {
                console.warn(`[DrizzleServiceRepository] !!! NENHUM REGISTRO ENCONTRADO PARA O ID: ${id}`);
                return null;
            }
            // Gerencia os recursos (estoque) vinculados no Update
            if (data.resources !== undefined) {
                console.log(`[DrizzleServiceRepository] Atualizando recursos para o serviço: ${id}`);
                // Remove os antigos
                await db
                    .delete(serviceResources)
                    .where(eq(serviceResources.serviceId, id));
                // Insere os novos se houver
                if (data.resources.length > 0) {
                    await db.insert(serviceResources).values(data.resources.map(res => ({
                        id: crypto.randomUUID(),
                        serviceId: id,
                        inventoryId: res.inventoryId,
                        quantity: res.quantity.toString(),
                        unit: res.unit,
                        useSecondaryUnit: res.useSecondaryUnit
                    })));
                }
            }
            // Busca os recursos atuais para retornar o objeto completo
            const resources = await db
                .select()
                .from(serviceResources)
                .where(eq(serviceResources.serviceId, id));
            console.log(`[DrizzleServiceRepository] <<< UPDATE CONCLUÍDO COM SUCESSO!`);
            return {
                ...updated,
                resources: resources
            };
        }
        catch (error) {
            console.error(`[DrizzleServiceRepository] !!! ERRO FATAL NO UPDATE:`, error);
            throw error;
        }
    }
    async delete(id) {
        const [deleted] = await db
            .delete(services)
            .where(eq(services.id, id))
            .returning();
        return !!deleted;
    }
    async checkServiceExists(id) {
        const [result] = await db
            .select({ id: services.id })
            .from(services)
            .where(eq(services.id, id))
            .limit(1);
        return !!result;
    }
}
