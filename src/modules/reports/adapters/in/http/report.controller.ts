import { Elysia, t } from "elysia";
import { db } from "../../../../infrastructure/drizzle/database";
import { report } from "../../../../../db/schema";
import { eq } from "drizzle-orm";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import type { User } from "../../../../infrastructure/auth/auth-plugin";

export const reportController = new Elysia({ prefix: "/reports" })
  .use(authPlugin)
  .get("/", async ({ user, set }: { user: User | null; set: any }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const data = await db
      .select()
      .from(report)
      .where(eq(report.userId, user.id));

    return data;
  }, {
    auth: true
  })
  .post("/", async ({ user, body, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const newReport = await db.insert(report).values({
      id: crypto.randomUUID(),
      name: body.name,
      data: body.data,
      userId: user.id,
    }).returning();

    return newReport[0];
  }, {
    auth: true,
    body: t.Object({
      name: t.String(),
      data: t.String(),
    })
  });
