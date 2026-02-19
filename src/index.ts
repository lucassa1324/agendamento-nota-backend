import { Elysia } from "elysia";

const app = new Elysia()
  .get("/", () => "OK")
  .get("/health", () => ({ status: "ok" }));

export default app;
