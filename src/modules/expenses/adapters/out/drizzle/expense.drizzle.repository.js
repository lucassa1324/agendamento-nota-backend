import { db } from "../../../../infrastructure/drizzle/database";
import { fixedExpenses } from "../../../../../db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
export class DrizzleExpenseRepository {
    async create(data) {
        const [newExpense] = await db
            .insert(fixedExpenses)
            .values({
            id: crypto.randomUUID(),
            ...data,
        })
            .returning();
        return this.mapToEntity(newExpense);
    }
    async findAllByCompanyId(companyId) {
        const expenses = await db
            .select()
            .from(fixedExpenses)
            .where(eq(fixedExpenses.companyId, companyId));
        return expenses.map(this.mapToEntity);
    }
    async findById(id) {
        const [expense] = await db
            .select()
            .from(fixedExpenses)
            .where(eq(fixedExpenses.id, id))
            .limit(1);
        return expense ? this.mapToEntity(expense) : null;
    }
    async update(id, data) {
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
    async delete(id) {
        await db.delete(fixedExpenses).where(eq(fixedExpenses.id, id));
    }
    async sumTotalByCompanyId(companyId, startDate, endDate) {
        const filters = [eq(fixedExpenses.companyId, companyId)];
        if (startDate) {
            filters.push(gte(fixedExpenses.dueDate, startDate));
        }
        if (endDate) {
            filters.push(lte(fixedExpenses.dueDate, endDate));
        }
        const [result] = await db
            .select({
            total: sql `sum(${fixedExpenses.value})`,
        })
            .from(fixedExpenses)
            .where(and(...filters));
        return parseFloat(result?.total || "0");
    }
    mapToEntity(row) {
        return {
            ...row,
            category: row.category,
        };
    }
}
