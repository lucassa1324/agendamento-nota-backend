import { db } from "../../../../infrastructure/drizzle/database";
import { galleryImages } from "../../../../../db/schema";
import { GalleryImage } from "../../../domain/entities/gallery.entity";
import { GalleryRepository } from "../../../domain/ports/gallery.repository";
import { eq, and, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// Repository implementation for Gallery using Drizzle ORM
export class GalleryDrizzleRepository implements GalleryRepository {
  async save(image: Omit<GalleryImage, "id" | "createdAt" | "updatedAt">): Promise<GalleryImage> {
    const id = uuidv4();
    const [result] = await db
      .insert(galleryImages)
      .values({
        id,
        businessId: image.businessId,
        title: image.title,
        imageUrl: image.imageUrl,
        category: image.category,
        showInHome: image.showInHome,
        order: image.order.toString(),
      })
      .returning();

    return this.mapToEntity(result);
  }

  async findById(id: string): Promise<GalleryImage | null> {
    const [result] = await db
      .select()
      .from(galleryImages)
      .where(eq(galleryImages.id, id));

    return result ? this.mapToEntity(result) : null;
  }

  async findByBusinessId(
    businessId: string,
    filters?: { category?: string; showInHome?: boolean }
  ): Promise<GalleryImage[]> {
    const conditions = [eq(galleryImages.businessId, businessId)];

    if (filters?.category) {
      conditions.push(eq(galleryImages.category, filters.category));
    }

    if (filters?.showInHome !== undefined) {
      conditions.push(eq(galleryImages.showInHome, filters.showInHome));
    }

    const results = await db
      .select()
      .from(galleryImages)
      .where(and(...conditions))
      .orderBy(asc(galleryImages.order));

    return results.map(this.mapToEntity);
  }

  async delete(id: string): Promise<void> {
    await db.delete(galleryImages).where(eq(galleryImages.id, id));
  }

  async update(
    id: string,
    data: Partial<Omit<GalleryImage, "id" | "businessId" | "createdAt" | "updatedAt">>
  ): Promise<GalleryImage> {
    const updateData: any = { ...data };
    if (data.order !== undefined) {
      updateData.order = data.order.toString();
    }

    const [result] = await db
      .update(galleryImages)
      .set(updateData)
      .where(eq(galleryImages.id, id))
      .returning();

    return this.mapToEntity(result);
  }

  private mapToEntity(row: any): GalleryImage {
    return {
      id: row.id,
      businessId: row.businessId,
      title: row.title,
      imageUrl: row.imageUrl,
      category: row.category,
      showInHome: row.showInHome,
      order: row.order,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
