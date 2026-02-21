import { Elysia } from "elysia";
import { getFileStreamFromB2 } from "./b2.storage";

export const storageController = () => new Elysia({ prefix: "/storage" })
  .get("/*", async ({ params, set }) => {
    try {
      const path = params["*"];
      if (!path) {
        set.status = 400;
        return "File path missing";
      }

      const { stream, contentType, contentLength } = await getFileStreamFromB2(path);

      if (contentType) set.headers["Content-Type"] = contentType;
      if (contentLength) set.headers["Content-Length"] = contentLength.toString();
      
      // Cache agressivo para imagens (1 ano)
      set.headers["Cache-Control"] = "public, max-age=31536000, immutable";

      return stream;
    } catch (error: any) {
      console.error("[STORAGE_PROXY_ERROR]:", error);
      
      if (error.Code === "NoSuchKey" || error.name === "NoSuchKey") {
        set.status = 404;
        return "File not found";
      }

      set.status = 500;
      return "Internal Server Error";
    }
  });
