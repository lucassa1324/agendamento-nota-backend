import { user } from "../../../../db/schema";
import { db } from "../../../infrastructure/drizzle/database";
import { User } from "../../domain/models/user";
import { eq } from "drizzle-orm";

export class UserRepository {
  async create(data: User) {
    return await db.insert(user).values(data);
  }

  async find(id: string) {
    const [record] = await db
      .select()
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    return record ?? null;
  }

  async findByEmail(email: string) {
    const [record] = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    return record ?? null;
  }

  async findAll() {
    return await db.select().from(user);
  }

  async update(id: string, data: Partial<User>) {
    return await db.update(user).set(data).where(eq(user.id, id)).returning();
  }
}
