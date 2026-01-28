export interface Service {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  price: string;
  duration: string;
  icon?: string | null;
  isVisible: boolean;
  advancedRules?: any;
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
  advancedRules?: any;
}
