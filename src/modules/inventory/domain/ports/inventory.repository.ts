export interface Product {
  id: string;
  companyId: string;
  name: string;
  initialQuantity: string;
  currentQuantity: string;
  minQuantity: string;
  unitPrice: string;
  unit: string;
  secondaryUnit?: string | null;
  conversionFactor?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryRepository {
  create(product: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product>;
  findById(id: string): Promise<Product | null>;
  findByCompanyId(companyId: string): Promise<Product[]>;
  update(id: string, product: Partial<Omit<Product, "id" | "companyId" | "createdAt" | "updatedAt">>): Promise<Product>;
  delete(id: string): Promise<void>;
}
