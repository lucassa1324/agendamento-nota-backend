import { db } from "../../../../infrastructure/drizzle/database";
import { fixedExpenses } from "../../../../../db/schema";
import { IExpenseRepository, FixedExpense, CreateExpenseInput } from "../../../domain/ports/expense.repository";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export class DrizzleExpenseRepository implements IExpenseRepository {
  async create(data: CreateExpenseInput): Promise<FixedExpense> {
    const [newExpense] = await db
      .insert(fixedExpenses)
      .values({
        id: crypto.randomUUID(),
        ...data,
      })
      .returning();
    
    return this.mapToEntity(newExpense);
  }

  async findAllByCompanyId(companyId: string): Promise<FixedExpense[]> {
    const expenses = await db
      .select()
      .from(fixedExpenses)
      .where(eq(fixedExpenses.companyId, companyId));
    
    return expenses.map(this.mapToEntity);
  }

  async findById(id: string): Promise<FixedExpense | null> {
    const [expense] = await db
      .select()
      .from(fixedExpenses)
      .where(eq(fixedExpenses.id, id))
      .limit(1);
    
    return expense ? this.mapToEntity(expense) : null;
  }

  async update(id: string, data: Partial<CreateExpenseInput>): Promise<FixedExpense> {
    const [updatedExpense] = await db
      .update(fixedExpenses)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(fixedExpenses.id, id))
      .returning();
    
    return this.mapToEntity(updatedExpense);
  }

  async delete(id: string): Promise<void> {
    await db.delete(fixedExpenses).where(eq(fixedExpenses.id, id));
  }

  async sumTotalByCompanyId(companyId: string, startDate?: Date, endDate?: Date): Promise<number> {
    const filters = [eq(fixedExpenses.companyId, companyId)];
    
    if (startDate) {
      filters.push(gte(fixedExpenses.dueDate, startDate));
    }
    
    if (endDate) {
      filters.push(lte(fixedExpenses.dueDate, endDate));
    }

    const [result] = await db
      .select({
        total: sql<string>`sum(${fixedExpenses.value})`,
      })
      .from(fixedExpenses)
      .where(and(...filters));
    
    return parseFloat(result?.total || "0");
  }

  private mapToEntity(row: any): FixedExpense {
    return {
      ...row,
      category: row.category as FixedExpense["category"],
    };
  }
}
