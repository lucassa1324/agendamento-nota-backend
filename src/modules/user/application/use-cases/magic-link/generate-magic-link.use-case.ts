import { createHash } from "node:crypto";
import { db } from "../../../../infrastructure/drizzle/database";
import { magicLinks } from "../../../../../db/schema";

export class GenerateMagicLinkUseCase {
  async execute(input: {
    userId: string;
    companyId?: string;
    expirationHours?: number;
    singleUse?: boolean;
  }) {
    const hours = input.expirationHours ?? 24;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + hours);

    const rawToken = crypto.randomUUID();
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    await db.insert(magicLinks).values({
      id: crypto.randomUUID(),
      tokenHash,
      userId: input.userId,
      companyId: input.companyId ?? null,
      consumedAt: null,
      expiresAt,
      expirationHours: hours,
      singleUse: input.singleUse ?? true,
    });

    return { rawToken, expiresAt, userId: input.userId, expirationHours: hours, singleUse: input.singleUse ?? true };
  }
}
