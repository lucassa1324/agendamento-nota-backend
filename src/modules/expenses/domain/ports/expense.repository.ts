export interface FixedExpense {
  id: string;
  companyId: string;
  description: string;
  value: string;
  category: "INFRAESTRUTURA" | "UTILIDADES" | "MARKETING" | "PRODUTOS_INSUMOS" | "PESSOAL" | "SISTEMAS_SOFTWARE" | "IMPOSTOS" | "GERAL";
  type: "FIXO" | "VARIAVEL" | "PARCELADO";
  totalInstallments?: number;
  currentInstallment?: number;
  parentId?: string | null;
  dueDate: Date;
  isPaid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExpenseInput {
  companyId: string;
  description: string;
  value: string;
  category: FixedExpense["category"];
  type?: FixedExpense["type"];
  totalInstallments?: number;
  currentInstallment?: number;
  parentId?: string | null;
  dueDate: Date;
  isPaid?: boolean;
}

export interface IExpenseRepository {
  create(data: CreateExpenseInput): Promise<FixedExpense>;
  findAllByCompanyId(companyId: string): Promise<FixedExpense[]>;
  findById(id: string): Promise<FixedExpense | null>;
  update(id: string, data: Partial<CreateExpenseInput>): Promise<FixedExpense>;
  delete(id: string): Promise<void>;
  sumTotalByCompanyId(companyId: string, startDate?: Date, endDate?: Date): Promise<number>;
}
