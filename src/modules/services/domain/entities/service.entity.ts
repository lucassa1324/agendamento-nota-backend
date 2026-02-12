export interface ServiceResource {
  id: string;
  serviceId: string;
  inventoryId: string;
  quantity: string;
  unit: string;
  useSecondaryUnit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Service {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  price: string;
  duration: string;
  icon?: string | null;
  isVisible: boolean;
  showOnHome: boolean;
  advancedRules?: any;
  resources?: ServiceResource[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateServiceInput {
  id?: string;
  companyId: string;
  name: string;
  description?: string | null;
  price: string;
  duration: string;
  icon?: string | null;
  isVisible?: boolean;
  showOnHome?: boolean;
  advancedRules?: any;
  resources?: Array<{
    inventoryId: string;
    quantity: number;
    unit: string;
    useSecondaryUnit: boolean;
  }>;
}
