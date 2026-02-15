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

export interface InventoryLog {
  id: string;
  inventoryId: string;
  type: "ENTRY" | "EXIT";
  quantity: string;
  reason: string;
  companyId: string;
  createdAt: Date;
}

export interface InventoryRepository {
  create(product: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product>;
  findById(id: string): Promise<Product | null>;
  findByCompanyId(companyId: string): Promise<Product[]>;
  update(id: string, product: Partial<Omit<Product, "id" | "companyId" | "createdAt" | "updatedAt">>): Promise<Product>;
  delete(id: string): Promise<void>;

  // Transaction Logs
  createLog(log: Omit<InventoryLog, "id" | "createdAt">): Promise<InventoryLog>;
  getLogsByProduct(productId: string): Promise<InventoryLog[]>;
  getLogsByCompany(companyId: string): Promise<InventoryLog[]>;
}
