export interface GalleryImage {
  id: string;
  businessId: string;
  title: string | null;
  imageUrl: string;
  category: string | null;
  showInHome: boolean;
  order: string;
  createdAt: Date;
  updatedAt: Date;
}
