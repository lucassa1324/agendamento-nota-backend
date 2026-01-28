import { db } from "../../../../infrastructure/drizzle/database";
import { services } from "../../../../../db/schema";
import { eq } from "drizzle-orm";
import { IServiceRepository } from "../../../domain/ports/service.repository";
import { Service, CreateServiceInput } from "../../../domain/entities/service.entity";

export class DrizzleServiceRepository implements IServiceRepository {
  async findById(id: string): Promise<Service | null> {
    const [result] = await db
      .select()
      .from(services)
      .where(eq(services.id, id))
      .limit(1);

    return (result as Service) || null;
  }

  async findAllByCompanyId(companyId: string): Promise<Service[]> {
    const results = await db
      .select()
      .from(services)
      .where(eq(services.companyId, companyId));

    return results as Service[];
  }

  async create(data: CreateServiceInput): Promise<Service> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const serviceId = data.id && isUUID(data.id) ? data.id : crypto.randomUUID();

    console.log(`[DrizzleServiceRepository] Executando Upsert para ID: ${serviceId}`);

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
          advancedRules: data.advancedRules,
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
            advancedRules: data.advancedRules,
            updatedAt: new Date(),
          },
        })
        .returning();

      return newService as Service;
    } catch (dbError: any) {
      console.error(`[DrizzleServiceRepository] Erro no banco:`, dbError);
      throw dbError;
    }
  }

  async update(id: string, data: Partial<CreateServiceInput>): Promise<Service | null> {
    const [updated] = await db
      .update(services)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(services.id, id))
      .returning();

    return (updated as Service) || null;
  }

  async delete(id: string): Promise<boolean> {
    const [deleted] = await db
      .delete(services)
      .where(eq(services.id, id))
      .returning();

    return !!deleted;
  }

  async checkServiceExists(id: string): Promise<boolean> {
    const [result] = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.id, id))
      .limit(1);
    return !!result;
  }
}
