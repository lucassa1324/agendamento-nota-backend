import { createHash } from "node:crypto";
import { db } from "../../../../infrastructure/drizzle/database";
import { magicLinks } from "../../../../../db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";

export class MagicLinkExpiredError extends Error {
  constructor() {
    super("Link mágico expirado.");
    this.name = "MagicLinkExpiredError";
  }
}

export class MagicLinkAlreadyConsumedError extends Error {
  constructor() {
    super("Link mágico já foi utilizado.");
    this.name = "MagicLinkAlreadyConsumedError";
  }
}

export class MagicLinkNotFoundError extends Error {
  constructor() {
    super("Link mágico inválido ou não encontrado.");
    this.name = "MagicLinkNotFoundError";
  }
}

export class ValidateMagicLinkUseCase {
  async execute(rawToken: string) {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    const [record] = await db
      .select()
      .from(magicLinks)
      .where(eq(magicLinks.tokenHash, tokenHash))
      .limit(1);

    if (!record) {
      throw new MagicLinkNotFoundError();
    }

    if (record.consumedAt) {
      throw new MagicLinkAlreadyConsumedError();
    }

    if (new Date() > record.expiresAt) {
      throw new MagicLinkExpiredError();
    }

    if (record.singleUse) {
      await db
        .update(magicLinks)
        .set({ consumedAt: new Date() })
        .where(eq(magicLinks.id, record.id));
    }

    return record;
  }
}
