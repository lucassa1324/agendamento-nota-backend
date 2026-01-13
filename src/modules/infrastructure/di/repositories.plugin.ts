import { Elysia } from "elysia";
import { DrizzleBusinessRepository } from "../../business/adapters/out/drizzle/business.drizzle.repository";

export const repositoriesPlugin = new Elysia()
  .decorate("businessRepository", new DrizzleBusinessRepository());
