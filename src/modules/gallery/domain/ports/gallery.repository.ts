import { GalleryImage } from "../entities/gallery.entity";

export interface GalleryRepository {
  save(image: Omit<GalleryImage, "id" | "createdAt" | "updatedAt">): Promise<GalleryImage>;
  findById(id: string): Promise<GalleryImage | null>;
  findByBusinessId(businessId: string, filters?: { category?: string; showInHome?: boolean }): Promise<GalleryImage[]>;
  delete(id: string): Promise<void>;
  update(id: string, data: Partial<Omit<GalleryImage, "id" | "businessId" | "createdAt" | "updatedAt">>): Promise<GalleryImage>;
}
