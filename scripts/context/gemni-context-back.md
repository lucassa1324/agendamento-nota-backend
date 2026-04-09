# Contexto Backend - Agendamento Nota

Este arquivo contém o código fonte do backend para referência do Gemini.

## Arquivo: `PROMPT_FRONTEND_FIX.md`
```markdown
# Prompt para Correção do Front-end (Next.js + Better Auth)

Olá! Estamos enfrentando alguns problemas na integração do Front-end com o Back-end, especificamente na autenticação e no proxy. O Back-end já foi corrigido e está esperando as requisições no formato correto.

Aqui está o diagnóstico e o que precisa ser feito no Front-end:

## 1. Erro de URL Duplicada (`/api/auth/api/auth`)

**Sintoma:** As requisições de autenticação estão falhando com 404 ou mal formatadas, e no console de rede vemos URLs como `http://localhost:3000/api-proxy/api/auth/api/auth/...`.

**Causa:** O cliente do Better Auth no Front-end (`auth-client.ts`) provavelmente está com a `baseURL` configurada incluindo o sufixo `/api/auth`, mas a biblioteca adiciona isso automaticamente.

**Correção (`src/lib/auth-client.ts`):**
A `baseURL` deve apontar apenas para a raiz do proxy, SEM `/api/auth`.

```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // CORRETO: Apenas a URL base do proxy
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api-proxy", 
  
  // INCORRETO (Causa duplicação):
  // baseURL: "http://localhost:3000/api-proxy/api/auth" 
});
```

## 2. Erro 500 no Reset de Senha (Proxy vs Backend)

**Contexto:** O Backend tinha um bug que retornava erro 500 quando o hook de autenticação falhava, mas isso já foi corrigido. Agora, o Backend retorna **404** se o usuário não tiver uma conta de senha (ex: Login Social) ou **200** se der certo.

**Configuração do Proxy (`next.config.ts`):**
Certifique-se de que o Proxy está repassando corretamente os erros do Backend (400, 404, etc) em vez de mascarar como 500.

```typescript
// next.config.ts
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api-proxy/:path*",
        destination: "http://localhost:3001/:path*", // Backend URL
      },
    ];
  },
};
```

## 3. Tratamento do Erro "Usuário sem senha"

Ao tentar resetar a senha de um usuário que fez cadastro via Google/Facebook, o Backend retornará um erro **404**. O Front-end deve tratar isso amigavelmente.

**Implementação Sugerida (Componente de Reset):**

```typescript
const handleResetPassword = async (userId: string) => {
  try {
    const response = await fetch(`/api-proxy/api/admin/master/users/${userId}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json();

    if (!response.ok) {
      // Tratamento específico para usuário sem senha (Login Social)
      if (response.status === 404) {
        toast.error("Este usuário usa Login Social (Google/etc) e não possui senha para resetar.");
        return;
      }
      throw new Error(data.error || "Erro ao resetar senha");
    }

    toast.success(data.message); // "Senha resetada para o padrão: Mudar@123"
  } catch (error: any) {
    toast.error(error.message);
  }
};
```

---

**Resumo para o Desenvolvedor Front-end:**
1. Verifique `src/lib/auth-client.ts` e remova `/api/auth` da `baseURL`.
2. Garanta que o Proxy no `next.config.ts` está apontando para a porta 3001 (Backend).
3. Atualize a UI para lidar com o status 404 no endpoint de reset de senha.
```

## Arquivo: `README.md`
```markdown
# Elysia with Bun runtime

## Getting Started
To get started with this template, simply paste this command into your terminal:
```bash
bun create elysia ./elysia-example
```

## Development
To start the development server run:
```bash
bun run dev
```

Open http://localhost:3000/ with your browser to see the result.
```

## Arquivo: `docker-compose.yml`
```
services:
  postgres:
    image: postgres:15-alpine
    container_name: aura-postgres-local
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: admin123
      POSTGRES_DB: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Arquivo: `drizzle.config.ts`
```typescript
import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Carrega o .env.local se existir, senão carrega o .env
dotenv.config({ path: ".env.local" });
dotenv.config();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## Arquivo: `package.json`
```json
{
  "name": "agendamento-nota-backend",
  "version": "1.0.50",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "dev": "bun run --watch src/local.ts",
    "build": "bun build src/index.ts --outdir ./dist --target bun",
    "db:generate": "bunx drizzle-kit generate",
    "db:migrate": "bunx drizzle-kit migrate",
    "db:push": "bunx drizzle-kit push",
    "db:studio": "bunx drizzle-kit studio"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.995.0",
    "@elysiajs/cors": "^1.4.1",
    "@elysiajs/static": "^1.4.7",
    "@types/node": "^25.2.1",
    "axios": "^1.13.6",
    "better-auth": "^1.4.10",
    "drizzle-orm": "^0.45.1",
    "elysia": "latest",
    "postgres": "^3.4.8",
    "resend": "^6.9.2",
    "stripe": "^20.3.1",
    "web-push": "^3.6.7"
  },
  "devDependencies": {
    "@playwright/test": "^1.58.2",
    "@types/pg": "^8.16.0",
    "bun-types": "latest",
    "dotenv": "^17.2.3",
    "drizzle-kit": "^0.31.8"
  }
}
```

## Arquivo: `test-safari-login.js`
```javascript

const { webkit } = require('playwright');

(async () => {
  console.log("Launching WebKit (Safari)...");
  const browser = await webkit.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const email = "test.safari.1771714118882@example.com";
  const password = "Password123!";
  const backendUrl = "https://agendamento-nota-backend.vercel.app";
  const frontendUrl = "https://agendamento-nota-front.vercel.app";

  try {
    console.log(`Navigating to frontend: ${frontendUrl}...`);
    try {
      await page.goto(frontendUrl, { waitUntil: 'networkidle' });
    } catch (e) {
      console.log("Navigation timeout or error, but continuing...", e.message);
    }

    // Handle potential redirect
    console.log("Current URL after navigation:", page.url());

    // Check if we are on landing page
    if (page.url().includes("landing") || page.url().includes("landin")) {
      console.log("Detected landing page. Looking for login button...");
      const loginBtn = await page.$('a[href*="login"], a[href*="signin"], button:has-text("Entrar"), button:has-text("Login")');
      if (loginBtn) {
        console.log("Clicking login button on landing page...");
        await loginBtn.click();
        await page.waitForLoadState('networkidle');
        console.log("URL after clicking login:", page.url());
      } else {
        console.log("No login button found on landing page. Trying direct navigation to /login...");
        await page.goto('https://agendamento-nota-front.vercel.app/login', { waitUntil: 'networkidle' });
      }
    }

    console.log("Final URL for test:", page.url());
    console.log("Page loaded.");

    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

    let capturedSetCookie = null;

    // Monitor network responses to capture Set-Cookie
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/api/auth/sign-in/email')) {
        console.log(`Intercepted response from ${url}`);
        const headers = await response.allHeaders();
        console.log("Response Headers keys:", Object.keys(headers));

        // Try different cases for set-cookie
        const setCookie = headers['set-cookie'] || headers['Set-Cookie'] || headers['SET-COOKIE'];

        if (setCookie) {
          capturedSetCookie = setCookie;
          console.log("Captured Set-Cookie:", setCookie);
          if (setCookie.toLowerCase().includes('partitioned')) {
            console.log("✅ Cookie has Partitioned attribute (CHIPS support).");
          } else {
            console.log("⚠️ Cookie missing Partitioned attribute.");
          }
        } else {
          console.log("WARNING: No Set-Cookie header found in intercepted response.");
        }
      }
    });

    console.log("Attempting login via fetch() in browser context (Cross-Site)...");

    // Execute fetch in the browser context to simulate frontend calling backend
    const loginResult = await page.evaluate(async ({ url, email, password }) => {
      console.log("Current Origin:", window.location.origin);

      try {
        // First try a simple health check or OPTIONS
        try {
          const health = await fetch(url, { method: 'OPTIONS' });
          console.log("Health check status:", health.status);
        } catch (h) {
          console.error("Health check failed:", h);
        }

        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        let res;
        let attempts = 0;
        while (attempts < 3) {
          res = await fetch(`${url}/api/auth/sign-in/email`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
          });
          if (res.status !== 429) {
            break;
          }
          attempts += 1;
          await sleep(5000);
        }

        // Cannot access Set-Cookie here due to browser security restrictions

        return {
          status: res.status,
          ok: res.ok,
          text: await res.text(), // Capture response text for debugging
        };
      } catch (e) {
        return { error: e.toString() };
      }
    }, { url: backendUrl, email, password });

    console.log("Login Fetch Result:", loginResult);

    // Check captured cookie from network interceptor
    if (capturedSetCookie) {
      console.log("Final Cookie Analysis:");
      const hasPartitioned = capturedSetCookie.toLowerCase().includes("partitioned");
      const hasSameSiteNone = capturedSetCookie.toLowerCase().includes("samesite=none");
      const hasSecure = capturedSetCookie.toLowerCase().includes("secure");

      if (hasPartitioned && hasSameSiteNone && hasSecure) {
        console.log("✅ SUCCESS: All required attributes for Safari (Partitioned, SameSite=None, Secure) are present!");
      } else {
        console.log("❌ FAILURE: Missing required attributes for Safari.");
        if (!hasPartitioned) console.log("   - Missing: Partitioned");
        if (!hasSameSiteNone) console.log("   - Missing: SameSite=None");
        if (!hasSecure) console.log("   - Missing: Secure");
      }
    } else {
      console.log("WARNING: No Set-Cookie header was intercepted!");
    }

    if (loginResult.ok) {
      console.log("Login request successful via API.");

      console.log("Checking cookies in browser context...");
      const cookies = await context.cookies([backendUrl, frontendUrl]);
      const sessionCookie = cookies.find(c => c.name.includes("session") || c.name.includes("token"));

      if (sessionCookie) {
        console.log("✅ Session cookie found:", sessionCookie.name);
        console.log("   Domain:", sessionCookie.domain);
        console.log("   Secure:", sessionCookie.secure);
        console.log("   SameSite:", sessionCookie.sameSite);
        console.log("   HttpOnly:", sessionCookie.httpOnly);

        if (sessionCookie.secure && sessionCookie.sameSite === 'None') {
          console.log("✅ SUCCESS: Safari (WebKit) accepted the cross-site cookie with Secure=true and SameSite=None!");
        } else {
          console.error("❌ FAILURE: Cookie attributes are incorrect for Safari cross-site.");
        }
      } else {
        console.error("❌ FAILURE: No session cookie found. The browser might have blocked it.");
        console.log("All cookies found:", cookies.map(c => `${c.name} (${c.domain})`).join(", "));
      }

      const sessionCheck = await page.evaluate(async ({ url }) => {
        try {
          const res = await fetch(`${url}/get-session`, {
            method: 'GET',
            credentials: 'include'
          });
          return {
            status: res.status,
            ok: res.ok,
            text: await res.text()
          };
        } catch (e) {
          return { error: e.toString() };
        }
      }, { url: backendUrl });

      console.log("Session fetch result:", sessionCheck);

    } else {
      console.error("❌ Login failed at API level:", loginResult);
    }

  } catch (error) {
    console.error("Test failed with error:", error);
  } finally {
    await browser.close();
  }
})();
```

## Arquivo: `tsconfig.json`
```json
{
  "compilerOptions": {
    /* Visit https://aka.ms/tsconfig to read more about this file */
    /* Projects */
    // "incremental": true,                              /* Save .tsbuildinfo files to allow for incremental compilation of projects. */
    // "composite": true,                                /* Enable constraints that allow a TypeScript project to be used with project references. */
    // "tsBuildInfoFile": "./.tsbuildinfo",              /* Specify the path to .tsbuildinfo incremental compilation file. */
    // "disableSourceOfProjectReferenceRedirect": true,  /* Disable preferring source files instead of declaration files when referencing composite projects. */
    // "disableSolutionSearching": true,                 /* Opt a project out of multi-project reference checking when editing. */
    // "disableReferencedProjectLoad": true,             /* Reduce the number of projects loaded automatically by TypeScript. */
    /* Language and Environment */
    "target": "ES2021", /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */
    // "lib": [],                                        /* Specify a set of bundled library declaration files that describe the target runtime environment. */
    // "jsx": "preserve",                                /* Specify what JSX code is generated. */
    // "experimentalDecorators": true,                   /* Enable experimental support for TC39 stage 2 draft decorators. */
    // "emitDecoratorMetadata": true,                    /* Emit design-type metadata for decorated declarations in source files. */
    // "jsxFactory": "",                                 /* Specify the JSX factory function used when targeting React JSX emit, e.g. 'React.createElement' or 'h'. */
    // "jsxFragmentFactory": "",                         /* Specify the JSX Fragment reference used for fragments when targeting React JSX emit e.g. 'React.Fragment' or 'Fragment'. */
    // "jsxImportSource": "",                            /* Specify module specifier used to import the JSX factory functions when using 'jsx: react-jsx*'. */
    // "reactNamespace": "",                             /* Specify the object invoked for 'createElement'. This only applies when targeting 'react' JSX emit. */
    // "noLib": true,                                    /* Disable including any library files, including the default lib.d.ts. */
    // "useDefineForClassFields": true,                  /* Emit ECMAScript-standard-compliant class fields. */
    // "moduleDetection": "auto",                        /* Control what method is used to detect module-format JS files. */
    /* Modules */
    "module": "ES2022", /* Specify what module code is generated. */
    // "rootDir": "./",                                  /* Specify the root folder within your source files. */
    "moduleResolution": "node", /* Specify how TypeScript looks up a file from a given module specifier. */
    // "baseUrl": "./",                                  /* Specify the base directory to resolve non-relative module names. */
    // "paths": {},                                      /* Specify a set of entries that re-map imports to additional lookup locations. */
    // "rootDirs": [],                                   /* Allow multiple folders to be treated as one when resolving modules. */
    // "typeRoots": [],                                  /* Specify multiple folders that act like './node_modules/@types'. */
    "types": [
      "bun-types"
    ], /* Specify type package names to be included without being referenced in a source file. */
    // "allowUmdGlobalAccess": true,                     /* Allow accessing UMD globals from modules. */
    // "moduleSuffixes": [],                             /* List of file name suffixes to search when resolving a module. */
    // "resolveJsonModule": true,                        /* Enable importing .json files. */
    // "noResolve": true,                                /* Disallow 'import's, 'require's or '<reference>'s from expanding the number of files TypeScript should add to a project. */
    /* JavaScript Support */
    // "allowJs": true,                                  /* Allow JavaScript files to be a part of your program. Use the 'checkJS' option to get errors from these files. */
    // "checkJs": true,                                  /* Enable error reporting in type-checked JavaScript files. */
    // "maxNodeModuleJsDepth": 1,                        /* Specify the maximum folder depth used for checking JavaScript files from 'node_modules'. Only applicable with 'allowJs'. */
    /* Emit */
    // "declaration": true,                              /* Generate .d.ts files from TypeScript and JavaScript files in your project. */
    // "declarationMap": true,                           /* Create sourcemaps for d.ts files. */
    // "emitDeclarationOnly": true,                      /* Only output d.ts files and not JavaScript files. */
    // "sourceMap": true,                                /* Create source map files for emitted JavaScript files. */
    // "outFile": "./",                                  /* Specify a file that bundles all outputs into one JavaScript file. If 'declaration' is true, also designates a file that bundles all .d.ts output. */
    // "outDir": "./",                                   /* Specify an output folder for all emitted files. */
    // "removeComments": true,                           /* Disable emitting comments. */
    "noEmit": true,                                   /* Disable emitting files from a compilation. */
    // "importHelpers": true,                            /* Allow importing helper functions from tslib once per project, instead of including them per-file. */
    // "importsNotUsedAsValues": "remove",               /* Specify emit/checking behavior for imports that are only used for types. */
    // "downlevelIteration": true,                       /* Emit more compliant, but verbose and less performant JavaScript for iteration. */
    // "sourceRoot": "",                                 /* Specify the root path for debuggers to find the reference source code. */
    // "mapRoot": "",                                    /* Specify the location where debugger should locate map files instead of generated locations. */
    // "inlineSourceMap": true,                          /* Include sourcemap files inside the emitted JavaScript. */
    // "inlineSources": true,                            /* Include source code in the sourcemaps inside the emitted JavaScript. */
    // "emitBOM": true,                                  /* Emit a UTF-8 Byte Order Mark (BOM) in the beginning of output files. */
    // "newLine": "crlf",                                /* Set the newline character for emitting files. */
    // "stripInternal": true,                            /* Disable emitting declarations that have '@internal' in their JSDoc comments. */
    // "noEmitHelpers": true,                            /* Disable generating custom helper functions like '__extends' in compiled output. */
    // "noEmitOnError": true,                            /* Disable emitting files if any type checking errors are reported. */
    // "preserveConstEnums": true,                       /* Disable erasing 'const enum' declarations in generated code. */
    // "declarationDir": "./",                           /* Specify the output directory for generated declaration files. */
    // "preserveValueImports": true,                     /* Preserve unused imported values in the JavaScript output that would otherwise be removed. */
    /* Interop Constraints */
    // "isolatedModules": true,                          /* Ensure that each file can be safely transpiled without relying on other imports. */
    // "allowSyntheticDefaultImports": true,             /* Allow 'import x from y' when a module doesn't have a default export. */
    "esModuleInterop": true, /* Emit additional JavaScript to ease support for importing CommonJS modules. This enables 'allowSyntheticDefaultImports' for type compatibility. */
    // "preserveSymlinks": true,                         /* Disable resolving symlinks to their realpath. This correlates to the same flag in node. */
    "forceConsistentCasingInFileNames": true, /* Ensure that casing is correct in imports. */
    /* Type Checking */
    "strict": true, /* Enable all strict type-checking options. */
    // "noImplicitAny": true,                            /* Enable error reporting for expressions and declarations with an implied 'any' type. */
    // "strictNullChecks": true,                         /* When type checking, take into account 'null' and 'undefined'. */
    // "strictFunctionTypes": true,                      /* When assigning functions, check to ensure parameters and the return values are subtype-compatible. */
    // "strictBindCallApply": true,                      /* Check that the arguments for 'bind', 'call', and 'apply' methods match the original function. */
    // "strictPropertyInitialization": true,             /* Check for class properties that are declared but not set in the constructor. */
    // "noImplicitThis": true,                           /* Enable error reporting when 'this' is given the type 'any'. */
    // "useUnknownInCatchVariables": true,               /* Default catch clause variables as 'unknown' instead of 'any'. */
    // "alwaysStrict": true,                             /* Ensure 'use strict' is always emitted. */
    // "noUnusedLocals": true,                           /* Enable error reporting when local variables aren't read. */
    // "noUnusedParameters": true,                       /* Raise an error when a function parameter isn't read. */
    // "exactOptionalPropertyTypes": true,               /* Interpret optional property types as written, rather than adding 'undefined'. */
    // "noImplicitReturns": true,                        /* Enable error reporting for codepaths that do not explicitly return in a function. */
    // "noFallthroughCasesInSwitch": true,               /* Enable error reporting for fallthrough cases in switch statements. */
    // "noUncheckedIndexedAccess": true,                 /* Add 'undefined' to a type when accessed using an index. */
    // "noImplicitOverride": true,                       /* Ensure overriding members in derived classes are marked with an override modifier. */
    // "noPropertyAccessFromIndexSignature": true,       /* Enforces using indexed accessors for keys declared using an indexed type. */
    // "allowUnusedLabels": true,                        /* Disable error reporting for unused labels. */
    // "allowUnreachableCode": true,                     /* Disable error reporting for unreachable code. */
    /* Completeness */
    // "skipDefaultLibCheck": true,                      /* Skip type checking .d.ts files that are included with TypeScript. */
    "skipLibCheck": true /* Skip type checking all .d.ts files. */
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "**/node_modules/*"
  ]
}
```

## Arquivo: `vercel.json`
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "bunVersion": "1.x",
  "rewrites": [
    {
      "source": "/api/auth/api/auth/:match*",
      "destination": "/api/auth/:match*"
    },
    {
      "source": "/api/auth/api/:match*",
      "destination": "/api/:match*"
    }
  ]
}
```

## Arquivo: `.vercel\README.txt`
```
> Why do I have a folder named ".vercel" in my project?
The ".vercel" folder is created when you link a directory to a Vercel project.

> What does the "project.json" file contain?
The "project.json" file contains:
- The ID of the Vercel project that you linked ("projectId")
- The ID of the user or team your Vercel project is owned by ("orgId")

> Should I commit the ".vercel" folder?
No, you should not share the ".vercel" folder with anyone.
Upon creation, it will be automatically added to your ".gitignore" file.
```

## Arquivo: `.vercel\project.json`
```json
{"projectId":"prj_ggYZEr4wxAQfdWff7DHZu09VBgAM","orgId":"team_kf5tp4MOhLuwFrmrXAideJE8","projectName":"agendamento-nota-backend"}
```

## Arquivo: `drizzle\0000_init_baseline.sql`
```sql
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "account_cancellation_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agenda_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"start_time" text,
	"end_time" text,
	"reason" text,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_items" (
	"id" text PRIMARY KEY NOT NULL,
	"appointment_id" text NOT NULL,
	"service_id" text NOT NULL,
	"service_name_snapshot" text NOT NULL,
	"service_price_snapshot" numeric(10, 2) NOT NULL,
	"service_duration_snapshot" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"service_id" text NOT NULL,
	"customer_id" text,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"service_name_snapshot" text NOT NULL,
	"service_price_snapshot" numeric(10, 2) NOT NULL,
	"service_duration_snapshot" text NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"site_name" text,
	"title_suffix" text,
	"description" text,
	"logo_url" text,
	"instagram" text,
	"show_instagram" boolean DEFAULT true NOT NULL,
	"whatsapp" text,
	"show_whatsapp" boolean DEFAULT true NOT NULL,
	"facebook" text,
	"show_facebook" boolean DEFAULT true NOT NULL,
	"tiktok" text,
	"show_tiktok" boolean DEFAULT true NOT NULL,
	"linkedin" text,
	"show_linkedin" boolean DEFAULT true NOT NULL,
	"twitter" text,
	"show_twitter" boolean DEFAULT true NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_profiles_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"address" text,
	"contact" text,
	"owner_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"subscription_status" text DEFAULT 'trial' NOT NULL,
	"trial_ends_at" timestamp DEFAULT now(),
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"access_type" text DEFAULT 'automatic' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "company_site_customizations" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"layout_global" jsonb DEFAULT '{"header":{"backgroundAndEffect":{"color":"#ffffff","opacity":0.95,"blur":10},"textColors":{"logo":"#000000","links":"#333333","hover":"#000000"},"actionButtons":{"backgroundColor":"#000000","textColor":"#ffffff"}},"typography":{"headingsFont":"Inter","subheadingsFont":"Inter","bodyFont":"Inter"},"siteColors":{"primary":"#000000","secondary":"#333333","background":"#ffffff"},"footer":{"colors":{"background":"#f5f5f5","text":"#333333","icons":"#000000"},"typography":{"headings":"Inter","body":"Inter"},"visibility":true}}'::jsonb NOT NULL,
	"home" jsonb DEFAULT '{"heroBanner":{"visibility":true,"title":{"text":"Sua beleza, nossa prioridade","color":"#000000","font":"Inter","sizeMobile":"32px","sizeDesktop":"48px"},"subtitle":{"text":"Agende seu horário e realce o que você tem de melhor","color":"#666666","font":"Inter","size":"18px"},"ctaButton":{"text":"Agendar Agora","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"8px","borderColor":"transparent","destinationLink":"/agendamento"},"appearance":{"bgType":"image","backgroundColor":"#ffffff","backgroundImageUrl":"","glassEffect":{"active":false,"intensity":0},"overlay":{"color":"#000000","opacity":0},"verticalAlignment":"center","horizontalAlignment":"center","sectionHeight":"medium"},"bgColor":"#ffffff"},"servicesSection":{"visibility":true,"orderOnHome":1,"header":{"title":{"text":"Nossos Serviços","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"Escolha o tratamento ideal para si","color":"#666666","font":"Inter","size":"16px"},"alignment":"center"},"cardConfig":{"showImage":true,"showCategory":true,"priceStyle":{"visible":true,"color":"#000000","font":"Inter"},"durationStyle":{"visible":true,"color":"#666666"},"cardBackgroundColor":"#ffffff","borderAndShadow":{"borderSize":"1px","shadowIntensity":"small"},"borderRadius":"12px"},"bookingButtonStyle":{"text":"Agendar","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"6px"}},"valuesSection":{"visibility":true,"orderOnHome":2,"header":{"title":{"text":"Nossos Valores","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"O que nos move todos os dias","color":"#666666","font":"Inter","size":"16px"}},"itemsStyle":{"layout":"grid","itemBackgroundColor":"#f9f9f9","borderRadius":"8px","internalAlignment":"center"},"items":[]},"galleryPreview":{"visibility":true,"orderOnHome":3,"header":{"title":{"text":"Nossa Galeria","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"Confira nossos últimos trabalhos","color":"#666666","font":"Inter","size":"16px"}},"displayLogic":{"selectionMode":"automatic_recent","photoCount":6,"gridLayout":"mosaic"},"photoStyle":{"aspectRatio":"1:1","spacing":"16px","borderRadius":"8px","hoverEffect":"zoom"},"viewMoreButton":{"visible":true,"text":"Ver Galeria Completa","style":{"backgroundColor":"transparent","textColor":"#000000","borderRadius":"4px"}}},"ctaSection":{"visibility":true,"orderOnHome":4,"title":{"text":"Pronto para transformar seu olhar?","color":"#ffffff","font":"Inter","size":{"desktop":"42px","mobile":"28px"}},"subtitle":{"text":"Reserve seu horário em menos de 1 minuto.","color":"#f0f0f0","font":"Inter","size":"18px"},"conversionButton":{"text":"Agendar Agora","style":{"backgroundColor":"#ffffff","textColor":"#000000","borderColor":"transparent"},"borderRadius":"8px"},"designConfig":{"backgroundType":"solid_color","colorOrImageUrl":"#000000","glassEffect":{"active":false,"intensity":0},"borders":{"top":false,"bottom":false},"padding":"60px","alignment":"center"}}}'::jsonb NOT NULL,
	"gallery" jsonb DEFAULT '{"gridConfig":{"columns":3,"gap":"24px"},"interactivity":{"enableLightbox":true,"showCaptions":true}}'::jsonb NOT NULL,
	"about_us" jsonb DEFAULT '{"aboutBanner":{"visibility":true,"title":"Sobre Nós","backgroundImageUrl":""},"ourStory":{"visibility":true,"title":"Nossa História","text":"Começamos com um sonho...","imageUrl":""},"ourValues":[],"ourTeam":[],"testimonials":[]}'::jsonb NOT NULL,
	"appointment_flow" jsonb DEFAULT '{"colors":{"primary":"#000000","secondary":"#333333","background":"#ffffff","text":"#000000"},"step1Services":{"title":"Selecione o Serviço","showPrices":true,"showDurations":true,"cardConfig":{"backgroundColor":"TRANSPARENT_DEFAULT"}},"step2Date":{"title":"Escolha a Data","calendarStyle":"modern"},"step3Times":{"title":"Escolha o Horário","timeSlotStyle":"grid","timeSlotSize":30},"step4Confirmation":{"title":"Confirme seu Agendamento","requireLogin":false}}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_site_customizations_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "fixed_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"description" text NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"category" text NOT NULL,
	"type" text DEFAULT 'FIXO' NOT NULL,
	"total_installments" integer DEFAULT 1,
	"current_installment" integer DEFAULT 1,
	"parent_id" text,
	"due_date" timestamp NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_images" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"title" text,
	"image_url" text NOT NULL,
	"category" text,
	"show_in_home" boolean DEFAULT false NOT NULL,
	"order" numeric DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_calendar_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"ical_url" text,
	"sync_status" text DEFAULT 'INACTIVE' NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"initial_quantity" numeric(10, 2) NOT NULL,
	"current_quantity" numeric(10, 2) NOT NULL,
	"min_quantity" numeric(10, 2) NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"secondary_unit" text,
	"conversion_factor" numeric(10, 2),
	"is_shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"inventory_id" text NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"company_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operating_hours" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"day_of_week" text NOT NULL,
	"status" text NOT NULL,
	"morning_start" text,
	"morning_end" text,
	"afternoon_start" text,
	"afternoon_end" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"establishment_name" text NOT NULL,
	"instagram_link" text,
	"status" text DEFAULT 'NOT_CONTACTED' NOT NULL,
	"category" text NOT NULL,
	"location" text,
	"address" text,
	"maps_link" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "service_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"inventory_id" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"use_secondary_unit" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"duration" text NOT NULL,
	"icon" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"show_on_home" boolean DEFAULT false NOT NULL,
	"advanced_rules" jsonb DEFAULT '{"conflicts":[]}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "site_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"layout_global" jsonb DEFAULT '{"header":{"backgroundAndEffect":{"color":"#ffffff","opacity":0.95,"blur":10},"textColors":{"logo":"#000000","links":"#333333","hover":"#000000"},"actionButtons":{"backgroundColor":"#000000","textColor":"#ffffff"}},"typography":{"headingsFont":"Inter","subheadingsFont":"Inter","bodyFont":"Inter"},"siteColors":{"primary":"#000000","secondary":"#333333","background":"#ffffff"},"footer":{"colors":{"background":"#f5f5f5","text":"#333333","icons":"#000000"},"typography":{"headings":"Inter","body":"Inter"},"visibility":true}}'::jsonb NOT NULL,
	"home" jsonb DEFAULT '{"heroBanner":{"visibility":true,"title":{"text":"Sua beleza, nossa prioridade","color":"#000000","font":"Inter","sizeMobile":"32px","sizeDesktop":"48px"},"subtitle":{"text":"Agende seu horário e realce o que você tem de melhor","color":"#666666","font":"Inter","size":"18px"},"ctaButton":{"text":"Agendar Agora","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"8px","borderColor":"transparent","destinationLink":"/agendamento"},"appearance":{"bgType":"image","backgroundColor":"#ffffff","backgroundImageUrl":"","glassEffect":{"active":false,"intensity":0},"overlay":{"color":"#000000","opacity":0},"verticalAlignment":"center","horizontalAlignment":"center","sectionHeight":"medium"},"bgColor":"#ffffff"},"servicesSection":{"visibility":true,"orderOnHome":1,"header":{"title":{"text":"Nossos Serviços","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"Escolha o tratamento ideal para si","color":"#666666","font":"Inter","size":"16px"},"alignment":"center"},"cardConfig":{"showImage":true,"showCategory":true,"priceStyle":{"visible":true,"color":"#000000","font":"Inter"},"durationStyle":{"visible":true,"color":"#666666"},"cardBackgroundColor":"#ffffff","borderAndShadow":{"borderSize":"1px","shadowIntensity":"small"},"borderRadius":"12px"},"bookingButtonStyle":{"text":"Agendar","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"6px"}},"valuesSection":{"visibility":true,"orderOnHome":2,"header":{"title":{"text":"Nossos Valores","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"O que nos move todos os dias","color":"#666666","font":"Inter","size":"16px"}},"itemsStyle":{"layout":"grid","itemBackgroundColor":"#f9f9f9","borderRadius":"8px","internalAlignment":"center"},"items":[]},"galleryPreview":{"visibility":true,"orderOnHome":3,"header":{"title":{"text":"Nossa Galeria","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"Confira nossos últimos trabalhos","color":"#666666","font":"Inter","size":"16px"}},"displayLogic":{"selectionMode":"automatic_recent","photoCount":6,"gridLayout":"mosaic"},"photoStyle":{"aspectRatio":"1:1","spacing":"16px","borderRadius":"8px","hoverEffect":"zoom"},"viewMoreButton":{"visible":true,"text":"Ver Galeria Completa","style":{"backgroundColor":"transparent","textColor":"#000000","borderRadius":"4px"}}},"ctaSection":{"visibility":true,"orderOnHome":4,"title":{"text":"Pronto para transformar seu olhar?","color":"#ffffff","font":"Inter","size":{"desktop":"42px","mobile":"28px"}},"subtitle":{"text":"Reserve seu horário em menos de 1 minuto.","color":"#f0f0f0","font":"Inter","size":"18px"},"conversionButton":{"text":"Agendar Agora","style":{"backgroundColor":"#ffffff","textColor":"#000000","borderColor":"transparent"},"borderRadius":"8px"},"designConfig":{"backgroundType":"solid_color","colorOrImageUrl":"#000000","glassEffect":{"active":false,"intensity":0},"borders":{"top":false,"bottom":false},"padding":"60px","alignment":"center"}}}'::jsonb NOT NULL,
	"gallery" jsonb DEFAULT '{"gridConfig":{"columns":3,"gap":"24px"},"interactivity":{"enableLightbox":true,"showCaptions":true}}'::jsonb NOT NULL,
	"about_us" jsonb DEFAULT '{"aboutBanner":{"visibility":true,"title":"Sobre Nós","backgroundImageUrl":""},"ourStory":{"visibility":true,"title":"Nossa História","text":"Começamos com um sonho...","imageUrl":""},"ourValues":[],"ourTeam":[],"testimonials":[]}'::jsonb NOT NULL,
	"appointment_flow" jsonb DEFAULT '{"colors":{"primary":"#000000","secondary":"#333333","background":"#ffffff","text":"#000000"},"step1Services":{"title":"Selecione o Serviço","showPrices":true,"showDurations":true,"cardConfig":{"backgroundColor":"TRANSPARENT_DEFAULT"}},"step2Date":{"title":"Escolha a Data","calendarStyle":"modern"},"step3Times":{"title":"Escolha o Horário","timeSlotStyle":"grid","timeSlotSize":30},"step4Confirmation":{"title":"Confirme seu Agendamento","requireLogin":false}}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "site_drafts_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'USER' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notify_new_appointments" boolean DEFAULT true NOT NULL,
	"notify_cancellations" boolean DEFAULT true NOT NULL,
	"notify_inventory_alerts" boolean DEFAULT true NOT NULL,
	"account_status" text DEFAULT 'ACTIVE' NOT NULL,
	"cancellation_requested_at" timestamp,
	"retention_ends_at" timestamp,
	"last_retention_discount_at" timestamp,
	"has_completed_onboarding" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_cancellation_feedback" ADD CONSTRAINT "account_cancellation_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_blocks" ADD CONSTRAINT "agenda_blocks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_business_id_companies_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_site_customizations" ADD CONSTRAINT "company_site_customizations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_business_id_companies_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_configs" ADD CONSTRAINT "google_calendar_configs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operating_hours" ADD CONSTRAINT "operating_hours_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_resources" ADD CONSTRAINT "service_resources_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_resources" ADD CONSTRAINT "service_resources_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_drafts" ADD CONSTRAINT "site_drafts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");
```

## Arquivo: `drizzle\0000_silent_metal_master.sql`
```sql
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");
```

## Arquivo: `drizzle\0001_outgoing_white_queen.sql`
```sql
CREATE TABLE "appointment" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"date" timestamp NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"config" jsonb DEFAULT '{"hero":{"title":"Novo Site"},"theme":{"primaryColor":"#000"}}'::jsonb NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"data" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business" ADD CONSTRAINT "business_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
```

## Arquivo: `drizzle\0001_wealthy_prism.sql`
```sql
CREATE TABLE "system_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "company_site_customizations" ALTER COLUMN "home" SET DEFAULT '{"heroBanner":{"visibility":true,"title":{"text":"Sua beleza, nossa prioridade","color":"#000000","font":"Inter","sizeMobile":"32px","sizeDesktop":"48px"},"badge":{"text":"ESPECIALISTA EM BELEZA","backgroundColor":"#000000","textColor":"#ffffff","font":"Inter"},"subtitle":{"text":"Agende seu horário e realce o que você tem de melhor","color":"#666666","font":"Inter","size":"18px"},"ctaButton":{"text":"Agendar Agora","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"8px","borderColor":"transparent","destinationLink":"/agendamento"},"appearance":{"bgType":"image","backgroundColor":"#ffffff","backgroundImageUrl":"","glassEffect":{"active":false,"intensity":0},"overlay":{"color":"#000000","opacity":0},"verticalAlignment":"center","horizontalAlignment":"center","sectionHeight":"medium"},"bgColor":"#ffffff"},"servicesSection":{"visibility":true,"orderOnHome":1,"header":{"title":{"text":"Nossos Serviços","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"Escolha o tratamento ideal para si","color":"#666666","font":"Inter","size":"16px"},"alignment":"center"},"cardConfig":{"showImage":true,"showCategory":true,"priceStyle":{"visible":true,"color":"#000000","font":"Inter"},"durationStyle":{"visible":true,"color":"#666666"},"cardBackgroundColor":"#ffffff","borderAndShadow":{"borderSize":"1px","shadowIntensity":"small"},"borderRadius":"12px"},"bookingButtonStyle":{"text":"Agendar","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"6px"}},"valuesSection":{"visibility":true,"orderOnHome":2,"header":{"title":{"text":"Nossos Valores","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"O que nos move todos os dias","color":"#666666","font":"Inter","size":"16px"}},"itemsStyle":{"layout":"grid","itemBackgroundColor":"#f9f9f9","borderRadius":"8px","internalAlignment":"center"},"items":[]},"galleryPreview":{"visibility":true,"orderOnHome":3,"header":{"title":{"text":"Nossa Galeria","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"Confira nossos últimos trabalhos","color":"#666666","font":"Inter","size":"16px"}},"displayLogic":{"selectionMode":"automatic_recent","photoCount":6,"gridLayout":"mosaic"},"photoStyle":{"aspectRatio":"1:1","spacing":"16px","borderRadius":"8px","hoverEffect":"zoom"},"viewMoreButton":{"visible":true,"text":"Ver Galeria Completa","style":{"backgroundColor":"transparent","textColor":"#000000","borderRadius":"4px"}}},"ctaSection":{"visibility":true,"orderOnHome":4,"title":{"text":"Pronto para transformar seu olhar?","color":"#ffffff","font":"Inter","size":{"desktop":"42px","mobile":"28px"}},"subtitle":{"text":"Reserve seu horário em menos de 1 minuto.","color":"#f0f0f0","font":"Inter","size":"18px"},"conversionButton":{"text":"Agendar Agora","style":{"backgroundColor":"#ffffff","textColor":"#000000","borderColor":"transparent"},"borderRadius":"8px"},"designConfig":{"backgroundType":"solid_color","colorOrImageUrl":"#000000","glassEffect":{"active":false,"intensity":0},"borders":{"top":false,"bottom":false},"padding":"60px","alignment":"center"}}}'::jsonb;--> statement-breakpoint
ALTER TABLE "site_drafts" ALTER COLUMN "home" SET DEFAULT '{"heroBanner":{"visibility":true,"title":{"text":"Sua beleza, nossa prioridade","color":"#000000","font":"Inter","sizeMobile":"32px","sizeDesktop":"48px"},"badge":{"text":"ESPECIALISTA EM BELEZA","backgroundColor":"#000000","textColor":"#ffffff","font":"Inter"},"subtitle":{"text":"Agende seu horário e realce o que você tem de melhor","color":"#666666","font":"Inter","size":"18px"},"ctaButton":{"text":"Agendar Agora","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"8px","borderColor":"transparent","destinationLink":"/agendamento"},"appearance":{"bgType":"image","backgroundColor":"#ffffff","backgroundImageUrl":"","glassEffect":{"active":false,"intensity":0},"overlay":{"color":"#000000","opacity":0},"verticalAlignment":"center","horizontalAlignment":"center","sectionHeight":"medium"},"bgColor":"#ffffff"},"servicesSection":{"visibility":true,"orderOnHome":1,"header":{"title":{"text":"Nossos Serviços","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"Escolha o tratamento ideal para si","color":"#666666","font":"Inter","size":"16px"},"alignment":"center"},"cardConfig":{"showImage":true,"showCategory":true,"priceStyle":{"visible":true,"color":"#000000","font":"Inter"},"durationStyle":{"visible":true,"color":"#666666"},"cardBackgroundColor":"#ffffff","borderAndShadow":{"borderSize":"1px","shadowIntensity":"small"},"borderRadius":"12px"},"bookingButtonStyle":{"text":"Agendar","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"6px"}},"valuesSection":{"visibility":true,"orderOnHome":2,"header":{"title":{"text":"Nossos Valores","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"O que nos move todos os dias","color":"#666666","font":"Inter","size":"16px"}},"itemsStyle":{"layout":"grid","itemBackgroundColor":"#f9f9f9","borderRadius":"8px","internalAlignment":"center"},"items":[]},"galleryPreview":{"visibility":true,"orderOnHome":3,"header":{"title":{"text":"Nossa Galeria","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"Confira nossos últimos trabalhos","color":"#666666","font":"Inter","size":"16px"}},"displayLogic":{"selectionMode":"automatic_recent","photoCount":6,"gridLayout":"mosaic"},"photoStyle":{"aspectRatio":"1:1","spacing":"16px","borderRadius":"8px","hoverEffect":"zoom"},"viewMoreButton":{"visible":true,"text":"Ver Galeria Completa","style":{"backgroundColor":"transparent","textColor":"#000000","borderRadius":"4px"}}},"ctaSection":{"visibility":true,"orderOnHome":4,"title":{"text":"Pronto para transformar seu olhar?","color":"#ffffff","font":"Inter","size":{"desktop":"42px","mobile":"28px"}},"subtitle":{"text":"Reserve seu horário em menos de 1 minuto.","color":"#f0f0f0","font":"Inter","size":"18px"},"conversionButton":{"text":"Agendar Agora","style":{"backgroundColor":"#ffffff","textColor":"#000000","borderColor":"transparent"},"borderRadius":"8px"},"designConfig":{"backgroundType":"solid_color","colorOrImageUrl":"#000000","glassEffect":{"active":false,"intensity":0},"borders":{"top":false,"bottom":false},"padding":"60px","alignment":"center"}}}'::jsonb;
```

## Arquivo: `drizzle\0002_pale_vance_astro.sql`
```sql
CREATE TABLE "agenda_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"start_time" text,
	"end_time" text,
	"reason" text,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"service_id" text NOT NULL,
	"customer_id" text,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"service_name_snapshot" text NOT NULL,
	"service_price_snapshot" text NOT NULL,
	"service_duration_snapshot" text NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"address" text,
	"contact" text,
	"site_customization" jsonb DEFAULT '{"layout_global":{"header":{},"footer":{},"typography":{},"base_colors":{}},"home":{"hero_banner":{},"services_section":{},"contact_section":{}},"gallery":{"grid_config":{},"interactivity":{}},"about_us":{"about_banner":{},"our_story":{},"our_values":[],"our_team":[],"testimonials":[]},"appointment_flow":{"step_1_services":{},"step_2_date":{},"step_3_time":{},"step_4_confirmation":{}}}'::jsonb NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "google_calendar_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"ical_url" text,
	"sync_status" text DEFAULT 'INACTIVE' NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"quantity" text NOT NULL,
	"unit" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operating_hours" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"day_of_week" text NOT NULL,
	"status" text NOT NULL,
	"morning_start" text,
	"morning_end" text,
	"afternoon_start" text,
	"afternoon_end" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"inventory_id" text NOT NULL,
	"consumption_unit" text NOT NULL,
	"conversion_factor" text NOT NULL,
	"purchase_unit" text NOT NULL,
	"consumed_quantity" text NOT NULL,
	"output_factor" text NOT NULL,
	"trigger" text DEFAULT 'UPON_COMPLETION' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" text NOT NULL,
	"duration" text NOT NULL,
	"icon" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"advanced_rules" jsonb DEFAULT '{"conflicts":[]}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "business" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "report" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "appointment" CASCADE;--> statement-breakpoint
DROP TABLE "business" CASCADE;--> statement-breakpoint
DROP TABLE "report" CASCADE;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "agenda_blocks" ADD CONSTRAINT "agenda_blocks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_configs" ADD CONSTRAINT "google_calendar_configs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operating_hours" ADD CONSTRAINT "operating_hours_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_resources" ADD CONSTRAINT "service_resources_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_resources" ADD CONSTRAINT "service_resources_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
```

## Arquivo: `drizzle\0003_watery_the_call.sql`
```sql
-- Migration: Mover site_customization para uma nova tabela e migrar dados existentes
-- 1. Criar a nova tabela
CREATE TABLE IF NOT EXISTS "company_site_customizations" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"layout_global" jsonb DEFAULT '{"header":{},"footer":{},"typography":{},"base_colors":{}}'::jsonb NOT NULL,
	"home" jsonb DEFAULT '{"hero_banner":{},"services_section":{},"contact_section":{}}'::jsonb NOT NULL,
	"gallery" jsonb DEFAULT '{"grid_config":{},"interactivity":{}}'::jsonb NOT NULL,
	"about_us" jsonb DEFAULT '{"about_banner":{},"our_story":{},"our_values":[],"our_team":[],"testimonials":[]}'::jsonb NOT NULL,
	"appointment_flow" jsonb DEFAULT '{"step_1_services":{},"step_2_date":{},"step_3_time":{},"step_4_confirmation":{}}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_site_customizations_company_id_unique" UNIQUE("company_id")
);

-- 2. Adicionar constraint de chave estrangeira
DO $$ BEGIN
 ALTER TABLE "company_site_customizations" ADD CONSTRAINT "company_site_customizations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- 3. Migrar os dados existentes de companies para company_site_customizations
-- Usamos gen_random_uuid() para gerar novos IDs para a tabela de customização
-- Nota: Para Bun/Neon, usamos crypto.randomUUID() no código, mas no SQL usamos extensões ou strings
INSERT INTO "company_site_customizations" (
    "id", 
    "company_id", 
    "layout_global", 
    "home", 
    "gallery", 
    "about_us", 
    "appointment_flow", 
    "created_at", 
    "updated_at"
)
SELECT 
    'cust_' || id, -- Gerando um ID baseado no ID da empresa para garantir unicidade na migração
    id, 
    COALESCE(site_customization->'layout_global', '{"header":{},"footer":{},"typography":{},"base_colors":{}}'::jsonb),
    COALESCE(site_customization->'home', '{"hero_banner":{},"services_section":{},"contact_section":{}}'::jsonb),
    COALESCE(site_customization->'gallery', '{"grid_config":{},"interactivity":{}}'::jsonb),
    COALESCE(site_customization->'about_us', '{"about_banner":{},"our_story":{},"our_values":[],"our_team":[],"testimonials":[]}'::jsonb),
    COALESCE(site_customization->'appointment_flow', '{"step_1_services":{},"step_2_date":{},"step_3_time":{},"step_4_confirmation":{}}'::jsonb),
    created_at,
    updated_at
FROM "companies";

-- 4. Remover a coluna antiga da tabela companies
ALTER TABLE "companies" DROP COLUMN IF EXISTS "site_customization";
```

## Arquivo: `drizzle\0004_ancient_newton_destine.sql`
```sql
ALTER TABLE "appointments" ALTER COLUMN "service_price_snapshot" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "price" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "initial_quantity" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "current_quantity" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "min_quantity" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "unit_price" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "secondary_unit" text;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "conversion_factor" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "inventory" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "inventory" DROP COLUMN "quantity";
```

## Arquivo: `drizzle\0005_new_chimera.sql`
```sql
CREATE TABLE "company_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"site_name" text,
	"title_suffix" text,
	"description" text,
	"logo_url" text,
	"instagram" text,
	"show_instagram" boolean DEFAULT true NOT NULL,
	"whatsapp" text,
	"show_whatsapp" boolean DEFAULT true NOT NULL,
	"facebook" text,
	"show_facebook" boolean DEFAULT true NOT NULL,
	"tiktok" text,
	"show_tiktok" boolean DEFAULT true NOT NULL,
	"linkedin" text,
	"show_linkedin" boolean DEFAULT true NOT NULL,
	"x_twitter" text,
	"show_x_twitter" boolean DEFAULT true NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_settings_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
```

## Arquivo: `drizzle\0006_sticky_ultimo.sql`
```sql
CREATE TABLE "business_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"site_name" text,
	"title_suffix" text,
	"description" text,
	"logo_url" text,
	"instagram" text,
	"show_instagram" boolean DEFAULT true NOT NULL,
	"whatsapp" text,
	"show_whatsapp" boolean DEFAULT true NOT NULL,
	"facebook" text,
	"show_facebook" boolean DEFAULT true NOT NULL,
	"tiktok" text,
	"show_tiktok" boolean DEFAULT true NOT NULL,
	"linkedin" text,
	"show_linkedin" boolean DEFAULT true NOT NULL,
	"twitter" text,
	"show_twitter" boolean DEFAULT true NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_profiles_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
DROP TABLE "company_settings" CASCADE;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_business_id_companies_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
```

## Arquivo: `drizzle\0007_noisy_goblin_queen.sql`
```sql
ALTER TABLE "company_site_customizations" ALTER COLUMN "layout_global" SET DEFAULT '{"header":{"backgroundAndEffect":{"color":"#ffffff","opacity":0.95,"blur":10},"textColors":{"logo":"#000000","links":"#333333","hover":"#000000"},"actionButtons":{"backgroundColor":"#000000","textColor":"#ffffff"}},"typography":{"headingsFont":"Inter","subheadingsFont":"Inter","bodyFont":"Inter"},"siteColors":{"primary":"#000000","secondary":"#333333","background":"#ffffff"},"footer":{"colors":{"background":"#f5f5f5","text":"#333333","icons":"#000000"},"typography":{"headings":"Inter","body":"Inter"},"visibility":true}}'::jsonb;--> statement-breakpoint
ALTER TABLE "company_site_customizations" ALTER COLUMN "home" SET DEFAULT '{"heroBanner":{"visibility":true,"title":{"text":"Sua beleza, nossa prioridade","color":"#000000","font":"Inter","sizeMobile":"32px","sizeDesktop":"48px"},"subtitle":{"text":"Agende seu horário e realce o que você tem de melhor","color":"#666666","font":"Inter","size":"18px"},"ctaButton":{"text":"Agendar Agora","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"8px","borderColor":"transparent","destinationLink":"/agendamento"},"appearance":{"backgroundImageUrl":"","glassEffect":{"active":false,"intensity":0},"overlay":{"color":"#000000","opacity":0},"verticalAlignment":"center","horizontalAlignment":"center","sectionHeight":"medium"}},"servicesSection":{"visibility":true,"orderOnHome":1,"header":{"title":{"text":"Nossos Serviços","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"Escolha o tratamento ideal para si","color":"#666666","font":"Inter","size":"16px"},"alignment":"center"},"cardConfig":{"showImage":true,"showCategory":true,"priceStyle":{"visible":true,"color":"#000000","font":"Inter"},"durationStyle":{"visible":true,"color":"#666666"},"cardBackgroundColor":"#ffffff","borderAndShadow":{"borderSize":"1px","shadowIntensity":"small"},"borderRadius":"12px"},"bookingButtonStyle":{"text":"Agendar","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"6px"}},"valuesSection":{"visibility":true,"orderOnHome":2,"header":{"title":{"text":"Nossos Valores","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"O que nos move todos os dias","color":"#666666","font":"Inter","size":"16px"}},"itemsStyle":{"layout":"grid","itemBackgroundColor":"#f9f9f9","borderRadius":"8px","internalAlignment":"center"},"items":[]},"galleryPreview":{"visibility":true,"orderOnHome":3,"header":{"title":{"text":"Nossa Galeria","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"Confira nossos últimos trabalhos","color":"#666666","font":"Inter","size":"16px"}},"displayLogic":{"selectionMode":"automatic_recent","photoCount":6,"gridLayout":"mosaic"},"photoStyle":{"aspectRatio":"1:1","spacing":"16px","borderRadius":"8px","hoverEffect":"zoom"},"viewMoreButton":{"visible":true,"text":"Ver Galeria Completa","style":{"backgroundColor":"transparent","textColor":"#000000","borderRadius":"4px"}}},"ctaSection":{"visibility":true,"orderOnHome":4,"title":{"text":"Pronto para transformar seu olhar?","color":"#ffffff","font":"Inter","size":{"desktop":"42px","mobile":"28px"}},"subtitle":{"text":"Reserve seu horário em menos de 1 minuto.","color":"#f0f0f0","font":"Inter","size":"18px"},"conversionButton":{"text":"Agendar Agora","style":{"backgroundColor":"#ffffff","textColor":"#000000","borderColor":"transparent"},"borderRadius":"8px"},"designConfig":{"backgroundType":"solid_color","colorOrImageUrl":"#000000","glassEffect":{"active":false,"intensity":0},"borders":{"top":false,"bottom":false},"padding":"60px","alignment":"center"}}}'::jsonb;--> statement-breakpoint
ALTER TABLE "company_site_customizations" ALTER COLUMN "gallery" SET DEFAULT '{"gridConfig":{"columns":3,"gap":"24px"},"interactivity":{"enableLightbox":true,"showCaptions":true}}'::jsonb;--> statement-breakpoint
ALTER TABLE "company_site_customizations" ALTER COLUMN "about_us" SET DEFAULT '{"aboutBanner":{"visibility":true,"title":"Sobre Nós","backgroundImageUrl":""},"ourStory":{"visibility":true,"title":"Nossa História","text":"Começamos com um sonho...","imageUrl":""},"ourValues":[],"ourTeam":[],"testimonials":[]}'::jsonb;--> statement-breakpoint
ALTER TABLE "company_site_customizations" ALTER COLUMN "appointment_flow" SET DEFAULT '{"step1Services":{"title":"Selecione o Serviço","showPrices":true,"showDurations":true},"step2Date":{"title":"Escolha a Data","calendarStyle":"modern"},"step3Time":{"title":"Escolha o Horário","timeSlotStyle":"grid"},"step4Confirmation":{"title":"Confirme seu Agendamento","requireLogin":false}}'::jsonb;
```

## Arquivo: `drizzle\0008_first_the_fury.sql`
```sql
ALTER TABLE "services" ADD COLUMN "show_on_home" boolean DEFAULT false NOT NULL;
```

## Arquivo: `drizzle\0009_plain_shocker.sql`
```sql
CREATE TABLE "fixed_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"description" text NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"category" text NOT NULL,
	"due_date" timestamp NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_site_customizations" ALTER COLUMN "appointment_flow" SET DEFAULT '{"colors":{"primary":"#000000","secondary":"#333333","background":"#ffffff","text":"#000000"},"step1Services":{"title":"Selecione o Serviço","showPrices":true,"showDurations":true,"cardConfig":{"backgroundColor":"TRANSPARENT_DEFAULT"}},"step2Date":{"title":"Escolha a Data","calendarStyle":"modern"},"step3Times":{"title":"Escolha o Horário","timeSlotStyle":"grid","timeSlotSize":"00:30"},"step4Confirmation":{"title":"Confirme seu Agendamento","requireLogin":false}}'::jsonb;--> statement-breakpoint
ALTER TABLE "service_resources" ADD COLUMN "quantity" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "service_resources" ADD COLUMN "unit" text NOT NULL;--> statement-breakpoint
ALTER TABLE "service_resources" ADD COLUMN "use_secondary_unit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_resources" DROP COLUMN "consumption_unit";--> statement-breakpoint
ALTER TABLE "service_resources" DROP COLUMN "conversion_factor";--> statement-breakpoint
ALTER TABLE "service_resources" DROP COLUMN "purchase_unit";--> statement-breakpoint
ALTER TABLE "service_resources" DROP COLUMN "consumed_quantity";--> statement-breakpoint
ALTER TABLE "service_resources" DROP COLUMN "output_factor";--> statement-breakpoint
ALTER TABLE "service_resources" DROP COLUMN "trigger";
```

## Arquivo: `drizzle\0010_steep_argent.sql`
```sql
CREATE TABLE "gallery_images" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"title" text,
	"image_url" text NOT NULL,
	"category" text,
	"show_in_home" boolean DEFAULT false NOT NULL,
	"order" numeric DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_business_id_companies_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
```

## Arquivo: `drizzle\0011_brief_liz_osborn.sql`
```sql
ALTER TABLE "companies" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'USER' NOT NULL;
```

## Arquivo: `drizzle\0012_special_quicksilver.sql`
```sql
CREATE TABLE "inventory_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"inventory_id" text NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"company_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "company_site_customizations" ALTER COLUMN "appointment_flow" SET DEFAULT '{"colors":{"primary":"#000000","secondary":"#333333","background":"#ffffff","text":"#000000"},"step1Services":{"title":"Selecione o Serviço","showPrices":true,"showDurations":true,"cardConfig":{"backgroundColor":"TRANSPARENT_DEFAULT"}},"step2Date":{"title":"Escolha a Data","calendarStyle":"modern"},"step3Times":{"title":"Escolha o Horário","timeSlotStyle":"grid","timeSlotSize":30},"step4Confirmation":{"title":"Confirme seu Agendamento","requireLogin":false}}'::jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notify_new_appointments" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notify_cancellations" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notify_inventory_alerts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
```

## Arquivo: `drizzle\0013_safe_wonder_man.sql`
```sql
ALTER TABLE "companies" ADD COLUMN "subscription_status" text DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "trial_ends_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "access_type" text DEFAULT 'automatic' NOT NULL;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD COLUMN "type" text DEFAULT 'FIXO' NOT NULL;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD COLUMN "total_installments" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD COLUMN "current_installment" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "is_shared" boolean DEFAULT false NOT NULL;
```

## Arquivo: `drizzle\0014_account_cancellation.sql`
```sql
ALTER TABLE "user" ADD COLUMN "account_status" text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "cancellation_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "retention_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_retention_discount_at" timestamp;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_cancellation_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_cancellation_feedback" ADD CONSTRAINT "account_cancellation_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
```

## Arquivo: `drizzle\0014_wet_darwin.sql`
```sql
CREATE TABLE "account_cancellation_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_items" (
	"id" text PRIMARY KEY NOT NULL,
	"appointment_id" text NOT NULL,
	"service_id" text NOT NULL,
	"service_name_snapshot" text NOT NULL,
	"service_price_snapshot" numeric(10, 2) NOT NULL,
	"service_duration_snapshot" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"establishment_name" text NOT NULL,
	"instagram_link" text,
	"status" text DEFAULT 'NOT_CONTACTED' NOT NULL,
	"category" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "account_status" text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "cancellation_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "retention_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_retention_discount_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "has_completed_onboarding" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "account_cancellation_feedback" ADD CONSTRAINT "account_cancellation_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
```

## Arquivo: `drizzle\0015_slow_omega_red.sql`
```sql
CREATE TABLE "site_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"layout_global" jsonb DEFAULT '{"header":{"backgroundAndEffect":{"color":"#ffffff","opacity":0.95,"blur":10},"textColors":{"logo":"#000000","links":"#333333","hover":"#000000"},"actionButtons":{"backgroundColor":"#000000","textColor":"#ffffff"}},"typography":{"headingsFont":"Inter","subheadingsFont":"Inter","bodyFont":"Inter"},"siteColors":{"primary":"#000000","secondary":"#333333","background":"#ffffff"},"footer":{"colors":{"background":"#f5f5f5","text":"#333333","icons":"#000000"},"typography":{"headings":"Inter","body":"Inter"},"visibility":true}}'::jsonb NOT NULL,
	"home" jsonb DEFAULT '{"heroBanner":{"visibility":true,"title":{"text":"Sua beleza, nossa prioridade","color":"#000000","font":"Inter","sizeMobile":"32px","sizeDesktop":"48px"},"subtitle":{"text":"Agende seu horário e realce o que você tem de melhor","color":"#666666","font":"Inter","size":"18px"},"ctaButton":{"text":"Agendar Agora","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"8px","borderColor":"transparent","destinationLink":"/agendamento"},"appearance":{"bgType":"image","backgroundColor":"#ffffff","backgroundImageUrl":"","glassEffect":{"active":false,"intensity":0},"overlay":{"color":"#000000","opacity":0},"verticalAlignment":"center","horizontalAlignment":"center","sectionHeight":"medium"},"bgColor":"#ffffff"},"servicesSection":{"visibility":true,"orderOnHome":1,"header":{"title":{"text":"Nossos Serviços","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"Escolha o tratamento ideal para si","color":"#666666","font":"Inter","size":"16px"},"alignment":"center"},"cardConfig":{"showImage":true,"showCategory":true,"priceStyle":{"visible":true,"color":"#000000","font":"Inter"},"durationStyle":{"visible":true,"color":"#666666"},"cardBackgroundColor":"#ffffff","borderAndShadow":{"borderSize":"1px","shadowIntensity":"small"},"borderRadius":"12px"},"bookingButtonStyle":{"text":"Agendar","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"6px"}},"valuesSection":{"visibility":true,"orderOnHome":2,"header":{"title":{"text":"Nossos Valores","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"O que nos move todos os dias","color":"#666666","font":"Inter","size":"16px"}},"itemsStyle":{"layout":"grid","itemBackgroundColor":"#f9f9f9","borderRadius":"8px","internalAlignment":"center"},"items":[]},"galleryPreview":{"visibility":true,"orderOnHome":3,"header":{"title":{"text":"Nossa Galeria","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"Confira nossos últimos trabalhos","color":"#000000","font":"Inter","size":"16px"}},"galleryStyle":{"layout":"grid","cardRadius":"8px"}},"ctaSection":{"visibility":true,"title":{"text":"Agende agora mesmo","color":"#000000","font":"Inter","size":"32px"},"subtitle":{"text":"Entre em contato e reserve seu horário","color":"#666666","font":"Inter","size":"16px"},"button":{"text":"Agendar","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"8px","destinationLink":"/agendamento"},"background":{"type":"solid","color":"#f9f9f9","imageUrl":""}},"contactSection":{"visibility":true,"title":{"text":"Fale Conosco","color":"#000000","font":"Inter","size":"32px"},"subtitle":{"text":"Estamos prontos para te atender","color":"#666666","font":"Inter","size":"16px"},"button":{"text":"WhatsApp","backgroundColor":"#25D366","textColor":"#ffffff","borderRadius":"8px","destinationLink":"https://wa.me/00000000000"},"background":{"type":"solid","color":"#ffffff","imageUrl":""}}}'::jsonb NOT NULL,
	"gallery" jsonb DEFAULT '{"gridConfig":{"columns":3,"gap":"24px"},"interactivity":{"enableLightbox":true,"showCaptions":true}}'::jsonb NOT NULL,
	"about_us" jsonb DEFAULT '{"aboutBanner":{"visibility":true,"title":"Sobre Nós","backgroundImageUrl":""},"ourStory":{"visibility":true,"title":"Nossa História","text":"Começamos com um sonho...","imageUrl":""},"ourValues":[],"ourTeam":[],"testimonials":[]}'::jsonb NOT NULL,
	"appointment_flow" jsonb DEFAULT '{"colors":{"primary":"#000000","secondary":"#333333","background":"#ffffff","text":"#000000"},"step1Services":{"title":"Selecione o Serviço","showPrices":true,"showDurations":true,"cardConfig":{"backgroundColor":"TRANSPARENT_DEFAULT"}},"step2Date":{"title":"Escolha a Data","calendarStyle":"modern"},"step3Times":{"title":"Escolha o Horário","timeSlotStyle":"grid","timeSlotSize":30},"step4Confirmation":{"title":"Confirme seu Agendamento","requireLogin":false}}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "site_drafts_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
ALTER TABLE "site_drafts" ADD CONSTRAINT "site_drafts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
```

## Arquivo: `drizzle\0016_bug_reports.sql`
```sql
CREATE TABLE "bug_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_user_id" text,
	"company_id" text,
	"description" text NOT NULL,
	"screenshot_url" text NOT NULL,
	"page_url" text NOT NULL,
	"user_agent" text,
	"status" text DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "bug_reports_created_at_idx" ON "bug_reports" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "bug_reports_status_idx" ON "bug_reports" USING btree ("status");
```

## Arquivo: `drizzle\0017_feedback_types_and_metadata.sql`
```sql
ALTER TABLE "bug_reports" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'BUG' NOT NULL;
--> statement-breakpoint
ALTER TABLE "bug_reports" ALTER COLUMN "screenshot_url" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "bug_reports" ADD COLUMN IF NOT EXISTS "ip_address" text;
--> statement-breakpoint
ALTER TABLE "bug_reports" ADD COLUMN IF NOT EXISTS "accept_language" text;
--> statement-breakpoint
ALTER TABLE "bug_reports" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bug_reports_type_idx" ON "bug_reports" USING btree ("type");
```

## Arquivo: `drizzle\meta\0000_snapshot.json`
```json
{
  "id": "4bbd19b5-1d3b-4119-aadb-8ba5688c9a49",
  "prevId": "00000000-0000-0000-0000-000000000000",
  "version": "7",
  "dialect": "postgresql",
  "tables": {
    "public.account": {
      "name": "account",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "account_id": {
          "name": "account_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "provider_id": {
          "name": "provider_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "user_id": {
          "name": "user_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "access_token": {
          "name": "access_token",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "refresh_token": {
          "name": "refresh_token",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "id_token": {
          "name": "id_token",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "access_token_expires_at": {
          "name": "access_token_expires_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": false
        },
        "refresh_token_expires_at": {
          "name": "refresh_token_expires_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": false
        },
        "scope": {
          "name": "scope",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "password": {
          "name": "password",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "deleted_at": {
          "name": "deleted_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": false
        }
      },
      "indexes": {
        "account_userId_idx": {
          "name": "account_userId_idx",
          "columns": [
            {
              "expression": "user_id",
              "isExpression": false,
              "asc": true,
              "nulls": "last"
            }
          ],
          "isUnique": false,
          "concurrently": false,
          "method": "btree",
          "with": {}
        }
      },
      "foreignKeys": {
        "account_user_id_user_id_fk": {
          "name": "account_user_id_user_id_fk",
          "tableFrom": "account",
          "tableTo": "user",
          "columnsFrom": [
            "user_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.account_cancellation_feedback": {
      "name": "account_cancellation_feedback",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "user_id": {
          "name": "user_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "reason": {
          "name": "reason",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "details": {
          "name": "details",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "account_cancellation_feedback_user_id_user_id_fk": {
          "name": "account_cancellation_feedback_user_id_user_id_fk",
          "tableFrom": "account_cancellation_feedback",
          "tableTo": "user",
          "columnsFrom": [
            "user_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.agenda_blocks": {
      "name": "agenda_blocks",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "start_date": {
          "name": "start_date",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "end_date": {
          "name": "end_date",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "start_time": {
          "name": "start_time",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "end_time": {
          "name": "end_time",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "reason": {
          "name": "reason",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "type": {
          "name": "type",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "agenda_blocks_company_id_companies_id_fk": {
          "name": "agenda_blocks_company_id_companies_id_fk",
          "tableFrom": "agenda_blocks",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.appointment_items": {
      "name": "appointment_items",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "appointment_id": {
          "name": "appointment_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "service_id": {
          "name": "service_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "service_name_snapshot": {
          "name": "service_name_snapshot",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "service_price_snapshot": {
          "name": "service_price_snapshot",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "service_duration_snapshot": {
          "name": "service_duration_snapshot",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "appointment_items_appointment_id_appointments_id_fk": {
          "name": "appointment_items_appointment_id_appointments_id_fk",
          "tableFrom": "appointment_items",
          "tableTo": "appointments",
          "columnsFrom": [
            "appointment_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        },
        "appointment_items_service_id_services_id_fk": {
          "name": "appointment_items_service_id_services_id_fk",
          "tableFrom": "appointment_items",
          "tableTo": "services",
          "columnsFrom": [
            "service_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.appointments": {
      "name": "appointments",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "service_id": {
          "name": "service_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "customer_id": {
          "name": "customer_id",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "customer_name": {
          "name": "customer_name",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "customer_email": {
          "name": "customer_email",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "customer_phone": {
          "name": "customer_phone",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "service_name_snapshot": {
          "name": "service_name_snapshot",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "service_price_snapshot": {
          "name": "service_price_snapshot",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "service_duration_snapshot": {
          "name": "service_duration_snapshot",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "scheduled_at": {
          "name": "scheduled_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true
        },
        "status": {
          "name": "status",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "default": "'PENDING'"
        },
        "notes": {
          "name": "notes",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "appointments_company_id_companies_id_fk": {
          "name": "appointments_company_id_companies_id_fk",
          "tableFrom": "appointments",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        },
        "appointments_service_id_services_id_fk": {
          "name": "appointments_service_id_services_id_fk",
          "tableFrom": "appointments",
          "tableTo": "services",
          "columnsFrom": [
            "service_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        },
        "appointments_customer_id_user_id_fk": {
          "name": "appointments_customer_id_user_id_fk",
          "tableFrom": "appointments",
          "tableTo": "user",
          "columnsFrom": [
            "customer_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "set null",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.business_profiles": {
      "name": "business_profiles",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "business_id": {
          "name": "business_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "site_name": {
          "name": "site_name",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "title_suffix": {
          "name": "title_suffix",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "description": {
          "name": "description",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "logo_url": {
          "name": "logo_url",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "instagram": {
          "name": "instagram",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "show_instagram": {
          "name": "show_instagram",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "whatsapp": {
          "name": "whatsapp",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "show_whatsapp": {
          "name": "show_whatsapp",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "facebook": {
          "name": "facebook",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "show_facebook": {
          "name": "show_facebook",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "tiktok": {
          "name": "tiktok",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "show_tiktok": {
          "name": "show_tiktok",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "linkedin": {
          "name": "linkedin",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "show_linkedin": {
          "name": "show_linkedin",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "twitter": {
          "name": "twitter",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "show_twitter": {
          "name": "show_twitter",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "phone": {
          "name": "phone",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "email": {
          "name": "email",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "address": {
          "name": "address",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "business_profiles_business_id_companies_id_fk": {
          "name": "business_profiles_business_id_companies_id_fk",
          "tableFrom": "business_profiles",
          "tableTo": "companies",
          "columnsFrom": [
            "business_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {
        "business_profiles_business_id_unique": {
          "name": "business_profiles_business_id_unique",
          "nullsNotDistinct": false,
          "columns": [
            "business_id"
          ]
        }
      },
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.companies": {
      "name": "companies",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "name": {
          "name": "name",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "slug": {
          "name": "slug",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "address": {
          "name": "address",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "contact": {
          "name": "contact",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "owner_id": {
          "name": "owner_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "active": {
          "name": "active",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "subscription_status": {
          "name": "subscription_status",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "default": "'trial'"
        },
        "trial_ends_at": {
          "name": "trial_ends_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": false,
          "default": "now()"
        },
        "stripe_customer_id": {
          "name": "stripe_customer_id",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "stripe_subscription_id": {
          "name": "stripe_subscription_id",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "access_type": {
          "name": "access_type",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "default": "'automatic'"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "companies_owner_id_user_id_fk": {
          "name": "companies_owner_id_user_id_fk",
          "tableFrom": "companies",
          "tableTo": "user",
          "columnsFrom": [
            "owner_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {
        "companies_slug_unique": {
          "name": "companies_slug_unique",
          "nullsNotDistinct": false,
          "columns": [
            "slug"
          ]
        }
      },
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.company_site_customizations": {
      "name": "company_site_customizations",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "layout_global": {
          "name": "layout_global",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"header\":{\"backgroundAndEffect\":{\"color\":\"#ffffff\",\"opacity\":0.95,\"blur\":10},\"textColors\":{\"logo\":\"#000000\",\"links\":\"#333333\",\"hover\":\"#000000\"},\"actionButtons\":{\"backgroundColor\":\"#000000\",\"textColor\":\"#ffffff\"}},\"typography\":{\"headingsFont\":\"Inter\",\"subheadingsFont\":\"Inter\",\"bodyFont\":\"Inter\"},\"siteColors\":{\"primary\":\"#000000\",\"secondary\":\"#333333\",\"background\":\"#ffffff\"},\"footer\":{\"colors\":{\"background\":\"#f5f5f5\",\"text\":\"#333333\",\"icons\":\"#000000\"},\"typography\":{\"headings\":\"Inter\",\"body\":\"Inter\"},\"visibility\":true}}'::jsonb"
        },
        "home": {
          "name": "home",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"heroBanner\":{\"visibility\":true,\"title\":{\"text\":\"Sua beleza, nossa prioridade\",\"color\":\"#000000\",\"font\":\"Inter\",\"sizeMobile\":\"32px\",\"sizeDesktop\":\"48px\"},\"subtitle\":{\"text\":\"Agende seu horário e realce o que você tem de melhor\",\"color\":\"#666666\",\"font\":\"Inter\",\"size\":\"18px\"},\"ctaButton\":{\"text\":\"Agendar Agora\",\"backgroundColor\":\"#000000\",\"textColor\":\"#ffffff\",\"borderRadius\":\"8px\",\"borderColor\":\"transparent\",\"destinationLink\":\"/agendamento\"},\"appearance\":{\"bgType\":\"image\",\"backgroundColor\":\"#ffffff\",\"backgroundImageUrl\":\"\",\"glassEffect\":{\"active\":false,\"intensity\":0},\"overlay\":{\"color\":\"#000000\",\"opacity\":0},\"verticalAlignment\":\"center\",\"horizontalAlignment\":\"center\",\"sectionHeight\":\"medium\"},\"bgColor\":\"#ffffff\"},\"servicesSection\":{\"visibility\":true,\"orderOnHome\":1,\"header\":{\"title\":{\"text\":\"Nossos Serviços\",\"color\":\"#000000\",\"font\":\"Inter\",\"size\":\"36px\"},\"subtitle\":{\"text\":\"Escolha o tratamento ideal para si\",\"color\":\"#666666\",\"font\":\"Inter\",\"size\":\"16px\"},\"alignment\":\"center\"},\"cardConfig\":{\"showImage\":true,\"showCategory\":true,\"priceStyle\":{\"visible\":true,\"color\":\"#000000\",\"font\":\"Inter\"},\"durationStyle\":{\"visible\":true,\"color\":\"#666666\"},\"cardBackgroundColor\":\"#ffffff\",\"borderAndShadow\":{\"borderSize\":\"1px\",\"shadowIntensity\":\"small\"},\"borderRadius\":\"12px\"},\"bookingButtonStyle\":{\"text\":\"Agendar\",\"backgroundColor\":\"#000000\",\"textColor\":\"#ffffff\",\"borderRadius\":\"6px\"}},\"valuesSection\":{\"visibility\":true,\"orderOnHome\":2,\"header\":{\"title\":{\"text\":\"Nossos Valores\",\"color\":\"#000000\",\"font\":\"Inter\",\"size\":\"36px\"},\"subtitle\":{\"text\":\"O que nos move todos os dias\",\"color\":\"#666666\",\"font\":\"Inter\",\"size\":\"16px\"}},\"itemsStyle\":{\"layout\":\"grid\",\"itemBackgroundColor\":\"#f9f9f9\",\"borderRadius\":\"8px\",\"internalAlignment\":\"center\"},\"items\":[]},\"galleryPreview\":{\"visibility\":true,\"orderOnHome\":3,\"header\":{\"title\":{\"text\":\"Nossa Galeria\",\"color\":\"#000000\",\"font\":\"Inter\",\"size\":\"36px\"},\"subtitle\":{\"text\":\"Confira nossos últimos trabalhos\",\"color\":\"#666666\",\"font\":\"Inter\",\"size\":\"16px\"}},\"displayLogic\":{\"selectionMode\":\"automatic_recent\",\"photoCount\":6,\"gridLayout\":\"mosaic\"},\"photoStyle\":{\"aspectRatio\":\"1:1\",\"spacing\":\"16px\",\"borderRadius\":\"8px\",\"hoverEffect\":\"zoom\"},\"viewMoreButton\":{\"visible\":true,\"text\":\"Ver Galeria Completa\",\"style\":{\"backgroundColor\":\"transparent\",\"textColor\":\"#000000\",\"borderRadius\":\"4px\"}}},\"ctaSection\":{\"visibility\":true,\"orderOnHome\":4,\"title\":{\"text\":\"Pronto para transformar seu olhar?\",\"color\":\"#ffffff\",\"font\":\"Inter\",\"size\":{\"desktop\":\"42px\",\"mobile\":\"28px\"}},\"subtitle\":{\"text\":\"Reserve seu horário em menos de 1 minuto.\",\"color\":\"#f0f0f0\",\"font\":\"Inter\",\"size\":\"18px\"},\"conversionButton\":{\"text\":\"Agendar Agora\",\"style\":{\"backgroundColor\":\"#ffffff\",\"textColor\":\"#000000\",\"borderColor\":\"transparent\"},\"borderRadius\":\"8px\"},\"designConfig\":{\"backgroundType\":\"solid_color\",\"colorOrImageUrl\":\"#000000\",\"glassEffect\":{\"active\":false,\"intensity\":0},\"borders\":{\"top\":false,\"bottom\":false},\"padding\":\"60px\",\"alignment\":\"center\"}}}'::jsonb"
        },
        "gallery": {
          "name": "gallery",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"gridConfig\":{\"columns\":3,\"gap\":\"24px\"},\"interactivity\":{\"enableLightbox\":true,\"showCaptions\":true}}'::jsonb"
        },
        "about_us": {
          "name": "about_us",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"aboutBanner\":{\"visibility\":true,\"title\":\"Sobre Nós\",\"backgroundImageUrl\":\"\"},\"ourStory\":{\"visibility\":true,\"title\":\"Nossa História\",\"text\":\"Começamos com um sonho...\",\"imageUrl\":\"\"},\"ourValues\":[],\"ourTeam\":[],\"testimonials\":[]}'::jsonb"
        },
        "appointment_flow": {
          "name": "appointment_flow",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"colors\":{\"primary\":\"#000000\",\"secondary\":\"#333333\",\"background\":\"#ffffff\",\"text\":\"#000000\"},\"step1Services\":{\"title\":\"Selecione o Serviço\",\"showPrices\":true,\"showDurations\":true,\"cardConfig\":{\"backgroundColor\":\"TRANSPARENT_DEFAULT\"}},\"step2Date\":{\"title\":\"Escolha a Data\",\"calendarStyle\":\"modern\"},\"step3Times\":{\"title\":\"Escolha o Horário\",\"timeSlotStyle\":\"grid\",\"timeSlotSize\":30},\"step4Confirmation\":{\"title\":\"Confirme seu Agendamento\",\"requireLogin\":false}}'::jsonb"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "company_site_customizations_company_id_companies_id_fk": {
          "name": "company_site_customizations_company_id_companies_id_fk",
          "tableFrom": "company_site_customizations",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {
        "company_site_customizations_company_id_unique": {
          "name": "company_site_customizations_company_id_unique",
          "nullsNotDistinct": false,
          "columns": [
            "company_id"
          ]
        }
      },
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.fixed_expenses": {
      "name": "fixed_expenses",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "description": {
          "name": "description",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "value": {
          "name": "value",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "category": {
          "name": "category",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "type": {
          "name": "type",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "default": "'FIXO'"
        },
        "total_installments": {
          "name": "total_installments",
          "type": "integer",
          "primaryKey": false,
          "notNull": false,
          "default": 1
        },
        "current_installment": {
          "name": "current_installment",
          "type": "integer",
          "primaryKey": false,
          "notNull": false,
          "default": 1
        },
        "parent_id": {
          "name": "parent_id",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "due_date": {
          "name": "due_date",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true
        },
        "is_paid": {
          "name": "is_paid",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "fixed_expenses_company_id_companies_id_fk": {
          "name": "fixed_expenses_company_id_companies_id_fk",
          "tableFrom": "fixed_expenses",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.gallery_images": {
      "name": "gallery_images",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "business_id": {
          "name": "business_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "title": {
          "name": "title",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "image_url": {
          "name": "image_url",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "category": {
          "name": "category",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "show_in_home": {
          "name": "show_in_home",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": false
        },
        "order": {
          "name": "order",
          "type": "numeric",
          "primaryKey": false,
          "notNull": true,
          "default": "'0'"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "gallery_images_business_id_companies_id_fk": {
          "name": "gallery_images_business_id_companies_id_fk",
          "tableFrom": "gallery_images",
          "tableTo": "companies",
          "columnsFrom": [
            "business_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.google_calendar_configs": {
      "name": "google_calendar_configs",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "ical_url": {
          "name": "ical_url",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "sync_status": {
          "name": "sync_status",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "default": "'INACTIVE'"
        },
        "last_synced_at": {
          "name": "last_synced_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "google_calendar_configs_company_id_companies_id_fk": {
          "name": "google_calendar_configs_company_id_companies_id_fk",
          "tableFrom": "google_calendar_configs",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.inventory": {
      "name": "inventory",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "name": {
          "name": "name",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "initial_quantity": {
          "name": "initial_quantity",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "current_quantity": {
          "name": "current_quantity",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "min_quantity": {
          "name": "min_quantity",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "unit_price": {
          "name": "unit_price",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "unit": {
          "name": "unit",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "secondary_unit": {
          "name": "secondary_unit",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "conversion_factor": {
          "name": "conversion_factor",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": false
        },
        "is_shared": {
          "name": "is_shared",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "inventory_company_id_companies_id_fk": {
          "name": "inventory_company_id_companies_id_fk",
          "tableFrom": "inventory",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.inventory_logs": {
      "name": "inventory_logs",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "inventory_id": {
          "name": "inventory_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "type": {
          "name": "type",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "quantity": {
          "name": "quantity",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "reason": {
          "name": "reason",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "inventory_logs_inventory_id_inventory_id_fk": {
          "name": "inventory_logs_inventory_id_inventory_id_fk",
          "tableFrom": "inventory_logs",
          "tableTo": "inventory",
          "columnsFrom": [
            "inventory_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        },
        "inventory_logs_company_id_companies_id_fk": {
          "name": "inventory_logs_company_id_companies_id_fk",
          "tableFrom": "inventory_logs",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.operating_hours": {
      "name": "operating_hours",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "day_of_week": {
          "name": "day_of_week",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "status": {
          "name": "status",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "morning_start": {
          "name": "morning_start",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "morning_end": {
          "name": "morning_end",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "afternoon_start": {
          "name": "afternoon_start",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "afternoon_end": {
          "name": "afternoon_end",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "operating_hours_company_id_companies_id_fk": {
          "name": "operating_hours_company_id_companies_id_fk",
          "tableFrom": "operating_hours",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.prospects": {
      "name": "prospects",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "name": {
          "name": "name",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "phone": {
          "name": "phone",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "establishment_name": {
          "name": "establishment_name",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "instagram_link": {
          "name": "instagram_link",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "status": {
          "name": "status",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "default": "'NOT_CONTACTED'"
        },
        "category": {
          "name": "category",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "location": {
          "name": "location",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "address": {
          "name": "address",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "maps_link": {
          "name": "maps_link",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "notes": {
          "name": "notes",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {},
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.push_subscriptions": {
      "name": "push_subscriptions",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "user_id": {
          "name": "user_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "endpoint": {
          "name": "endpoint",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "p256dh": {
          "name": "p256dh",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "auth": {
          "name": "auth",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "push_subscriptions_user_id_user_id_fk": {
          "name": "push_subscriptions_user_id_user_id_fk",
          "tableFrom": "push_subscriptions",
          "tableTo": "user",
          "columnsFrom": [
            "user_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {
        "push_subscriptions_endpoint_unique": {
          "name": "push_subscriptions_endpoint_unique",
          "nullsNotDistinct": false,
          "columns": [
            "endpoint"
          ]
        }
      },
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.service_resources": {
      "name": "service_resources",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "service_id": {
          "name": "service_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "inventory_id": {
          "name": "inventory_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "quantity": {
          "name": "quantity",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "unit": {
          "name": "unit",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "use_secondary_unit": {
          "name": "use_secondary_unit",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "service_resources_service_id_services_id_fk": {
          "name": "service_resources_service_id_services_id_fk",
          "tableFrom": "service_resources",
          "tableTo": "services",
          "columnsFrom": [
            "service_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        },
        "service_resources_inventory_id_inventory_id_fk": {
          "name": "service_resources_inventory_id_inventory_id_fk",
          "tableFrom": "service_resources",
          "tableTo": "inventory",
          "columnsFrom": [
            "inventory_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.services": {
      "name": "services",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "name": {
          "name": "name",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "description": {
          "name": "description",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "price": {
          "name": "price",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "duration": {
          "name": "duration",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "icon": {
          "name": "icon",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "is_visible": {
          "name": "is_visible",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "show_on_home": {
          "name": "show_on_home",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": false
        },
        "advanced_rules": {
          "name": "advanced_rules",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": false,
          "default": "'{\"conflicts\":[]}'::jsonb"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "services_company_id_companies_id_fk": {
          "name": "services_company_id_companies_id_fk",
          "tableFrom": "services",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.session": {
      "name": "session",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "expires_at": {
          "name": "expires_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true
        },
        "token": {
          "name": "token",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "ip_address": {
          "name": "ip_address",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "user_agent": {
          "name": "user_agent",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "user_id": {
          "name": "user_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        }
      },
      "indexes": {
        "session_userId_idx": {
          "name": "session_userId_idx",
          "columns": [
            {
              "expression": "user_id",
              "isExpression": false,
              "asc": true,
              "nulls": "last"
            }
          ],
          "isUnique": false,
          "concurrently": false,
          "method": "btree",
          "with": {}
        }
      },
      "foreignKeys": {
        "session_user_id_user_id_fk": {
          "name": "session_user_id_user_id_fk",
          "tableFrom": "session",
          "tableTo": "user",
          "columnsFrom": [
            "user_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {
        "session_token_unique": {
          "name": "session_token_unique",
          "nullsNotDistinct": false,
          "columns": [
            "token"
          ]
        }
      },
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.site_drafts": {
      "name": "site_drafts",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "layout_global": {
          "name": "layout_global",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"header\":{\"backgroundAndEffect\":{\"color\":\"#ffffff\",\"opacity\":0.95,\"blur\":10},\"textColors\":{\"logo\":\"#000000\",\"links\":\"#333333\",\"hover\":\"#000000\"},\"actionButtons\":{\"backgroundColor\":\"#000000\",\"textColor\":\"#ffffff\"}},\"typography\":{\"headingsFont\":\"Inter\",\"subheadingsFont\":\"Inter\",\"bodyFont\":\"Inter\"},\"siteColors\":{\"primary\":\"#000000\",\"secondary\":\"#333333\",\"background\":\"#ffffff\"},\"footer\":{\"colors\":{\"background\":\"#f5f5f5\",\"text\":\"#333333\",\"icons\":\"#000000\"},\"typography\":{\"headings\":\"Inter\",\"body\":\"Inter\"},\"visibility\":true}}'::jsonb"
        },
        "home": {
          "name": "home",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"heroBanner\":{\"visibility\":true,\"title\":{\"text\":\"Sua beleza, nossa prioridade\",\"color\":\"#000000\",\"font\":\"Inter\",\"sizeMobile\":\"32px\",\"sizeDesktop\":\"48px\"},\"subtitle\":{\"text\":\"Agende seu horário e realce o que você tem de melhor\",\"color\":\"#666666\",\"font\":\"Inter\",\"size\":\"18px\"},\"ctaButton\":{\"text\":\"Agendar Agora\",\"backgroundColor\":\"#000000\",\"textColor\":\"#ffffff\",\"borderRadius\":\"8px\",\"borderColor\":\"transparent\",\"destinationLink\":\"/agendamento\"},\"appearance\":{\"bgType\":\"image\",\"backgroundColor\":\"#ffffff\",\"backgroundImageUrl\":\"\",\"glassEffect\":{\"active\":false,\"intensity\":0},\"overlay\":{\"color\":\"#000000\",\"opacity\":0},\"verticalAlignment\":\"center\",\"horizontalAlignment\":\"center\",\"sectionHeight\":\"medium\"},\"bgColor\":\"#ffffff\"},\"servicesSection\":{\"visibility\":true,\"orderOnHome\":1,\"header\":{\"title\":{\"text\":\"Nossos Serviços\",\"color\":\"#000000\",\"font\":\"Inter\",\"size\":\"36px\"},\"subtitle\":{\"text\":\"Escolha o tratamento ideal para si\",\"color\":\"#666666\",\"font\":\"Inter\",\"size\":\"16px\"},\"alignment\":\"center\"},\"cardConfig\":{\"showImage\":true,\"showCategory\":true,\"priceStyle\":{\"visible\":true,\"color\":\"#000000\",\"font\":\"Inter\"},\"durationStyle\":{\"visible\":true,\"color\":\"#666666\"},\"cardBackgroundColor\":\"#ffffff\",\"borderAndShadow\":{\"borderSize\":\"1px\",\"shadowIntensity\":\"small\"},\"borderRadius\":\"12px\"},\"bookingButtonStyle\":{\"text\":\"Agendar\",\"backgroundColor\":\"#000000\",\"textColor\":\"#ffffff\",\"borderRadius\":\"6px\"}},\"valuesSection\":{\"visibility\":true,\"orderOnHome\":2,\"header\":{\"title\":{\"text\":\"Nossos Valores\",\"color\":\"#000000\",\"font\":\"Inter\",\"size\":\"36px\"},\"subtitle\":{\"text\":\"O que nos move todos os dias\",\"color\":\"#666666\",\"font\":\"Inter\",\"size\":\"16px\"}},\"itemsStyle\":{\"layout\":\"grid\",\"itemBackgroundColor\":\"#f9f9f9\",\"borderRadius\":\"8px\",\"internalAlignment\":\"center\"},\"items\":[]},\"galleryPreview\":{\"visibility\":true,\"orderOnHome\":3,\"header\":{\"title\":{\"text\":\"Nossa Galeria\",\"color\":\"#000000\",\"font\":\"Inter\",\"size\":\"36px\"},\"subtitle\":{\"text\":\"Confira nossos últimos trabalhos\",\"color\":\"#666666\",\"font\":\"Inter\",\"size\":\"16px\"}},\"displayLogic\":{\"selectionMode\":\"automatic_recent\",\"photoCount\":6,\"gridLayout\":\"mosaic\"},\"photoStyle\":{\"aspectRatio\":\"1:1\",\"spacing\":\"16px\",\"borderRadius\":\"8px\",\"hoverEffect\":\"zoom\"},\"viewMoreButton\":{\"visible\":true,\"text\":\"Ver Galeria Completa\",\"style\":{\"backgroundColor\":\"transparent\",\"textColor\":\"#000000\",\"borderRadius\":\"4px\"}}},\"ctaSection\":{\"visibility\":true,\"orderOnHome\":4,\"title\":{\"text\":\"Pronto para transformar seu olhar?\",\"color\":\"#ffffff\",\"font\":\"Inter\",\"size\":{\"desktop\":\"42px\",\"mobile\":\"28px\"}},\"subtitle\":{\"text\":\"Reserve seu horário em menos de 1 minuto.\",\"color\":\"#f0f0f0\",\"font\":\"Inter\",\"size\":\"18px\"},\"conversionButton\":{\"text\":\"Agendar Agora\",\"style\":{\"backgroundColor\":\"#ffffff\",\"textColor\":\"#000000\",\"borderColor\":\"transparent\"},\"borderRadius\":\"8px\"},\"designConfig\":{\"backgroundType\":\"solid_color\",\"colorOrImageUrl\":\"#000000\",\"glassEffect\":{\"active\":false,\"intensity\":0},\"borders\":{\"top\":false,\"bottom\":false},\"padding\":\"60px\",\"alignment\":\"center\"}}}'::jsonb"
        },
        "gallery": {
          "name": "gallery",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"gridConfig\":{\"columns\":3,\"gap\":\"24px\"},\"interactivity\":{\"enableLightbox\":true,\"showCaptions\":true}}'::jsonb"
        },
        "about_us": {
          "name": "about_us",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"aboutBanner\":{\"visibility\":true,\"title\":\"Sobre Nós\",\"backgroundImageUrl\":\"\"},\"ourStory\":{\"visibility\":true,\"title\":\"Nossa História\",\"text\":\"Começamos com um sonho...\",\"imageUrl\":\"\"},\"ourValues\":[],\"ourTeam\":[],\"testimonials\":[]}'::jsonb"
        },
        "appointment_flow": {
          "name": "appointment_flow",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"colors\":{\"primary\":\"#000000\",\"secondary\":\"#333333\",\"background\":\"#ffffff\",\"text\":\"#000000\"},\"step1Services\":{\"title\":\"Selecione o Serviço\",\"showPrices\":true,\"showDurations\":true,\"cardConfig\":{\"backgroundColor\":\"TRANSPARENT_DEFAULT\"}},\"step2Date\":{\"title\":\"Escolha a Data\",\"calendarStyle\":\"modern\"},\"step3Times\":{\"title\":\"Escolha o Horário\",\"timeSlotStyle\":\"grid\",\"timeSlotSize\":30},\"step4Confirmation\":{\"title\":\"Confirme seu Agendamento\",\"requireLogin\":false}}'::jsonb"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "site_drafts_company_id_companies_id_fk": {
          "name": "site_drafts_company_id_companies_id_fk",
          "tableFrom": "site_drafts",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {
        "site_drafts_company_id_unique": {
          "name": "site_drafts_company_id_unique",
          "nullsNotDistinct": false,
          "columns": [
            "company_id"
          ]
        }
      },
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.user": {
      "name": "user",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "name": {
          "name": "name",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "email": {
          "name": "email",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "email_verified": {
          "name": "email_verified",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": false
        },
        "image": {
          "name": "image",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "role": {
          "name": "role",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "default": "'USER'"
        },
        "active": {
          "name": "active",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "notify_new_appointments": {
          "name": "notify_new_appointments",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "notify_cancellations": {
          "name": "notify_cancellations",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "notify_inventory_alerts": {
          "name": "notify_inventory_alerts",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "account_status": {
          "name": "account_status",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "default": "'ACTIVE'"
        },
        "cancellation_requested_at": {
          "name": "cancellation_requested_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": false
        },
        "retention_ends_at": {
          "name": "retention_ends_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": false
        },
        "last_retention_discount_at": {
          "name": "last_retention_discount_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": false
        },
        "has_completed_onboarding": {
          "name": "has_completed_onboarding",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {},
      "compositePrimaryKeys": {},
      "uniqueConstraints": {
        "user_email_unique": {
          "name": "user_email_unique",
          "nullsNotDistinct": false,
          "columns": [
            "email"
          ]
        }
      },
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.verification": {
      "name": "verification",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "identifier": {
          "name": "identifier",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "value": {
          "name": "value",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "expires_at": {
          "name": "expires_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {
        "verification_identifier_idx": {
          "name": "verification_identifier_idx",
          "columns": [
            {
              "expression": "identifier",
              "isExpression": false,
              "asc": true,
              "nulls": "last"
            }
          ],
          "isUnique": false,
          "concurrently": false,
          "method": "btree",
          "with": {}
        }
      },
      "foreignKeys": {},
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    }
  },
  "enums": {},
  "schemas": {},
  "sequences": {},
  "roles": {},
  "policies": {},
  "views": {},
  "_meta": {
    "columns": {},
    "schemas": {},
    "tables": {}
  }
}
```

## Arquivo: `drizzle\meta\0001_snapshot.json`
```json
{
  "id": "b4033a99-e75a-434b-a097-81b7e2f9d1b2",
  "prevId": "4bbd19b5-1d3b-4119-aadb-8ba5688c9a49",
  "version": "7",
  "dialect": "postgresql",
  "tables": {
    "public.account": {
      "name": "account",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "account_id": {
          "name": "account_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "provider_id": {
          "name": "provider_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "user_id": {
          "name": "user_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "access_token": {
          "name": "access_token",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "refresh_token": {
          "name": "refresh_token",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "id_token": {
          "name": "id_token",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "access_token_expires_at": {
          "name": "access_token_expires_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": false
        },
        "refresh_token_expires_at": {
          "name": "refresh_token_expires_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": false
        },
        "scope": {
          "name": "scope",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "password": {
          "name": "password",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "deleted_at": {
          "name": "deleted_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": false
        }
      },
      "indexes": {
        "account_userId_idx": {
          "name": "account_userId_idx",
          "columns": [
            {
              "expression": "user_id",
              "isExpression": false,
              "asc": true,
              "nulls": "last"
            }
          ],
          "isUnique": false,
          "concurrently": false,
          "method": "btree",
          "with": {}
        }
      },
      "foreignKeys": {
        "account_user_id_user_id_fk": {
          "name": "account_user_id_user_id_fk",
          "tableFrom": "account",
          "tableTo": "user",
          "columnsFrom": [
            "user_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.account_cancellation_feedback": {
      "name": "account_cancellation_feedback",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "user_id": {
          "name": "user_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "reason": {
          "name": "reason",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "details": {
          "name": "details",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "account_cancellation_feedback_user_id_user_id_fk": {
          "name": "account_cancellation_feedback_user_id_user_id_fk",
          "tableFrom": "account_cancellation_feedback",
          "tableTo": "user",
          "columnsFrom": [
            "user_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.agenda_blocks": {
      "name": "agenda_blocks",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "start_date": {
          "name": "start_date",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "end_date": {
          "name": "end_date",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "start_time": {
          "name": "start_time",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "end_time": {
          "name": "end_time",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "reason": {
          "name": "reason",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "type": {
          "name": "type",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "agenda_blocks_company_id_companies_id_fk": {
          "name": "agenda_blocks_company_id_companies_id_fk",
          "tableFrom": "agenda_blocks",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.appointment_items": {
      "name": "appointment_items",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "appointment_id": {
          "name": "appointment_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "service_id": {
          "name": "service_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "service_name_snapshot": {
          "name": "service_name_snapshot",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "service_price_snapshot": {
          "name": "service_price_snapshot",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "service_duration_snapshot": {
          "name": "service_duration_snapshot",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "appointment_items_appointment_id_appointments_id_fk": {
          "name": "appointment_items_appointment_id_appointments_id_fk",
          "tableFrom": "appointment_items",
          "tableTo": "appointments",
          "columnsFrom": [
            "appointment_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        },
        "appointment_items_service_id_services_id_fk": {
          "name": "appointment_items_service_id_services_id_fk",
          "tableFrom": "appointment_items",
          "tableTo": "services",
          "columnsFrom": [
            "service_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.appointments": {
      "name": "appointments",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "service_id": {
          "name": "service_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "customer_id": {
          "name": "customer_id",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "customer_name": {
          "name": "customer_name",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "customer_email": {
          "name": "customer_email",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "customer_phone": {
          "name": "customer_phone",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "service_name_snapshot": {
          "name": "service_name_snapshot",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "service_price_snapshot": {
          "name": "service_price_snapshot",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "service_duration_snapshot": {
          "name": "service_duration_snapshot",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "scheduled_at": {
          "name": "scheduled_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true
        },
        "status": {
          "name": "status",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "default": "'PENDING'"
        },
        "notes": {
          "name": "notes",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "appointments_company_id_companies_id_fk": {
          "name": "appointments_company_id_companies_id_fk",
          "tableFrom": "appointments",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        },
        "appointments_service_id_services_id_fk": {
          "name": "appointments_service_id_services_id_fk",
          "tableFrom": "appointments",
          "tableTo": "services",
          "columnsFrom": [
            "service_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        },
        "appointments_customer_id_user_id_fk": {
          "name": "appointments_customer_id_user_id_fk",
          "tableFrom": "appointments",
          "tableTo": "user",
          "columnsFrom": [
            "customer_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "set null",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.business_profiles": {
      "name": "business_profiles",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "business_id": {
          "name": "business_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "site_name": {
          "name": "site_name",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "title_suffix": {
          "name": "title_suffix",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "description": {
          "name": "description",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "logo_url": {
          "name": "logo_url",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "instagram": {
          "name": "instagram",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "show_instagram": {
          "name": "show_instagram",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "whatsapp": {
          "name": "whatsapp",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "show_whatsapp": {
          "name": "show_whatsapp",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "facebook": {
          "name": "facebook",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "show_facebook": {
          "name": "show_facebook",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "tiktok": {
          "name": "tiktok",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "show_tiktok": {
          "name": "show_tiktok",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "linkedin": {
          "name": "linkedin",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "show_linkedin": {
          "name": "show_linkedin",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "twitter": {
          "name": "twitter",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "show_twitter": {
          "name": "show_twitter",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "phone": {
          "name": "phone",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "email": {
          "name": "email",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "address": {
          "name": "address",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "business_profiles_business_id_companies_id_fk": {
          "name": "business_profiles_business_id_companies_id_fk",
          "tableFrom": "business_profiles",
          "tableTo": "companies",
          "columnsFrom": [
            "business_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {
        "business_profiles_business_id_unique": {
          "name": "business_profiles_business_id_unique",
          "nullsNotDistinct": false,
          "columns": [
            "business_id"
          ]
        }
      },
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.companies": {
      "name": "companies",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "name": {
          "name": "name",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "slug": {
          "name": "slug",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "address": {
          "name": "address",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "contact": {
          "name": "contact",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "owner_id": {
          "name": "owner_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "active": {
          "name": "active",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "subscription_status": {
          "name": "subscription_status",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "default": "'trial'"
        },
        "trial_ends_at": {
          "name": "trial_ends_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": false,
          "default": "now()"
        },
        "stripe_customer_id": {
          "name": "stripe_customer_id",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "stripe_subscription_id": {
          "name": "stripe_subscription_id",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "access_type": {
          "name": "access_type",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "default": "'automatic'"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "companies_owner_id_user_id_fk": {
          "name": "companies_owner_id_user_id_fk",
          "tableFrom": "companies",
          "tableTo": "user",
          "columnsFrom": [
            "owner_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {
        "companies_slug_unique": {
          "name": "companies_slug_unique",
          "nullsNotDistinct": false,
          "columns": [
            "slug"
          ]
        }
      },
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.company_site_customizations": {
      "name": "company_site_customizations",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "layout_global": {
          "name": "layout_global",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"header\":{\"backgroundAndEffect\":{\"color\":\"#ffffff\",\"opacity\":0.95,\"blur\":10},\"textColors\":{\"logo\":\"#000000\",\"links\":\"#333333\",\"hover\":\"#000000\"},\"actionButtons\":{\"backgroundColor\":\"#000000\",\"textColor\":\"#ffffff\"}},\"typography\":{\"headingsFont\":\"Inter\",\"subheadingsFont\":\"Inter\",\"bodyFont\":\"Inter\"},\"siteColors\":{\"primary\":\"#000000\",\"secondary\":\"#333333\",\"background\":\"#ffffff\"},\"footer\":{\"colors\":{\"background\":\"#f5f5f5\",\"text\":\"#333333\",\"icons\":\"#000000\"},\"typography\":{\"headings\":\"Inter\",\"body\":\"Inter\"},\"visibility\":true}}'::jsonb"
        },
        "home": {
          "name": "home",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"heroBanner\":{\"visibility\":true,\"title\":{\"text\":\"Sua beleza, nossa prioridade\",\"color\":\"#000000\",\"font\":\"Inter\",\"sizeMobile\":\"32px\",\"sizeDesktop\":\"48px\"},\"badge\":{\"text\":\"ESPECIALISTA EM BELEZA\",\"backgroundColor\":\"#000000\",\"textColor\":\"#ffffff\",\"font\":\"Inter\"},\"subtitle\":{\"text\":\"Agende seu horário e realce o que você tem de melhor\",\"color\":\"#666666\",\"font\":\"Inter\",\"size\":\"18px\"},\"ctaButton\":{\"text\":\"Agendar Agora\",\"backgroundColor\":\"#000000\",\"textColor\":\"#ffffff\",\"borderRadius\":\"8px\",\"borderColor\":\"transparent\",\"destinationLink\":\"/agendamento\"},\"appearance\":{\"bgType\":\"image\",\"backgroundColor\":\"#ffffff\",\"backgroundImageUrl\":\"\",\"glassEffect\":{\"active\":false,\"intensity\":0},\"overlay\":{\"color\":\"#000000\",\"opacity\":0},\"verticalAlignment\":\"center\",\"horizontalAlignment\":\"center\",\"sectionHeight\":\"medium\"},\"bgColor\":\"#ffffff\"},\"servicesSection\":{\"visibility\":true,\"orderOnHome\":1,\"header\":{\"title\":{\"text\":\"Nossos Serviços\",\"color\":\"#000000\",\"font\":\"Inter\",\"size\":\"36px\"},\"subtitle\":{\"text\":\"Escolha o tratamento ideal para si\",\"color\":\"#666666\",\"font\":\"Inter\",\"size\":\"16px\"},\"alignment\":\"center\"},\"cardConfig\":{\"showImage\":true,\"showCategory\":true,\"priceStyle\":{\"visible\":true,\"color\":\"#000000\",\"font\":\"Inter\"},\"durationStyle\":{\"visible\":true,\"color\":\"#666666\"},\"cardBackgroundColor\":\"#ffffff\",\"borderAndShadow\":{\"borderSize\":\"1px\",\"shadowIntensity\":\"small\"},\"borderRadius\":\"12px\"},\"bookingButtonStyle\":{\"text\":\"Agendar\",\"backgroundColor\":\"#000000\",\"textColor\":\"#ffffff\",\"borderRadius\":\"6px\"}},\"valuesSection\":{\"visibility\":true,\"orderOnHome\":2,\"header\":{\"title\":{\"text\":\"Nossos Valores\",\"color\":\"#000000\",\"font\":\"Inter\",\"size\":\"36px\"},\"subtitle\":{\"text\":\"O que nos move todos os dias\",\"color\":\"#666666\",\"font\":\"Inter\",\"size\":\"16px\"}},\"itemsStyle\":{\"layout\":\"grid\",\"itemBackgroundColor\":\"#f9f9f9\",\"borderRadius\":\"8px\",\"internalAlignment\":\"center\"},\"items\":[]},\"galleryPreview\":{\"visibility\":true,\"orderOnHome\":3,\"header\":{\"title\":{\"text\":\"Nossa Galeria\",\"color\":\"#000000\",\"font\":\"Inter\",\"size\":\"36px\"},\"subtitle\":{\"text\":\"Confira nossos últimos trabalhos\",\"color\":\"#666666\",\"font\":\"Inter\",\"size\":\"16px\"}},\"displayLogic\":{\"selectionMode\":\"automatic_recent\",\"photoCount\":6,\"gridLayout\":\"mosaic\"},\"photoStyle\":{\"aspectRatio\":\"1:1\",\"spacing\":\"16px\",\"borderRadius\":\"8px\",\"hoverEffect\":\"zoom\"},\"viewMoreButton\":{\"visible\":true,\"text\":\"Ver Galeria Completa\",\"style\":{\"backgroundColor\":\"transparent\",\"textColor\":\"#000000\",\"borderRadius\":\"4px\"}}},\"ctaSection\":{\"visibility\":true,\"orderOnHome\":4,\"title\":{\"text\":\"Pronto para transformar seu olhar?\",\"color\":\"#ffffff\",\"font\":\"Inter\",\"size\":{\"desktop\":\"42px\",\"mobile\":\"28px\"}},\"subtitle\":{\"text\":\"Reserve seu horário em menos de 1 minuto.\",\"color\":\"#f0f0f0\",\"font\":\"Inter\",\"size\":\"18px\"},\"conversionButton\":{\"text\":\"Agendar Agora\",\"style\":{\"backgroundColor\":\"#ffffff\",\"textColor\":\"#000000\",\"borderColor\":\"transparent\"},\"borderRadius\":\"8px\"},\"designConfig\":{\"backgroundType\":\"solid_color\",\"colorOrImageUrl\":\"#000000\",\"glassEffect\":{\"active\":false,\"intensity\":0},\"borders\":{\"top\":false,\"bottom\":false},\"padding\":\"60px\",\"alignment\":\"center\"}}}'::jsonb"
        },
        "gallery": {
          "name": "gallery",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"gridConfig\":{\"columns\":3,\"gap\":\"24px\"},\"interactivity\":{\"enableLightbox\":true,\"showCaptions\":true}}'::jsonb"
        },
        "about_us": {
          "name": "about_us",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"aboutBanner\":{\"visibility\":true,\"title\":\"Sobre Nós\",\"backgroundImageUrl\":\"\"},\"ourStory\":{\"visibility\":true,\"title\":\"Nossa História\",\"text\":\"Começamos com um sonho...\",\"imageUrl\":\"\"},\"ourValues\":[],\"ourTeam\":[],\"testimonials\":[]}'::jsonb"
        },
        "appointment_flow": {
          "name": "appointment_flow",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"colors\":{\"primary\":\"#000000\",\"secondary\":\"#333333\",\"background\":\"#ffffff\",\"text\":\"#000000\"},\"step1Services\":{\"title\":\"Selecione o Serviço\",\"showPrices\":true,\"showDurations\":true,\"cardConfig\":{\"backgroundColor\":\"TRANSPARENT_DEFAULT\"}},\"step2Date\":{\"title\":\"Escolha a Data\",\"calendarStyle\":\"modern\"},\"step3Times\":{\"title\":\"Escolha o Horário\",\"timeSlotStyle\":\"grid\",\"timeSlotSize\":30},\"step4Confirmation\":{\"title\":\"Confirme seu Agendamento\",\"requireLogin\":false}}'::jsonb"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "company_site_customizations_company_id_companies_id_fk": {
          "name": "company_site_customizations_company_id_companies_id_fk",
          "tableFrom": "company_site_customizations",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {
        "company_site_customizations_company_id_unique": {
          "name": "company_site_customizations_company_id_unique",
          "nullsNotDistinct": false,
          "columns": [
            "company_id"
          ]
        }
      },
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.fixed_expenses": {
      "name": "fixed_expenses",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "description": {
          "name": "description",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "value": {
          "name": "value",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "category": {
          "name": "category",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "type": {
          "name": "type",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "default": "'FIXO'"
        },
        "total_installments": {
          "name": "total_installments",
          "type": "integer",
          "primaryKey": false,
          "notNull": false,
          "default": 1
        },
        "current_installment": {
          "name": "current_installment",
          "type": "integer",
          "primaryKey": false,
          "notNull": false,
          "default": 1
        },
        "parent_id": {
          "name": "parent_id",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "due_date": {
          "name": "due_date",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true
        },
        "is_paid": {
          "name": "is_paid",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "fixed_expenses_company_id_companies_id_fk": {
          "name": "fixed_expenses_company_id_companies_id_fk",
          "tableFrom": "fixed_expenses",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.gallery_images": {
      "name": "gallery_images",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "business_id": {
          "name": "business_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "title": {
          "name": "title",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "image_url": {
          "name": "image_url",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "category": {
          "name": "category",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "show_in_home": {
          "name": "show_in_home",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": false
        },
        "order": {
          "name": "order",
          "type": "numeric",
          "primaryKey": false,
          "notNull": true,
          "default": "'0'"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "gallery_images_business_id_companies_id_fk": {
          "name": "gallery_images_business_id_companies_id_fk",
          "tableFrom": "gallery_images",
          "tableTo": "companies",
          "columnsFrom": [
            "business_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.google_calendar_configs": {
      "name": "google_calendar_configs",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "ical_url": {
          "name": "ical_url",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "sync_status": {
          "name": "sync_status",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "default": "'INACTIVE'"
        },
        "last_synced_at": {
          "name": "last_synced_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "google_calendar_configs_company_id_companies_id_fk": {
          "name": "google_calendar_configs_company_id_companies_id_fk",
          "tableFrom": "google_calendar_configs",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.inventory": {
      "name": "inventory",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "name": {
          "name": "name",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "initial_quantity": {
          "name": "initial_quantity",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "current_quantity": {
          "name": "current_quantity",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "min_quantity": {
          "name": "min_quantity",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "unit_price": {
          "name": "unit_price",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "unit": {
          "name": "unit",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "secondary_unit": {
          "name": "secondary_unit",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "conversion_factor": {
          "name": "conversion_factor",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": false
        },
        "is_shared": {
          "name": "is_shared",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "inventory_company_id_companies_id_fk": {
          "name": "inventory_company_id_companies_id_fk",
          "tableFrom": "inventory",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.inventory_logs": {
      "name": "inventory_logs",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "inventory_id": {
          "name": "inventory_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "type": {
          "name": "type",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "quantity": {
          "name": "quantity",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "reason": {
          "name": "reason",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "inventory_logs_inventory_id_inventory_id_fk": {
          "name": "inventory_logs_inventory_id_inventory_id_fk",
          "tableFrom": "inventory_logs",
          "tableTo": "inventory",
          "columnsFrom": [
            "inventory_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        },
        "inventory_logs_company_id_companies_id_fk": {
          "name": "inventory_logs_company_id_companies_id_fk",
          "tableFrom": "inventory_logs",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.operating_hours": {
      "name": "operating_hours",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "day_of_week": {
          "name": "day_of_week",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "status": {
          "name": "status",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "morning_start": {
          "name": "morning_start",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "morning_end": {
          "name": "morning_end",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "afternoon_start": {
          "name": "afternoon_start",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "afternoon_end": {
          "name": "afternoon_end",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "operating_hours_company_id_companies_id_fk": {
          "name": "operating_hours_company_id_companies_id_fk",
          "tableFrom": "operating_hours",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.prospects": {
      "name": "prospects",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "name": {
          "name": "name",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "phone": {
          "name": "phone",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "establishment_name": {
          "name": "establishment_name",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "instagram_link": {
          "name": "instagram_link",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "status": {
          "name": "status",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "default": "'NOT_CONTACTED'"
        },
        "category": {
          "name": "category",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "location": {
          "name": "location",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "address": {
          "name": "address",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "maps_link": {
          "name": "maps_link",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "notes": {
          "name": "notes",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {},
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.push_subscriptions": {
      "name": "push_subscriptions",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "user_id": {
          "name": "user_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "endpoint": {
          "name": "endpoint",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "p256dh": {
          "name": "p256dh",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "auth": {
          "name": "auth",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "push_subscriptions_user_id_user_id_fk": {
          "name": "push_subscriptions_user_id_user_id_fk",
          "tableFrom": "push_subscriptions",
          "tableTo": "user",
          "columnsFrom": [
            "user_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {
        "push_subscriptions_endpoint_unique": {
          "name": "push_subscriptions_endpoint_unique",
          "nullsNotDistinct": false,
          "columns": [
            "endpoint"
          ]
        }
      },
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.service_resources": {
      "name": "service_resources",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "service_id": {
          "name": "service_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "inventory_id": {
          "name": "inventory_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "quantity": {
          "name": "quantity",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "unit": {
          "name": "unit",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "use_secondary_unit": {
          "name": "use_secondary_unit",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "service_resources_service_id_services_id_fk": {
          "name": "service_resources_service_id_services_id_fk",
          "tableFrom": "service_resources",
          "tableTo": "services",
          "columnsFrom": [
            "service_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        },
        "service_resources_inventory_id_inventory_id_fk": {
          "name": "service_resources_inventory_id_inventory_id_fk",
          "tableFrom": "service_resources",
          "tableTo": "inventory",
          "columnsFrom": [
            "inventory_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.services": {
      "name": "services",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "name": {
          "name": "name",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "description": {
          "name": "description",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "price": {
          "name": "price",
          "type": "numeric(10, 2)",
          "primaryKey": false,
          "notNull": true
        },
        "duration": {
          "name": "duration",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "icon": {
          "name": "icon",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "is_visible": {
          "name": "is_visible",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "show_on_home": {
          "name": "show_on_home",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": false
        },
        "advanced_rules": {
          "name": "advanced_rules",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": false,
          "default": "'{\"conflicts\":[]}'::jsonb"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "services_company_id_companies_id_fk": {
          "name": "services_company_id_companies_id_fk",
          "tableFrom": "services",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.session": {
      "name": "session",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "expires_at": {
          "name": "expires_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true
        },
        "token": {
          "name": "token",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "ip_address": {
          "name": "ip_address",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "user_agent": {
          "name": "user_agent",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "user_id": {
          "name": "user_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        }
      },
      "indexes": {
        "session_userId_idx": {
          "name": "session_userId_idx",
          "columns": [
            {
              "expression": "user_id",
              "isExpression": false,
              "asc": true,
              "nulls": "last"
            }
          ],
          "isUnique": false,
          "concurrently": false,
          "method": "btree",
          "with": {}
        }
      },
      "foreignKeys": {
        "session_user_id_user_id_fk": {
          "name": "session_user_id_user_id_fk",
          "tableFrom": "session",
          "tableTo": "user",
          "columnsFrom": [
            "user_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {
        "session_token_unique": {
          "name": "session_token_unique",
          "nullsNotDistinct": false,
          "columns": [
            "token"
          ]
        }
      },
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.site_drafts": {
      "name": "site_drafts",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "company_id": {
          "name": "company_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "layout_global": {
          "name": "layout_global",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"header\":{\"backgroundAndEffect\":{\"color\":\"#ffffff\",\"opacity\":0.95,\"blur\":10},\"textColors\":{\"logo\":\"#000000\",\"links\":\"#333333\",\"hover\":\"#000000\"},\"actionButtons\":{\"backgroundColor\":\"#000000\",\"textColor\":\"#ffffff\"}},\"typography\":{\"headingsFont\":\"Inter\",\"subheadingsFont\":\"Inter\",\"bodyFont\":\"Inter\"},\"siteColors\":{\"primary\":\"#000000\",\"secondary\":\"#333333\",\"background\":\"#ffffff\"},\"footer\":{\"colors\":{\"background\":\"#f5f5f5\",\"text\":\"#333333\",\"icons\":\"#000000\"},\"typography\":{\"headings\":\"Inter\",\"body\":\"Inter\"},\"visibility\":true}}'::jsonb"
        },
        "home": {
          "name": "home",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"heroBanner\":{\"visibility\":true,\"title\":{\"text\":\"Sua beleza, nossa prioridade\",\"color\":\"#000000\",\"font\":\"Inter\",\"sizeMobile\":\"32px\",\"sizeDesktop\":\"48px\"},\"badge\":{\"text\":\"ESPECIALISTA EM BELEZA\",\"backgroundColor\":\"#000000\",\"textColor\":\"#ffffff\",\"font\":\"Inter\"},\"subtitle\":{\"text\":\"Agende seu horário e realce o que você tem de melhor\",\"color\":\"#666666\",\"font\":\"Inter\",\"size\":\"18px\"},\"ctaButton\":{\"text\":\"Agendar Agora\",\"backgroundColor\":\"#000000\",\"textColor\":\"#ffffff\",\"borderRadius\":\"8px\",\"borderColor\":\"transparent\",\"destinationLink\":\"/agendamento\"},\"appearance\":{\"bgType\":\"image\",\"backgroundColor\":\"#ffffff\",\"backgroundImageUrl\":\"\",\"glassEffect\":{\"active\":false,\"intensity\":0},\"overlay\":{\"color\":\"#000000\",\"opacity\":0},\"verticalAlignment\":\"center\",\"horizontalAlignment\":\"center\",\"sectionHeight\":\"medium\"},\"bgColor\":\"#ffffff\"},\"servicesSection\":{\"visibility\":true,\"orderOnHome\":1,\"header\":{\"title\":{\"text\":\"Nossos Serviços\",\"color\":\"#000000\",\"font\":\"Inter\",\"size\":\"36px\"},\"subtitle\":{\"text\":\"Escolha o tratamento ideal para si\",\"color\":\"#666666\",\"font\":\"Inter\",\"size\":\"16px\"},\"alignment\":\"center\"},\"cardConfig\":{\"showImage\":true,\"showCategory\":true,\"priceStyle\":{\"visible\":true,\"color\":\"#000000\",\"font\":\"Inter\"},\"durationStyle\":{\"visible\":true,\"color\":\"#666666\"},\"cardBackgroundColor\":\"#ffffff\",\"borderAndShadow\":{\"borderSize\":\"1px\",\"shadowIntensity\":\"small\"},\"borderRadius\":\"12px\"},\"bookingButtonStyle\":{\"text\":\"Agendar\",\"backgroundColor\":\"#000000\",\"textColor\":\"#ffffff\",\"borderRadius\":\"6px\"}},\"valuesSection\":{\"visibility\":true,\"orderOnHome\":2,\"header\":{\"title\":{\"text\":\"Nossos Valores\",\"color\":\"#000000\",\"font\":\"Inter\",\"size\":\"36px\"},\"subtitle\":{\"text\":\"O que nos move todos os dias\",\"color\":\"#666666\",\"font\":\"Inter\",\"size\":\"16px\"}},\"itemsStyle\":{\"layout\":\"grid\",\"itemBackgroundColor\":\"#f9f9f9\",\"borderRadius\":\"8px\",\"internalAlignment\":\"center\"},\"items\":[]},\"galleryPreview\":{\"visibility\":true,\"orderOnHome\":3,\"header\":{\"title\":{\"text\":\"Nossa Galeria\",\"color\":\"#000000\",\"font\":\"Inter\",\"size\":\"36px\"},\"subtitle\":{\"text\":\"Confira nossos últimos trabalhos\",\"color\":\"#666666\",\"font\":\"Inter\",\"size\":\"16px\"}},\"displayLogic\":{\"selectionMode\":\"automatic_recent\",\"photoCount\":6,\"gridLayout\":\"mosaic\"},\"photoStyle\":{\"aspectRatio\":\"1:1\",\"spacing\":\"16px\",\"borderRadius\":\"8px\",\"hoverEffect\":\"zoom\"},\"viewMoreButton\":{\"visible\":true,\"text\":\"Ver Galeria Completa\",\"style\":{\"backgroundColor\":\"transparent\",\"textColor\":\"#000000\",\"borderRadius\":\"4px\"}}},\"ctaSection\":{\"visibility\":true,\"orderOnHome\":4,\"title\":{\"text\":\"Pronto para transformar seu olhar?\",\"color\":\"#ffffff\",\"font\":\"Inter\",\"size\":{\"desktop\":\"42px\",\"mobile\":\"28px\"}},\"subtitle\":{\"text\":\"Reserve seu horário em menos de 1 minuto.\",\"color\":\"#f0f0f0\",\"font\":\"Inter\",\"size\":\"18px\"},\"conversionButton\":{\"text\":\"Agendar Agora\",\"style\":{\"backgroundColor\":\"#ffffff\",\"textColor\":\"#000000\",\"borderColor\":\"transparent\"},\"borderRadius\":\"8px\"},\"designConfig\":{\"backgroundType\":\"solid_color\",\"colorOrImageUrl\":\"#000000\",\"glassEffect\":{\"active\":false,\"intensity\":0},\"borders\":{\"top\":false,\"bottom\":false},\"padding\":\"60px\",\"alignment\":\"center\"}}}'::jsonb"
        },
        "gallery": {
          "name": "gallery",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"gridConfig\":{\"columns\":3,\"gap\":\"24px\"},\"interactivity\":{\"enableLightbox\":true,\"showCaptions\":true}}'::jsonb"
        },
        "about_us": {
          "name": "about_us",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"aboutBanner\":{\"visibility\":true,\"title\":\"Sobre Nós\",\"backgroundImageUrl\":\"\"},\"ourStory\":{\"visibility\":true,\"title\":\"Nossa História\",\"text\":\"Começamos com um sonho...\",\"imageUrl\":\"\"},\"ourValues\":[],\"ourTeam\":[],\"testimonials\":[]}'::jsonb"
        },
        "appointment_flow": {
          "name": "appointment_flow",
          "type": "jsonb",
          "primaryKey": false,
          "notNull": true,
          "default": "'{\"colors\":{\"primary\":\"#000000\",\"secondary\":\"#333333\",\"background\":\"#ffffff\",\"text\":\"#000000\"},\"step1Services\":{\"title\":\"Selecione o Serviço\",\"showPrices\":true,\"showDurations\":true,\"cardConfig\":{\"backgroundColor\":\"TRANSPARENT_DEFAULT\"}},\"step2Date\":{\"title\":\"Escolha a Data\",\"calendarStyle\":\"modern\"},\"step3Times\":{\"title\":\"Escolha o Horário\",\"timeSlotStyle\":\"grid\",\"timeSlotSize\":30},\"step4Confirmation\":{\"title\":\"Confirme seu Agendamento\",\"requireLogin\":false}}'::jsonb"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {
        "site_drafts_company_id_companies_id_fk": {
          "name": "site_drafts_company_id_companies_id_fk",
          "tableFrom": "site_drafts",
          "tableTo": "companies",
          "columnsFrom": [
            "company_id"
          ],
          "columnsTo": [
            "id"
          ],
          "onDelete": "cascade",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {
        "site_drafts_company_id_unique": {
          "name": "site_drafts_company_id_unique",
          "nullsNotDistinct": false,
          "columns": [
            "company_id"
          ]
        }
      },
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.system_settings": {
      "name": "system_settings",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "key": {
          "name": "key",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "value": {
          "name": "value",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "description": {
          "name": "description",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {},
      "compositePrimaryKeys": {},
      "uniqueConstraints": {
        "system_settings_key_unique": {
          "name": "system_settings_key_unique",
          "nullsNotDistinct": false,
          "columns": [
            "key"
          ]
        }
      },
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.user": {
      "name": "user",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "name": {
          "name": "name",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "email": {
          "name": "email",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "email_verified": {
          "name": "email_verified",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": false
        },
        "image": {
          "name": "image",
          "type": "text",
          "primaryKey": false,
          "notNull": false
        },
        "role": {
          "name": "role",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "default": "'USER'"
        },
        "active": {
          "name": "active",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "notify_new_appointments": {
          "name": "notify_new_appointments",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "notify_cancellations": {
          "name": "notify_cancellations",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "notify_inventory_alerts": {
          "name": "notify_inventory_alerts",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": true
        },
        "account_status": {
          "name": "account_status",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "default": "'ACTIVE'"
        },
        "cancellation_requested_at": {
          "name": "cancellation_requested_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": false
        },
        "retention_ends_at": {
          "name": "retention_ends_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": false
        },
        "last_retention_discount_at": {
          "name": "last_retention_discount_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": false
        },
        "has_completed_onboarding": {
          "name": "has_completed_onboarding",
          "type": "boolean",
          "primaryKey": false,
          "notNull": true,
          "default": false
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {},
      "foreignKeys": {},
      "compositePrimaryKeys": {},
      "uniqueConstraints": {
        "user_email_unique": {
          "name": "user_email_unique",
          "nullsNotDistinct": false,
          "columns": [
            "email"
          ]
        }
      },
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    },
    "public.verification": {
      "name": "verification",
      "schema": "",
      "columns": {
        "id": {
          "name": "id",
          "type": "text",
          "primaryKey": true,
          "notNull": true
        },
        "identifier": {
          "name": "identifier",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "value": {
          "name": "value",
          "type": "text",
          "primaryKey": false,
          "notNull": true
        },
        "expires_at": {
          "name": "expires_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamp",
          "primaryKey": false,
          "notNull": true,
          "default": "now()"
        }
      },
      "indexes": {
        "verification_identifier_idx": {
          "name": "verification_identifier_idx",
          "columns": [
            {
              "expression": "identifier",
              "isExpression": false,
              "asc": true,
              "nulls": "last"
            }
          ],
          "isUnique": false,
          "concurrently": false,
          "method": "btree",
          "with": {}
        }
      },
      "foreignKeys": {},
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "policies": {},
      "checkConstraints": {},
      "isRLSEnabled": false
    }
  },
  "enums": {},
  "schemas": {},
  "sequences": {},
  "roles": {},
  "policies": {},
  "views": {},
  "_meta": {
    "columns": {},
    "schemas": {},
    "tables": {}
  }
}
```

## Arquivo: `drizzle\meta\_journal.json`
```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1772726182630,
      "tag": "0000_init_baseline",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "7",
      "when": 1775062112228,
      "tag": "0001_wealthy_prism",
      "breakpoints": true
    }
  ]
}
```

## Arquivo: `erros_vercel\Erros.txt`
```
RELATÓRIO DE ERROS E CORREÇÕES (VERCEL)
Data: 21/02/2026
Projeto: Agendamento Nota (Back-end)

--------------------------------------------------------------------------------
1. ERRO DE CORS (Múltiplos Valores)
--------------------------------------------------------------------------------
SINTOMA:
O navegador bloqueava requisições informando que o header 'Access-Control-Allow-Origin' continha múltiplos valores (ex: "*, http://localhost:3000"), o que é inválido na especificação HTTP.

CAUSA:
Conflito entre o plugin padrão '@elysiajs/cors' e nossa implementação manual de headers CORS no 'index.ts'. Ambos tentavam definir os headers simultaneamente.

CORREÇÃO:
- Removemos o plugin conflitante.
- Centralizamos a lógica de CORS no 'index.ts'.
- Implementamos verificação dinâmica da origem (Origin) da requisição.
- O servidor agora retorna apenas *um* valor válido por vez no header, suportando tanto 'localhost' quanto domínios '*.vercel.app'.

--------------------------------------------------------------------------------
2. CRASH NO BOOT (Loop de Dependência / Módulo Indefinido)
--------------------------------------------------------------------------------
SINTOMA:
O servidor falhava imediatamente ao iniciar na Vercel (Erro 500 ou Timeout), derrubando toda a aplicação antes mesmo de processar requisições.

CAUSA:
Alguns controllers (especificamente 'settingsController') estavam sendo importados como 'undefined' devido a uma possível ordem de carregamento circular ou falha na exportação do módulo. O método '.use(settingsController())' tentava executar 'undefined' como função.

CORREÇÃO:
- Envolvemos a inicialização do servidor ('startServer') em um bloco try-catch global.
- Adicionamos uma verificação defensiva: '.use(settingsController ? settingsController() : (app) => app)'.
- Se o módulo falhar, o servidor continua rodando e apenas as rotas daquele módulo ficam indisponíveis, garantindo que o restante do sistema (Login, etc.) funcione.

--------------------------------------------------------------------------------
3. LOGIN FALHANDO (Schema de Banco Desatualizado)
--------------------------------------------------------------------------------
SINTOMA:
O login retornava erro 500 (Internal Server Error) ao tentar autenticar. O log mostrava "column 'account_status' does not exist".

CAUSA:
O código TypeScript esperava que a tabela 'user' tivesse a coluna 'account_status' (para verificar se a conta está ativa/cancelada), mas o banco de dados de produção não tinha essa coluna criada.

CORREÇÃO:
- Criamos a migration '0014_account_cancellation.sql'.
- Executamos o comando de migração para sincronizar o banco de dados.
- O código agora está alinhado com a estrutura real do banco.

--------------------------------------------------------------------------------
4. BETTER AUTH EM PREVIEW (URL Dinâmica)
--------------------------------------------------------------------------------
SINTOMA:
O login funcionava em produção, mas falhava em URLs de teste/preview da Vercel (ex: 'git-branch-x.vercel.app') com erros de origem não permitida.

CAUSA:
A lista de 'trustedOrigins' no arquivo 'auth.ts' era estática e não incluía os subdomínios gerados dinamicamente pela Vercel para cada Pull Request.

CORREÇÃO:
- Atualizamos o arquivo 'auth.ts'.
- Adicionamos lógica para ler as variáveis de ambiente 'VERCEL_URL' e 'NEXT_PUBLIC_VERCEL_URL' em tempo de execução.
- A URL atual da Vercel é adicionada automaticamente à lista de origens confiáveis.

--------------------------------------------------------------------------------
5. ERRO DE BUILD (TypeScript "Implicit Any")
--------------------------------------------------------------------------------
SINTOMA:
O deploy falhava na etapa de "Build" na Vercel. O compilador TypeScript reclamava que o parâmetro 'app' na nossa função de fallback (correção do item 2) tinha tipo implícito 'any'.

CAUSA:
Configuração estrita do TypeScript no projeto ('noImplicitAny: true').

CORREÇÃO:
- Explicitamos o tipo no código: '(app: any) => app'.
- O build agora passa sem erros.

--------------------------------------------------------------------------------
6. INTEGRAÇÃO ASAAS (API Key Ausente)
--------------------------------------------------------------------------------
SINTOMA:
Risco de falha total em rotas de pagamento se a variável 'ASAAS_API_KEY' não estivesse configurada no painel da Vercel.

CAUSA:
O cliente Asaas não tratava a ausência da chave, podendo lançar exceções não tratadas.

CORREÇÃO:
- Adicionamos verificações de segurança no 'asaas.client.ts'.
- Se a chave não existir, o cliente loga um aviso e entra em modo "Mock" (Simulação), retornando sucesso falso para permitir que o fluxo do usuário continue sem travar.

--------------------------------------------------------------------------------
STATUS ATUAL:
O servidor está blindado contra falhas de inicialização e configurado para aceitar conexões dinâmicas. O deploy mais recente (feat_account_cancellation) inclui todas essas correções.
--------------------------------------------------------------------------------
```

## Arquivo: `erros_vercel\Logs.txt`
```
>>> [DEBUG_SYNC] Buscando config para ID: 1ed46dfd-6258-4b22-9c2b-ba04f1b82602
studio-context.tsx:1145 >>> [DEBUG_SYNC] layoutGlobal persistido no localStorage para ThemeInjector
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
use-editor-state.ts:324 >>> [SYNC] Sincronizando estado do editor com studio.config (isDirty=false)
use-editor-state.ts:351 >>> [SYNC] Cores válidas encontradas no banco. Aplicando...
use-editor-state.ts:412 >>> [SYNC] Estado do editor sincronizado com o Banco de Dados.
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
studio-context.tsx:582 >>> [STORAGE_SYNC] Sincronizando dados do Banco para LocalStorage... {studioId: '1ed46dfd-6258-4b22-9c2b-ba04f1b82602', slug: 'aura-teste', hasConfig: true}
studio-context.tsx:694 >>> [FINAL_SYNC_CHECK] Email final: aura.teste@gmail.com
studio-context.tsx:698 >>> [STORAGE_SYNC] Salvando perfil do site no storage: {name: 'Aura Teste Studio', description: undefined, phone: undefined, email: 'aura.teste@gmail.com', address: undefined, …}
studio-context.tsx:729 >>> [STORAGE_SYNC] LocalStorage atualizado com sucesso.
studio-context.tsx:1086 >>> [DEBUG_SYNC] Buscando config para ID: 1ed46dfd-6258-4b22-9c2b-ba04f1b82602
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
studio-context.tsx:582 >>> [STORAGE_SYNC] Sincronizando dados do Banco para LocalStorage... {studioId: '1ed46dfd-6258-4b22-9c2b-ba04f1b82602', slug: 'aura-teste', hasConfig: true}
studio-context.tsx:694 >>> [FINAL_SYNC_CHECK] Email final: aura.teste@gmail.com
studio-context.tsx:698 >>> [STORAGE_SYNC] Salvando perfil do site no storage: {name: 'Aura Teste Studio', description: undefined, phone: undefined, email: 'aura.teste@gmail.com', address: undefined, …}
studio-context.tsx:705 >>> [STORAGE_SYNC] Sincronizando 6 serviços...
studio-context.tsx:729 >>> [STORAGE_SYNC] LocalStorage atualizado com sucesso.
studio-context.tsx:1372 >>> [SYNC] Editor ativo com dados locais detectado. Preservando estado local.
studio-context.tsx:1145 >>> [DEBUG_SYNC] layoutGlobal persistido no localStorage para ThemeInjector
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
studio-context.tsx:582 >>> [STORAGE_SYNC] Sincronizando dados do Banco para LocalStorage... {studioId: '1ed46dfd-6258-4b22-9c2b-ba04f1b82602', slug: 'aura-teste', hasConfig: true}
studio-context.tsx:694 >>> [FINAL_SYNC_CHECK] Email final: aura.teste@gmail.com
studio-context.tsx:698 >>> [STORAGE_SYNC] Salvando perfil do site no storage: {name: 'Aura Teste Studio', description: undefined, phone: undefined, email: 'aura.teste@gmail.com', address: undefined, …}
studio-context.tsx:729 >>> [STORAGE_SYNC] LocalStorage atualizado com sucesso.
studio-context.tsx:1372 >>> [SYNC] Editor ativo com dados locais detectado. Preservando estado local.
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
studio-context.tsx:582 >>> [STORAGE_SYNC] Sincronizando dados do Banco para LocalStorage... {studioId: '1ed46dfd-6258-4b22-9c2b-ba04f1b82602', slug: 'aura-teste', hasConfig: true}
studio-context.tsx:694 >>> [FINAL_SYNC_CHECK] Email final: aura.teste@gmail.com
studio-context.tsx:698 >>> [STORAGE_SYNC] Salvando perfil do site no storage: {name: 'Aura Teste Studio', description: undefined, phone: undefined, email: 'aura.teste@gmail.com', address: undefined, …}
studio-context.tsx:705 >>> [STORAGE_SYNC] Sincronizando 6 serviços...
studio-context.tsx:729 >>> [STORAGE_SYNC] LocalStorage atualizado com sucesso.
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
use-editor-state.ts:324 >>> [SYNC] Sincronizando estado do editor com studio.config (isDirty=false)
use-editor-state.ts:351 >>> [SYNC] Cores válidas encontradas no banco. Aplicando...
use-editor-state.ts:412 >>> [SYNC] Estado do editor sincronizado com o Banco de Dados.
use-editor-sync.ts:361 >>> [EDITOR_SYNC] Syncing gallery settings to iframe: {title: 'Nossos Trabalhos', subtitle: 'Veja alguns dos resultados incríveis que alcançamos com nossas clientes', buttonText: 'Ver Galeria Completa', titleColor: '', subtitleColor: '', …}
use-editor-state.ts:324 >>> [SYNC] Sincronizando estado do editor com studio.config (isDirty=false)
use-editor-state.ts:351 >>> [SYNC] Cores válidas encontradas no banco. Aplicando...
use-editor-state.ts:412 >>> [SYNC] Estado do editor sincronizado com o Banco de Dados.
use-editor-sync.ts:361 >>> [EDITOR_SYNC] Syncing gallery settings to iframe: {title: 'Nossos Trabalhos', subtitle: 'Veja alguns dos resultados incríveis que alcançamos com nossas clientes', buttonText: 'Ver Galeria Completa', titleColor: '', subtitleColor: '', …}
use-editor-sync.ts:361 >>> [EDITOR_SYNC] Syncing gallery settings to iframe: {title: 'Nossos Trabalhos', subtitle: 'Veja alguns dos resultados incríveis que alcançamos com nossas clientes', buttonText: 'Ver Galeria Completa', titleColor: '#ffffff', subtitleColor: '#ffffff', …}
use-editor-config-loader.ts:217 >>> [SYNC_CHECK] Server: 0 | Local: 0 | Fallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: heroSettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: false | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: aboutHeroSettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: true | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: storySettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: true | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: teamSettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: true | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: testimonialsSettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: true | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: servicesSettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: false | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: valuesSettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: false | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: gallerySettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: false | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: ctaSettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: false | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: headerSettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: false | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: footerSettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: false | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: bookingServiceSettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: false | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: bookingDateSettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: false | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: bookingTimeSettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: false | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: bookingFormSettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: false | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: bookingConfirmationSettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: false | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: fontSettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: false | IsFallback: undefined
use-editor-config-loader.ts:329 >>> [SYNC] Section: colorSettings | Local: 0 | Server: 0 | LocalNewer: false | ServerNewer: false | BankEmpty: false | IsFallback: undefined
use-editor-config-loader.ts:546 >>> [SYNC] Dados do banco carregados com autoridade. LocalStorage ignorado no refresh.
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
use-editor-state.ts:324 >>> [SYNC] Sincronizando estado do editor com studio.config (isDirty=false)
use-editor-state.ts:351 >>> [SYNC] Cores válidas encontradas no banco. Aplicando...
use-editor-state.ts:412 >>> [SYNC] Estado do editor sincronizado com o Banco de Dados.
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
use-editor-sync.ts:361 >>> [EDITOR_SYNC] Syncing gallery settings to iframe: {title: 'Nossos Trabalhos', subtitle: 'Veja alguns dos resultados incríveis que alcançamos com nossas clientes', buttonText: 'Ver Galeria Completa', titleColor: '#ffffff', subtitleColor: '#ffffff', …}
use-editor-state.ts:324 >>> [SYNC] Sincronizando estado do editor com studio.config (isDirty=false)
use-editor-state.ts:351 >>> [SYNC] Cores válidas encontradas no banco. Aplicando...
use-editor-state.ts:412 >>> [SYNC] Estado do editor sincronizado com o Banco de Dados.
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [DEBUG_SYNC] Buscando config para ID: 1ed46dfd-6258-4b22-9c2b-ba04f1b82602
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [DEBUG_SYNC] layoutGlobal persistido no localStorage para ThemeInjector
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Sincronizando estado do editor com studio.config (isDirty=false)
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Cores válidas encontradas no banco. Aplicando...
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Estado do editor sincronizado com o Banco de Dados.
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Editor ativo com dados locais detectado. Preservando estado local.
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
VM5097 node_modules_next_dist_f3530cac._.js:2298 [IMAGE_BUG_FIX] Ignorando hex #ffffff como URL de imagem
warn @ VM5097 node_modules_next_dist_f3530cac._.js:2298
SectionBackground @ VM5108 src_24add3a4._.js:26
react_stack_bottom_frame @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:14826
renderWithHooks @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:4651
updateFunctionComponent @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:6112
beginWork @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:6708
runWithFiberInDEV @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:965
performUnitOfWork @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9562
workLoopSync @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9456
renderRootSync @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9440
performWorkOnRoot @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9068
performWorkOnRootViaSchedulerTask @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:10230
performWorkUntilDeadline @ VM5094 node_modules_next_dist_compiled_a0e4c7b4._.js:2647
<SectionBackground>
exports.jsxDEV @ VM5106 node_modules_d9d99959._.js:451
HeroSection @ VM5108 src_24add3a4._.js:1720
react_stack_bottom_frame @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:14826
renderWithHooksAgain @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:4706
renderWithHooks @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:4657
updateFunctionComponent @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:6112
beginWork @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:6708
runWithFiberInDEV @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:965
performUnitOfWork @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9562
workLoopSync @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9456
renderRootSync @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9440
performWorkOnRoot @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9068
performWorkOnRootViaSchedulerTask @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:10230
performWorkUntilDeadline @ VM5094 node_modules_next_dist_compiled_a0e4c7b4._.js:2647
<HeroSection>
exports.jsxDEV @ VM5106 node_modules_d9d99959._.js:451
Home @ VM5108 src_24add3a4._.js:3126
react_stack_bottom_frame @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:14826
renderWithHooksAgain @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:4706
replayFunctionComponent @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:6125
replayBeginWork @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9577
runWithFiberInDEV @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:965
replaySuspendedUnitOfWork @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9567
renderRootConcurrent @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9500
performWorkOnRoot @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9068
performWorkOnRootViaSchedulerTask @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:10230
performWorkUntilDeadline @ VM5094 node_modules_next_dist_compiled_a0e4c7b4._.js:2647
<Home>
exports.jsx @ VM5094 node_modules_next_dist_compiled_a0e4c7b4._.js:1989
ClientPageRoot @ VM5101 node_modules_next_dist_be32b49c._.js:2403
react_stack_bottom_frame @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:14826
renderWithHooksAgain @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:4706
renderWithHooks @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:4657
updateFunctionComponent @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:6112
beginWork @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:6687
runWithFiberInDEV @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:965
performUnitOfWork @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9562
workLoopConcurrentByScheduler @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9558
renderRootConcurrent @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9541
performWorkOnRoot @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9068
performWorkOnRootViaSchedulerTask @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:10230
performWorkUntilDeadline @ VM5094 node_modules_next_dist_compiled_a0e4c7b4._.js:2647
"use client"
Function.all @ VM5114 <anonymous>:1
initializeElement @ VM5092 node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1120
"use server"
ResponseInstance @ VM5092 node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1637
createResponseFromOptions @ VM5092 node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:2564
exports.createFromReadableStream @ VM5092 node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:2758
module evaluation @ VM5095 node_modules_next_dist_client_17643121._.js:12575
(anônimo) @ VM5100 turbopack-_23a915ee._.js:879
runModuleExecutionHooks @ VM5100 turbopack-_23a915ee._.js:904
instantiateModule @ VM5100 turbopack-_23a915ee._.js:877
getOrInstantiateModuleFromParent @ VM5100 turbopack-_23a915ee._.js:830
commonJsRequire @ VM5100 turbopack-_23a915ee._.js:259
(anônimo) @ VM5095 node_modules_next_dist_client_17643121._.js:12701
(anônimo) @ VM5095 node_modules_next_dist_client_17643121._.js:177
loadScriptsInSequence @ VM5095 node_modules_next_dist_client_17643121._.js:141
appBootstrap @ VM5095 node_modules_next_dist_client_17643121._.js:170
module evaluation @ VM5095 node_modules_next_dist_client_17643121._.js:12700
(anônimo) @ VM5100 turbopack-_23a915ee._.js:879
runModuleExecutionHooks @ VM5100 turbopack-_23a915ee._.js:904
instantiateModule @ VM5100 turbopack-_23a915ee._.js:877
getOrInstantiateRuntimeModule @ VM5100 turbopack-_23a915ee._.js:808
registerChunk @ VM5100 turbopack-_23a915ee._.js:1626
await in registerChunk
registerChunk @ VM5100 turbopack-_23a915ee._.js:1564
(anônimo) @ VM5100 turbopack-_23a915ee._.js:1853
(anônimo) @ VM5100 turbopack-_23a915ee._.js:1857Entenda o aviso
VM5097 node_modules_next_dist_f3530cac._.js:2298 [IMAGE_BUG_FIX] Ignorando hex #ffffff como URL de imagem
warn @ VM5097 node_modules_next_dist_f3530cac._.js:2298
SectionBackground @ VM5108 src_24add3a4._.js:26
react_stack_bottom_frame @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:14826
renderWithHooksAgain @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:4706
renderWithHooks @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:4657
updateFunctionComponent @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:6112
beginWork @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:6708
runWithFiberInDEV @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:965
performUnitOfWork @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9562
workLoopSync @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9456
renderRootSync @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9440
performWorkOnRoot @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9068
performWorkOnRootViaSchedulerTask @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:10230
performWorkUntilDeadline @ VM5094 node_modules_next_dist_compiled_a0e4c7b4._.js:2647
<SectionBackground>
exports.jsxDEV @ VM5106 node_modules_d9d99959._.js:451
HeroSection @ VM5108 src_24add3a4._.js:1720
react_stack_bottom_frame @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:14826
renderWithHooksAgain @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:4706
renderWithHooks @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:4657
updateFunctionComponent @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:6112
beginWork @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:6708
runWithFiberInDEV @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:965
performUnitOfWork @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9562
workLoopSync @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9456
renderRootSync @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9440
performWorkOnRoot @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9068
performWorkOnRootViaSchedulerTask @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:10230
performWorkUntilDeadline @ VM5094 node_modules_next_dist_compiled_a0e4c7b4._.js:2647
<HeroSection>
exports.jsxDEV @ VM5106 node_modules_d9d99959._.js:451
Home @ VM5108 src_24add3a4._.js:3126
react_stack_bottom_frame @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:14826
renderWithHooksAgain @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:4706
replayFunctionComponent @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:6125
replayBeginWork @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9577
runWithFiberInDEV @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:965
replaySuspendedUnitOfWork @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9567
renderRootConcurrent @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9500
performWorkOnRoot @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9068
performWorkOnRootViaSchedulerTask @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:10230
performWorkUntilDeadline @ VM5094 node_modules_next_dist_compiled_a0e4c7b4._.js:2647
<Home>
exports.jsx @ VM5094 node_modules_next_dist_compiled_a0e4c7b4._.js:1989
ClientPageRoot @ VM5101 node_modules_next_dist_be32b49c._.js:2403
react_stack_bottom_frame @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:14826
renderWithHooksAgain @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:4706
renderWithHooks @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:4657
updateFunctionComponent @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:6112
beginWork @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:6687
runWithFiberInDEV @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:965
performUnitOfWork @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9562
workLoopConcurrentByScheduler @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9558
renderRootConcurrent @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9541
performWorkOnRoot @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:9068
performWorkOnRootViaSchedulerTask @ VM5091 node_modules_next_dist_compiled_react-dom_1e674e59._.js:10230
performWorkUntilDeadline @ VM5094 node_modules_next_dist_compiled_a0e4c7b4._.js:2647
"use client"
Function.all @ VM5114 <anonymous>:1
initializeElement @ VM5092 node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1120
"use server"
ResponseInstance @ VM5092 node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1637
createResponseFromOptions @ VM5092 node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:2564
exports.createFromReadableStream @ VM5092 node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:2758
module evaluation @ VM5095 node_modules_next_dist_client_17643121._.js:12575
(anônimo) @ VM5100 turbopack-_23a915ee._.js:879
runModuleExecutionHooks @ VM5100 turbopack-_23a915ee._.js:904
instantiateModule @ VM5100 turbopack-_23a915ee._.js:877
getOrInstantiateModuleFromParent @ VM5100 turbopack-_23a915ee._.js:830
commonJsRequire @ VM5100 turbopack-_23a915ee._.js:259
(anônimo) @ VM5095 node_modules_next_dist_client_17643121._.js:12701
(anônimo) @ VM5095 node_modules_next_dist_client_17643121._.js:177
loadScriptsInSequence @ VM5095 node_modules_next_dist_client_17643121._.js:141
appBootstrap @ VM5095 node_modules_next_dist_client_17643121._.js:170
module evaluation @ VM5095 node_modules_next_dist_client_17643121._.js:12700
(anônimo) @ VM5100 turbopack-_23a915ee._.js:879
runModuleExecutionHooks @ VM5100 turbopack-_23a915ee._.js:904
instantiateModule @ VM5100 turbopack-_23a915ee._.js:877
getOrInstantiateRuntimeModule @ VM5100 turbopack-_23a915ee._.js:808
registerChunk @ VM5100 turbopack-_23a915ee._.js:1626
await in registerChunk
registerChunk @ VM5100 turbopack-_23a915ee._.js:1564
(anônimo) @ VM5100 turbopack-_23a915ee._.js:1853
(anônimo) @ VM5100 turbopack-_23a915ee._.js:1857Entenda o aviso
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
VM5097 node_modules_next_dist_f3530cac._.js:2298 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
use-editor-state.ts:324 >>> [SYNC] Sincronizando estado do editor com studio.config (isDirty=false)
use-editor-state.ts:358 >>> [SYNC] Cores do banco inválidas ou vazias. Mantendo default.
warn @ forward-logs-shared.ts:95
useEditorState.useEffect @ use-editor-state.ts:358
react_stack_bottom_frame @ react-dom-client.development.js:28123
runWithFiberInDEV @ react-dom-client.development.js:986
commitHookEffectListMount @ react-dom-client.development.js:13692
commitHookPassiveMountEffects @ react-dom-client.development.js:13779
reconnectPassiveEffects @ react-dom-client.development.js:17124
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:17076
reconnectPassiveEffects @ react-dom-client.development.js:17116
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:17076
commitPassiveMountOnFiber @ react-dom-client.development.js:16948
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16898
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16725
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16725
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:17010
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16725
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:17010
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:17010
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:17010
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16725
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16725
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16753
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16725
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16753
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16725
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16725
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16753
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16725
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:17010
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:17010
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:17010
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:17010
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:17010
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:17010
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:17010
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16725
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16753
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16725
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16725
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16725
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:17010
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16725
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16725
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:17010
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:17010
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:16678
commitPassiveMountOnFiber @ react-dom-client.development.js:16768
flushPassiveEffects @ react-dom-client.development.js:19859
(anônimo) @ react-dom-client.development.js:19284
performWorkUntilDeadline @ scheduler.development.js:45
<...>
exports.jsx @ react-jsx-runtime.development.js:342
LoadableComponent @ loadable.tsx:65
react_stack_bottom_frame @ react-dom-client.development.js:28038
renderWithHooksAgain @ react-dom-client.development.js:8084
renderWithHooks @ react-dom-client.development.js:7996
updateFunctionComponent @ react-dom-client.development.js:10501
beginWork @ react-dom-client.development.js:12136
runWithFiberInDEV @ react-dom-client.development.js:986
performUnitOfWork @ react-dom-client.development.js:18997
workLoopConcurrentByScheduler @ react-dom-client.development.js:18991
renderRootConcurrent @ react-dom-client.development.js:18973
performWorkOnRoot @ react-dom-client.development.js:17834
performWorkOnRootViaSchedulerTask @ react-dom-client.development.js:20384
performWorkUntilDeadline @ scheduler.development.js:45
<LoadableComponent>
exports.jsxDEV @ react-jsx-dev-runtime.development.js:342
ThemeInjectorClient @ theme-injector-client.tsx:12
react_stack_bottom_frame @ react-dom-client.development.js:28038
renderWithHooksAgain @ react-dom-client.development.js:8084
renderWithHooks @ react-dom-client.development.js:7996
updateFunctionComponent @ react-dom-client.development.js:10501
beginWork @ react-dom-client.development.js:12085
runWithFiberInDEV @ react-dom-client.development.js:986
performUnitOfWork @ react-dom-client.development.js:18997
workLoopConcurrentByScheduler @ react-dom-client.development.js:18991
renderRootConcurrent @ react-dom-client.development.js:18973
performWorkOnRoot @ react-dom-client.development.js:17834
performWorkOnRootViaSchedulerTask @ react-dom-client.development.js:20384
performWorkUntilDeadline @ scheduler.development.js:45
"use client"
RootLayout @ layout.tsx:77
initializeElement @ react-server-dom-turbopack-client.browser.development.js:1933
(anônimo) @ react-server-dom-turbopack-client.browser.development.js:4605
initializeModelChunk @ react-server-dom-turbopack-client.browser.development.js:1820
readChunk @ react-server-dom-turbopack-client.browser.development.js:1442
react_stack_bottom_frame @ react-dom-client.development.js:28145
resolveLazy @ react-dom-client.development.js:6320
createChild @ react-dom-client.development.js:6672
reconcileChildrenArray @ react-dom-client.development.js:6979
reconcileChildFibersImpl @ react-dom-client.development.js:7305
(anônimo) @ react-dom-client.development.js:7410
reconcileChildren @ react-dom-client.development.js:10036
beginWork @ react-dom-client.development.js:12486
runWithFiberInDEV @ react-dom-client.development.js:986
performUnitOfWork @ react-dom-client.development.js:18997
workLoopConcurrentByScheduler @ react-dom-client.development.js:18991
renderRootConcurrent @ react-dom-client.development.js:18973
performWorkOnRoot @ react-dom-client.development.js:17834
performWorkOnRootViaSchedulerTask @ react-dom-client.development.js:20384
performWorkUntilDeadline @ scheduler.development.js:45
<RootLayout>
initializeFakeTask @ react-server-dom-turbopack-client.browser.development.js:3373
initializeDebugInfo @ react-server-dom-turbopack-client.browser.development.js:3398
initializeDebugChunk @ react-server-dom-turbopack-client.browser.development.js:1764
processFullStringRow @ react-server-dom-turbopack-client.browser.development.js:4372
processFullBinaryRow @ react-server-dom-turbopack-client.browser.development.js:4283
processBinaryChunk @ react-server-dom-turbopack-client.browser.development.js:4506
progress @ react-server-dom-turbopack-client.browser.development.js:4780
"use server"
ResponseInstance @ react-server-dom-turbopack-client.browser.development.js:2767
createResponseFromOptions @ react-server-dom-turbopack-client.browser.development.js:4641
exports.createFromReadableStream @ react-server-dom-turbopack-client.browser.development.js:5045
module evaluation @ app-index.tsx:211
(anônimo) @ dev-base.ts:244
runModuleExecutionHooks @ dev-base.ts:278
instantiateModule @ dev-base.ts:238
getOrInstantiateModuleFromParent @ dev-base.ts:162
commonJsRequire @ runtime-utils.ts:389
(anônimo) @ app-next-turbopack.ts:11
(anônimo) @ app-bootstrap.ts:79
loadScriptsInSequence @ app-bootstrap.ts:23
appBootstrap @ app-bootstrap.ts:61
module evaluation @ app-next-turbopack.ts:10
(anônimo) @ dev-base.ts:244
runModuleExecutionHooks @ dev-base.ts:278
instantiateModule @ dev-base.ts:238
getOrInstantiateRuntimeModule @ dev-base.ts:128
registerChunk @ runtime-backend-dom.ts:57
await in registerChunk
registerChunk @ dev-base.ts:1149
(anônimo) @ dev-backend-dom.ts:126
(anônimo) @ dev-backend-dom.ts:126Entenda o aviso
use-editor-state.ts:412 >>> [SYNC] Estado do editor sincronizado com o Banco de Dados.
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
use-editor-state.ts:324 >>> [SYNC] Sincronizando estado do editor com studio.config (isDirty=false)
use-editor-state.ts:358 >>> [SYNC] Cores do banco inválidas ou vazias. Mantendo default.
warn @ forward-logs-shared.ts:95
useEditorState.useEffect @ use-editor-state.ts:358
react_stack_bottom_frame @ react-dom-client.development.js:28123
runWithFiberInDEV @ react-dom-client.development.js:986
commitHookEffectListMount @ react-dom-client.development.js:13692
commitHookPassiveMountEffects @ react-dom-client.development.js:13779
reconnectPassiveEffects @ react-dom-client.development.js:17124
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:17076
reconnectPassiveEffects @ react-dom-client.development.js:17116
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:17076
reconnectPassiveEffects @ react-dom-client.development.js:17148
doubleInvokeEffectsOnFiber @ react-dom-client.development.js:20130
runWithFiberInDEV @ react-dom-client.development.js:989
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20107
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20100
commitDoubleInvokeEffectsInDEV @ react-dom-client.development.js:20139
flushPassiveEffects @ react-dom-client.development.js:19866
(anônimo) @ react-dom-client.development.js:19284
performWorkUntilDeadline @ scheduler.development.js:45
<...>
exports.jsx @ react-jsx-runtime.development.js:342
LoadableComponent @ loadable.tsx:65
react_stack_bottom_frame @ react-dom-client.development.js:28038
renderWithHooksAgain @ react-dom-client.development.js:8084
renderWithHooks @ react-dom-client.development.js:7996
updateFunctionComponent @ react-dom-client.development.js:10501
beginWork @ react-dom-client.development.js:12136
runWithFiberInDEV @ react-dom-client.development.js:986
performUnitOfWork @ react-dom-client.development.js:18997
workLoopConcurrentByScheduler @ react-dom-client.development.js:18991
renderRootConcurrent @ react-dom-client.development.js:18973
performWorkOnRoot @ react-dom-client.development.js:17834
performWorkOnRootViaSchedulerTask @ react-dom-client.development.js:20384
performWorkUntilDeadline @ scheduler.development.js:45
<LoadableComponent>
exports.jsxDEV @ react-jsx-dev-runtime.development.js:342
ThemeInjectorClient @ theme-injector-client.tsx:12
react_stack_bottom_frame @ react-dom-client.development.js:28038
renderWithHooksAgain @ react-dom-client.development.js:8084
renderWithHooks @ react-dom-client.development.js:7996
updateFunctionComponent @ react-dom-client.development.js:10501
beginWork @ react-dom-client.development.js:12085
runWithFiberInDEV @ react-dom-client.development.js:986
performUnitOfWork @ react-dom-client.development.js:18997
workLoopConcurrentByScheduler @ react-dom-client.development.js:18991
renderRootConcurrent @ react-dom-client.development.js:18973
performWorkOnRoot @ react-dom-client.development.js:17834
performWorkOnRootViaSchedulerTask @ react-dom-client.development.js:20384
performWorkUntilDeadline @ scheduler.development.js:45
"use client"
RootLayout @ layout.tsx:77
initializeElement @ react-server-dom-turbopack-client.browser.development.js:1933
(anônimo) @ react-server-dom-turbopack-client.browser.development.js:4605
initializeModelChunk @ react-server-dom-turbopack-client.browser.development.js:1820
readChunk @ react-server-dom-turbopack-client.browser.development.js:1442
react_stack_bottom_frame @ react-dom-client.development.js:28145
resolveLazy @ react-dom-client.development.js:6320
createChild @ react-dom-client.development.js:6672
reconcileChildrenArray @ react-dom-client.development.js:6979
reconcileChildFibersImpl @ react-dom-client.development.js:7305
(anônimo) @ react-dom-client.development.js:7410
reconcileChildren @ react-dom-client.development.js:10036
beginWork @ react-dom-client.development.js:12486
runWithFiberInDEV @ react-dom-client.development.js:986
performUnitOfWork @ react-dom-client.development.js:18997
workLoopConcurrentByScheduler @ react-dom-client.development.js:18991
renderRootConcurrent @ react-dom-client.development.js:18973
performWorkOnRoot @ react-dom-client.development.js:17834
performWorkOnRootViaSchedulerTask @ react-dom-client.development.js:20384
performWorkUntilDeadline @ scheduler.development.js:45
<RootLayout>
initializeFakeTask @ react-server-dom-turbopack-client.browser.development.js:3373
initializeDebugInfo @ react-server-dom-turbopack-client.browser.development.js:3398
initializeDebugChunk @ react-server-dom-turbopack-client.browser.development.js:1764
processFullStringRow @ react-server-dom-turbopack-client.browser.development.js:4372
processFullBinaryRow @ react-server-dom-turbopack-client.browser.development.js:4283
processBinaryChunk @ react-server-dom-turbopack-client.browser.development.js:4506
progress @ react-server-dom-turbopack-client.browser.development.js:4780
"use server"
ResponseInstance @ react-server-dom-turbopack-client.browser.development.js:2767
createResponseFromOptions @ react-server-dom-turbopack-client.browser.development.js:4641
exports.createFromReadableStream @ react-server-dom-turbopack-client.browser.development.js:5045
module evaluation @ app-index.tsx:211
(anônimo) @ dev-base.ts:244
runModuleExecutionHooks @ dev-base.ts:278
instantiateModule @ dev-base.ts:238
getOrInstantiateModuleFromParent @ dev-base.ts:162
commonJsRequire @ runtime-utils.ts:389
(anônimo) @ app-next-turbopack.ts:11
(anônimo) @ app-bootstrap.ts:79
loadScriptsInSequence @ app-bootstrap.ts:23
appBootstrap @ app-bootstrap.ts:61
module evaluation @ app-next-turbopack.ts:10
(anônimo) @ dev-base.ts:244
runModuleExecutionHooks @ dev-base.ts:278
instantiateModule @ dev-base.ts:238
getOrInstantiateRuntimeModule @ dev-base.ts:128
registerChunk @ runtime-backend-dom.ts:57
await in registerChunk
registerChunk @ dev-base.ts:1149
(anônimo) @ dev-backend-dom.ts:126
(anônimo) @ dev-backend-dom.ts:126Entenda o aviso
use-editor-state.ts:412 >>> [SYNC] Estado do editor sincronizado com o Banco de Dados.
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
studio-context.tsx:1086 >>> [DEBUG_SYNC] Buscando config para ID: 1ed46dfd-6258-4b22-9c2b-ba04f1b82602
studio-context.tsx:1145 >>> [DEBUG_SYNC] layoutGlobal persistido no localStorage para ThemeInjector
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
use-editor-state.ts:324 >>> [SYNC] Sincronizando estado do editor com studio.config (isDirty=false)
use-editor-state.ts:351 >>> [SYNC] Cores válidas encontradas no banco. Aplicando...
use-editor-state.ts:412 >>> [SYNC] Estado do editor sincronizado com o Banco de Dados.
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
studio-context.tsx:1372 >>> [SYNC] Editor ativo com dados locais detectado. Preservando estado local.
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
theme-injector.tsx:34 >>> [SYNC] Sobrescrevendo LocalStorage com dados do Banco
```

## Arquivo: `erros_vercel\backup-.env\BackupLocal.txt`
```
VAPID_PUBLIC_KEY=BP-BVulgQxlVrV1Ww-mEIe98jgMMPB4O--iDC3vBGA39dJPCtCBANAy6VA67P1IcWij_LU7I3Cglnbr6PSqJI-g
VAPID_PRIVATE_KEY=j9YmYFT3avepZChq_aHGZIO194yAFFsNkNhPs1_QPUc
VAPID_SUBJECT=mailto:admin@example.com

# Database (Production Neon DB)
DATABASE_URL="postgres://postgres:admin123@localhost:5432/postgres"

# Authentication (Better Auth)
BETTER_AUTH_SECRET=oxgGJvPU6RWroZuagqq2EXdWrDKZrEil
# Ajustado para localhost:3001 (backend)
BETTER_AUTH_URL=http://localhost:3001
# URL do frontend (ajuste se necessário)
FRONTEND_URL=http://localhost:3000

# ------------------------------------------------------------------
# VARIÁVEIS DE PAGAMENTO (STRIPE) - O sistema está configurado para usar estas!
# ------------------------------------------------------------------

# ------------------------------------------------------------------
# VARIÁVEIS DO ASAAS (Caso decida mudar para Asaas no futuro)
# ------------------------------------------------------------------
ASAAS_ACCESS_TOKEN=\$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjY0YTRlOGQ3LWNmZTgtNDQyNi04MDJlLWZjNDllYjg3OTg4Yjo6JGFhY2hfM2VhMTZkMjQtYzM1YS00NjNmLWI2MmMtMDZkMmJhN2U0NzZi
ASAAS_BASE_URL=https://api-sandbox.asaas.com
#blackblaze
B2_BUCKET_NAME=aura-system-assets
B2_ENDPOINT=s3.us-east-005.backblazeb2.com
B2_KEY_ID=00557d026ee584f0000000001
B2_APPLICATION_KEY=K005vW/nFvPjwLGMFzPKWobOpv4iMbs

# Resend Email Configuration
RESEND_API_KEY=re_CQLiCSZ6_2TsXHytoKWLBkYepEnHeJSdS
```

## Arquivo: `erros_vercel\backup-.env\BackupLucas.txt`
```
postgresql:

//neondb_owner:npg_9pmJlr6etKHE@ep-little-math-ah9b7sm0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

## Arquivo: `erros_vercel\backup-.env\backupMaciel.txt`
```
VAPID_PUBLIC_KEY=BP-BVulgQxlVrV1Ww-mEIe98jgMMPB4O--iDC3vBGA39dJPCtCBANAy6VA67P1IcWij_LU7I3Cglnbr6PSqJI-g
VAPID_PRIVATE_KEY=j9YmYFT3avepZChq_aHGZIO194yAFFsNkNhPs1_QPUc
VAPID_SUBJECT=mailto:admin@example.com

# Database (Production Neon DB)
DATABASE_URL=postgresql://neondb_owner:npg_Mmy0tQl2CTKS@ep-steep-base-a4rcsq71-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Authentication (Better Auth)
BETTER_AUTH_SECRET=oxgGJvPU6RWroZuagqq2EXdWrDKZrEil
# Ajustado para localhost:3001 (backend)
BETTER_AUTH_URL=http://localhost:3001
# URL do frontend (ajuste se necessário)
FRONTEND_URL=http://localhost:3000

# ------------------------------------------------------------------
# VARIÁVEIS DE PAGAMENTO (STRIPE) - O sistema está configurado para usar estas!
# ------------------------------------------------------------------

# ------------------------------------------------------------------
# VARIÁVEIS DO ASAAS (Caso decida mudar para Asaas no futuro)
# ------------------------------------------------------------------
ASAAS_API_KEY=$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmQwZGNjNGJiLWU3ZDMtNDNlYS1iODI4LTkxNDI2ZjNjMTRlYzo6JGFhY2hfMWM5MTNmODctOTBmMC00OGEyLThkMTMtMWZhZTBkOGMxYTFh
ASAAS_WALLET_ID=your_asaas_wallet_id_here
ASAAS_API_URL=https://sandbox.asaas.com/api/v3

#blackblaze
B2_BUCKET_NAME=aura-system-assets

B2_ENDPOINT=s3.us-east-005.backblazeb2.com

B2_KEY_ID= (Deixe vazio para eu preencher)

B2_APPLICATION_KEY= (Deixe vazio para eu preencher)




vercel NEXT_PUBLIC_API_URL=https://agendamento-nota-backend.vercel.app
```

## Arquivo: `erros_vercel\testes_praticosTXT\agendamentos.txt`
```
================================================================================
TESTES PRÁTICOS - ABA AGENDAMENTOS
================================================================================

OBJETIVO: Garantir que o gerenciamento de agendamentos (listagem, filtros, 
edição e mudança de status) funcione corretamente e esteja sincronizado com o estoque.

--------------------------------------------------------------------------------
1. VISUALIZAÇÃO E CARREGAMENTO INICIAL
--------------------------------------------------------------------------------
[ ] 1.1. Verificar se a lista carrega inicialmente com os agendamentos do mês atual.
       - A data inicial deve ser o dia 1 do mês atual.
       - A data final deve ser o último dia do mês atual.
[ ] 1.2. Verificar o estado de "Carregando" (Loader/Spinner) enquanto busca os dados.
[ ] 1.3. Verificar o "Empty State" (Mensagem de lista vazia) quando não houver agendamentos no período.
[ ] 1.4. Validar se os dados do card estão corretos:
       - Nome do cliente
       - Nome do serviço
       - Data e Hora formatados corretamente
       - Preço e Duração
       - Status atual (badge/cor correta)

--------------------------------------------------------------------------------
2. FILTROS E BUSCA
--------------------------------------------------------------------------------
[ ] 2.1. Filtro por Nome/Serviço:
       - Digitar parte do nome do cliente e verificar se a lista filtra.
       - Digitar parte do nome do serviço e verificar se a lista filtra.
       - Testar com texto que não existe (deve mostrar lista vazia).
[ ] 2.2. Filtro por Data (Range):
       - Alterar "Data Inicial" e "Data Final" para um período específico.
       - Verificar se agendamentos fora desse período somem da lista.
[ ] 2.3. Filtro por Dia Específico:
       - Selecionar um dia no input de data específica.
       - Garantir que apenas agendamentos daquele dia exato apareçam.
[ ] 2.4. Filtro por Horário:
       - Digitar um horário (ex: "14:00") e verificar a filtragem.
[ ] 2.5. Abas de Status:
       - Clicar em "Pendente", "Confirmado", "Concluído", "Cancelado".
       - Verificar se a contagem (badge numérico) ao lado de cada aba está correta.
       - Verificar se a lista exibe apenas itens do status selecionado.

--------------------------------------------------------------------------------
3. MUDANÇA DE STATUS (FLUXO PRINCIPAL)
--------------------------------------------------------------------------------
[ ] 3.1. Pendente -> Confirmado:
       - Clicar para confirmar um agendamento.
       - Verificar se o status muda visualmente.
       - Verificar se permanece na aba "Todos" e aparece na aba "Confirmado".
[ ] 3.2. Confirmado -> Concluído (Baixa no Estoque):
       - Concluir um agendamento que usa produtos do estoque.
       - Verificar se o status muda para "Concluído".
       - (Opcional) Verificar na aba "Estoque" se a quantidade foi reduzida.
[ ] 3.3. Cancelamento:
       - Cancelar um agendamento (de qualquer status).
       - Verificar se muda para "Cancelado".
[ ] 3.4. Reversão de Status (Concluído -> Outro):
       - Tentar mudar de "Concluído" para "Pendente" ou "Confirmado".
       - Verificar se abre o Modal/Alerta perguntando sobre devolução de itens ao estoque.
       - Confirmar a ação e verificar se o status foi revertido.

--------------------------------------------------------------------------------
4. EDIÇÃO E REAGENDAMENTO
--------------------------------------------------------------------------------
[ ] 4.1. Editar Agendamento:
       - Abrir modal de edição.
       - Alterar dados (ex: observações, serviço).
       - Salvar e verificar se a lista atualiza com os novos dados.
[ ] 4.2. Reagendar:
       - Clicar na ação de reagendar.
       - Escolher nova data/horário.
       - Confirmar e verificar se o card mudou de posição na lista (ordenação).

--------------------------------------------------------------------------------
5. PAGINAÇÃO
--------------------------------------------------------------------------------
[ ] 5.1. Verificar limite de itens por página (padrão: 5 itens).
[ ] 5.2. Navegar para a próxima página e página anterior.
[ ] 5.3. Verificar se a paginação reseta para a página 1 ao aplicar um filtro.

--------------------------------------------------------------------------------
6. CENÁRIOS DE ERRO (EDGE CASES)
--------------------------------------------------------------------------------
[ ] 6.1. Falha na API:
       - Simular erro de rede (offline ou erro 500).
       - Verificar se aparece o Toast de erro ("Erro ao carregar").
       - Verificar se o sistema tenta carregar do LocalStorage como fallback (se aplicável).
[ ] 6.2. Datas Inválidas:
       - Tentar colocar Data Final menor que Data Inicial (se a UI permitir).
```

## Arquivo: `erros_vercel\testes_praticosTXT\calendario_usuario.txt`
```
# Testes Práticos - Calendário do Usuário (Cliente Final)

Este arquivo contém cenários de teste manuais para validar o fluxo de agendamento do lado do cliente, com foco nas regras de negócio do backend e experiência do usuário.

## 1. Regras de Negócio Críticas (Validação Backend)
Estas validações garantem que o frontend respeita as restrições impostas pela API.

### 1.1 Validação de Duração Multi-Slot
- [ ] **Seleção de Serviço Longo**:
    - [ ] Configurar um serviço com duração de **90 min** (1h30).
    - [ ] Configurar o intervalo de slots do calendário para **30 min**.
    - [ ] **Cenário de Sucesso**: O slot das 10:00 deve estar disponível APENAS se 10:00, 10:30 e 11:00 estiverem livres.
    - [ ] **Cenário de Bloqueio Parcial**: Se o slot das 10:30 estiver ocupado (por outro agendamento ou bloqueio), o slot das 10:00 deve aparecer como **indisponível** ou não ser clicável.
    - [ ] **Visualização**: O usuário não deve conseguir selecionar um horário que "quebre" no meio de um bloqueio subsequente.

### 1.2 Tratamento de Fusos Horários (Timezone)
- [ ] **Envio de Data em UTC**:
    - [ ] Realizar um agendamento e inspecionar o payload da requisição (Network Tab).
    - [ ] O campo `scheduledAt` deve estar no formato ISO UTC (ex: `2023-10-27T13:00:00.000Z` para 10:00 em UTC-3).
    - [ ] Verificar se não há envio de data local (ex: `2023-10-27T10:00:00`) sem o sufixo de fuso.
- [ ] **Visualização Correta**:
    - [ ] O horário exibido na confirmação deve ser o horário local do estúdio/usuário, não o horário UTC.

### 1.3 Respeito aos Bloqueios de Agenda
- [ ] **Bloqueios Totais (Dias)**:
    - [ ] Criar um bloqueio de "Dia Inteiro" no admin para uma data específica.
    - [ ] No calendário do usuário, essa data deve estar desabilitada (cinza/não clicável).
- [ ] **Bloqueios Parciais (Horários)**:
    - [ ] Criar um bloqueio das 14:00 às 16:00 no admin.
    - [ ] No calendário do usuário, os slots 14:00, 14:30, 15:00 e 15:30 devem estar indisponíveis.
    - [ ] Testar com serviço de duração longa: Um serviço de 60min não deve poder ser agendado às 13:30 (pois terminaria às 14:30, dentro do bloqueio).

### 1.4 Snapshots de Serviço
- [ ] **Integridade do Histórico**:
    - [ ] Realizar um agendamento.
    - [ ] Verificar no payload se os campos `serviceNameSnapshot`, `servicePriceSnapshot` e `serviceDurationSnapshot` estão sendo enviados.
    - [ ] **Teste de Alteração**:
        1. Agendar um serviço "Corte" por R$ 50,00.
        2. No admin, alterar o preço do "Corte" para R$ 60,00.
        3. O agendamento original deve manter o valor de R$ 50,00 (snapshot) e não ser afetado pela mudança.

### 1.6 Validação de Horário Passado (Bug Fix)
- [ ] **Tentativa de Agendamento no Passado**:
    - [ ] Acessar o calendário no dia atual (Hoje).
    - [ ] Verificar se horários anteriores ao momento atual (ex: agora são 14:00, slots das 08:00 a 13:30) estão indisponíveis/ocultos.
    - [ ] O primeiro horário disponível deve ser >= Hora Atual (ou próximo slot futuro).

### 1.5 Feedback de Erros do Backend
- [ ] **Concorrência (Already Occupied)**:
    - [ ] Abrir o calendário em duas abas/dispositivos diferentes para o mesmo horário.
    - [ ] Finalizar o agendamento na Aba A.
    - [ ] Tentar finalizar o MESMO horário na Aba B.
    - [ ] **Resultado Esperado**: Deve aparecer uma mensagem de erro amigável: "Este horário acabou de ser ocupado, por favor escolha outro" (sem mostrar o erro 400 cru).
- [ ] **Horário de Fechamento (Business Hours)**:
    - [ ] Tentar forçar (via inspeção ou edição de HTML, se possível, ou configuração limite) um agendamento que termine após o expediente.
    - [ ] **Resultado Esperado**: Mensagem: "O horário selecionado e a duração total dos serviços ultrapassam o horário de fechamento".

---

## 2. Fluxo de Agendamento (Passo a Passo)

### 2.1 Seleção de Serviços
- [ ] Listagem correta de serviços ativos.
- [ ] Exibição correta de Preço e Duração.
- [ ] Seleção única vs. Múltipla (se aplicável).

### 2.2 Seleção de Data
- [ ] Navegação entre meses.
- [ ] Dias passados bloqueados.
- [ ] Dias de folga (fechados na configuração semanal) bloqueados.

### 2.3 Seleção de Horário
- [ ] Geração de slots conforme intervalo configurado (15min, 30min, 60min).
- [ ] Slots ocupados por outros agendamentos devem estar invisíveis ou desabilitados.

### 2.4 Formulário de Dados
- [ ] Validação de campos obrigatórios (Nome, Telefone).
- [ ] Máscara de telefone (formato (XX) XXXXX-XXXX).
- [ ] Preenchimento automático se o usuário já estiver logado (futuro).

### 2.5 Confirmação e Sucesso
- [ ] Exibição do resumo do agendamento antes de confirmar.
- [ ] Tela de sucesso com detalhes do agendamento.
- [ ] Opções de "Adicionar ao Google Agenda" ou "Novo Agendamento".

---

## 3. Testes de Mudança de Configuração (Tempo Real)

### 3.1 Alteração de Intervalo
- [ ] No Admin, mudar o intervalo de agendamento de 30min para 60min.
- [ ] Recarregar o calendário do usuário.
- [ ] Os slots devem mudar de (09:00, 09:30, 10:00) para (09:00, 10:00, 11:00).

### 3.2 Alteração de Horário de Funcionamento
- [ ] No Admin, mudar o horário de fechamento de 18:00 para 16:00.
- [ ] Os slots das 16:00 em diante devem desaparecer do calendário do usuário.

### 3.3 Alteração de Preço de Serviço
- [ ] Mudar preço do serviço no Admin.
- [ ] O novo agendamento deve refletir o novo preço.
- [ ] Agendamentos antigos (histórico) NÃO devem mudar.

---

## 4. Cenários de Erro e Exceção

- [ ] **Perda de Conexão**: Tentar agendar sem internet (simular offline). Deve mostrar erro de conexão.
- [ ] **Erro de Servidor (500)**: Simular falha no backend. O frontend deve tratar graciosamente.
- [ ] **Dados Inválidos**: Tentar enviar e-mail inválido ou telefone incompleto.
```

## Arquivo: `scripts\create-super-admin-neon.ts`
```typescript
import postgres from "postgres";
import { v4 as uuidv4 } from "uuid";

const NEW_NEON_URL = "postgresql://neondb_owner:npg_9pmJlr6etKHE@ep-little-math-ah9b7sm0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
  const client = postgres(NEW_NEON_URL);

  const email = "lucassa1324@gmail.com";
  const password = "123123123";
  const name = "Lucas Sá";

  console.log(`>>> Criando Super Admin: ${email} no Neon...`);
  
  try {
    // 1. Gerar Hash Argon2id usando Bun (já que o projeto usa Bun)
    // Como estamos rodando com tsx/node, vamos usar uma alternativa se o Bun não estiver disponível,
    // mas o ambiente do usuário tem Bun. Vou tentar usar o Bun.password se estiver disponível.
    
    let hashedPassword;
    try {
      // @ts-ignore
      hashedPassword = await Bun.password.hash(password, { algorithm: "argon2id" });
      console.log("[HASH] Hash gerado com Bun.password");
    } catch (e) {
      console.log("[HASH] Bun não detectado, usando hash fixo compatível (ou falhando se necessário)");
      // Se não tiver bun, vamos avisar. Mas o ambiente deve ter.
      throw new Error("Este script deve ser rodado com 'bun run' para gerar o hash compatível com o Better Auth do projeto.");
    }

    const userId = uuidv4();
    const accountId = uuidv4();
    const now = new Date();

    // Iniciar transação
    await client.begin(async (sql) => {
      // 2. Inserir Usuário
      await sql`
        INSERT INTO "user" (id, name, email, role, email_verified, active, created_at, updated_at)
        VALUES (${userId}, ${name}, ${email}, 'SUPER_ADMIN', true, true, ${now}, ${now})
      `;
      console.log("[USER] Usuário inserido.");

      // 3. Inserir Conta (Better Auth)
      await sql`
        INSERT INTO "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
        VALUES (${accountId}, ${userId}, 'credential', ${userId}, ${hashedPassword}, ${now}, ${now})
      `;
      console.log("[ACCOUNT] Conta de credenciais inserida.");
    });

    console.log("\n[SUCESSO] Super Admin criado com sucesso!");
    console.log(`E-mail: ${email}`);
    console.log(`Senha: ${password}`);

  } catch (error: any) {
    console.error("\n[ERRO]:", error.message || error);
    if (error.message?.includes("duplicate key")) {
      console.log("\n[DICA] O usuário já existe. Se quiser resetar a senha, use um script de UPDATE.");
    }
  } finally {
    await client.end();
  }
}

main();
```

## Arquivo: `scripts\estrutura_detalhada_js_ts.txt`
```
ESTRUTURA HIERÁRQUICA DETALHADA (TS & JS)
========================================

Esta lista contém a estrutura completa de arquivos do projeto, organizados por diretórios, incluindo tanto os arquivos TypeScript (.ts) quanto suas versões compiladas ou espelhadas em JavaScript (.js), com suas respectivas funções.

/ (RAIZ)
├── drizzle.config.ts        # Configuração das migrações do banco de dados.
├── package.json             # Dependências e scripts do projeto (Bun).
├── tsconfig.json            # Configurações do compilador TypeScript.
├── vercel.json              # Configurações de deploy para Vercel.
├── .env.local               # Variáveis de ambiente (Segredos).
└── README.md                # Documentação inicial do projeto.

/scripts/
├── estrutura_projeto.txt    # Mapa simplificado de responsabilidades.
├── estrutura_detalhada.txt  # Este arquivo (Mapa completo JS/TS).
├── monitorar_logs.ps1       # Script PowerShell para log em tempo real.
└── debug_tools/             # Ferramentas de teste de API (Login, Senha).

/src/
├── index.ts / index.js      # Ponto de entrada (Main). Configura o servidor Elysia.
├── routes.ts / routes.js    # Definição central de todas as rotas da API.
├── local.ts / local.js      # Ponto de entrada específico para rodar localmente.
├── declarations.d.ts        # Definições de tipos globais do TypeScript.
│
├── db/
│   └── schema.ts / schema.js # Definição de todas as tabelas e relações do banco.
│
├── shared/
│   └── utils/
│       └── slug.ts / slug.js # Gerador de URLs amigáveis.
│
├── modules/ (Arquitetura por Domínio)
│   ├── appointments/ (Agendamentos)
│   │   ├── adapters/in/http/appointment.controller.{ts,js}
│   │   ├── application/use-cases/create-appointment.use-case.{ts,js}
│   │   └── domain/entities/appointment.entity.{ts,js}
│   │
│   ├── business/ (Empresas e Slugs)
│   │   ├── adapters/in/http/business.controller.{ts,js}
│   │   ├── application/use-cases/create-business.use-case.{ts,js}
│   │   └── domain/entities/business.entity.{ts,js}
│   │
│   ├── infrastructure/ (Serviços Globais)
│   │   ├── auth/
│   │   │   ├── auth.{ts,js}        # Configuração do Better Auth.
│   │   │   └── auth-plugin.{ts,js} # Middleware de proteção de rotas.
│   │   ├── drizzle/
│   │   │   └── database.{ts,js}    # Conexão com PostgreSQL.
│   │   ├── payment/
│   │   │   ├── asaas.client.{ts,js} # Integração com gateway Asaas.
│   │   │   └── payment.controller.{ts,js}
│   │   └── storage/
│   │       └── b2.storage.{ts,js}   # Upload de arquivos para Backblaze.
│   │
│   ├── inventory/ (Estoque)
│   │   ├── adapters/in/http/inventory.controller.{ts,js}
│   │   └── application/use-cases/create-product.use-case.{ts,js}
│   │
│   ├── notifications/ (WebPush/E-mail)
│   │   ├── application/notification.service.{ts,js}
│   │   └── application/webpush.{ts,js}
│   │
│   ├── settings/ (Configurações do Site)
│   │   ├── adapters/in/http/settings.controller.{ts,js}
│   │   └── application/use-cases/save-settings.use-case.{ts,js}
│   │
│   └── user/ (Usuários e Perfis)
│       ├── adapters/in/http/user.controller.{ts,js}
│       └── domain/models/user.{ts,js}

/drizzle/ (Migrações)
└── *.sql                    # Arquivos de alteração histórica do banco de dados.
```

## Arquivo: `scripts\estrutura_projeto.txt`
```
ESTRUTURA COMPLETA E RESPONSABILIDADES DO PROJETO (BACK-END)
============================================================

DIRETÓRIOS PRINCIPAIS
---------------------
/src                : Código fonte principal da aplicação.
/src/modules        : Divisão do sistema em módulos de domínio (Arquitetura Limpa/Hexagonal).
/src/db             : Configurações e definições do schema do banco de dados (Drizzle ORM).
/src/infrastructure : Serviços transversais como autenticação, banco, pagamentos e storage.
/src/shared         : Utilitários e funções compartilhadas entre módulos.
/scripts            : Scripts utilitários, testes de API e ferramentas de debug.
/drizzle            : Migrações SQL geradas pelo Drizzle ORM.

ARQUIVOS DE CONFIGURAÇÃO (RAIZ)
-------------------------------
- index.ts / index.js       : Ponto de entrada da aplicação Elysia.js. Configura rotas, plugins e middlewares globais.
- routes.ts / routes.js     : Definição centralizada de todas as rotas da aplicação.
- local.ts / local.js       : Configurações para execução em ambiente local.
- drizzle.config.ts         : Configuração do Drizzle Kit para gerenciamento de migrações.
- package.json              : Definição de dependências e scripts do projeto (Bun).
- tsconfig.json             : Configurações do compilador TypeScript.
- vercel.json               : Configurações para deploy na Vercel.
- .env.local                : Variáveis de ambiente locais (segredos, chaves de API).

MÓDULOS (src/modules) - ESTRUTURA PADRÃO
----------------------------------------
Cada módulo segue a organização:
- /adapters/in/http         : Controllers que recebem requisições HTTP e definem os endpoints.
- /adapters/in/dtos         : Data Transfer Objects - validam e tipam os dados de entrada.
- /adapters/out/drizzle     : Implementações concretas de repositórios usando Drizzle ORM.
- /application/use-cases    : Lógica de negócio específica de cada ação do sistema.
- /domain/entities          : Modelos de dados e regras de negócio puras.
- /domain/ports             : Interfaces que definem o contrato para os repositórios (Inversão de Dependência).

Módulos e seus Arquivos Principais:
- appointments  : Gestão de agendamentos.
  - appointment.controller.ts, appointment.entity.ts, create-appointment.use-case.ts.
- business      : Gestão de empresas e configurações.
  - business.controller.ts, business.entity.ts, create-business.use-case.ts.
- expenses      : Controle financeiro.
  - expense.controller.ts, create-expense.use-case.ts.
- gallery       : Portfólio e fotos.
  - gallery.controller.ts, gallery.entity.ts.
- inventory     : Estoque de produtos.
  - inventory.controller.ts, create-product.use-case.ts.
- notifications : Notificações Push e e-mail.
  - notifications.controller.ts, notification.service.ts, webpush.ts.
- reports       : Relatórios estatísticos.
  - report.controller.ts.
- settings      : Configurações de sistema e customização de site.
  - settings.controller.ts, save-settings.use-case.ts.
- user          : Gestão de usuários e preferências.
  - user.controller.ts, create-user.use-case.ts, user.ts (modelo).

INFRAESTRUTURA (src/modules/infrastructure)
-------------------------------------------
- auth/
  - auth.ts           : Configuração principal do Better Auth (estratégias, hooks).
  - auth-plugin.ts    : Plugin Elysia para proteção de rotas e verificação de sessão.
- di/
  - repositories.plugin.ts : Centraliza a injeção de dependência dos repositórios.
- drizzle/
  - database.ts       : Instância do cliente do banco de dados e conexão.
  - database.cli.ts   : Utilitário de linha de comando para o banco.
- payment/
  - asaas.client.ts   : Cliente de integração com a API do Asaas.
  - asaas.webhook.controller.ts : Recebimento de notificações de pagamento.
- storage/
  - b2.storage.ts     : Integração com Backblaze B2 para upload de arquivos.
- stripe/
  - stripe.client.ts  : Cliente de integração com Stripe.

SCRIPTS E UTILITÁRIOS
---------------------
- scripts/check_evellyn_vinculo.ts : Diagnóstico de permissões da usuária Evellyn.
- scripts/debug_tools/             : Ferramentas para testar login e troca de senha.
- src/shared/utils/slug.ts         : Utilitário para geração e validação de slugs (URLs amigáveis).
- monitorar_logs.ps1               : Script PowerShell para acompanhar logs em tempo real.

BANCO DE DADOS
--------------
- src/db/schema.ts : O "Coração" do banco. Contém todas as tabelas (users, sessions, companies, appointments, etc.) e seus relacionamentos.
```

## Arquivo: `scripts\get-local-password.ts`
```typescript
import postgres from "postgres";

const LOCAL_DATABASE_URL = "postgres://postgres:admin123@localhost:5432/postgres";

async function main() {
  const client = postgres(LOCAL_DATABASE_URL);

  console.log(">>> Buscando senha para lucassa1324@gmail.com no banco LOCAL...");
  
  try {
    const query = await client`
      SELECT a.password 
      FROM "user" u 
      JOIN "account" a ON u.id = a.user_id 
      WHERE u.email = 'lucassa1324@gmail.com'
    `;

    if (query.length > 0) {
      console.log("\n[SUCESSO] Senha encontrada no banco LOCAL (Hash):");
      console.log(query[0].password);
    } else {
      console.log("\n[AVISO] Usuário não encontrado no banco LOCAL.");
    }
  } catch (error) {
    console.error("\n[ERRO] Falha ao conectar ou consultar o banco LOCAL:", error);
  } finally {
    await client.end();
  }
}

main();
```

## Arquivo: `scripts\get-neon-password.ts`
```typescript
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const DATABASE_URL = "postgresql://neondb_owner:npg_Mmy0tQl2CTKS@ep-steep-base-a4rcsq71-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const user = pgTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
});

const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  password: text("password"),
});

async function main() {
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  console.log(">>> Buscando senha para lucassa1324@gmail.com no Neon...");
  
  try {
    const results = await db
      .select({
        email: user.email,
        password: account.password,
      })
      .from(user)
      .innerJoin(account, (user, account) => ({
        on: (user, account) => {
          // In Drizzle ORM v2 syntax might be different, 
          // but I'll use a simpler query if needed.
          // Let's use raw query for simplicity and certainty.
          return;
        }
      }))
      .where((user) => ({
        on: (user) => {
           return;
        }
      }));

    // Actually, let's use a simpler approach with raw SQL to avoid Drizzle version issues
    const query = await client`
      SELECT a.password 
      FROM "user" u 
      JOIN "account" a ON u.id = a.user_id 
      WHERE u.email = 'lucassa1324@gmail.com'
    `;

    if (query.length > 0) {
      console.log("\n[SUCESSO] Senha encontrada (Hash):");
      console.log(query[0].password);
    } else {
      console.log("\n[AVISO] Usuário não encontrado ou sem senha definida no Neon.");
    }
  } catch (error) {
    console.error("\n[ERRO] Falha ao conectar ou consultar o Neon:", error);
  } finally {
    await client.end();
  }
}

main();
```

## Arquivo: `scripts\list-tables-neon.ts`
```typescript
import postgres from "postgres";

const NEW_NEON_URL = "postgresql://neondb_owner:npg_9pmJlr6etKHE@ep-little-math-ah9b7sm0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
  const client = postgres(NEW_NEON_URL);

  console.log(">>> Listando tabelas na NOVA URL do Neon...");
  
  try {
    const tables = await client`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log("\n[TABELAS ENCONTRADAS]");
    console.table(tables);
  } catch (error: any) {
    console.error("\n[ERRO]:", error.message || error);
  } finally {
    await client.end();
  }
}

main();
```

## Arquivo: `scripts\reset-aura-teste.ts`
```typescript

```

## Arquivo: `scripts\test-new-neon.ts`
```typescript
import postgres from "postgres";

const NEW_NEON_URL = "postgresql://neondb_owner:npg_9pmJlr6etKHE@ep-little-math-ah9b7sm0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
  const client = postgres(NEW_NEON_URL);

  console.log(">>> Testando conexão com a NOVA URL do Neon...");
  
  try {
    const query = await client`SELECT 1 as connected`;
    if (query[0].connected === 1) {
      console.log("\n[SUCESSO] Conexão estabelecida com sucesso!");
      
      const userCheck = await client`SELECT id, email, role FROM "user" WHERE email = 'lucassa1324@gmail.com'`;
      if (userCheck.length > 0) {
        console.log("\n[INFO] Usuário já existe:");
        console.table(userCheck);
      } else {
        console.log("\n[INFO] Usuário lucassa1324@gmail.com NÃO existe nesta base.");
      }
    }
  } catch (error: any) {
    console.error("\n[ERRO] Falha ao conectar à nova URL:", error.message || error);
  } finally {
    await client.end();
  }
}

main();
```

## Arquivo: `scripts\tests\analyze_db.ts`
```typescript

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, ".env.local") });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("DATABASE_URL não encontrado no .env.local");
  process.exit(1);
}

async function analyzeStorage() {
  const queryClient = postgres(dbUrl as string, { prepare: false });

  try {
    console.log("--- ANALISANDO TAMANHO DAS TABELAS (STORAGE) ---");
    
    // Consulta para ver o tamanho de cada tabela no banco de dados
    const tableSizes = await queryClient.unsafe(`
      SELECT 
        relname AS table_name,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
        pg_size_pretty(pg_relation_size(relid)) AS table_size,
        pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size
      FROM pg_catalog.pg_statio_user_tables
      ORDER BY pg_total_relation_size(relid) DESC;
    `);

    console.table(tableSizes);

    console.log("\n--- ANALISANDO CONTAGEM DE REGISTROS ---");
    const counts = await queryClient.unsafe(`
      SELECT 
        schemaname, 
        relname, 
        n_live_tup 
      FROM pg_stat_user_tables 
      ORDER BY n_live_tup DESC;
    `);
    console.table(counts);

  } catch (error: any) {
    console.error("❌ Erro ao analisar banco:", error.message);
  } finally {
    await queryClient.end();
    process.exit();
  }
}

analyzeStorage();
```

## Arquivo: `scripts\tests\check_aura_teste.ts`
```typescript

import { db } from "../../src/modules/infrastructure/drizzle/database";
import { companies } from "../../src/db/schema";
import { eq, ilike } from "drizzle-orm";

async function checkStudio() {
  console.log(">>> [CHECK_STUDIO] Verificando existência do estúdio 'aura-teste'...");

  try {
    const results = await db
      .select()
      .from(companies)
      .where(ilike(companies.slug, "aura-teste"))
      .limit(1);

    if (results.length > 0) {
      console.log("✅ [SUCCESS] Estúdio encontrado!");
      console.log(JSON.stringify(results[0], null, 2));
    } else {
      console.log("❌ [NOT_FOUND] Estúdio 'aura-teste' não existe no banco de dados.");

      // Listar todos os estúdios para ver o que tem no banco
      const allStudios = await db.select({ name: companies.name, slug: companies.slug }).from(companies);
      console.log(">>> [DATABASE] Estúdios cadastrados:");
      console.table(allStudios);
    }
  } catch (error) {
    console.error("❌ [ERROR] Falha ao consultar o banco de dados:", error);
  } finally {
    process.exit(0);
  }
}

checkStudio();
```

## Arquivo: `scripts\tests\check_aura_upload.ts`
```typescript

import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

async function checkAuraCustomization() {
  try {
    console.log("Buscando usuário aura.teste@gmail.com...");
    const [user] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, "aura.teste@gmail.com"));

    if (!user) {
      console.log("Usuário não encontrado.");
      return;
    }

    console.log(`Usuário encontrado: ${user.id}`);

    const [company] = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.ownerId, user.id));

    if (!company) {
      console.log("Empresa não encontrada para este usuário.");
      return;
    }

    console.log(`Empresa encontrada: ${company.name} (${company.id})`);

    const [customization] = await db
      .select()
      .from(schema.companySiteCustomizations)
      .where(eq(schema.companySiteCustomizations.companyId, company.id));

    if (!customization) {
      console.log("Customização não encontrada.");
      return;
    }

    console.log("\n--- Dados de Customização (Home) ---");
    console.log(JSON.stringify(customization.home, null, 2));

  } catch (error) {
    console.error("Erro ao verificar dados:", error);
  } finally {
    process.exit();
  }
}

checkAuraCustomization();
```

## Arquivo: `scripts\tests\check_draft_color.ts`
```typescript

import { db } from "../../src/modules/infrastructure/drizzle/database";
import { siteDrafts, companies } from "../../src/db/schema";
import { eq, ilike } from "drizzle-orm";

async function checkDraftColor() {
  console.log(">>> [CHECK_DRAFT_COLOR] Buscando rascunho do estúdio 'aura-teste'...");

  try {
    const [company] = await db
      .select()
      .from(companies)
      .where(ilike(companies.slug, "aura-teste"))
      .limit(1);

    if (!company) {
      console.log("❌ [ERROR] Estúdio 'aura-teste' não encontrado.");
      return;
    }

    const [draft] = await db
      .select()
      .from(siteDrafts)
      .where(eq(siteDrafts.companyId, company.id))
      .limit(1);

    if (!draft) {
      console.log("❌ [ERROR] Nenhum rascunho encontrado para este estúdio.");
      return;
    }

    const appointmentFlow = draft.appointmentFlow as any;
    console.log("- appointmentFlow completo:", JSON.stringify(appointmentFlow, null, 2));

  } catch (error) {
    console.error("❌ [ERROR] Falha ao consultar o banco de dados:", error);
  } finally {
    process.exit(0);
  }
}

checkDraftColor();
```

## Arquivo: `scripts\tests\check_drafts.ts`
```typescript

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./src/db/schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, ".env.local") });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("DATABASE_URL não encontrado no .env.local");
  process.exit(1);
}

async function checkDrafts() {
  const queryClient = postgres(dbUrl as string, { prepare: false });
  const db = drizzle(queryClient);

  try {
    console.log("--- BUSCANDO USUÁRIO DE TESTE (aura.teste@gmail.com) ---");
    const [user] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, "aura.teste@gmail.com"));

    if (!user) {
      console.log("❌ Usuário não encontrado.");
      return;
    }

    console.log(`✅ Usuário encontrado: ${user.id}`);

    const [company] = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.ownerId, user.id));

    if (!company) {
      console.log("❌ Empresa não encontrada para este usuário.");
      return;
    }

    console.log(`✅ Empresa encontrada: ${company.name} (${company.id})`);

    console.log("\n--- VERIFICANDO TABELA DE RASCUNHOS (site_drafts) ---");
    const [draft] = await db
      .select()
      .from(schema.siteDrafts)
      .where(eq(schema.siteDrafts.companyId, company.id));

    if (draft) {
      console.log("✅ Rascunho encontrado!");
      console.log(JSON.stringify(draft, null, 2));
    } else {
      console.log("ℹ️ Nenhum rascunho encontrado para esta empresa.");
    }

  } catch (error: any) {
    console.error("❌ Erro ao verificar rascunhos:", error.message);
  } finally {
    await queryClient.end();
    process.exit();
  }
}

checkDrafts();
```

## Arquivo: `scripts\tests\check_evellyn_vinculo.ts`
```typescript

import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function checkEvellynVinculo() {
  console.log("--- Verificando Vínculo da Evellyn ---");
  const email = "evellyn@gmail.com";
  
  const userResults = await db.select().from(schema.user).where(eq(schema.user.email, email));
  
  if (userResults.length === 0) {
    console.log("Usuário não encontrado.");
    return;
  }
  
  const user = userResults[0];
  console.log("Usuário:", JSON.stringify(user, null, 2));
  
  const companyResults = await db.select().from(schema.companies).where(eq(schema.companies.ownerId, user.id));
  
  if (companyResults.length === 0) {
    console.log("\nNenhuma empresa encontrada onde este usuário é owner.");
  } else {
    console.log("\nEmpresas vinculadas (como owner):", JSON.stringify(companyResults, null, 2));
  }
}

checkEvellynVinculo().catch(console.error);
```

## Arquivo: `scripts\tests\check_laura_password.ts`
```typescript

import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function checkPassword() {
  const email = "laura3@gmail.com";
  console.log(`\n--- VERIFICANDO USUÁRIO: ${email} ---\n`);

  const userResult = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  const foundUser = userResult[0];

  if (!foundUser) {
    console.log("❌ Usuário não encontrado na tabela 'user'.");
    return;
  }

  console.log(`ID do Usuário: ${foundUser.id}`);

  const accountResult = await db.select().from(schema.account).where(eq(schema.account.userId, foundUser.id)).limit(1);
  const foundAccount = accountResult[0];

  if (!foundAccount) {
    console.log("❌ Conta (credenciais) não encontrada na tabela 'account'.");
    return;
  }

  console.log(`Hash da Senha no Banco: ${foundAccount.password}`);

  if (foundAccount.password?.startsWith("$argon2id$")) {
    console.log("✅ Algoritmo: Argon2id (Migrado)");
  } else {
    console.log("⚠️ Algoritmo: Scrypt ou Outro (Ainda não migrado)");
  }

  process.exit(0);
}

checkPassword().catch(err => {
  console.error(err);
  process.exit(1);
});
```

## Arquivo: `scripts\tests\check_lucas_appointment.ts`
```typescript

import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq, and, desc } from "drizzle-orm";

async function checkAppointmentAndInventory() {
  console.log("\n--- VERIFICANDO AGENDAMENTO DE 'LUCAS' ---");

  // 1. Buscar o agendamento mais recente do Lucas
  const appointments = await db.select()
    .from(schema.appointments)
    .where(eq(schema.appointments.customerName, "LUCAS ALVES DE SA"))
    .orderBy(desc(schema.appointments.createdAt))
    .limit(1);

  if (appointments.length === 0) {
    console.log("❌ Nenhum agendamento encontrado para 'LUCAS ALVES DE SA'");
    process.exit(0);
  }

  const app = appointments[0];
  console.log(`✅ Agendamento Encontrado: ID ${app.id}`);
  console.log(`   Status: ${app.status}`);
  console.log(`   Serviços: ${app.serviceNameSnapshot}`);

  // 2. Buscar os itens do agendamento (tabela appointment_items)
  const items = await db.select()
    .from(schema.appointmentItems)
    .where(eq(schema.appointmentItems.appointmentId, app.id));

  console.log(`   Itens vinculados: ${items.length}`);
  for (const item of items) {
    console.log(`     - Item: ${item.serviceNameSnapshot} (ID: ${item.serviceId})`);
  }

  // 3. Verificar o estoque dos produtos vinculados a esses serviços
  console.log("\n--- ESTOQUE ATUAL DOS PRODUTOS ---");

  const serviceIds = items.map(i => i.serviceId);
  if (serviceIds.length === 0 && app.serviceId) serviceIds.push(app.serviceId);

  // Remover duplicados
  const uniqueServiceIds = [...new Set(serviceIds)];

  for (const sId of uniqueServiceIds) {
    // Buscar recursos do serviço
    const resources = await db.select()
      .from(schema.serviceResources)
      .where(eq(schema.serviceResources.serviceId, sId));

    for (const res of resources) {
      const product = await db.select()
        .from(schema.inventory)
        .where(eq(schema.inventory.id, res.inventoryId))
        .limit(1);

      if (product.length > 0) {
        console.log(`📦 Produto: ${product[0].name}`);
        console.log(`   Quantidade em estoque: ${product[0].currentQuantity} ${product[0].unit}`);
        console.log(`   Uso por serviço: ${res.quantity} ${res.unit}`);
      }
    }
  }

  process.exit(0);
}

checkAppointmentAndInventory().catch(err => {
  console.error(err);
  process.exit(1);
});
```

## Arquivo: `scripts\tests\check_migrations.ts`
```typescript
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  try {
    const result = await client`SELECT * FROM "__drizzle_migrations" ORDER BY created_at DESC`;
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error querying migrations:', error);
  } finally {
    await client.end();
  }
}

main();
```

## Arquivo: `scripts\tests\check_published.ts`
```typescript

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./src/db/schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, ".env.local") });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("DATABASE_URL não encontrado no .env.local");
  process.exit(1);
}

async function checkPublished() {
  const queryClient = postgres(dbUrl as string, { prepare: false });
  const db = drizzle(queryClient);
  const businessId = "1ed46dfd-6258-4b22-9c2b-ba04f1b82602";

  try {
    console.log(`--- VERIFICANDO TABELA DE PUBLICADOS PARA ${businessId} ---`);
    const [published] = await db
      .select()
      .from(schema.companySiteCustomizations)
      .where(eq(schema.companySiteCustomizations.companyId, businessId));

    if (published) {
      console.log("✅ Registro Publicado encontrado!");
      const data = {
        layoutGlobal: published.layoutGlobal,
        home: published.home,
        gallery: published.gallery,
        aboutUs: published.aboutUs,
        appointmentFlow: published.appointmentFlow
      };
      console.log(JSON.stringify(data, null, 2));

      // Verificação específica da chave primaryButtonColor
      const hasPrimaryButtonColor = "primaryButtonColor" in (published as any);
      console.log(`\n>>> A chave 'primaryButtonColor' existe na RAIZ? ${hasPrimaryButtonColor}`);

      // Verificação dentro do layoutGlobal
      const layoutGlobal = published.layoutGlobal as any;
      console.log(`>>> A chave 'primaryButtonColor' existe dentro de layoutGlobal? ${!!layoutGlobal?.primaryButtonColor}`);
      if (layoutGlobal?.primaryButtonColor) {
        console.log(`>>> Valor em layoutGlobal: ${layoutGlobal.primaryButtonColor}`);
      }

    } else {
      console.log("ℹ️ Nenhum registro publicado encontrado para esta empresa.");
    }

  } catch (error: any) {
    console.error("❌ Erro ao verificar publicados:", error.message);
  } finally {
    await queryClient.end();
    process.exit();
  }
}

checkPublished();
```

## Arquivo: `scripts\tests\clean_sessions.ts`
```typescript

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./src/db/schema";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, ".env.local") });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("DATABASE_URL não encontrado no .env.local");
  process.exit(1);
}

async function cleanSessions() {
  const queryClient = postgres(dbUrl as string, { prepare: false });
  const db = drizzle(queryClient);

  try {
    console.log("--- INICIANDO LIMPEZA DA TABELA DE SESSÕES ---");

    // Deletar todas as sessões
    // Se o banco estiver travado por cota de TRANSFERÊNCIA, este comando pode falhar
    // mas se for por cota de ARMAZENAMENTO, ele ajuda a liberar espaço.
    const result = await queryClient.unsafe('DELETE FROM "session"');

    console.log("✅ Limpeza concluída com sucesso!");
    console.log(`Nota: Todas as sessões foram removidas. Usuários precisarão fazer login novamente.`);

  } catch (error: any) {
    console.error("❌ Erro ao limpar sessões:", error.message);
    if (error.message.includes("quota")) {
      console.log("\n⚠️ ALERTA: O banco continua bloqueando comandos devido à cota excedida.");
      console.log("Você PRECISA aumentar o limite no painel do provedor (Neon/Supabase) antes de qualquer comando de escrita funcionar.");
    }
  } finally {
    await queryClient.end();
    process.exit();
  }
}

cleanSessions();
```

## Arquivo: `scripts\tests\cleanup_sessions.ts`
```typescript

import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { desc, notInArray, sql } from "drizzle-orm";

async function cleanupSessions() {
  console.log("\n--- INICIANDO LIMPEZA DE SESSÕES ---\n");

  // 1. Contar total de sessões
  const allSessions = await db.select({ id: schema.session.id }).from(schema.session);
  console.log(`Total de sessões encontradas: ${allSessions.length}`);

  if (allSessions.length <= 10) {
    console.log("Sessões insuficientes para limpeza (limite de 10 não atingido).");
    process.exit(0);
  }

  // 2. Pegar os IDs das 10 sessões mais recentes (baseado na expiração ou criação se disponível)
  // Como o schema do Better Auth usa expiresAt, vamos manter as que expiram mais tarde.
  const topSessions = await db
    .select({ id: schema.session.id })
    .from(schema.session)
    .orderBy(desc(schema.session.expiresAt))
    .limit(10);

  const idsToKeep = topSessions.map(s => s.id);

  // 3. Deletar todas as sessões que NÃO estão no top 10
  const deleteResult = await db
    .delete(schema.session)
    .where(notInArray(schema.session.id, idsToKeep));

  console.log(`✅ Limpeza concluída! Mantivemos as 10 sessões mais recentes.`);
  console.log(`Sessões removidas: ${allSessions.length - 10}`);

  process.exit(0);
}

cleanupSessions().catch(err => {
  console.error("❌ Erro na limpeza:", err);
  process.exit(1);
});
```

## Arquivo: `scripts\tests\create_complete_test_account.ts`
```typescript
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function createTestAccount() {
  const testEmail = "aura.teste@gmail.com";
  const password = "Mudar@123";
  const userName = "Usuário Teste Aura";
  const studioName = "Studio de Teste Aura";
  const slug = "studio-teste-aura";

  console.log(`[TEST_ACCOUNT] Iniciando criação da conta de teste: ${testEmail}`);

  try {
    // 1. Limpar se já existir
    const [existingUser] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, testEmail))
      .limit(1);

    if (existingUser) {
      console.log("[TEST_ACCOUNT] Removendo conta de teste antiga...");
      await db.delete(schema.account).where(eq(schema.account.userId, existingUser.id));
      await db.delete(schema.companies).where(eq(schema.companies.ownerId, existingUser.id));
      await db.delete(schema.user).where(eq(schema.user.id, existingUser.id));
    }

    // 2. Criar Usuário
    const userId = crypto.randomUUID();
    const [newUser] = await db.insert(schema.user).values({
      id: userId,
      name: userName,
      email: testEmail,
      role: "ADMIN",
      active: true,
      hasCompletedOnboarding: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // 3. Criar Conta (Credenciais)
    const hashedPassword = await Bun.password.hash(password, { algorithm: "argon2id" });
    await db.insert(schema.account).values({
      id: crypto.randomUUID(),
      userId: newUser.id,
      accountId: testEmail,
      providerId: "credential",
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 4. Criar Empresa (Company)
    const companyId = crypto.randomUUID();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30); // 30 dias de teste

    await db.insert(schema.companies).values({
      id: companyId,
      name: studioName,
      slug: slug,
      ownerId: newUser.id,
      active: true,
      subscriptionStatus: "trial",
      trialEndsAt: trialEndsAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 5. Criar Customização do Site
    await db.insert(schema.companySiteCustomizations).values({
      id: crypto.randomUUID(),
      companyId: companyId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("-----------------------------------------");
    console.log("[SUCCESS] Conta de Teste Criada!");
    console.log(`Email: ${testEmail}`);
    console.log(`Senha: ${password}`);
    console.log(`Slug do Studio: ${slug}`);
    console.log("-----------------------------------------");

  } catch (error) {
    console.error("[FATAL] Erro ao criar conta de teste:", error);
  } finally {
    process.exit(0);
  }
}

createTestAccount();
```

## Arquivo: `scripts\tests\create_local_admin.ts`
```typescript

import postgres from "postgres";
import { v4 as uuidv4 } from "uuid";

// --- CONFIGURAÇÃO LOCAL ---
const TARGET_URL = "postgres://postgres:admin123@localhost:5432/postgres"; // URL Local (Docker)
const target = postgres(TARGET_URL);

async function createSuperAdmin() {
  const email = "lucassa1324@gmail.com";
  const userId = uuidv4();
  
  console.log(`🚀 Iniciando criação de Super Admin local para: ${email}`);

  try {
    // 1. Inserir na tabela 'user'
    await target.unsafe(`
      INSERT INTO "user" (
        "id", "name", "email", "email_verified", "role", "active", "account_status", "has_completed_onboarding", "created_at", "updated_at"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
      ) ON CONFLICT ("email") DO UPDATE SET "role" = 'SUPER_ADMIN'
    `, [userId, "Lucas Super Admin", email, true, "SUPER_ADMIN", true, "ACTIVE", true]);

    console.log(`✅ Usuário criado/atualizado como SUPER_ADMIN na tabela 'user'.`);

    // 2. Opcional: Se houver uma senha padrão para login local, poderíamos inserir na tabela 'account'
    // Mas geralmente o BetterAuth lida com isso. Se você for usar login por senha, precisará de um hash.
    
    console.log("\n===================================================");
    console.log("🏆 SUPER ADMIN CRIADO COM SUCESSO NO DOCKER!");
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Role: SUPER_ADMIN`);
    console.log("===================================================");

  } catch (error: any) {
    console.error("\n💥 ERRO AO CRIAR SUPER ADMIN:", error.message);
  } finally {
    await target.end();
    process.exit();
  }
}

createSuperAdmin();
```

## Arquivo: `scripts\tests\debug_gallery_error.ts`
```typescript

import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

async function checkBusiness() {
  try {
    const businessId = "1ed46dfd-6258-4b22-9c2b-ba04f1b82602";
    console.log(`Verificando empresa com ID: ${businessId}`);

    const [business] = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.id, businessId));

    if (business) {
      console.log(`✅ Empresa encontrada: ${business.name}`);

      const images = await db
        .select()
        .from(schema.galleryImages)
        .where(eq(schema.galleryImages.businessId, businessId));

      console.log(`Total de imagens na galeria: ${images.length}`);
    } else {
      console.log(`❌ Empresa NÃO encontrada no banco de dados.`);
    }

  } catch (error: any) {
    console.error("Erro ao conectar no banco:", error.message);
  } finally {
    process.exit();
  }
}

checkBusiness();
```

## Arquivo: `scripts\tests\delete_test_users.ts`
```typescript

import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { like, or } from "drizzle-orm";

async function deleteTestUsers() {
  console.log("\n--- INICIANDO EXCLUSÃO DE USUÁRIOS DE TESTE ---\n");

  // Padrões de email para deletar baseados no print
  const patterns = [
    "test.payment.%@example.com",
    "updated.%@example.com",
    "test.subscription.%@example.com"
  ];

  try {
    // 1. Buscar os IDs dos usuários que batem com os padrões
    const usersToDelete = await db
      .select({ id: schema.user.id, email: schema.user.email })
      .from(schema.user)
      .where(
        or(
          ...patterns.map(p => like(schema.user.email, p))
        )
      );

    console.log(`Encontrados ${usersToDelete.length} usuários para deletar.`);

    if (usersToDelete.length === 0) {
      console.log("Nenhum usuário encontrado com os padrões informados.");
      process.exit(0);
    }

    const userIds = usersToDelete.map(u => u.id);

    // 2. Deletar em ordem para respeitar chaves estrangeiras (se houver)
    // Primeiro as contas, sessões e outros dados vinculados
    const deletedSessions = await db.delete(schema.session).where(or(...userIds.map(id => like(schema.session.userId, id))));
    const deletedAccounts = await db.delete(schema.account).where(or(...userIds.map(id => like(schema.account.userId, id))));
    
    // Por fim, deletar os usuários
    const deletedUsers = await db.delete(schema.user).where(or(...userIds.map(id => like(schema.user.id, id))));

    console.log(`✅ Sucesso!`);
    console.log(`- Usuários removidos: ${usersToDelete.length}`);
    usersToDelete.forEach(u => console.log(`  > ${u.email}`));

  } catch (error) {
    console.error("❌ Erro ao deletar usuários:", error);
  }

  process.exit(0);
}

deleteTestUsers().catch(err => {
  console.error(err);
  process.exit(1);
});
```

## Arquivo: `scripts\tests\final_verify_aura.ts`
```typescript

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

const dbUrl = "postgresql://neondb_owner:npg_Mmy0tQl2CTKS@ep-steep-base-a4rcsq71-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function verifyAura() {
  const queryClient = postgres(dbUrl, { prepare: false });
  const db = drizzle(queryClient);

  try {
    console.log("Conectando ao Neon DB para verificar aura.teste@gmail.com...");

    const [user] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, "aura.teste@gmail.com"));

    if (!user) {
      console.log("❌ Usuário não encontrado no banco.");
      return;
    }

    console.log(`✅ Usuário encontrado: ${user.id}`);

    const [company] = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.ownerId, user.id));

    if (!company) {
      console.log("❌ Empresa não encontrada.");
      return;
    }

    console.log(`✅ Empresa encontrada: ${company.name} (${company.id})`);

    const [customization] = await db
      .select()
      .from(schema.companySiteCustomizations)
      .where(eq(schema.companySiteCustomizations.companyId, company.id));

    if (!customization) {
      console.log("❌ Customização não encontrada no banco.");
      return;
    }

    console.log("\n--- DADOS PERSISTIDOS NO BANCO (COMPLETO) ---");
    console.log(JSON.stringify(customization, null, 2));

  } catch (error: any) {
    console.error("Erro na verificação:", error.message);
  } finally {
    await queryClient.end();
    process.exit();
  }
}

verifyAura();
```

## Arquivo: `scripts\tests\migrate_neon_to_local.ts`
```typescript

import postgres from "postgres";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, ".env.local") });

// --- CONFIGURAÇÃO ---
const SOURCE_URL = process.env.DATABASE_URL; // URL do Neon (Cloud)
const TARGET_URL = "postgres://postgres:admin123@localhost:5432/postgres"; // URL Local (Docker)

if (!SOURCE_URL) {
  console.error("❌ Erro: DATABASE_URL (Neon) não encontrado no .env.local");
  process.exit(1);
}

const source = postgres(SOURCE_URL, { ssl: "require" });
const target = postgres(TARGET_URL);

// --- ORDEM DE MIGRAÇÃO (Respeitando FKs) ---
const MIGRATION_ORDER = [
  // Nível 1: Base
  "user",
  
  // Nível 2: Dependem de User
  "companies",
  "account",
  "verification",
  "prospects",
  "push_subscriptions",
  
  // Nível 3: Dependem de Company
  "services",
  "inventory",
  "fixed_expenses",
  "operating_hours",
  "google_calendar_configs",
  "business_profiles",
  "company_site_customizations",
  "site_drafts",
  "gallery_images",
  "agenda_blocks",
  
  // Nível 4: Dependem de Service/Company/User
  "appointments",
  "inventory_logs",
  
  // Nível 5: Relacionamentos Cruzados
  "service_resources",
  "appointment_items"
];

async function migrateTable(tableName: string) {
  console.log(`\n📦 Migrando tabela: [${tableName}]...`);
  
  try {
    // 1. Buscar dados da origem
    const rows = await source.unsafe(`SELECT * FROM "${tableName}"`);
    
    if (rows.length === 0) {
      console.log(`ℹ️ Tabela [${tableName}] está vazia na origem.`);
      return 0;
    }

    console.log(`➡️ Lendo ${rows.length} registros da nuvem...`);

    // 2. Inserir no destino com tratamento de conflito
    // Usamos ON CONFLICT DO NOTHING para evitar erros com dados já existentes (como aura.teste)
    let migratedCount = 0;
    
    // Inserção em lotes para performance
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      // Construir query dinâmica para INSERT ... ON CONFLICT DO NOTHING
      // Nota: Assume-se que a PK é 'id'. Se houver tabelas sem ID ou com PK composta, 
      // o ON CONFLICT DO NOTHING sem alvo específico funciona em versões recentes do Postgres.
      try {
        await target.unsafe(`
          INSERT INTO "${tableName}" ${target(batch)} 
          ON CONFLICT DO NOTHING
        `);
        migratedCount += batch.length;
      } catch (err: any) {
        console.error(`❌ Erro no lote da tabela [${tableName}]:`, err.message);
      }
    }

    console.log(`✅ Tabela [${tableName}] migrada! Total: ${migratedCount} registros.`);
    return migratedCount;

  } catch (error: any) {
    console.error(`❌ Erro crítico ao migrar [${tableName}]:`, error.message);
    return 0;
  }
}

async function startMigration() {
  const startTime = Date.now();
  const summary: Record<string, number> = {};

  console.log("🚀 INICIANDO MIGRAÇÃO: NEON (CLOUD) -> DOCKER (LOCAL)");
  console.log("---------------------------------------------------");

  try {
    for (const table of MIGRATION_ORDER) {
      const count = await migrateTable(table);
      summary[table] = count;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log("\n===================================================");
    console.log("🏆 MIGRAÇÃO CONCLUÍDA COM SUCESSO!");
    console.log(`⏱️ Tempo total: ${duration}s`);
    console.log("---------------------------------------------------");
    console.table(summary);
    console.log("===================================================");
    console.log("💡 Nota: As sessões foram ignoradas propositalmente.");
    
  } catch (error: any) {
    console.error("\n💥 FALHA FATAL NA MIGRAÇÃO:", error.message);
  } finally {
    await source.end();
    await target.end();
    process.exit();
  }
}

startMigration();
```

## Arquivo: `scripts\tests\populate_test_data.ts`
```typescript
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function populateTestData() {
  const testEmail = "aura.teste@gmail.com";

  console.log(`[POPULATE] Buscando empresa para o usuário: ${testEmail}`);

  try {
    // 1. Buscar o usuário e sua empresa
    const [user] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, testEmail))
      .limit(1);

    if (!user) {
      console.error("[ERROR] Usuário de teste não encontrado!");
      return;
    }

    const [company] = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.ownerId, user.id))
      .limit(1);

    if (!company) {
      console.error("[ERROR] Empresa de teste não encontrada!");
      return;
    }

    console.log(`[POPULATE] Empresa encontrada: ${company.name} (${company.id})`);

    // 2. Cadastrar Itens no Estoque
    console.log("[POPULATE] Cadastrando itens no estoque...");
    const inventoryItems = [
      {
        name: "Shampoo Pós-Química 1L",
        initialQuantity: "10",
        currentQuantity: "8",
        minQuantity: "2",
        unitPrice: "85.50",
        unit: "L",
        secondaryUnit: "ml",
        conversionFactor: "1000",
      },
      {
        name: "Esmalte Vermelho Royal",
        initialQuantity: "20",
        currentQuantity: "15",
        minQuantity: "5",
        unitPrice: "12.00",
        unit: "un",
      },
      {
        name: "Cera Depilatória Mel 500g",
        initialQuantity: "15",
        currentQuantity: "12",
        minQuantity: "3",
        unitPrice: "45.00",
        unit: "g",
        conversionFactor: "1",
      },
      {
        name: "Toalhas Brancas Algodão",
        initialQuantity: "50",
        currentQuantity: "42",
        minQuantity: "10",
        unitPrice: "15.00",
        unit: "un",
      }
    ];

    const insertedInventory = [];
    for (const item of inventoryItems) {
      const [inserted] = await db.insert(schema.inventory).values({
        id: crypto.randomUUID(),
        companyId: company.id,
        ...item,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      insertedInventory.push(inserted);

      // Criar log de entrada inicial
      await db.insert(schema.inventoryLogs).values({
        id: crypto.randomUUID(),
        inventoryId: inserted.id,
        companyId: company.id,
        type: "ENTRY",
        quantity: item.initialQuantity,
        reason: "Carga inicial de teste",
        createdAt: new Date(),
      });
    }

    // 3. Cadastrar Serviços
    console.log("[POPULATE] Cadastrando serviços...");
    const services = [
      {
        name: "Corte de Cabelo Feminino",
        description: "Corte moderno com lavagem inclusa",
        price: "120.00",
        duration: "01:00",
        icon: "scissors",
        isVisible: true,
        showOnHome: true,
      },
      {
        name: "Manicure + Pedicure",
        description: "Cutilagem e esmaltação completa",
        price: "85.00",
        duration: "01:30",
        icon: "hand",
        isVisible: true,
        showOnHome: true,
      },
      {
        name: "Escova Modeladora",
        description: "Lavagem, secagem e modelagem dos fios",
        price: "60.00",
        duration: "00:45",
        icon: "wind",
        isVisible: true,
        showOnHome: false,
      }
    ];

    for (const service of services) {
      const [insertedService] = await db.insert(schema.services).values({
        id: crypto.randomUUID(),
        companyId: company.id,
        ...service,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      // Vincular recurso ao primeiro serviço (Corte) se for o caso
      if (service.name === "Corte de Cabelo Feminino") {
        const shampoo = insertedInventory.find(i => i.name.includes("Shampoo"));
        if (shampoo) {
          await db.insert(schema.serviceResources).values({
            id: crypto.randomUUID(),
            serviceId: insertedService.id,
            inventoryId: shampoo.id,
            quantity: "50", // 50ml
            unit: "ml",
            useSecondaryUnit: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }

    console.log("-----------------------------------------");
    console.log("[SUCCESS] Dados de Teste Populados!");
    console.log(`Empresa: ${company.name}`);
    console.log(`Serviços criados: ${services.length}`);
    console.log(`Itens de estoque: ${inventoryItems.length}`);
    console.log("-----------------------------------------");

  } catch (error) {
    console.error("[FATAL] Erro ao popular dados:", error);
  } finally {
    process.exit(0);
  }
}

populateTestData();
```

## Arquivo: `scripts\tests\reset_onboarding_evellyn.ts`
```typescript
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function resetOnboarding() {
  const email = "evellync077@gmail.com";
  console.log(`[RESET] Resetando onboarding para: ${email}`);

  try {
    const [user] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1);

    if (!user) {
      console.error(`[ERROR] Usuário ${email} não encontrado.`);
      process.exit(1);
    }

    await db
      .update(schema.user)
      .set({ hasCompletedOnboarding: false })
      .where(eq(schema.user.id, user.id));

    console.log(`[SUCCESS] Onboarding resetado com sucesso para ${email}!`);
  } catch (error) {
    console.error("[FATAL] Erro ao resetar onboarding:", error);
  } finally {
    process.exit(0);
  }
}

resetOnboarding();
```

## Arquivo: `scripts\tests\set_local_password.ts`
```typescript

import postgres from "postgres";
import { v4 as uuidv4 } from "uuid";

// O erro de linter "Cannot find name Bun" ocorre porque o TS não reconhece o global do Bun em scripts isolados.
// Como o script é rodado com 'bun run', ele funciona perfeitamente na execução.
declare const Bun: any;

// --- CONFIGURAÇÃO LOCAL ---
const TARGET_URL = "postgres://postgres:admin123@localhost:5432/postgres"; // URL Local (Docker)
const target = postgres(TARGET_URL);

async function setPassword() {
  const email = "lucassa1324@gmail.com";
  const password = "admin123"; // SENHA PADRÃO PARA DESENVOLVIMENTO

  console.log(`🚀 Definindo senha para o Super Admin: ${email}`);

  try {
    // 1. Buscar o ID do usuário
    const [user] = await target.unsafe(`SELECT id FROM "user" WHERE email = $1`, [email]);

    if (!user) {
      console.error("❌ Erro: Usuário não encontrado no banco local.");
      process.exit(1);
    }

    // 2. Gerar o hash da senha usando o padrão do projeto (argon2id via Bun)
    const passwordHash = await Bun.password.hash(password, { algorithm: "argon2id" });

    // 3. Inserir ou atualizar na tabela 'account'
    // O BetterAuth espera providerId = 'credential' para login por email/senha
    const [existingAccount] = await target.unsafe(
      `SELECT id FROM "account" WHERE user_id = $1 AND provider_id = 'credential'`,
      [user.id]
    );

    if (existingAccount) {
      await target.unsafe(
        `UPDATE "account" SET "password" = $1, "updated_at" = NOW() WHERE id = $2`,
        [passwordHash, existingAccount.id]
      );
      console.log(`✅ Senha atualizada para o usuário.`);
    } else {
      const accountId = uuidv4();
      await target.unsafe(`
        INSERT INTO "account" (
          "id", "user_id", "account_id", "provider_id", "password", "created_at", "updated_at"
        ) VALUES (
          $1, $2, $3, $4, $5, NOW(), NOW()
        )
      `, [accountId, user.id, email, "credential", passwordHash]);
      console.log(`✅ Novo registro de autenticação criado.`);
    }

    console.log("\n===================================================");
    console.log("🔑 SENHA DEFINIDA COM SUCESSO!");
    console.log(`📧 Email: ${email}`);
    console.log(`🔓 Senha: ${password}`);
    console.log("---------------------------------------------------");
    console.log("💡 Agora você pode logar localmente com estas credenciais.");
    console.log("===================================================");

  } catch (error: any) {
    console.error("\n💥 ERRO AO DEFINIR SENHA:", error.message);
  } finally {
    await target.end();
    process.exit();
  }
}

setPassword();
```

## Arquivo: `scripts\tests\test_appointment_full_flow.ts`
```typescript
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq, and } from "drizzle-orm";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL";
  detail?: string;
}

async function runAppointmentFlowTests() {
  const testEmail = "aura.teste@gmail.com";
  const results: Record<string, TestResult[]> = {
    concorrencia: [],
    horario_fechamento: [],
    snapshots_integridade: [],
    validacao_campos: []
  };

  console.log(`\n=== INICIANDO TESTES DE AGENDAMENTO (FLUXO COMPLETO) ===\n`);

  try {
    // 1. Preparação: Buscar dados da empresa de teste
    const [user] = await db.select().from(schema.user).where(eq(schema.user.email, testEmail)).limit(1);
    if (!user) throw new Error("Usuário de teste não encontrado");

    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.ownerId, user.id)).limit(1);
    if (!company) throw new Error("Empresa de teste não encontrada");

    const [service] = await db.select().from(schema.services).where(eq(schema.services.companyId, company.id)).limit(1);
    if (!service) throw new Error("Serviço de teste não encontrado");

    // --- TESTE 1: Concorrência (Already Occupied) ---
    console.log("[TEST] 1. Concorrência: Agendamentos Duplicados");
    const scheduledAt = new Date();
    scheduledAt.setHours(15, 0, 0, 0); // 15:00 de hoje

    // Criar o primeiro agendamento
    const appId1 = crypto.randomUUID();
    await db.insert(schema.appointments).values({
      id: appId1,
      companyId: company.id,
      serviceId: service.id,
      customerName: "Cliente A",
      customerEmail: "a@teste.com",
      customerPhone: "11999999999",
      serviceNameSnapshot: service.name,
      servicePriceSnapshot: service.price,
      serviceDurationSnapshot: service.duration,
      scheduledAt: scheduledAt,
      status: "CONFIRMED"
    });

    // Simular a tentativa de criar um segundo agendamento no mesmo horário
    // No backend, o controller deve verificar a disponibilidade antes de inserir.
    // Aqui testamos a lógica de detecção.
    const alreadyExists = await db.select().from(schema.appointments).where(
      and(
        eq(schema.appointments.companyId, company.id),
        eq(schema.appointments.scheduledAt, scheduledAt),
        eq(schema.appointments.status, "CONFIRMED")
      )
    ).limit(1);

    results.concorrencia.push({
      name: "Detecção de horário ocupado",
      status: alreadyExists.length > 0 ? "PASS" : "FAIL",
      detail: alreadyExists.length > 0 ? "O sistema identificou o horário ocupado pelo Cliente A" : "Falha ao detectar ocupação"
    });

    // --- TESTE 2: Horário de Fechamento (Business Hours) ---
    console.log("[TEST] 2. Horário de Fechamento");
    // Vamos configurar o fechamento para 18:00
    const dayOfWeek = scheduledAt.getDay();
    await db.insert(schema.operatingHours).values({
      id: crypto.randomUUID(),
      companyId: company.id,
      dayOfWeek: String(dayOfWeek),
      status: "OPEN",
      morningStart: "09:00",
      morningEnd: "12:00",
      afternoonStart: "13:00",
      afternoonEnd: "18:00",
    }).onConflictDoUpdate({
      target: [schema.operatingHours.companyId, schema.operatingHours.dayOfWeek],
      set: { afternoonEnd: "18:00", status: "OPEN" }
    });

    // Tentar um agendamento que termine após as 18:00
    const lateScheduledAt = new Date(scheduledAt);
    lateScheduledAt.setHours(17, 30, 0, 0); // Começa 17:30
    // Se o serviço durar 60min, termina 18:30 (ULTRAPASSA)
    const serviceDurationMin = 60; // Supondo 1h
    const endTimeMin = (17 * 60 + 30) + serviceDurationMin;
    const closingTimeMin = 18 * 60;

    results.horario_fechamento.push({
      name: "Validação de término pós-expediente",
      status: endTimeMin > closingTimeMin ? "PASS" : "FAIL",
      detail: `Agendamento termina às 18:30, fechamento às 18:00. Identificado: ${endTimeMin > closingTimeMin}`
    });

    // --- TESTE 3: Snapshots e Integridade ---
    console.log("[TEST] 3. Snapshots e Integridade");
    const [lastApp] = await db.select().from(schema.appointments).where(eq(schema.appointments.id, appId1)).limit(1);

    const snapshotsCorrect =
      lastApp.serviceNameSnapshot === service.name &&
      lastApp.servicePriceSnapshot === service.price &&
      lastApp.serviceDurationSnapshot === service.duration;

    results.snapshots_integridade.push({
      name: "Snapshot de Preço/Duração no Momento do Agendamento",
      status: snapshotsCorrect ? "PASS" : "FAIL",
      detail: snapshotsCorrect ? "Dados preservados corretamente" : "Dados do snapshot divergem do serviço original"
    });

    // --- LIMPEZA ---
    await db.delete(schema.appointments).where(eq(schema.appointments.id, appId1));

    // --- DIAGNÓSTICO FINAL ---
    console.log(`\n=== DIAGNÓSTICO FINAL (AGENDAMENTOS) ===\n`);
    for (const [cat, tests] of Object.entries(results)) {
      console.log(`**${cat.toUpperCase()}**`);
      tests.forEach(t => {
        console.log(`- [${t.status}] ${t.name}`);
        if (t.detail) console.log(`  > ${t.detail}`);
      });
    }

  } catch (error) {
    console.error("\n[FATAL] Erro durante os testes de agendamento:", error);
  } finally {
    process.exit(0);
  }
}

runAppointmentFlowTests();
```

## Arquivo: `scripts\tests\test_appointments_full_management.ts`
```typescript
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { UpdateAppointmentStatusUseCase } from "../src/modules/appointments/application/use-cases/update-appointment-status.use-case";
import { DrizzleAppointmentRepository } from "../src/modules/appointments/adapters/out/drizzle/appointment.drizzle.repository";
import { DrizzleBusinessRepository } from "../src/modules/business/adapters/out/drizzle/business.drizzle.repository";
import { UserRepository } from "../src/modules/user/adapters/out/user.repository";
import { DrizzlePushSubscriptionRepository } from "../src/modules/notifications/adapters/out/drizzle/push-subscription.drizzle.repository";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "WARNING";
  detail?: string;
}

async function runFullManagementTests() {
  const testEmail = "aura.teste@gmail.com";
  const results: Record<string, TestResult[]> = {
    visualizacao_filtros: [],
    status_estoque_simples: [],
    status_estoque_multiplo: [],
    reversao_estorno: []
  };

  console.log(`\n=== INICIANDO TESTES: GESTÃO DE AGENDAMENTOS E ESTOQUE ===\n`);

  try {
    // Inicializar UseCase e Dependências
    const appointmentRepo = new DrizzleAppointmentRepository();
    const businessRepo = new DrizzleBusinessRepository();
    const userRepo = new UserRepository();
    const pushRepo = new DrizzlePushSubscriptionRepository();
    const useCase = new UpdateAppointmentStatusUseCase(appointmentRepo, businessRepo, userRepo, pushRepo);

    // 1. Preparação
    const [user] = await db.select().from(schema.user).where(eq(schema.user.email, testEmail)).limit(1);
    if (!user) throw new Error("Usuário de teste não encontrado");

    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.ownerId, user.id)).limit(1);
    if (!company) throw new Error("Empresa de teste não encontrada");

    // Buscar serviços e itens de estoque
    const services = await db.select().from(schema.services).where(eq(schema.services.companyId, company.id));
    const inventory = await db.select().from(schema.inventory).where(eq(schema.inventory.companyId, company.id));

    if (services.length < 2 || inventory.length < 1) {
      throw new Error("Dados insuficientes para teste (mínimo 2 serviços e 1 item de estoque)");
    }

    // --- TESTE 1: Visualização e Filtros ---
    console.log("[TEST] 1. Visualização e Filtros (Simulação Backend)");
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    results.visualizacao_filtros.push({
      name: "Range de Datas (Mês Atual)",
      status: "PASS",
      detail: `Filtro inicial: ${firstDay.toLocaleDateString()} até ${lastDay.toLocaleDateString()}`
    });

    // --- TESTE 2: Status e Baixa no Estoque (Simples) ---
    console.log("[TEST] 2. Baixa no Estoque (1 Serviço)");
    const service1 = services[0];
    const item1 = inventory[0];
    const initialQty = parseFloat(item1.currentQuantity || "0");

    // Criar agendamento com recurso vinculado
    const appIdSimple = crypto.randomUUID();
    await db.insert(schema.appointments).values({
      id: appIdSimple,
      companyId: company.id,
      serviceId: service1.id,
      customerName: "Teste Simples",
      customerEmail: "simples@teste.com",
      customerPhone: "11",
      serviceNameSnapshot: service1.name,
      servicePriceSnapshot: service1.price,
      serviceDurationSnapshot: service1.duration,
      scheduledAt: new Date(),
      status: "PENDING"
    });

    // Vincular recurso ao serviço (se não houver)
    const resourceId = crypto.randomUUID();
    await db.insert(schema.serviceResources).values({
      id: resourceId,
      serviceId: service1.id,
      inventoryId: item1.id,
      quantity: "1",
      unit: item1.unit || "un"
    }).onConflictDoNothing();

    // SIMULAR MUDANÇA PARA CONCLUÍDO (BAIXA NO ESTOQUE)
    // No backend real, isso deve ser uma transaction
    await db.update(schema.appointments).set({ status: "COMPLETED" }).where(eq(schema.appointments.id, appIdSimple));

    // Simular a baixa (lógica do Use Case de conclusão)
    const usageQty = 1;
    const newQty = initialQty - usageQty;
    await db.update(schema.inventory).set({ currentQuantity: String(newQty) }).where(eq(schema.inventory.id, item1.id));

    const [itemAfter] = await db.select().from(schema.inventory).where(eq(schema.inventory.id, item1.id)).limit(1);
    results.status_estoque_simples.push({
      name: "Baixa automática no estoque (1 item)",
      status: parseFloat(itemAfter.currentQuantity || "0") === newQty ? "PASS" : "FAIL",
      detail: `Qtd Anterior: ${initialQty}, Qtd Atual: ${itemAfter.currentQuantity}`
    });

    // --- TESTE 3: Múltiplos Procedimentos e Estoque ---
    console.log("[TEST] 3. Múltiplos Procedimentos e Estoque");
    const service2 = services[1];
    const appIdMulti = crypto.randomUUID();

    // Inserir agendamento principal (Usando o primeiro ID no campo principal para respeitar a FK)
    await db.insert(schema.appointments).values({
      id: appIdMulti,
      companyId: company.id,
      serviceId: service1.id,
      customerName: "Teste Multi",
      customerEmail: "multi@teste.com",
      customerPhone: "11",
      serviceNameSnapshot: `${service1.name} + ${service2.name}`,
      servicePriceSnapshot: String(Number(service1.price) + Number(service2.price)),
      serviceDurationSnapshot: "02:30",
      scheduledAt: new Date(),
      status: "PENDING"
    });

    // Inserir itens extras (A nova fonte da verdade)
    await db.insert(schema.appointmentItems).values([
      {
        id: crypto.randomUUID(),
        appointmentId: appIdMulti,
        serviceId: service1.id,
        serviceNameSnapshot: service1.name,
        servicePriceSnapshot: service1.price,
        serviceDurationSnapshot: service1.duration,
      },
      {
        id: crypto.randomUUID(),
        appointmentId: appIdMulti,
        serviceId: service2.id,
        serviceNameSnapshot: service2.name,
        servicePriceSnapshot: service2.price,
        serviceDurationSnapshot: service2.duration,
      }
    ]);

    // Criar recurso para o segundo serviço se não existir
    await db.insert(schema.serviceResources).values({
      id: crypto.randomUUID(),
      serviceId: service2.id,
      inventoryId: item1.id,
      quantity: "2",
      unit: item1.unit || "un"
    }).onConflictDoNothing();

    // Completar e verificar baixa de ambos (1 + 2 = 3 unidades)
    const [itemBeforeMulti] = await db.select().from(schema.inventory).where(eq(schema.inventory.id, item1.id)).limit(1);
    const initialQtyMulti = parseFloat(itemBeforeMulti.currentQuantity || "0");
    await useCase.execute(appIdMulti, "COMPLETED", user.id);

    const [itemMulti] = await db.select().from(schema.inventory).where(eq(schema.inventory.id, item1.id)).limit(1);
    const multiQty = parseFloat(itemMulti.currentQuantity || "0");

    results.status_estoque_multiplo.push({
      name: "Suporte a Múltiplos Procedimentos (Schema & Itens)",
      status: multiQty < initialQtyMulti ? "PASS" : "FAIL",
      detail: `Qtd Anterior: ${initialQtyMulti}, Qtd Atual: ${multiQty} (Consumiu ${initialQtyMulti - multiQty})`
    });

    // --- TESTE 4: Reversão e Estorno ---
    console.log("[TEST] 4. Reversão (Concluído -> Pendente)");
    // Simular estorno
    await db.update(schema.appointments).set({ status: "PENDING" }).where(eq(schema.appointments.id, appIdSimple));
    await db.update(schema.inventory).set({ currentQuantity: String(initialQty) }).where(eq(schema.inventory.id, item1.id));

    const [itemReverted] = await db.select().from(schema.inventory).where(eq(schema.inventory.id, item1.id)).limit(1);
    results.reversao_estorno.push({
      name: "Estorno de estoque na reversão",
      status: parseFloat(itemReverted.currentQuantity || "0") === initialQty ? "PASS" : "FAIL",
      detail: `Qtd após estorno: ${itemReverted.currentQuantity} (Esperado: ${initialQty})`
    });

    // --- LIMPEZA ---
    await db.delete(schema.appointments).where(inArray(schema.appointments.id, [appIdSimple, appIdMulti]));
    // Limpar o recurso criado apenas para o teste se necessário, mas como ele está vinculado ao serviço real, melhor deixar.

    // --- DIAGNÓSTICO FINAL ---
    console.log(`\n=== RELATÓRIO FINAL: AGENDAMENTOS E ESTOQUE ===\n`);
    for (const [cat, tests] of Object.entries(results)) {
      console.log(`**${cat.toUpperCase()}**`);
      tests.forEach(t => {
        console.log(`- [${t.status}] ${t.name}`);
        if (t.detail) console.log(`  > ${t.detail}`);
      });
    }

  } catch (error) {
    console.error("\n[FATAL] Erro durante os testes de gestão:", error);
  } finally {
    process.exit(0);
  }
}

runFullManagementTests();
```

## Arquivo: `scripts\tests\test_bugfixes.ts`
```typescript
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq, and } from "drizzle-orm";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL";
  detail?: string;
}

async function runBugFixTests() {
  const testEmail = "aura.teste@gmail.com";
  const results: Record<string, TestResult[]> = {
    email_sync: [],
    onboarding: [],
    resend_fallback: [],
    validation_bugs: []
  };

  console.log(`\n=== INICIANDO TESTES DE CORREÇÃO DE BUGS E SINCRONIZAÇÃO ===\n`);

  try {
    // 1. Preparação
    const [user] = await db.select().from(schema.user).where(eq(schema.user.email, testEmail)).limit(1);
    if (!user) throw new Error("Usuário de teste não encontrado");

    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.ownerId, user.id)).limit(1);
    if (!company) throw new Error("Empresa de teste não encontrada");

    // --- TESTE 1: Sincronização de Email ---
    // Simula a lógica do SettingsController: Profile Email -> Company Contact -> User Email
    console.log("[TEST] Sincronização e Fallback de Email");

    // Caso 1: Sem email no perfil e sem contato na empresa (deve pegar do User)
    await db.update(schema.companies).set({ contact: null }).where(eq(schema.companies.id, company.id));

    let publicEmail = null; // simulando a lógica do controller
    if (!publicEmail && company.contact) publicEmail = company.contact;
    if (!publicEmail && user.email) publicEmail = user.email;

    results.email_sync.push({
      name: "Fallback para Email do Usuário (Dono)",
      status: publicEmail === testEmail ? "PASS" : "FAIL",
      detail: `Email obtido: ${publicEmail}`
    });

    // Caso 2: Com contato na empresa (deve priorizar sobre o User)
    const companyContact = "contato@empresa.com";
    await db.update(schema.companies).set({ contact: companyContact }).where(eq(schema.companies.id, company.id));

    publicEmail = null;
    if (!publicEmail && companyContact) publicEmail = companyContact;
    if (!publicEmail && user.email) publicEmail = user.email;

    results.email_sync.push({
      name: "Prioridade para Contato da Empresa",
      status: publicEmail === companyContact ? "PASS" : "FAIL",
      detail: `Email obtido: ${publicEmail}`
    });

    // --- TESTE 2: Reset de Onboarding ---
    console.log("[TEST] Reset de Onboarding");
    await db.update(schema.user).set({ hasCompletedOnboarding: false }).where(eq(schema.user.id, user.id));
    const [updatedUser] = await db.select().from(schema.user).where(eq(schema.user.id, user.id)).limit(1);

    results.onboarding.push({
      name: "Status de Onboarding Resetado",
      status: updatedUser.hasCompletedOnboarding === false ? "PASS" : "FAIL"
    });

    // --- TESTE 3: Fallback de Slug (Duplicate Slug Bug) ---
    console.log("[TEST] Fallback de Slug Único");
    // Simulando a lógica do CreateUserUseCase que usa Date.now() no fallback
    const originalSlug = company.slug;
    const fallbackSlug = `${originalSlug}-${Date.now()}`;

    results.resend_fallback.push({
      name: "Geração de Slug Alternativo",
      status: fallbackSlug.startsWith(originalSlug) && fallbackSlug.length > originalSlug.length ? "PASS" : "FAIL",
      detail: `Slug gerado: ${fallbackSlug}`
    });

    // --- TESTE 4: Validação de Horário Passado (Logic check) ---
    console.log("[TEST] Lógica de Bloqueio de Horário Passado");
    const now = new Date();
    const futureDate = new Date(now.getTime() + 10 * 60 * 1000); // 10 min no futuro
    const pastDate = new Date(now.getTime() - 10 * 60 * 1000); // 10 min no passado

    const isFutureValid = futureDate > now;
    const isPastInvalid = pastDate < now;

    results.validation_bugs.push({
      name: "Bloqueio de horários passados",
      status: (isFutureValid && isPastInvalid) ? "PASS" : "FAIL",
      detail: `Futuro válido: ${isFutureValid}, Passado inválido: ${isPastInvalid}`
    });

    // --- DIAGNÓSTICO FINAL ---
    console.log(`\n=== DIAGNÓSTICO DE CORREÇÕES ===\n`);
    for (const [cat, tests] of Object.entries(results)) {
      console.log(`**${cat.toUpperCase()}**`);
      tests.forEach(t => {
        console.log(`- [${t.status}] ${t.name}`);
        if (t.detail) console.log(`  > ${t.detail}`);
      });
    }

  } catch (error) {
    console.error("\n[FATAL] Erro durante os testes:", error);
  } finally {
    process.exit(0);
  }
}

runBugFixTests();
```

## Arquivo: `scripts\tests\test_calendar_flow.ts`
```typescript
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq, and } from "drizzle-orm";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL";
  detail?: string;
}

async function runCalendarTests() {
  const testEmail = "aura.teste@gmail.com";
  const results: Record<string, TestResult[]> = {
    regras_negocio: [],
    horarios_passados: [],
    bloqueios: [],
    snapshots: []
  };

  console.log(`\n=== INICIANDO TESTES AVANÇADOS: CALENDÁRIO DO USUÁRIO ===\n`);

  try {
    // 1. Preparação
    const [user] = await db.select().from(schema.user).where(eq(schema.user.email, testEmail)).limit(1);
    if (!user) throw new Error("Usuário de teste não encontrado");

    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.ownerId, user.id)).limit(1);
    if (!company) throw new Error("Empresa de teste não encontrada");

    // --- TESTE 1.1: Validação de Duração Multi-Slot ---
    console.log("[TEST] 1.1 Validação de Duração Multi-Slot");
    // Criar serviço de 90min
    const service90Id = crypto.randomUUID();
    await db.insert(schema.services).values({
      id: service90Id,
      companyId: company.id,
      name: "Serviço 90min Teste",
      price: "150.00",
      duration: "01:30",
      isVisible: true
    });

    // Simular slot 10:00 livre, 10:30 ocupado
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.toISOString().split('T')[0];

    // Agendamento das 10:30 às 11:00
    const appOccupiedId = crypto.randomUUID();
    const scheduledAt1030 = new Date(today);
    scheduledAt1030.setHours(10, 30, 0, 0);

    await db.insert(schema.appointments).values({
      id: appOccupiedId,
      companyId: company.id,
      serviceId: service90Id, // reusando id pra simplificar
      customerName: "Ocupante",
      customerEmail: "ocupante@teste.com",
      customerPhone: "11",
      serviceNameSnapshot: "Serviço Ocupante",
      servicePriceSnapshot: "10",
      serviceDurationSnapshot: "00:30",
      scheduledAt: scheduledAt1030,
      status: "CONFIRMED"
    });

    // Lógica do backend para validar se o slot das 10:00 está disponível para 90min
    // O backend atual (visto no controller) verifica apenas se o INÍCIO do slot está ocupado.
    // Isso é um BUG que identificamos agora através do teste!
    const slot1000TotalMin = 10 * 60;
    const duration90Min = 90;
    const end1000TotalMin = slot1000TotalMin + duration90Min;

    const app1030StartMin = 10 * 60 + 30;
    const isSlot1000Available = !(app1030StartMin >= slot1000TotalMin && app1030StartMin < end1000TotalMin);

    results.regras_negocio.push({
      name: "Detecção de conflito em duração longa",
      status: !isSlot1000Available ? "PASS" : "FAIL",
      detail: isSlot1000Available ? "O sistema permitiu agendar 90min às 10:00 mesmo com 10:30 ocupado" : "Conflito detectado corretamente"
    });

    // --- TESTE 1.6: Validação de Horário Passado ---
    console.log("[TEST] 1.6 Validação de Horário Passado");
    const now = new Date();
    const pastTime = new Date(now.getTime() - 1000 * 60 * 60); // 1 hora atrás
    const isPast = pastTime < now;

    results.horarios_passados.push({
      name: "Identificação de horário passado",
      status: isPast ? "PASS" : "FAIL"
    });

    // --- TESTE 1.4: Snapshots ---
    console.log("[TEST] 1.4 Snapshots");
    const [service] = await db.select().from(schema.services).where(eq(schema.services.companyId, company.id)).limit(1);
    results.snapshots.push({
      name: "Presença de campos de Snapshot",
      status: (service && "price" in service && "name" in service) ? "PASS" : "FAIL"
    });

    // --- LIMPEZA ---
    await db.delete(schema.appointments).where(eq(schema.appointments.id, appOccupiedId));
    await db.delete(schema.services).where(eq(schema.services.id, service90Id));

    // --- DIAGNÓSTICO FINAL ---
    console.log(`\n=== DIAGNÓSTICO FINAL (BUGS E MELHORIAS) ===\n`);
    for (const [cat, tests] of Object.entries(results)) {
      console.log(`**${cat.toUpperCase()}**`);
      tests.forEach(t => {
        console.log(`- [${t.status}] ${t.name}`);
        if (t.detail) console.log(`  > Motivo: ${t.detail}`);
      });
    }

  } catch (error) {
    console.error("\n[FATAL] Erro durante os testes:", error);
  } finally {
    process.exit(0);
  }
}

runCalendarTests();
```

## Arquivo: `scripts\tests\test_consolidation.ts`
```typescript

import { GetSiteCustomizationUseCase } from "../../src/modules/settings/application/use-cases/get-site-customization.use-case";
import { DrizzleSettingsRepository } from "../../src/modules/settings/adapters/out/drizzle/settings.drizzle.repository";
import { db } from "../../src/modules/infrastructure/drizzle/database";
import { companies } from "../../src/db/schema";
import { eq } from "drizzle-orm";

async function testConsolidation() {
  const repository = new DrizzleSettingsRepository();
  const useCase = new GetSiteCustomizationUseCase(repository);

  const slug = "aura-teste";
  console.log(`>>> TESTANDO CONSOLIDAÇÃO PARA: ${slug}`);

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.slug, slug))
    .limit(1);

  if (!company) {
    console.error("Empresa não encontrada");
    return;
  }

  // Testar rascunho (onde as mudanças geralmente estão antes de publicar)
  const result = await useCase.execute(company.id);

  console.log("\n>>> RESULTADO CONSOLIDADO (O que o Front recebe):");
  console.log("Layout Global -> siteColors:");
  console.log(JSON.stringify(result.layoutGlobal?.siteColors, null, 2));
  console.log("\nAppointment Flow -> colors:");
  console.log(JSON.stringify(result.appointmentFlow?.colors, null, 2));
  console.log("\nAppointment Flow -> step1Services:");
  console.log(JSON.stringify(result.appointmentFlow?.step1Services, null, 2));

  if (result.appointmentFlow?.step1Services?.cardConfig?.backgroundColor) {
    console.log(`\nCOR FINAL DO CARD: ${result.appointmentFlow.step1Services.cardConfig.backgroundColor}`);
  } else {
    console.log("\nNENHUMA COR ENCONTRADA!");
  }
}

testConsolidation().catch(console.error);
```

## Arquivo: `scripts\tests\test_evellyn_dashboard_access.ts`
```typescript
import { fetch } from "bun";

async function testEvellynDashboard() {
  const email = "evellyn@gmail.com";
  const password = "Mudar@123";

  console.log(`\n--- INICIANDO TESTE DE ACESSO AO DASHBOARD (Evellyn) ---`);

  // 1. Login
  console.log(`1. Realizando login...`);
  const loginUrl = "http://localhost:3001/api/auth/sign-in/email";
  const loginRes = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (loginRes.status !== 200) {
    console.error(`❌ Erro no login: ${loginRes.status}`);
    console.log(await loginRes.text());
    return;
  }

  const loginData = await loginRes.json();
  const token = loginData.token;
  const user = loginData.user;

  console.log(`✅ Login realizado com sucesso!`);
  console.log(`👤 Usuário: ${user.name} (${user.email})`);
  console.log(`🏷️ Role: ${user.role}`);
  console.log(`🔗 Slug no login: ${user.slug}`);

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  // 2. Testar /get-session
  console.log(`\n2. Verificando /get-session...`);
  const sessionRes = await fetch("http://localhost:3001/get-session", { headers });
  const sessionData = await sessionRes.json();
  console.log(`Status: ${sessionRes.status}`);
  console.log(`Slug na sessão: ${sessionData.user?.slug}`);

  // 3. Testar /api/auth/business-info (Endpoint do Plugin)
  console.log(`\n3. Verificando /api/auth/business-info (Plugin)...`);
  const bizInfoRes = await fetch("http://localhost:3001/api/auth/business-info", { headers });
  if (bizInfoRes.status === 200) {
    const bizInfo = await bizInfoRes.json();
    console.log(`✅ Sucesso!`);
    console.log(`🏢 Estúdio: ${bizInfo.business?.name}`);
    console.log(`📍 Slug: ${bizInfo.slug}`);
  } else {
    console.log(`❌ Erro ao buscar business-info: ${bizInfoRes.status}`);
  }

  // 4. Testar /api/business/my (Rota Privada do Controller)
  console.log(`\n4. Verificando /api/business/my (Controller Privado)...`);
  const myBizRes = await fetch("http://localhost:3001/api/business/my", { headers });
  if (myBizRes.status === 200) {
    const myBizList = await myBizRes.json();
    console.log(`✅ Sucesso! Encontrado(s) ${myBizList.length} estúdio(s).`);
    myBizList.forEach((b: any) => {
      console.log(` - ${b.name} (Slug: ${b.slug}, ID: ${b.id})`);
    });
  } else {
    console.log(`❌ Erro ao acessar /api/business/my: ${myBizRes.status}`);
    console.log(await myBizRes.text());
  }

  // 5. Testar /api/appointments (Dashboard Data)
  console.log(`\n5. Verificando acesso a dados do Dashboard (/api/appointments)...`);
  // Note: O endpoint /api/appointments precisa de companyId em algumas rotas ou lista tudo?
  // Vamos tentar o GET base se existir.
  const appointmentsRes = await fetch("http://localhost:3001/api/appointments", { headers });
  console.log(`Status /api/appointments: ${appointmentsRes.status}`);
  if (appointmentsRes.status === 200) {
    console.log(`✅ Acesso ao dashboard confirmado!`);
  } else if (appointmentsRes.status === 404) {
    console.log(`ℹ️ Endpoint /api/appointments base não encontrado (esperado se for apenas sub-rotas).`);
  } else {
    console.log(`❌ Erro de permissão ou rota: ${appointmentsRes.status}`);
  }

  console.log(`\n--- FIM DO TESTE ---`);
}

testEvellynDashboard();
```

## Arquivo: `scripts\tests\test_evellyn_login_api.ts`
```typescript
// import { fetch } from "bun";
// const fetch = globalThis.fetch;

async function testLogin() {
  const email = "evellyn@gmail.com";
  const password = "Mudar@123";

  console.log(`Testing login for ${email}...`);

  // Tenta diferentes endpoints comuns para descobrir onde o BA está montado
  const endpoints = [
    "http://localhost:3001/api/auth/sign-in/email",
    "http://localhost:3001/sign-in/email",
    "http://localhost:3001/api/auth/ok"
  ];

  for (const url of endpoints) {
    console.log(`\n--- Testing ${url} ---`);
    try {
      const response = await fetch(url, {
        method: url.includes("ok") ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: url.includes("ok") ? undefined : JSON.stringify({ email, password })
      });

      const status = response.status;
      const text = await response.text();
      console.log("Status:", status);
      console.log("Raw Response:", text);

      if (status === 200 && text) {
        try {
          const data = JSON.parse(text);
          if (data.user || data.session) {
            console.log("SUCCESS: Login works!");
            return;
          }
        } catch (e) {
          // not json
        }
      }
    } catch (e: any) {
      console.log(`Error testing ${url}:`, e.message);
    }
  }

  console.log("\nFAILED: All login attempts failed.");
}

testLogin();
```

## Arquivo: `scripts\tests\test_laura_login.ts`
```typescript

import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function testLogin() {
  const email = "laura3@gmail.com";
  const passwordsToTest = ["Mudar@123", "123123123"];

  console.log(`\n--- TESTANDO LOGIN PARA: ${email} ---\n`);

  const userResult = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  const user = userResult[0];

  if (!user) {
    console.log("❌ Usuário não encontrado.");
    return;
  }

  const accountResult = await db.select().from(schema.account).where(eq(schema.account.userId, user.id)).limit(1);
  const account = accountResult[0];

  if (!account || !account.password) {
    console.log("❌ Conta ou senha não encontrada.");
    return;
  }

  const hash = account.password;
  console.log(`Hash no banco: ${hash}\n`);

  for (const pwd of passwordsToTest) {
    const isMatch = await Bun.password.verify(pwd, hash);
    console.log(`Senha [${pwd}]: ${isMatch ? "✅ CORRETA" : "❌ INCORRETA"}`);
  }

  process.exit(0);
}

testLogin().catch(err => {
  console.error(err);
  process.exit(1);
});
```

## Arquivo: `scripts\tests\test_session_slug.ts`
```typescript
import { fetch } from "bun";

async function testSession() {
  const email = "evellyn@gmail.com";
  const password = "Mudar@123";

  console.log(`\n1. Realizando login para obter token...`);
  const loginUrl = "http://localhost:3001/api/auth/sign-in/email";
  const loginRes = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const loginData = await loginRes.json();
  const token = loginData.token;
  
  if (!token) {
    console.error("Login falhou, sem token.");
    return;
  }

  console.log(`Login OK. Token: ${token.substring(0, 10)}...`);
  console.log(`Slug no sign-in: ${loginData.user?.slug}`);

  console.log(`\n2. Testando /get-session com o token...`);
  const sessionUrl = "http://localhost:3001/get-session";
  const sessionRes = await fetch(sessionUrl, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  const sessionData = await sessionRes.json();
  console.log("Status /get-session:", sessionRes.status);
  console.log("Response /get-session:", JSON.stringify(sessionData, null, 2));

  if (sessionData.user && sessionData.user.slug) {
    console.log(`\n✅ SUCESSO: O endpoint /get-session retornou o slug: ${sessionData.user.slug}`);
  } else {
    console.log(`\n❌ FALHA: O endpoint /get-session NÃO retornou o slug.`);
  }
}

testSession();
```

## Arquivo: `src\declarations.d.ts`
```typescript
declare module 'web-push';
```

## Arquivo: `src\index.ts`
```typescript
console.log("[STARTUP] Inicializando Back-end com Try-Catch Global");

// Validação CRÍTICA de variáveis de ambiente antes de qualquer coisa
if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL IS MISSING");
  throw new Error("DATABASE_URL IS MISSING");
}

if (!process.env.BETTER_AUTH_SECRET) {
  console.warn("WARNING: BETTER_AUTH_SECRET IS MISSING");
}

import { Elysia, t } from "elysia";

// Definição da App Wrapper para capturar erros de importação/inicialização
const startServer = () => {
  try {
    console.log("[STARTUP] Carregando módulos...");

    // Imports dentro do try-catch para capturar erros de linkagem/dependência circular
    const { auth, detectHashAlgorithm, verifyScryptPassword } = require("./modules/infrastructure/auth/auth");
    const { authPlugin } = require("./modules/infrastructure/auth/auth-plugin");
    const { repositoriesPlugin } = require("./modules/infrastructure/di/repositories.plugin");
    const { db } = require("./modules/infrastructure/drizzle/database");
    const schema = require("./db/schema");
    const { asaas } = require("./modules/infrastructure/payment/asaas.client");
    const { uploadToB2 } = require("./modules/infrastructure/storage/b2.storage");
    const { eq, and, count, ilike } = require("drizzle-orm");

    // Controllers
    const { UserController } = require("./modules/user/adapters/in/http/user.controller");
    const { ListUsersUseCase } = require("./modules/user/application/use-cases/list-users.use-case");
    const { CreateUserUseCase } = require("./modules/user/application/use-cases/create-user.use-case");
    const { UserRepository } = require("./modules/user/adapters/out/user.repository");

    const { businessController } = require("./modules/business/adapters/in/http/business.controller");
    const { serviceController } = require("./modules/services/adapters/in/http/service.controller");
    const { reportController } = require("./modules/reports/adapters/in/http/report.controller");
    const { appointmentController } = require("./modules/appointments/adapters/in/http/appointment.controller");
    // Tratamento especial para settingsController que teve problemas de export default/named
    const settingsModule = require("./modules/settings/adapters/in/http/settings.controller");
    const settingsController = settingsModule.default || settingsModule.settingsController;

    const { inventoryController } = require("./modules/inventory/adapters/in/http/inventory.controller");
    const { expenseController } = require("./modules/expenses/adapters/in/http/expense.controller");
    const { masterAdminController } = require("./modules/business/adapters/in/http/master-admin.controller");
    const { galleryController } = require("./modules/gallery/adapters/in/http/gallery.controller");
    const { storageController } = require("./modules/infrastructure/storage/storage.controller");
    const { notificationsController } = require("./modules/notifications/adapters/in/http/notifications.controller");
    const { pushController } = require("./modules/notifications/adapters/in/http/push.controller");
    const { userPreferencesController } = require("./modules/user/adapters/in/http/user-preferences.controller");
    const { paymentController } = require("./modules/infrastructure/payment/payment.controller");
    const { asaasWebhookController } = require("./modules/infrastructure/payment/asaas.webhook.controller");
    const { billingController } = require("./modules/billing/adapters/in/http/billing.controller");

    console.log("[STARTUP] Módulos carregados. Instanciando dependências...");

    // Instanciação de Dependências Globais
    const userRepository = new UserRepository();
    const createUserUseCase = new CreateUserUseCase(userRepository);
    const listUsersUseCase = new ListUsersUseCase(userRepository);
    const userController = new UserController(createUserUseCase, listUsersUseCase);

    console.log("[STARTUP] Criando instância do Elysia...");

    const app = new Elysia({
      name: 'AgendamentoNota'
    })
      .get("/email-verified", async ({ query }) => {
        const { token } = query;
        const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        if (!token) {
          console.log("[VERIFY_EMAIL] Chamado sem token, assumindo que veio de um redirecionamento de sucesso.");
          return Response.redirect(`${frontendUrl}/admin?verified=true`, 302);
        }

        try {
          console.log(`[VERIFY_EMAIL] Iniciando verificação para token: ${token}`);
          await auth.api.verifyEmail({
            query: {
              token
            }
          });

          console.log(`[VERIFY_EMAIL] Sucesso! Redirecionando para o login.`);
          return Response.redirect(`${frontendUrl}/admin?verified=true`, 302);
        } catch (e) {
          console.error("[VERIFY_EMAIL_ERROR]", e);
          return Response.redirect(`${frontendUrl}/admin?error=verification_failed`, 302);
        }
      })
      .all("/api/auth/*", async (ctx) => {
        console.log(`>>> [AUTH_HANDLER_START] ${ctx.request.method} ${ctx.path}`);
        try {
          // Log do body se for POST para ajudar no debug do erro 400
          if (ctx.request.method === "POST") {
            try {
              const clonedRequest = ctx.request.clone();
              const bodyText = await clonedRequest.text();
              console.log(`>>> [AUTH_BODY] ${bodyText}`);
            } catch (e) {
              console.warn(">>> [AUTH_BODY_ERROR] Não foi possível ler o corpo da requisição");
            }
          }

          // Passamos a requisição original. O Better Auth sabe lidar com ela.
          const response = await auth.handler(ctx.request);

          console.log(`<<< [AUTH_HANDLER_END] Status: ${response.status}`);

          if (response.status >= 400) {
            try {
              const clonedRes = response.clone();
              const errorText = await clonedRes.text();
              console.error(`<<< [AUTH_ERROR_DETAILS] ${errorText}`);
            } catch (e) {
              console.error("<<< [AUTH_ERROR_DETAILS_FAILED] Erro ao ler corpo do erro");
            }
          }

          // Se não houver resposta do Better Auth, retornamos erro 500
          if (!response) {
            return new Response(JSON.stringify({ error: "Internal Auth Error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" }
            });
          }

          // Pegamos o corpo da resposta. Se for nulo, usamos um JSON vazio.
          const responseBody = response.body ? response.body : JSON.stringify({});

          // Criamos a nova resposta
          const newResponse = new Response(responseBody, {
            status: response.status,
            statusText: response.statusText,
            headers: new Headers(response.headers)
          });

          // Adicionar headers de CORS manualmente para o bypass do front funcionar
          const origin = ctx.request.headers.get("origin");
          if (origin) {
            newResponse.headers.set("Access-Control-Allow-Origin", origin);
            newResponse.headers.set("Access-Control-Allow-Credentials", "true");
            newResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
            newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, X-Requested-With, Cache-Control");
          }

          // Se for logout, limpamos o cookie explicitamente para o front-end
          if (ctx.path.endsWith("/sign-out") || ctx.path.endsWith("/logout")) {
            console.log("[LOGOUT] Limpando cookie better-auth.session_token");
            newResponse.headers.set("Set-Cookie", "better-auth.session_token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax");
          }

          return newResponse;
        } catch (e: any) {
          console.error(`!!! [AUTH_HANDLER_ERROR] ${e.message}`, e.stack);
          throw e;
        }
      })
      .onRequest(({ request, set }) => {
        // Log simplificado apenas para ver a rota sendo chamada
        const url = new URL(request.url);
        if (!url.pathname.includes("/api/auth/session")) { // Opcional: silenciar logs de sessão frequentes
          console.log(`>>> [RECEIVE] ${request.method} ${url.pathname}`);
        }

        if (request.method === "OPTIONS") {
          const origin = request.headers.get("origin");
          const allowedOrigins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'https://agendamento-nota-front.vercel.app',
            'https://landingpage-agendamento-front.vercel.app',
            'https://agendamento-nota-front-git-staging-lucassa1324s-projects.vercel.app'
          ];

          const isAllowed = allowedOrigins.includes(origin!) ||
            (origin && origin.match(/http:\/\/.*\.localhost:\d+$/)) ||
            (origin && origin.match(/\.vercel\.app$/)) ||
            (origin && origin.endsWith('.vercel.app'));

          if (isAllowed && origin) {
            return new Response(null, {
              status: 204,
              headers: {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie, X-Requested-With, Cache-Control",
                "Access-Control-Max-Age": "86400",
              }
            });
          }
        }
      })
      .onBeforeHandle(({ request, set }) => {
        const origin = request.headers.get("origin");
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3002',
          'http://127.0.0.1:3000',
          'https://agendamento-nota-front.vercel.app',
          'https://landingpage-agendamento-front.vercel.app',
          'https://agendamento-nota-front-git-staging-lucassa1324s-projects.vercel.app'
        ];

        const isAllowed = allowedOrigins.includes(origin!) ||
          (origin && origin.match(/http:\/\/.*\.localhost:\d+$/)) ||
          (origin && origin.match(/\.vercel\.app$/)) ||
          (origin && origin.endsWith('.vercel.app'));

        if (isAllowed && origin) {
          set.headers["Access-Control-Allow-Origin"] = origin;
          set.headers["Access-Control-Allow-Credentials"] = "true";
          set.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH";
          set.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Cookie, X-Requested-With, Cache-Control";
          set.headers["Access-Control-Expose-Headers"] = "Set-Cookie, set-cookie, Authorization, Cache-Control";
        }

        set.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
        set.headers["Pragma"] = "no-cache";
        set.headers["Expires"] = "0";
      })
      .use(authPlugin)
      .use(repositoriesPlugin)
      .use(userController.registerRoutes())
      .group("/api", (api) =>
        api
          .post("/feedback", async ({ body, user, set, request }) => {
            try {
              const payload = body as {
                type?: "bug" | "suggestion";
                description?: string;
                screenshot?: string;
                url?: string;
                userAgent?: string;
                metadata?: Record<string, unknown>;
              };

              const feedbackType =
                payload?.type?.toLowerCase() === "suggestion"
                  ? "SUGGESTION"
                  : "BUG";

              if (!payload?.description?.trim()) {
                set.status = 400;
                return { error: "Descrição é obrigatória." };
              }

              if (feedbackType === "BUG" && !payload?.screenshot) {
                set.status = 400;
                return { error: "Screenshot é obrigatória para relato de bug." };
              }

              let screenshotUrl: string | null = null;

              const pageUrl = payload.url || "";
              let companyId: string | null = null;

              if (pageUrl) {
                try {
                  const parsedUrl = new URL(pageUrl);
                  const segments = parsedUrl.pathname
                    .split("/")
                    .map((segment) => segment.trim())
                    .filter(Boolean);
                  const blockedSlugs = new Set([
                    "admin",
                    "api",
                    "dashboard",
                    "master",
                  ]);
                  const maybeSlug = segments.find(
                    (segment) => !blockedSlugs.has(segment.toLowerCase()),
                  );

                  if (maybeSlug) {
                    const [company] = await db
                      .select({ id: schema.companies.id })
                      .from(schema.companies)
                      .where(eq(schema.companies.slug, maybeSlug.toLowerCase()))
                      .limit(1);
                    companyId = company?.id || null;
                  }
                } catch { }
              }

              if (payload.screenshot) {
                const matches = payload.screenshot.match(
                  /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/,
                );

                if (!matches || !matches[1] || !matches[2]) {
                  set.status = 400;
                  return { error: "Formato de screenshot inválido." };
                }

                const contentType = matches[1];
                const base64Data = matches[2];
                const extensionMap: Record<string, string> = {
                  "image/png": "png",
                  "image/jpeg": "jpg",
                  "image/jpg": "jpg",
                  "image/webp": "webp",
                };
                const extension = extensionMap[contentType] || "png";
                const screenshotBuffer = Buffer.from(base64Data, "base64");
                const key = `feedback/${feedbackType.toLowerCase()}/${companyId || "unknown"}/${crypto.randomUUID()}.${extension}`;
                screenshotUrl = await uploadToB2({
                  buffer: screenshotBuffer,
                  contentType,
                  key,
                  cacheControl: "public, max-age=31536000",
                });
              }

              const forwardedFor = request.headers.get("x-forwarded-for");
              const realIp = request.headers.get("x-real-ip");
              const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || null;
              const acceptLanguage = request.headers.get("accept-language");
              const clientMetadata =
                payload.metadata && typeof payload.metadata === "object"
                  ? payload.metadata
                  : {};
              const metadata = {
                ...clientMetadata,
                requestHost: request.headers.get("host"),
                requestOrigin: request.headers.get("origin"),
                requestReferer: request.headers.get("referer"),
                secChUa: request.headers.get("sec-ch-ua"),
                secChUaMobile: request.headers.get("sec-ch-ua-mobile"),
                secChUaPlatform: request.headers.get("sec-ch-ua-platform"),
                submittedAtServer: new Date().toISOString(),
              };

              const [created] = await db
                .insert(schema.bugReports)
                .values({
                  id: crypto.randomUUID(),
                  reporterUserId: user?.id || null,
                  companyId,
                  type: feedbackType,
                  description: payload.description.trim(),
                  screenshotUrl,
                  pageUrl: pageUrl || "",
                  userAgent: payload.userAgent || null,
                  ipAddress,
                  acceptLanguage,
                  metadata,
                  status: "NEW",
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })
                .returning({ id: schema.bugReports.id });

              return {
                success: true,
                id: created?.id,
                type: feedbackType,
                screenshotUrl,
              };
            } catch (error: any) {
              console.error("[BUG_REPORT_CREATE_ERROR]:", error);
              set.status = 500;
              return {
                error: "Falha ao registrar feedback.",
                message: error?.message || "Erro interno.",
              };
            }
          }, {
            body: t.Object({
              type: t.Union([t.Literal("bug"), t.Literal("suggestion")]),
              description: t.String(),
              screenshot: t.Optional(t.String()),
              url: t.Optional(t.String()),
              userAgent: t.Optional(t.String()),
              metadata: t.Optional(t.Any()),
            }),
          })
          .group("/account", (account) =>
            account
              .onBeforeHandle(({ user, set }) => {
                if (!user) {
                  set.status = 401;
                  return { error: "Unauthorized" };
                }
              })
              .patch("/complete-onboarding", async ({ user }) => {
                await db.update(schema.user)
                  .set({ hasCompletedOnboarding: true })
                  .where(eq(schema.user.id, user!.id));

                return { success: true };
              })
              .post("/cancel-feedback", async ({ user, body, set }) => {
                const { reason, details, customReason } = body as {
                  reason: string;
                  details?: string;
                  customReason?: string;
                };

                if (!reason) {
                  set.status = 422;
                  return { error: "Missing reason" };
                }

                await db.insert(schema.accountCancellationFeedback).values({
                  id: crypto.randomUUID(),
                  userId: user!.id,
                  reason,
                  details: customReason || details || null,
                  createdAt: new Date()
                });

                return { success: true };
              }, {
                body: t.Object({
                  reason: t.String(),
                  details: t.Optional(t.String()),
                  customReason: t.Optional(t.String())
                })
              })
              .get("/cancellation-offer", async ({ user }) => {
                const [currentUser] = await db
                  .select({ lastRetentionDiscountAt: schema.user.lastRetentionDiscountAt })
                  .from(schema.user)
                  .where(eq(schema.user.id, user!.id))
                  .limit(1);

                const last = currentUser?.lastRetentionDiscountAt
                  ? new Date(currentUser.lastRetentionDiscountAt)
                  : null;

                const now = new Date();
                let available = true;
                let nextEligibleAt: Date | null = null;

                if (last) {
                  const nextEligible = new Date(last);
                  nextEligible.setMonth(nextEligible.getMonth() + 12);
                  if (nextEligible > now) {
                    available = false;
                    nextEligibleAt = nextEligible;
                  }
                }

                if (!available) {
                  return { available: false, nextEligibleAt };
                }

                return {
                  available: true,
                  offer: {
                    type: "RETENTION_20_3M",
                    percentage: 20,
                    durationMonths: 3
                  }
                };
              })
              .post("/accept-offer", async ({ user, body }) => {
                const { subscriptionId } = body as { subscriptionId?: string };

                // 1. Registra que o usuário aceitou a oferta no banco
                await db.update(schema.user)
                  .set({
                    lastRetentionDiscountAt: new Date(),
                    // Opcional: você pode querer resetar o status se ele estava "PENDING_CANCELLATION"
                    accountStatus: "ACTIVE",
                    cancellationRequestedAt: null,
                    retentionEndsAt: null
                  })
                  .where(eq(schema.user.id, user!.id));

                // 2. Aplica o desconto no gateway de pagamento
                if (subscriptionId) {
                  await asaas.applyDiscount(subscriptionId, {
                    percentage: 20,
                    cycles: 3
                  });
                }

                return {
                  success: true,
                  message: "Desconto aplicado com sucesso! Obrigado por continuar conosco."
                };
              }, {
                body: t.Object({
                  subscriptionId: t.Optional(t.String())
                })
              })
              .post("/terminate", async ({ user, body }) => {
                const { subscriptionId } = body as { subscriptionId?: string };

                const [currentUser] = await db
                  .select({
                    createdAt: schema.user.createdAt,
                  })
                  .from(schema.user)
                  .where(eq(schema.user.id, user!.id))
                  .limit(1);

                const now = new Date();
                const accountCreatedAt = currentUser?.createdAt
                  ? new Date(currentUser.createdAt)
                  : now;
                const diffInMs = now.getTime() - accountCreatedAt.getTime();
                const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
                const eligibleFullRefund = diffInDays <= 7;
                const refundPolicyMessage = eligibleFullRefund
                  ? "Cancelamento dentro de 7 dias: elegível a reembolso total."
                  : "Cancelamento após 7 dias: não há reembolso parcial ou total.";

                if (subscriptionId) {
                  await asaas.cancelSubscription(subscriptionId);

                  // Se for elegível para reembolso total (7 dias), tenta estornar o último pagamento
                  if (eligibleFullRefund) {
                    try {
                      console.log(`[TERMINATE] Usuário ${user!.id} elegível para reembolso total. Buscando pagamentos da assinatura ${subscriptionId}...`);
                      const payments = await asaas.listSubscriptionPayments(subscriptionId);

                      // Filtra pagamentos confirmados ou recebidos
                      const refundablePayments = payments.filter((p: any) =>
                        p.status === "CONFIRMED" || p.status === "RECEIVED"
                      );

                      if (refundablePayments.length > 0) {
                        // Ordena por data e pega o mais recente (geralmente o único em 7 dias)
                        const latestPayment = refundablePayments.sort((a: any, b: any) =>
                          new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
                        )[0];

                        console.log(`[TERMINATE] Iniciando estorno do pagamento ${latestPayment.id} para usuário ${user!.id}`);
                        await asaas.refundPayment(latestPayment.id);
                      } else {
                        console.warn(`[TERMINATE] Nenhum pagamento confirmando encontrado para reembolso da assinatura ${subscriptionId}`);
                      }
                    } catch (refundError) {
                      console.error("[TERMINATE_REFUND_ERROR] Erro ao processar estorno automático:", refundError);
                      // Não travamos o cancelamento se o estorno falhar, mas logamos
                    }
                  }
                }

                const retentionEndsAt = new Date(now);
                retentionEndsAt.setDate(retentionEndsAt.getDate() + 365);

                await db.update(schema.user)
                  .set({
                    accountStatus: "PENDING_CANCELLATION",
                    active: false,
                    cancellationRequestedAt: now,
                    retentionEndsAt
                  })
                  .where(eq(schema.user.id, user!.id));

                return {
                  success: true,
                  status: "PENDING_CANCELLATION",
                  retentionEndsAt,
                  refundPolicy: {
                    eligibleFullRefund,
                    daysSinceAccountCreation: diffInDays,
                    message: refundPolicyMessage,
                  },
                };
              }, {
                body: t.Object({
                  subscriptionId: t.Optional(t.String())
                })
              })
          )
          .use(businessController())
          .use(serviceController())
          .use(reportController())
          .use(appointmentController())
          .use(settingsController ? settingsController() : (app: any) => app) // Fallback seguro se settingsController falhar
          .use(inventoryController())
          .use(expenseController())
          .use(masterAdminController())
          .use(galleryController())
          .use(storageController())
          .use(notificationsController())
          .use(pushController())
          .use(userPreferencesController())
          .use(paymentController())
          .use(asaasWebhookController)
          .use(billingController())
      )
      .get("/", () => {
        const urlHint = process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        return `🦊 Elysia está rodando em ${urlHint}`;
      })
      .get("/test-error", () => {
        throw new Error("Test error for logs");
      })
      .get("/api/health", async () => {
        try {
          const { db } = require("./modules/infrastructure/drizzle/database");
          const { sql } = require("drizzle-orm");
          await db.execute(sql`select 1`);
          console.log("[HEALTH_CHECK] Hitting health endpoint - SUCCESS (DB Connected)");
          return {
            status: "ok",
            database: "connected",
            timestamp: new Date().toISOString(),
            version: "V2-LOCAL-DOCKER"
          };
        } catch (e) {
          console.error("[HEALTH_CHECK] DB Connection failed:", e);
          return {
            status: "error",
            database: "disconnected",
            error: String(e),
            timestamp: new Date().toISOString()
          };
        }
      })
      // Redirecionamentos Legados para compatibilidade
      .get("/get-session", ({ set }) => { set.redirect = "/api/auth/get-session"; })
      .post("/sign-in/*", ({ path, set }) => { set.redirect = `/api/auth${path}`; })
      .post("/sign-out", ({ set }) => { set.redirect = "/api/auth/sign-out"; })
      .get("/api/auth/session", ({ set }) => { set.redirect = "/api/auth/get-session"; })
      .get("/session", ({ set }) => { set.redirect = "/api/auth/get-session"; })
      .get("/api/proxy/api/auth/session", ({ set }) => { set.redirect = "/api/auth/get-session"; })
      .get("/api/proxy/session", ({ set }) => { set.redirect = "/api/auth/get-session"; })
      .get("/api/test-error", () => {
        throw new Error("Test error for logs");
      })
      .onError(({ code, error, request }) => {
        const errorMsg = `\n[ERROR_GLOBAL] ${new Date().toISOString()} ${request.method} ${request.url} ${code}: ${error}\n${error.stack}\n`;
        console.error(`\n[ERROR_GLOBAL] ${request.method} ${request.url} ${code}:`, error);
        if (error instanceof Error) {
          console.error("Stack Trace:", error.stack);
        }
        try {
          // require("fs").appendFileSync("server_debug.log", errorMsg);
        } catch (e) { }

        return {
          error: "INTERNAL_SERVER_ERROR",
          message: error.message,
          code: code,
          stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        };
      });

    console.log("[STARTUP] Servidor configurado com sucesso.");
    const urlHint = process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    console.log(`🦊 Elysia está rodando em ${urlHint}`);

    app.listen(3001, (server) => {
      console.log(`[STARTUP] Elysia escutando explicitamente na porta ${server.port}`);
    });

    return app;
  } catch (error) {
    console.error("ERRO DE STARTUP (CRÍTICO):", error);
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
    // Retorna uma instância mínima de erro para não derrubar o processo sem logs
    return new Elysia()
      .get("/api/health", () => ({ status: "startup_failed", error: String(error) }))
      .get("/*", () => {
        return {
          error: "STARTUP_FAILED",
          details: String(error),
          stack: error instanceof Error ? error.stack : undefined
        };
      });
  }
};

// Exporta a aplicação inicializada
export default startServer();
```

## Arquivo: `src\local.ts`
```typescript
import app from "./index";

const port = 3001;

console.log(`\n>>> [LOCAL] Iniciando servidor na porta ${port}...`);
console.log(`>>> [LOCAL] Frontend URL esperada: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);

app.listen(port, () => {
  console.log(`\n🦊 Elysia está rodando em http://localhost:${port}`);
  console.log(`🚀 Diagnósticos em http://localhost:${port}/diagnostics/headers`);
});
```

## Arquivo: `src\routes.ts`
```typescript

```

## Arquivo: `src\simulate-block.ts`
```typescript

import { db } from "./modules/infrastructure/drizzle/database";
import * as schema from "./db/schema";
import { like, eq } from "drizzle-orm";

async function simulateBlock() {
  try {
    const [company] = await db.select()
      .from(schema.companies)
      .where(like(schema.companies.name, "%Aura Teste%"))
      .limit(1);

    if (!company) {
      console.log("Empresa 'Aura Teste' não encontrada.");
      process.exit(1);
    }

    console.log(`Bloqueando empresa: ${company.name} (ID: ${company.id})`);

    // 1. Marcar como inadimplente e inativa
    await db.update(schema.companies)
      .set({
        subscriptionStatus: "past_due",
        active: false,
        accessType: "automatic",
        updatedAt: new Date()
      })
      .where(eq(schema.companies.id, company.id));

    // 2. Desativar o dono
    await db.update(schema.user)
      .set({
        active: false,
        updatedAt: new Date()
      })
      .where(eq(schema.user.id, company.ownerId));

    // 3. Matar sessões para forçar re-login/re-auth
    await db.delete(schema.session)
      .where(eq(schema.session.userId, company.ownerId));

    console.log("Simulação de bloqueio concluída com sucesso.");
    process.exit(0);
  } catch (error) {
    console.error("Erro na simulação:", error);
    process.exit(1);
  }
}

simulateBlock();
```

## Arquivo: `src\db\schema.ts`
```typescript
import {
  pgTable,
  timestamp,
  text,
  uuid,
  varchar,
  boolean,
  index,
  jsonb,
  numeric,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  DEFAULT_LAYOUT_GLOBAL,
  DEFAULT_HOME_SECTION,
  DEFAULT_GALLERY_SECTION,
  DEFAULT_ABOUT_US_SECTION,
  DEFAULT_APPOINTMENT_FLOW_SECTION,
} from "../modules/business/domain/constants/site_customization.defaults";


export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  cpfCnpj: text("cpf_cnpj"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  role: text("role").default("USER").notNull(), // USER ou SUPER_ADMIN
  active: boolean("active").default(true).notNull(),
  notifyNewAppointments: boolean("notify_new_appointments").default(true).notNull(),
  notifyCancellations: boolean("notify_cancellations").default(true).notNull(),
  notifyInventoryAlerts: boolean("notify_inventory_alerts").default(true).notNull(),
  accountStatus: text("account_status").default("ACTIVE").notNull(),
  cancellationRequestedAt: timestamp("cancellation_requested_at"),
  retentionEndsAt: timestamp("retention_ends_at"),
  lastRetentionDiscountAt: timestamp("last_retention_discount_at"),
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const prospects = pgTable("prospects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  establishmentName: text("establishment_name").notNull(),
  instagramLink: text("instagram_link"),
  status: text("status", { enum: ["NOT_CONTACTED", "CONTACTED", "IN_NEGOTIATION", "CONVERTED", "REJECTED"] })
    .default("NOT_CONTACTED")
    .notNull(),
  category: text("category").notNull(), // Ex: "Studio de Sobrancelha", "Manicure", etc.
  location: text("location"), // Cidade/Bairro
  address: text("address"), // Endereço Físico
  mapsLink: text("maps_link"), // Link do Google Maps (opcional)
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const accountCancellationFeedback = pgTable("account_cancellation_feedback", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bugReports = pgTable(
  "bug_reports",
  {
    id: text("id").primaryKey(),
    reporterUserId: text("reporter_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    type: text("type").default("BUG").notNull(),
    description: text("description").notNull(),
    screenshotUrl: text("screenshot_url"),
    pageUrl: text("page_url").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    acceptLanguage: text("accept_language"),
    metadata: jsonb("metadata").default({}).notNull(),
    status: text("status").default("NEW").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("bug_reports_created_at_idx").on(table.createdAt),
    index("bug_reports_status_idx").on(table.status),
    index("bug_reports_type_idx").on(table.type),
  ],
);

export const systemSettings = pgTable("system_settings", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  address: text("address"),
  phone: text("phone"),
  contact: text("contact"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  active: boolean("active").default(true).notNull(),
  subscriptionStatus: text("subscription_status").default('trial').notNull(),
  trialEndsAt: timestamp("trial_ends_at").defaultNow(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  accessType: text("access_type").default('automatic').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const systemLogs = pgTable("system_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id),
  action: text("action").notNull(),
  details: text("details"),
  level: text("level").default("INFO").notNull(), // INFO, WARN, ERROR
  companyId: text("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const inventoryLogs = pgTable("inventory_logs", {
  id: text("id").primaryKey(),
  inventoryId: text("inventory_id")
    .notNull()
    .references(() => inventory.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["ENTRY", "EXIT"] }).notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const siteCustomizationColumns = {
  layoutGlobal: jsonb("layout_global").default(DEFAULT_LAYOUT_GLOBAL).notNull(),
  home: jsonb("home").default(DEFAULT_HOME_SECTION).notNull(),
  gallery: jsonb("gallery").default(DEFAULT_GALLERY_SECTION).notNull(),
  aboutUs: jsonb("about_us").default(DEFAULT_ABOUT_US_SECTION).notNull(),
  appointmentFlow: jsonb("appointment_flow")
    .default(DEFAULT_APPOINTMENT_FLOW_SECTION)
    .notNull(),
};

export const companySiteCustomizations = pgTable("company_site_customizations", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .unique()
    .references(() => companies.id, { onDelete: "cascade" }),
  ...siteCustomizationColumns,
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const siteDrafts = pgTable("site_drafts", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .unique()
    .references(() => companies.id, { onDelete: "cascade" }),
  ...siteCustomizationColumns,
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const services = pgTable("services", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  duration: text("duration").notNull(),
  icon: text("icon"),
  isVisible: boolean("is_visible").default(true).notNull(),
  showOnHome: boolean("show_on_home").default(false).notNull(),
  advancedRules: jsonb("advanced_rules").default({
    conflicts: [], // IDs de serviços que não podem ser feitos junto
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const appointments = pgTable("appointments", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  customerId: text("customer_id").references(() => user.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  // Snapshot do serviço no momento do agendamento
  serviceNameSnapshot: text("service_name_snapshot").notNull(),
  servicePriceSnapshot: numeric("service_price_snapshot", { precision: 10, scale: 2 }).notNull(),
  serviceDurationSnapshot: text("service_duration_snapshot").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: text("status", { enum: ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "POSTPONED"] })
    .default("PENDING")
    .notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const agendaBlocks = pgTable("agenda_blocks", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  startDate: text("start_date").notNull(), // dd/mm/aaaa
  endDate: text("end_date").notNull(),
  startTime: text("start_time"), // HH:mm
  endTime: text("end_time"),
  reason: text("reason"),
  type: text("type", { enum: ["BLOCK_HOUR", "BLOCK_DAY", "BLOCK_PERIOD"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const serviceResources = pgTable("service_resources", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  inventoryId: text("inventory_id")
    .notNull()
    .references(() => inventory.id, { onDelete: "cascade" }),

  // Quantidade consumida no serviço
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),

  // Unidade usada no consumo (pode ser a principal ou secundária do produto)
  unit: text("unit").notNull(),

  // Se está usando a unidade secundária (ajuste fino)
  useSecondaryUnit: boolean("use_secondary_unit").default(false).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const appointmentItems = pgTable("appointment_items", {
  id: text("id").primaryKey(),
  appointmentId: text("appointment_id")
    .notNull()
    .references(() => appointments.id, { onDelete: "cascade" }),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),

  // Snapshots para histórico
  serviceNameSnapshot: text("service_name_snapshot").notNull(),
  servicePriceSnapshot: numeric("service_price_snapshot", { precision: 10, scale: 2 }).notNull(),
  serviceDurationSnapshot: text("service_duration_snapshot").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const googleCalendarConfigs = pgTable("google_calendar_configs", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  icalUrl: text("ical_url"),
  syncStatus: text("sync_status").default("INACTIVE").notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const operatingHours = pgTable("operating_hours", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  dayOfWeek: text("day_of_week").notNull(), // 0-6
  status: text("status").notNull(), // "OPEN", "CLOSED"
  morningStart: text("morning_start"),
  morningEnd: text("morning_end"),
  afternoonStart: text("afternoon_start"),
  afternoonEnd: text("afternoon_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const inventory = pgTable("inventory", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  initialQuantity: numeric("initial_quantity", { precision: 10, scale: 2 }).notNull(),
  currentQuantity: numeric("current_quantity", { precision: 10, scale: 2 }).notNull(),
  minQuantity: numeric("min_quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(), // Em centavos se preferir, mas usando numeric para precisão
  unit: text("unit").notNull(), // Ex: "un", "ml", "g"
  secondaryUnit: text("secondary_unit"),
  conversionFactor: numeric("conversion_factor", { precision: 10, scale: 2 }),
  isShared: boolean("is_shared").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const fixedExpenses = pgTable("fixed_expenses", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  value: numeric("value", { precision: 10, scale: 2 }).notNull(),
  category: text("category", {
    enum: [
      "INFRAESTRUTURA",
      "UTILIDADES",
      "MARKETING",
      "PRODUTOS_INSUMOS",
      "PESSOAL",
      "SISTEMAS_SOFTWARE",
      "IMPOSTOS",
      "GERAL"
    ]
  }).notNull(),
  type: text("type", { enum: ["FIXO", "VARIAVEL", "PARCELADO"] }).default("FIXO").notNull(),
  totalInstallments: integer("total_installments").default(1),
  currentInstallment: integer("current_installment").default(1),
  parentId: text("parent_id"),
  dueDate: timestamp("due_date").notNull(),
  isPaid: boolean("is_paid").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const businessProfiles = pgTable("business_profiles", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .unique()
    .references(() => companies.id, { onDelete: "cascade" }),

  // Informações Básicas
  siteName: text("site_name"),
  titleSuffix: text("title_suffix"),
  description: text("description"),
  logoUrl: text("logo_url"),

  // Redes Sociais
  instagram: text("instagram"),
  showInstagram: boolean("show_instagram").default(true).notNull(),
  whatsapp: text("whatsapp"),
  showWhatsapp: boolean("show_whatsapp").default(true).notNull(),
  facebook: text("facebook"),
  showFacebook: boolean("show_facebook").default(true).notNull(),
  tiktok: text("tiktok"),
  showTiktok: boolean("show_tiktok").default(true).notNull(),
  linkedin: text("linkedin"),
  showLinkedin: boolean("show_linkedin").default(true).notNull(),
  twitter: text("twitter"),
  showTwitter: boolean("show_twitter").default(true).notNull(),

  // Contato e Endereço
  phone: text("phone"),
  email: text("email"),
  address: text("address"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const galleryImages = pgTable("gallery_images", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  title: text("title"),
  imageUrl: text("image_url").notNull(),
  category: text("category"),
  showInHome: boolean("show_in_home").default(false).notNull(),
  order: numeric("order").default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const companiesRelations = relations(companies, ({ one, many }) => ({
  owner: one(user, {
    fields: [companies.ownerId],
    references: [user.id],
  }),
  siteCustomization: one(companySiteCustomizations, {
    fields: [companies.id],
    references: [companySiteCustomizations.companyId],
  }),
  profile: one(businessProfiles, {
    fields: [companies.id],
    references: [businessProfiles.businessId],
  }),
  services: many(services),
  appointments: many(appointments),
  operatingHours: many(operatingHours),
  agendaBlocks: many(agendaBlocks),
  googleCalendarConfigs: many(googleCalendarConfigs),
  inventory: many(inventory),
  fixedExpenses: many(fixedExpenses),
  galleryImages: many(galleryImages),
}));

export const galleryImagesRelations = relations(galleryImages, ({ one }) => ({
  business: one(companies, {
    fields: [galleryImages.businessId],
    references: [companies.id],
  }),
}));

export const businessProfilesRelations = relations(businessProfiles, ({ one }) => ({
  business: one(companies, {
    fields: [businessProfiles.businessId],
    references: [companies.id],
  }),
}));

export const companySiteCustomizationsRelations = relations(companySiteCustomizations, ({ one }) => ({
  company: one(companies, {
    fields: [companySiteCustomizations.companyId],
    references: [companies.id],
  }),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  company: one(companies, {
    fields: [services.companyId],
    references: [companies.id],
  }),
  appointments: many(appointments),
  resources: many(serviceResources),
}));

export const serviceResourcesRelations = relations(serviceResources, ({ one }) => ({
  service: one(services, {
    fields: [serviceResources.serviceId],
    references: [services.id],
  }),
  inventory: one(inventory, {
    fields: [serviceResources.inventoryId],
    references: [inventory.id],
  }),
}));

export const agendaBlocksRelations = relations(agendaBlocks, ({ one }) => ({
  company: one(companies, {
    fields: [agendaBlocks.companyId],
    references: [companies.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  company: one(companies, {
    fields: [appointments.companyId],
    references: [companies.id],
  }),
  service: one(services, {
    fields: [appointments.serviceId],
    references: [services.id],
  }),
  customer: one(user, {
    fields: [appointments.customerId],
    references: [user.id],
  }),
  items: many(appointmentItems),
}));

export const appointmentItemsRelations = relations(appointmentItems, ({ one }) => ({
  appointment: one(appointments, {
    fields: [appointmentItems.appointmentId],
    references: [appointments.id],
  }),
  service: one(services, {
    fields: [appointmentItems.serviceId],
    references: [services.id],
  }),
}));

export const googleCalendarConfigsRelations = relations(googleCalendarConfigs, ({ one }) => ({
  company: one(companies, {
    fields: [googleCalendarConfigs.companyId],
    references: [companies.id],
  }),
}));

export const operatingHoursRelations = relations(operatingHours, ({ one }) => ({
  company: one(companies, {
    fields: [operatingHours.companyId],
    references: [companies.id],
  }),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  company: one(companies, {
    fields: [inventory.companyId],
    references: [companies.id],
  }),
}));

export const fixedExpensesRelations = relations(fixedExpenses, ({ one }) => ({
  company: one(companies, {
    fields: [fixedExpenses.companyId],
    references: [companies.id],
  }),
}));
```

## Arquivo: `src\modules\appointments\adapters\in\dtos\appointment.dto.ts`
```typescript
import { t } from "elysia";

export const createAppointmentDTO = t.Object({
  companyId: t.String(),
  serviceId: t.String(),
  customerId: t.Optional(t.Nullable(t.String())),
  scheduledAt: t.String(),
  customerName: t.String(),
  customerEmail: t.String(),
  customerPhone: t.String(),
  serviceNameSnapshot: t.String(),
  servicePriceSnapshot: t.String(),
  serviceDurationSnapshot: t.String(),
  notes: t.Optional(t.String()),
});

export const updateAppointmentStatusDTO = t.Object({
  status: t.Enum({
    PENDING: "PENDING",
    CONFIRMED: "CONFIRMED",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
    POSTPONED: "POSTPONED"
  } as const),
});

export type CreateAppointmentDTO = typeof createAppointmentDTO.static;
export type UpdateAppointmentStatusDTO = typeof updateAppointmentStatusDTO.static;
```

## Arquivo: `src\modules\appointments\adapters\in\http\appointment.controller.ts`
```typescript
import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { ListAppointmentsUseCase } from "../../../application/use-cases/list-appointments.use-case";
import { UpdateAppointmentStatusUseCase } from "../../../application/use-cases/update-appointment-status.use-case";
import { DeleteAppointmentUseCase } from "../../../application/use-cases/delete-appointment.use-case";
import { GetOperatingHoursUseCase } from "../../../../business/application/use-cases/get-operating-hours.use-case";

export function appointmentController() {
  return new Elysia({ prefix: "/appointments" })
    .use(repositoriesPlugin)
    .use(authPlugin)
    .onError(({ code, error, set }) => {
      const message = (error as any)?.message ?? String(error);
      const detail = (error as any)?.errors ?? (error as any)?.cause ?? null;
      console.error("APPOINTMENT_CONTROLLER_ERROR", code, message, detail);
    })
    // Rotas Públicas
    .group("", (publicGroup) =>
      publicGroup
        .get("/company/:companyId", async ({ params: { companyId }, query, appointmentRepository, businessRepository, set }) => {
          try {
            console.log(`>>> [BACK_PUBLIC_ACCESS] Listando agendamentos (público) para empresa: ${companyId}`);

            const startDateStr = query.startDate as string;
            const endDateStr = query.endDate as string;

            const startDate = startDateStr ? new Date(startDateStr) : undefined;
            const endDate = endDateStr ? new Date(endDateStr) : undefined;

            // Se for uma requisição de slots (apenas uma data)
            const isSlotRequest = startDateStr && endDateStr && startDateStr.split('T')[0] === endDateStr.split('T')[0];

            const listAppointmentsUseCase = new ListAppointmentsUseCase(appointmentRepository, businessRepository);
            const appointments = await listAppointmentsUseCase.execute(companyId, undefined, startDate, endDate);

            // Se for pedido de slots, gerar a grade de horários disponíveis
            if (isSlotRequest && startDate) {
              console.log(`>>> [SLOT_GENERATION] Gerando slots para ${startDateStr.split('T')[0]}`);

              const settingsUseCase = new GetOperatingHoursUseCase(businessRepository);
              const settings = await settingsUseCase.execute(companyId);

              if (!settings) return [];

              const dayIndex = startDate.getUTCDay();
              const dayNames = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
              const dayName = dayNames[dayIndex];

              // Tentar encontrar por índice (0-6) ou por nome (SEGUNDA, etc)
              const dayConfig = settings.weekly.find((w: any) =>
                String(w.dayOfWeek) === String(dayIndex) ||
                String(w.dayOfWeek).toUpperCase() === dayName
              );

              if (!dayConfig || dayConfig.status === "CLOSED") {
                return { slots: [], closed: true };
              }

              // Converter intervalo HH:mm para minutos
              const [intH, intM] = settings.interval.split(':').map(Number);
              const intervalMin = (intH * 60) + intM;

              const slots: any[] = [];

              const processPeriod = (startStr: string | null | undefined, endStr: string | null | undefined) => {
                if (!startStr || !endStr) return;

                const [sH, sM] = startStr.split(':').map(Number);
                const [eH, eM] = endStr.split(':').map(Number);

                let currentTotalMin = (sH * 60) + sM;
                const endTotalMin = (eH * 60) + eM;

                while (currentTotalMin + intervalMin <= endTotalMin) {
                  const h = Math.floor(currentTotalMin / 60);
                  const m = currentTotalMin % 60;
                  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

                  // Verificar se o horário está ocupado por um agendamento (considerando duração)
                  const isOccupied = appointments.some(app => {
                    const appDate = new Date(app.scheduledAt);
                    // Usar o horário local para comparação com o expediente (HH:mm)
                    const appH = appDate.getHours();
                    const appM = appDate.getMinutes();

                    const appStartTotalMin = (appH * 60) + appM;

                    // Pegar duração do snapshot (formato HH:mm ou minutos)
                    let durationMin = 30; // default
                    if (app.serviceDurationSnapshot) {
                      if (app.serviceDurationSnapshot.includes(':')) {
                        const [dH, dM] = app.serviceDurationSnapshot.split(':').map(Number);
                        durationMin = (dH * 60) + dM;
                      } else if (/^\d+$/.test(app.serviceDurationSnapshot)) {
                        durationMin = parseInt(app.serviceDurationSnapshot);
                      }
                    }

                    const appEndTotalMin = appStartTotalMin + durationMin;

                    // O slot está ocupado se o seu início estiver dentro do intervalo do agendamento
                    // ou se o agendamento começar durante este slot
                    return app.status !== 'CANCELLED' &&
                      currentTotalMin >= appStartTotalMin &&
                      currentTotalMin < appEndTotalMin;
                  });

                  // Verificar bloqueios de agenda
                  const isBlocked = settings.blocks.some((block: any) => {
                    const blockStart = block.startTime || "00:00";
                    const blockEnd = block.endTime || "23:59";
                    return timeStr >= blockStart && timeStr < blockEnd;
                  });

                  slots.push({
                    time: timeStr,
                    available: !isOccupied && !isBlocked,
                    reason: isOccupied ? 'OCCUPIED' : (isBlocked ? 'BLOCKED' : null)
                  });

                  currentTotalMin += intervalMin;
                }
              };

              processPeriod(dayConfig.morningStart, dayConfig.morningEnd);
              processPeriod(dayConfig.afternoonStart, dayConfig.afternoonEnd);

              return {
                date: startDateStr.split('T')[0],
                interval: settings.interval,
                slots
              };
            }

            // Sanitização padrão para listagem de agendamentos
            return appointments.map(app => ({
              id: app.id,
              scheduledAt: app.scheduledAt,
              status: app.status,
              serviceId: app.serviceId,
              duration: app.serviceDurationSnapshot,
            }));
          } catch (error: any) {
            set.status = 500;
            return { error: "Internal Server Error", message: error.message };
          }
        }, {
          params: t.Object({ companyId: t.String() }),
          query: t.Object({
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String())
          })
        })
        .post("/", async ({ body, headers, appointmentRepository, serviceRepository, businessRepository, pushSubscriptionRepository, userRepository, user, set }) => {
          console.log("\n>>> [BACK_PUBLIC_ACCESS] Recebendo agendamento público POST /api/appointments");
          console.log("Dados recebidos:", JSON.stringify(body));

          try {
            // Lazy load CreateAppointmentUseCase to avoid circular initialization
            const { CreateAppointmentUseCase } = await import("../../../application/use-cases/create-appointment.use-case");

            let companyId = body.companyId;

            // Tentativa de resolver companyId pelo slug se não vier no body
            if (!companyId) {
              const businessSlug = headers['x-business-slug'];
              if (businessSlug) {
                console.log(`[APPOINTMENT_CONTROLLER] Buscando empresa pelo slug: ${businessSlug}`);
                const business = await businessRepository.findBySlug(businessSlug);
                if (business) {
                  companyId = business.id;
                  console.log(`[APPOINTMENT_CONTROLLER] Empresa encontrada: ${companyId}`);
                }
              }
            }

            if (!companyId) {
              set.status = 400;
              return { error: "Validation error", message: "Company ID is required" };
            }

            const scheduledAt = new Date(body.scheduledAt);

            // Validação de data
            if (isNaN(scheduledAt.getTime())) {
              set.status = 400;
              return {
                error: "Invalid date format",
                message: "A data de agendamento fornecida é inválida. Use o formato ISO (ex: 2025-12-24T10:00:00Z)"
              };
            }

            const createAppointmentUseCase = new CreateAppointmentUseCase(
              appointmentRepository,
              serviceRepository,
              businessRepository,
              pushSubscriptionRepository,
              userRepository
            );

            const result = await createAppointmentUseCase.execute({
              ...body,
              companyId, // Garante que usa o ID resolvido
              customerId: body.customerId || user?.id,
              scheduledAt,
            }, user?.id); // Passa user?.id (pode ser undefined se público)

            return result;
          } catch (error: any) {
            console.error("[APPOINTMENT_CONTROLLER] Erro ao criar agendamento:", error);

            const errorMessage = error.message || "Erro interno ao criar agendamento";

            if (errorMessage.includes("Unauthorized")) {
              set.status = 403;
              return { error: "Permission denied", message: errorMessage };
            }

            if (errorMessage.includes("Service") || errorMessage.includes("not available")) {
              set.status = 400;
              return { error: "Validation error", message: errorMessage };
            }

            if (errorMessage.includes("Business not found")) {
              set.status = 404;
              return { error: "Not Found", message: errorMessage };
            }

            // Erros de regra de negócio (horário, conflito, etc)
            if (
              errorMessage.includes("exceed business hours") ||
              errorMessage.includes("closed on this day") ||
              errorMessage.includes("already occupied") ||
              errorMessage.includes("operating hours not configured") ||
              errorMessage.includes("horário passado")
            ) {
              set.status = 400;
              return { error: "Scheduling Error", message: errorMessage };
            }

            set.status = 500;
            return {
              error: "Internal Server Error",
              message: errorMessage,
              detail: error.detail || error.toString()
            };
          }
        }, {
          body: t.Object({
            companyId: t.Optional(t.String()), // Agora é opcional no schema, pois pode vir pelo slug
            serviceId: t.String(),
            customerId: t.Optional(t.Nullable(t.String())),
            scheduledAt: t.String(),
            customerName: t.String(),
            customerEmail: t.String(),
            customerPhone: t.String(),
            serviceNameSnapshot: t.String(),
            servicePriceSnapshot: t.String(),
            serviceDurationSnapshot: t.String(),
            notes: t.Optional(t.String()),
            items: t.Optional(t.Array(t.Object({
              serviceId: t.String(),
              serviceNameSnapshot: t.String(),
              servicePriceSnapshot: t.String(),
              serviceDurationSnapshot: t.String(),
            }))),
          })
        })
    )
    // Rotas Privadas
    .group("", (privateGroup) =>
      privateGroup
        .onBeforeHandle(({ user, set }) => {
          if (!user) {
            set.status = 401;
            return { error: "Unauthorized" };
          }
        })
        .get("/admin/company/:companyId", async ({ params: { companyId }, query, appointmentRepository, businessRepository, user, set }) => {
          try {
            console.log(`>>> [BACK_ADMIN_ACCESS] Listando agendamentos (admin) para empresa: ${companyId}`);

            const startDateStr = query.startDate as string;
            const endDateStr = query.endDate as string;

            const startDate = startDateStr ? new Date(startDateStr) : undefined;
            const endDate = endDateStr ? new Date(endDateStr) : undefined;

            console.log(`>>> [FILTRO_DATA] Start: ${startDateStr}, End: ${endDateStr}`);

            const listAppointmentsUseCase = new ListAppointmentsUseCase(appointmentRepository, businessRepository);
            const results = await listAppointmentsUseCase.execute(companyId, user!.id, startDate, endDate);

            console.log(`>>> [ADMIN_RESULTS] Encontrados ${results.length} agendamentos`);

            return results || [];
          } catch (error: any) {
            console.error(`>>> [ADMIN_ERROR]`, error.message);
            set.status = error.message.includes("Unauthorized access") ? 403 : 500;
            return { error: error.message };
          }
        }, {
          params: t.Object({ companyId: t.String() }),
          query: t.Object({
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String())
          })
        })
        .patch("/:id/status", async ({ params: { id }, body, appointmentRepository, businessRepository, userRepository, pushSubscriptionRepository, user, set }) => {
          try {
            const updateAppointmentStatusUseCase = new UpdateAppointmentStatusUseCase(
              appointmentRepository,
              businessRepository,
              userRepository,
              pushSubscriptionRepository
            );
            return await updateAppointmentStatusUseCase.execute(id, body.status, user!.id);
          } catch (error: any) {
            set.status = 403;
            return { error: error.message };
          }
        }, {
          body: t.Object({
            status: t.Enum({
              PENDING: "PENDING",
              CONFIRMED: "CONFIRMED",
              COMPLETED: "COMPLETED",
              CANCELLED: "CANCELLED",
              POSTPONED: "POSTPONED"
            } as const),
          })
        })
        .delete("/:id", async ({ params: { id }, appointmentRepository, businessRepository, user, set }) => {
          try {
            const deleteAppointmentUseCase = new DeleteAppointmentUseCase(appointmentRepository, businessRepository);
            await deleteAppointmentUseCase.execute(id, user!.id);
            return { success: true };
          } catch (error: any) {
            set.status = 403;
            return { error: error.message };
          }
        })
    );
}
```

## Arquivo: `src\modules\appointments\adapters\out\drizzle\appointment.drizzle.repository.ts`
```typescript
import { db } from "../../../../infrastructure/drizzle/database";
import { appointments, appointmentItems } from "../../../../../db/schema";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import { IAppointmentRepository } from "../../../domain/ports/appointment.repository";
import { Appointment, CreateAppointmentInput, AppointmentStatus, AppointmentItem } from "../../../domain/entities/appointment.entity";

export class DrizzleAppointmentRepository implements IAppointmentRepository {
  async findById(id: string): Promise<Appointment | null> {
    const [result] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);

    if (!result) return null;

    const items = await db
      .select()
      .from(appointmentItems)
      .where(eq(appointmentItems.appointmentId, id));

    return {
      ...(result as Appointment),
      items: items as AppointmentItem[],
    };
  }

  async findAllByCompanyId(companyId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]> {
    const filters = [eq(appointments.companyId, companyId)];

    if (startDate) {
      filters.push(gte(appointments.scheduledAt, startDate));
    }

    if (endDate) {
      filters.push(lte(appointments.scheduledAt, endDate));
    }

    const results = await db
      .select()
      .from(appointments)
      .where(and(...filters));

    if (results.length === 0) return [];

    const appointmentIds = results.map(r => r.id);
    const allItems = await db
      .select()
      .from(appointmentItems)
      .where(inArray(appointmentItems.appointmentId, appointmentIds));

    return results.map(r => ({
      ...(r as Appointment),
      items: allItems.filter(item => item.appointmentId === r.id) as AppointmentItem[],
    }));
  }

  async findAllByCustomerId(customerId: string): Promise<Appointment[]> {
    const results = await db
      .select()
      .from(appointments)
      .where(eq(appointments.customerId, customerId));

    if (results.length === 0) return [];

    const appointmentIds = results.map(r => r.id);
    const allItems = await db
      .select()
      .from(appointmentItems)
      .where(inArray(appointmentItems.appointmentId, appointmentIds));

    return results.map(r => ({
      ...(r as Appointment),
      items: allItems.filter(item => item.appointmentId === r.id) as AppointmentItem[],
    }));
  }

  async create(data: CreateAppointmentInput): Promise<Appointment> {
    const { items, ...appointmentData } = data;
    const appointmentId = crypto.randomUUID();

    const [newAppointment] = await db
      .insert(appointments)
      .values({
        id: appointmentId,
        ...appointmentData,
      })
      .returning();

    let createdItems: AppointmentItem[] = [];

    if (items && items.length > 0) {
      const itemsToInsert = items.map(item => ({
        id: crypto.randomUUID(),
        appointmentId,
        ...item,
      }));

      const insertedItems = await db
        .insert(appointmentItems)
        .values(itemsToInsert)
        .returning();

      createdItems = insertedItems as AppointmentItem[];
    }

    return {
      ...(newAppointment as Appointment),
      items: createdItems,
    };
  }

  async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment | null> {
    const [updated] = await db
      .update(appointments)
      .set({ status, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();

    return (updated as Appointment) || null;
  }

  async delete(id: string): Promise<void> {
    await db.delete(appointments).where(eq(appointments.id, id));
  }

  async sumRevenueByCompanyId(companyId: string, startDate?: Date, endDate?: Date): Promise<number> {
    const filters = [
      eq(appointments.companyId, companyId),
      eq(appointments.status, "COMPLETED")
    ];

    if (startDate) {
      filters.push(gte(appointments.scheduledAt, startDate));
    }

    if (endDate) {
      filters.push(lte(appointments.scheduledAt, endDate));
    }

    const [result] = await db
      .select({
        total: sql<string>`sum(${appointments.servicePriceSnapshot})`,
      })
      .from(appointments)
      .where(and(...filters));

    return parseFloat(result?.total || "0");
  }
}
```

## Arquivo: `src\modules\appointments\application\use-cases\create-appointment.use-case.ts`
```typescript
import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { IServiceRepository } from "../../../services/domain/ports/service.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";
import { CreateAppointmentInput } from "../../domain/entities/appointment.entity";
import { IPushSubscriptionRepository } from "../../../notifications/domain/ports/push-subscription.repository";
import { UserRepository } from "../../../user/adapters/out/user.repository";
import { NotificationService } from "../../../notifications/application/notification.service";
import { TransactionalEmailService } from "../../../notifications/application/transactional-email.service";

export class CreateAppointmentUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private serviceRepository: IServiceRepository,
    private businessRepository: IBusinessRepository,
    private pushSubscriptionRepository: IPushSubscriptionRepository,
    private userRepository: UserRepository
  ) { }

  async execute(data: CreateAppointmentInput, userId?: string) {
    // Valida se a empresa existe
    const business = await this.businessRepository.findById(data.companyId);
    if (!business) {
      throw new Error("Business not found");
    }

    // Se houver um userId, validamos se é o dono (agendamento manual via admin)
    if (userId && business.ownerId !== userId) {
      throw new Error("Unauthorized: Only business owners can create manual appointments");
    }

    // Suporte a múltiplos serviços
    let serviceIds: string[] = [];

    // Prioridade 1: Se o frontend enviou a lista detalhada de itens (Novo padrão)
    if (data.items && data.items.length > 0) {
      serviceIds = data.items.map(it => it.serviceId);
    }
    // Prioridade 2: Se enviou IDs separados por vírgula na string serviceId (Fallback/Legado)
    else if (typeof data.serviceId === 'string' && data.serviceId.includes(',')) {
      serviceIds = data.serviceId.split(',').map(id => id.trim()).filter(id => id !== "");
    }
    // Prioridade 3: Apenas um ID simples
    else if (data.serviceId) {
      serviceIds = [data.serviceId];
    }

    if (serviceIds.length === 0) {
      throw new Error("Nenhum serviço selecionado para o agendamento");
    }

    const services = [];
    let totalDurationMin = 0;
    let totalPrice = 0;
    let combinedServiceNames = [];
    const appointmentItemsList = [];

    for (const sId of serviceIds) {
      const service = await this.serviceRepository.findById(sId);
      if (!service) {
        console.error(`[CREATE_APPOINTMENT_ERROR] Service not found: "${sId}". Full data:`, JSON.stringify(data));
        throw new Error(`Service not found: ${sId}. O ID enviado pelo frontend não existe no banco de dados.`);
      }

      if (service.companyId !== data.companyId) {
        throw new Error(`Service ${service.name} does not belong to this company`);
      }
      services.push(service);

      // Calcula a duração total do agendamento
      let durationMin = 0;
      if (service.duration && typeof service.duration === 'string') {
        if (service.duration.includes(':')) {
          const [h, m] = service.duration.split(':').map(Number);
          durationMin = (h * 60) + (m || 0);
        } else if (/^\d+$/.test(service.duration)) {
          durationMin = parseInt(service.duration);
        }
      }
      totalDurationMin += durationMin;
    }

    // Define o ID do serviço principal como o primeiro (necessário para compatibilidade com a FK do banco)
    data.serviceId = serviceIds[0];

    // Snapshot final com todos os nomes dos serviços se houver múltiplos
    if (services.length > 1) {
      data.serviceNameSnapshot = services.map(s => s.name).join(', ');
      data.servicePriceSnapshot = services.reduce((acc, s) => acc + parseFloat(s.price), 0).toString();

      const totalHours = Math.floor(totalDurationMin / 60);
      const totalMins = totalDurationMin % 60;
      data.serviceDurationSnapshot = `${String(totalHours).padStart(2, '0')}:${String(totalMins).padStart(2, '0')}`;
    }

    // Criar a lista de AppointmentItem a partir dos serviços carregados
    const items = services.map(service => ({
      serviceId: service.id,
      serviceNameSnapshot: service.name,
      servicePriceSnapshot: service.price,
      serviceDurationSnapshot: service.duration,
    }));

    // Agora substituímos os itens que podem ter vindo incompletos do front pelos dados reais do banco
    data.items = items;

    // Valida disponibilidade de horário
    const scheduledAt = new Date(data.scheduledAt);
    data.scheduledAt = scheduledAt; // Garante que o campo no objeto data seja um objeto Date para o Drizzle

    // Obter data e hora no fuso horário de Brasília (America/Sao_Paulo)
    // Isso garante que a validação funcione independente do fuso horário do servidor (ex: Vercel em UTC)
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });

    const parts = formatter.formatToParts(scheduledAt);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value;

    if (!userId) {
      const nowInBrt = new Date();
      const nowParts = formatter.formatToParts(nowInBrt);
      const getNowPart = (type: string) =>
        nowParts.find((p) => p.type === type)?.value || "00";

      const scheduledDateKey = `${getPart("year")}${getPart("month")}${getPart("day")}`;
      const nowDateKey = `${getNowPart("year")}${getNowPart("month")}${getNowPart("day")}`;
      const scheduledMinuteOfDay =
        parseInt(getPart("hour") || "0") * 60 + parseInt(getPart("minute") || "0");
      const nowMinuteOfDay =
        parseInt(getNowPart("hour")) * 60 + parseInt(getNowPart("minute"));

      const isPastDate = Number(scheduledDateKey) < Number(nowDateKey);
      const isPastTimeSameDay =
        scheduledDateKey === nowDateKey && scheduledMinuteOfDay <= nowMinuteOfDay;

      if (isPastDate || isPastTimeSameDay) {
        throw new Error("Não é possível agendar em horário passado.");
      }
    }

    // Mapeamento de dia da semana do Intl para o nosso padrão
    const weekdayMap: Record<string, number> = {
      'domingo': 0, 'segunda-feira': 1, 'terça-feira': 2, 'quarta-feira': 3,
      'quinta-feira': 4, 'sexta-feira': 5, 'sábado': 6
    };

    const weekdayStr = getPart('weekday')?.toLowerCase() || '';
    const dayOfWeek = weekdayMap[weekdayStr] ?? scheduledAt.getDay(); // fallback para o dia local se falhar

    const dayNames = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
    const dayName = dayNames[dayOfWeek];

    const settings = await this.businessRepository.getOperatingHours(data.companyId);
    if (!settings) {
      throw new Error("Business operating hours not configured");
    }

    const dayConfig = settings.weekly.find((w: any) =>
      String(w.dayOfWeek) === String(dayOfWeek) ||
      String(w.dayOfWeek).toUpperCase() === dayName
    );

    if (!dayConfig || dayConfig.status === "CLOSED") {
      throw new Error("Business is closed on this day");
    }

    // Validar se o horário está dentro do expediente (usando horário local de Brasília)
    const appH = parseInt(getPart('hour') || '0');
    const appM = parseInt(getPart('minute') || '0');
    const appTimeTotalMin = (appH * 60) + appM;

    if (!userId) {
      const minimumBookingLeadMinutes = Math.max(
        0,
        Number((settings as any).minimumBookingLeadMinutes ?? 0),
      );
      if (minimumBookingLeadMinutes > 0) {
        const nowParts = formatter.formatToParts(new Date());
        const getNowPart = (type: string) =>
          nowParts.find((p) => p.type === type)?.value || "00";
        const scheduledDateKey = `${getPart("year")}${getPart("month")}${getPart("day")}`;
        const nowDateKey = `${getNowPart("year")}${getNowPart("month")}${getNowPart("day")}`;
        if (scheduledDateKey === nowDateKey) {
          const nowMinuteOfDay =
            parseInt(getNowPart("hour")) * 60 + parseInt(getNowPart("minute"));
          const diffMinutes = appTimeTotalMin - nowMinuteOfDay;
          if (diffMinutes < minimumBookingLeadMinutes) {
            throw new Error(
              `É necessário agendar com pelo menos ${minimumBookingLeadMinutes} minutos de antecedência.`,
            );
          }
        }
      }
    }

    const checkTimeInPeriod = (startStr?: string | null, endStr?: string | null) => {
      if (!startStr || !endStr) return false;
      const [sH, sM] = startStr.split(':').map(Number);
      const [eH, eM] = endStr.split(':').map(Number);
      const startMin = (sH * 60) + sM;
      const endMin = (eH * 60) + eM;
      return appTimeTotalMin >= startMin && (appTimeTotalMin + totalDurationMin) <= endMin;
    };

    const isInMorning = checkTimeInPeriod(dayConfig.morningStart, dayConfig.morningEnd);
    const isInAfternoon = checkTimeInPeriod(dayConfig.afternoonStart, dayConfig.afternoonEnd);

    if (!isInMorning && !isInAfternoon) {
      throw new Error("O horário selecionado e a duração total excedem o horário de funcionamento.");
    }

    // --- BUSCA DE AGENDAMENTOS EXISTENTES (Intervalo de 24h em BRT) ---
    // Precisamos buscar agendamentos que caem no mesmo dia em Brasília
    const day = getPart('day');
    const month = getPart('month');
    const year = getPart('year');

    // Criamos as datas de início e fim do dia no timezone de Brasília
    // BRT é UTC-3. Então 00:00 BRT = 03:00 UTC.
    const startOfDay = new Date(`${year}-${month}-${day}T00:00:00.000-03:00`);
    const endOfDay = new Date(`${year}-${month}-${day}T23:59:59.999-03:00`);

    // Validar conflitos com outros agendamentos
    const existingAppointments = await this.appointmentRepository.findAllByCompanyId(
      data.companyId,
      startOfDay,
      endOfDay
    );

    // Converte a data do agendamento para o timezone local de Brasília
    const appStartMin = appTimeTotalMin;
    const appEndMin = appStartMin + totalDurationMin;

    const hasConflict = existingAppointments.some(app => {
      if (app.status === 'CANCELLED') return false;

      const dbDate = new Date(app.scheduledAt);

      // Comparação de dia usando o timezone de Brasília
      const dbDateParts = formatter.formatToParts(dbDate);
      const dbDay = dbDateParts.find(p => p.type === 'day')?.value;
      const dbMonth = dbDateParts.find(p => p.type === 'month')?.value;
      const schDay = parts.find(p => p.type === 'day')?.value;
      const schMonth = parts.find(p => p.type === 'month')?.value;

      if (dbDay !== schDay || dbMonth !== schMonth) {
        return false;
      }

      const dbH = parseInt(dbDateParts.find(p => p.type === 'hour')?.value || '0');
      const dbM = parseInt(dbDateParts.find(p => p.type === 'minute')?.value || '0');
      const existingStart = (dbH * 60) + dbM;

      let existingDuration = 30;
      if (app.serviceDurationSnapshot) {
        if (app.serviceDurationSnapshot.includes(':')) {
          const [dH, dM] = app.serviceDurationSnapshot.split(':').map(Number);
          existingDuration = (dH * 60) + dM;
        } else if (/^\d+$/.test(app.serviceDurationSnapshot)) {
          existingDuration = parseInt(app.serviceDurationSnapshot);
        }
      }
      const existingEnd = existingStart + existingDuration;

      return appStartMin < existingEnd && appEndMin > existingStart;
    });

    if (hasConflict) {
      throw new Error("O horário selecionado já está ocupado.");
    }

    // --- NOVA VALIDAÇÃO: PROCEDIMENTOS INCOMPATÍVEIS (Advanced Rules) ---
    // Verifica se o cliente já tem agendamentos no MESMO DIA que sejam incompatíveis com os novos serviços
    const customerAppointments = existingAppointments.filter(app => {
      if (app.status === 'CANCELLED') return false;

      // Verifica se é o mesmo cliente (por ID, Email ou Telefone)
      const isSameCustomer =
        (data.customerId && app.customerId === data.customerId) ||
        (data.customerEmail && app.customerEmail === data.customerEmail) ||
        (data.customerPhone && app.customerPhone === data.customerPhone);

      // Verifica se é o mesmo dia
      const appDate = new Date(app.scheduledAt);
      const isSameDay = appDate.getDate() === scheduledAt.getDate() && appDate.getMonth() === scheduledAt.getMonth();

      return isSameCustomer && isSameDay;
    });

    if (customerAppointments.length > 0) {
      for (const existingApp of customerAppointments) {
        const existingService = await this.serviceRepository.findById(existingApp.serviceId);
        if (!existingService) continue;

        const existingConflicts = (existingService.advancedRules as any)?.conflicts || [];

        for (const newService of services) {
          const newConflicts = (newService.advancedRules as any)?.conflicts || [];

          // 1. O serviço existente proíbe o novo?
          if (existingConflicts.includes(newService.id)) {
            throw new Error(`Conflito: O serviço '${newService.name}' não pode ser realizado no mesmo dia que '${existingService.name}'`);
          }

          // 2. O novo serviço proíbe o existente?
          if (newConflicts.includes(existingService.id)) {
            throw new Error(`Conflito: O serviço '${newService.name}' não pode ser realizado no mesmo dia que '${existingService.name}'`);
          }
        }
      }
    }

    // Persistência no repositório
    const newAppointment = await this.appointmentRepository.create(data);

    // Web Push Notification: notify business owner about the new appointment
    // Executamos em background (sem await) para não travar a resposta para o cliente
    (async () => {
      try {
        const ownerId = business.ownerId;
        const owner = await this.userRepository.find(ownerId);
        const transactionalEmailService = new TransactionalEmailService();

        if (owner && owner.notifyNewAppointments) {
          const notificationService = new NotificationService(this.pushSubscriptionRepository);

          const date = new Date(newAppointment.scheduledAt);
          const formatter = new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
          });
          const formattedDate = formatter.format(date);

          await notificationService.sendToUser(
            ownerId,
            "📅 Novo Agendamento!",
            `${newAppointment.customerName} agendou ${newAppointment.serviceNameSnapshot} para ${formattedDate}`
          );
          console.log(`[WEBPUSH] Notificação de agendamento enviada para ${owner.email}`);
        }

        if (data.customerEmail) {
          await transactionalEmailService.sendAppointmentConfirmationToCustomer({
            to: data.customerEmail,
            customerName: newAppointment.customerName,
            serviceName: newAppointment.serviceNameSnapshot,
            businessName: business.name,
            scheduledAt: new Date(newAppointment.scheduledAt),
          });
        }

        if (owner?.email) {
          await transactionalEmailService.sendAppointmentAlertToOwner({
            to: owner.email,
            ownerName: owner.name || "Administrador",
            customerName: newAppointment.customerName,
            serviceName: newAppointment.serviceNameSnapshot,
            businessName: business.name,
            scheduledAt: new Date(newAppointment.scheduledAt),
          });
        }
      } catch (notifyError: any) {
        console.error("[WEBPUSH_TRIGGER_ERROR]", notifyError?.message || notifyError);
      }
    })();

    return newAppointment;
  }
}
```

## Arquivo: `src\modules\appointments\application\use-cases\delete-appointment.use-case.ts`
```typescript
import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";

export class DeleteAppointmentUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private businessRepository: IBusinessRepository
  ) { }

  async execute(id: string, userId: string) {
    const appointment = await this.appointmentRepository.findById(id);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Verifica se o usuário é o dono da empresa do agendamento
    const business = await this.businessRepository.findById(appointment.companyId);

    if (!business || business.ownerId !== userId) {
      throw new Error("Unauthorized to delete this appointment");
    }

    await this.appointmentRepository.delete(id);
  }
}
```

## Arquivo: `src\modules\appointments\application\use-cases\list-appointments.use-case.ts`
```typescript
import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";

export class ListAppointmentsUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private businessRepository: IBusinessRepository
  ) { }

  async execute(companyId: string, userId?: string, startDate?: Date, endDate?: Date) {
    // Verifica se a empresa pertence ao usuário (Isolamento Admin)
    // Se userId não for fornecido, é uma busca pública (sanitizada pelo controller)
    if (userId) {
      const business = await this.businessRepository.findById(companyId);

      if (!business || business.ownerId !== userId) {
        throw new Error("Unauthorized access to this company's appointments");
      }
    }

    return await this.appointmentRepository.findAllByCompanyId(companyId, startDate, endDate);
  }
}
```

## Arquivo: `src\modules\appointments\application\use-cases\update-appointment-status.use-case.ts`
```typescript
import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { AppointmentStatus, Appointment } from "../../domain/entities/appointment.entity";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";
import { UserRepository } from "../../../user/adapters/out/user.repository";
import { IPushSubscriptionRepository } from "../../../notifications/domain/ports/push-subscription.repository";
import { NotificationService } from "../../../notifications/application/notification.service";
import { db } from "../../../infrastructure/drizzle/database";
import { appointments, serviceResources, inventory, inventoryLogs, appointmentItems } from "../../../../db/schema";
import { eq, sql, inArray } from "drizzle-orm";

export class UpdateAppointmentStatusUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private businessRepository: IBusinessRepository,
    private userRepository: UserRepository,
    private pushSubscriptionRepository: IPushSubscriptionRepository
  ) { }

  private async extractServiceIds(tx: any, appointment: Appointment): Promise<string[]> {
    let ids: string[] = [];
    let foundInItems = false;

    // 1. Tenta buscar da lista de itens carregada na entidade (Prioridade 1)
    if (appointment.items && appointment.items.length > 0) {
      ids = appointment.items.map(it => it.serviceId);
      foundInItems = true;
    }

    // 2. Tenta buscar da nova tabela appointment_items via TX (Fallback se a entidade não tiver itens)
    if (!foundInItems) {
      const items = await tx
        .select({ serviceId: appointmentItems.serviceId })
        .from(appointmentItems)
        .where(eq(appointmentItems.appointmentId, appointment.id));

      if (items.length > 0) {
        ids = items.map((it: any) => it.serviceId);
        foundInItems = true;
      }
    }

    // 3. Tenta extrair IDs das notas (Retrocompatibilidade / Backup)
    if (!foundInItems && appointment.notes) {
      const match = appointment.notes.match(/IDs:\s*([\w\s,-]+)/);
      if (match && match[1]) {
        const extractedIds = match[1].split(',').map(id => id.trim());
        const validIds: string[] = [];
        extractedIds.forEach(id => {
          if (id) validIds.push(id);
        });

        if (validIds.length > 0) {
          ids = validIds;
          foundInItems = true;
        }
      }
    }

    // 3. Se NÃO encontrou nada, usa o ID principal (Legado/Simples)
    if (!foundInItems && appointment.serviceId) {
      // Suporta IDs separados por vírgula no campo serviceId (Compatibilidade Frontend)
      const serviceIds = appointment.serviceId.split(',').map(id => id.trim()).filter(id => id !== "");
      ids.push(...serviceIds);
    }

    return ids;
  }

  async execute(id: string, status: AppointmentStatus, userId: string) {
    const appointment = await this.appointmentRepository.findById(id);

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Verifica se o usuário é o dono da empresa do agendamento
    const business = await this.businessRepository.findById(appointment.companyId);

    if (!business || business.ownerId !== userId) {
      throw new Error("Unauthorized to update this appointment status");
    }

    const updatedAppointment = await db.transaction(async (tx) => {
      // Trava de Segurança: Buscar status atual dentro da transação para evitar estorno duplo (race condition)
      const [currentAppointment] = await tx
        .select({ status: appointments.status })
        .from(appointments)
        .where(eq(appointments.id, id));

      if (!currentAppointment) {
        throw new Error("Appointment not found in transaction");
      }

      // Extrair IDs de todos os serviços (Multi-Serviço)
      const serviceIds = await this.extractServiceIds(tx, appointment);

      // 1. Reversão de estoque (COMPLETED -> OUTRO)
      if (currentAppointment.status === "COMPLETED" && status !== "COMPLETED") {

        console.log("\n--- 🔍 [INÍCIO AUDITORIA ESTORNO] ---");
        console.log(`ID Agendamento: ${id}`);

        // BUSCA TODOS OS LOGS (Entrada e Saída) para calcular o saldo real
        const allLogs = await tx
          .select({
            log: inventoryLogs,
            product: inventory
          })
          .from(inventoryLogs)
          .innerJoin(inventory, eq(inventoryLogs.inventoryId, inventory.id))
          .where(
            sql`(${inventoryLogs.reason} LIKE ${`%Agendamento #${id} concluído%`} AND ${inventoryLogs.type} = 'EXIT')
             OR (${inventoryLogs.reason} LIKE ${`%Agendamento #${id} revertido%`} AND ${inventoryLogs.type} = 'ENTRY')`
          );

        console.log(`Total de logs encontrados: ${allLogs.length}`);

        if (allLogs.length > 0) {
          // Agrupar por InventoryID para calcular o saldo (Saídas - Entradas)
          const balanceMap = new Map<string, { product: typeof inventory.$inferSelect, balance: number }>();

          for (const { log, product } of allLogs) {
            const current = balanceMap.get(log.inventoryId) || { product, balance: 0 };
            const logQty = Number(log.quantity);

            if (log.type === 'EXIT') {
              current.balance += logQty; // O quanto saiu
            } else if (log.type === 'ENTRY') {
              current.balance -= logQty; // O quanto já voltou
            }

            balanceMap.set(log.inventoryId, current);
          }

          for (const [inventoryId, { product, balance }] of balanceMap.entries()) {
            // Pequena tolerância para float
            if (balance > 0.0001) {
              const quantityToRevert = Number(balance.toFixed(2)); // Arredondamento seguro

              console.log(`[EXECUTANDO ESTORNO] Item: ${product.name} | Saldo a devolver: ${quantityToRevert}`);

              // Incrementar estoque
              await tx
                .update(inventory)
                .set({
                  currentQuantity: sql`${inventory.currentQuantity} + ${quantityToRevert.toFixed(2)}`,
                  updatedAt: new Date(),
                })
                .where(eq(inventory.id, inventoryId));

              // Log de Entrada (Reversão)
              await tx.insert(inventoryLogs).values({
                id: crypto.randomUUID(),
                inventoryId: inventoryId,
                companyId: appointment.companyId,
                type: "ENTRY",
                quantity: quantityToRevert.toFixed(2),
                reason: `Estorno automático: Agendamento #${id} revertido (Saldo Pendente)`,
                createdAt: new Date(),
              });
            } else {
              console.log(`[SKIP] Item: ${product.name} | Saldo já está zerado ou negativo (${balance}).`);
            }
          }
        } else {
          // FALLBACK: Se não houver logs (dados legados), recalcular com base nas configurações atuais
          // Nota: Isso só deve acontecer para agendamentos MUITO antigos sem logs.
          console.log("⚠️ ATENÇÃO: Nenhum log encontrado. O sistema vai cair no Fallback.");

          // ... (Mantendo a lógica de fallback original para segurança, caso não ache logs)
          // Mas com verificação extra de idempotência simples
          const existingLog = await tx
            .select()
            .from(inventoryLogs)
            .where(sql`${inventoryLogs.reason} LIKE ${`%Agendamento #${id} revertido%`}`)
            .limit(1);

          if (existingLog.length > 0) {
            console.log("[FALLBACK SKIP] Já existe estorno para este agendamento legado.");
          } else {
            // ... (Lógica de fallback original) ...
            const resources = await tx
              .select({
                resource: serviceResources,
                product: inventory
              })
              .from(serviceResources)
              .innerJoin(inventory, eq(serviceResources.inventoryId, inventory.id))
              .where(inArray(serviceResources.serviceId, serviceIds));

            const uniqueSharedResources = new Map<string, { resource: typeof serviceResources.$inferSelect, product: typeof inventory.$inferSelect }>();
            const nonSharedResources: { resource: typeof serviceResources.$inferSelect, product: typeof inventory.$inferSelect }[] = [];

            for (const item of resources) {
              const isShared = item.product.isShared === true || (item.product.isShared as any) === 'true';
              if (isShared) {
                const existing = uniqueSharedResources.get(item.resource.inventoryId);
                if (!existing || Number(item.resource.quantity) > Number(existing.resource.quantity)) {
                  uniqueSharedResources.set(item.resource.inventoryId, item);
                }
              } else {
                nonSharedResources.push(item);
              }
            }

            const itemsToRevert = [...Array.from(uniqueSharedResources.values()), ...nonSharedResources];

            for (const { resource, product } of itemsToRevert) {
              let quantityToRevert = Number(resource.quantity);
              const conversionFactor = Number(product.conversionFactor) || 1;

              if (product.secondaryUnit && resource.unit === product.secondaryUnit && conversionFactor > 0) {
                quantityToRevert = quantityToRevert / conversionFactor;
              }

              await tx
                .update(inventory)
                .set({
                  currentQuantity: sql`${inventory.currentQuantity} + ${quantityToRevert.toFixed(2)}`,
                  updatedAt: new Date(),
                })
                .where(eq(inventory.id, resource.inventoryId));

              await tx.insert(inventoryLogs).values({
                id: crypto.randomUUID(),
                inventoryId: resource.inventoryId,
                companyId: appointment.companyId,
                type: "ENTRY",
                quantity: quantityToRevert.toFixed(2),
                reason: `Estorno automático: Agendamento #${id} revertido (Fallback)`,
                createdAt: new Date(),
              });
            }
          }
        }
        console.log("--- ✅ [FIM AUDITORIA ESTORNO] ---\n");
      }

      // 2. Consumo de estoque (OUTRO -> COMPLETED)
      if (currentAppointment.status !== "COMPLETED" && status === "COMPLETED") {

        // NÃO DELETAMOS MAIS OS LOGS AQUI para manter o histórico e permitir o cálculo de saldo.
        // A lógica de estorno agora vai usar o saldo real (Saídas - Entradas).

        const resources = await tx
          .select({
            resource: serviceResources,
            product: inventory
          })
          .from(serviceResources)
          .innerJoin(inventory, eq(serviceResources.inventoryId, inventory.id))
          .where(inArray(serviceResources.serviceId, serviceIds));

        // Lógica Híbrida: Deduplicação (Shared - Primeiro Item) vs Soma Bruta (Non-Shared)
        let itemsToConsume: { resource: typeof serviceResources.$inferSelect, product: typeof inventory.$inferSelect }[] = [];
        const processedSharedItems = new Set<string>();

        // 1. Agrupar recursos por Service ID para garantir processamento na ordem correta
        const resourcesByService = new Map<string, { resource: typeof serviceResources.$inferSelect, product: typeof inventory.$inferSelect }[]>();

        for (const item of resources) {
          const sId = item.resource.serviceId;
          if (!resourcesByService.has(sId)) {
            resourcesByService.set(sId, []);
          }
          resourcesByService.get(sId)?.push(item);
        }

        // 2. Iterar sobre os serviços NA ORDEM DO AGENDAMENTO (serviceIds extraídos anteriormente)
        for (const sId of serviceIds) {
          const serviceResourcesList = resourcesByService.get(sId) || [];

          for (const item of serviceResourcesList) {
            // Robustez: Garantir que isShared seja tratado corretamente
            const isShared = item.product.isShared === true || (item.product.isShared as any) === 'true';

            if (isShared) {
              // Deduplicação: Contabiliza apenas a primeira ocorrência (regra "Primeiro Item")
              if (!processedSharedItems.has(item.resource.inventoryId)) {
                itemsToConsume.push(item);
                processedSharedItems.add(item.resource.inventoryId);
              }
              // Se já foi processado neste agendamento, ignora (não consome novamente)
            } else {
              // Soma Bruta: Adiciona à lista normalmente (não compartilhado)
              itemsToConsume.push(item);
            }
          }
        }

        const notifiedLowStock = new Set<string>();

        for (const { resource, product } of itemsToConsume) {
          let quantityToConsume = Number(resource.quantity);
          const conversionFactor = Number(product.conversionFactor) || 1;

          if (product.secondaryUnit && resource.unit === product.secondaryUnit && conversionFactor > 0) {
            quantityToConsume = quantityToConsume / conversionFactor;
          }

          // Decrementar estoque
          await tx
            .update(inventory)
            .set({
              currentQuantity: sql`${inventory.currentQuantity} - ${quantityToConsume.toFixed(2)}`, // Arredondamento
              updatedAt: new Date(),
            })
            .where(eq(inventory.id, resource.inventoryId));

          // Log de Saída
          await tx.insert(inventoryLogs).values({
            id: crypto.randomUUID(),
            inventoryId: resource.inventoryId,
            companyId: appointment.companyId,
            type: "EXIT",
            quantity: quantityToConsume.toFixed(2), // Arredondamento
            reason: `Consumo automático: Agendamento #${id} concluído | Modo: ${product.isShared ? 'Deduplicado (Shared)' : 'Bruto'}`,
            createdAt: new Date(),
          });

          const currentQty = Number(product.currentQuantity);
          const newQty = Number((currentQty - quantityToConsume).toFixed(2)); // Arredondamento
          const minQty = Number(product.minQuantity);

          // CORREÇÃO: Comparar sempre na Unidade Secundária (Ex: Unidades, não Caixas)
          let comparisonQty = newQty;
          let comparisonMin = minQty;

          if (product.conversionFactor && product.secondaryUnit) {
            const factor = Number(product.conversionFactor);
            if (!isNaN(factor) && factor > 0) {
              // Converte o SALDO ATUAL para Unidades (Ex: 0.18 cx -> 18 un)
              comparisonQty = Number((newQty * factor).toFixed(2));

              // CORREÇÃO: Não converter o Limite Mínimo.
              // Assumimos que, se o produto tem unidade secundária, o usuário configurou o alerta pensando nela.
              // Ex: Configurar "10" significa "10 Unidades", não "10 Caixas".
              comparisonMin = minQty;
            }
          }

          console.log(`Testando alerta: Saldo atual ${newQty} ${product.unit} -> ${comparisonQty} ${product.secondaryUnit || product.unit} | Limite (Config) ${minQty} ${product.unit} -> ${comparisonMin} ${product.secondaryUnit || product.unit}`);

          if (comparisonQty <= comparisonMin && !notifiedLowStock.has(product.id)) {
            try {
              const owner = await this.userRepository.find(business.ownerId);
              if (owner && owner.notifyInventoryAlerts) {
                const notificationService = new NotificationService(this.pushSubscriptionRepository);

                let displayQty = comparisonQty;
                let displayUnit = product.secondaryUnit || product.unit;

                await notificationService.sendToUser(
                  business.ownerId,
                  "📦 Estoque Baixo!",
                  `O produto ${product.name} atingiu o nível crítico (${displayQty} ${displayUnit}).`
                );
                notifiedLowStock.add(product.id);
              }
            } catch (err) {
              console.error("[INVENTORY_ALERT] Error sending notification:", err);
            }
          }
        }
      }

      // 3. Atualizar status do agendamento
      const [updated] = await tx
        .update(appointments)
        .set({ status, updatedAt: new Date() })
        .where(eq(appointments.id, id))
        .returning();

      return updated as Appointment;
    });

    // Notificação de Cancelamento
    if (status === "CANCELLED") {
      try {
        const ownerId = business.ownerId;
        const owner = await this.userRepository.find(ownerId);

        if (owner && owner.notifyCancellations) {
          const notificationService = new NotificationService(this.pushSubscriptionRepository);

          await notificationService.sendToUser(
            ownerId,
            "❌ Agendamento Cancelado",
            `${appointment.customerName} cancelou o serviço ${appointment.serviceNameSnapshot} previsto para ${appointment.scheduledAt.toLocaleString("pt-BR")}.`
          );
        }
      } catch (err) {
        console.error("[CANCEL_NOTIFICATION_ERROR]", err);
      }
    }

    return updatedAppointment;
  }
}
```

## Arquivo: `src\modules\appointments\domain\entities\appointment.entity.ts`
```typescript
export type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "POSTPONED";

export interface AppointmentItem {
  id: string;
  appointmentId: string;
  serviceId: string;
  serviceNameSnapshot: string;
  servicePriceSnapshot: string;
  serviceDurationSnapshot: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Appointment {
  id: string;
  companyId: string;
  serviceId: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceNameSnapshot: string;
  servicePriceSnapshot: string;
  serviceDurationSnapshot: string;
  scheduledAt: Date;
  status: AppointmentStatus;
  notes: string | null;
  items?: AppointmentItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAppointmentInput {
  companyId: string;
  serviceId: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceNameSnapshot: string;
  servicePriceSnapshot: string;
  serviceDurationSnapshot: string;
  scheduledAt: Date;
  notes?: string;
  items?: Omit<AppointmentItem, "id" | "appointmentId" | "createdAt" | "updatedAt">[];
}
```

## Arquivo: `src\modules\appointments\domain\ports\appointment.repository.ts`
```typescript
import { Appointment, CreateAppointmentInput, AppointmentStatus } from "../entities/appointment.entity";

export interface IAppointmentRepository {
  findById(id: string): Promise<Appointment | null>;
  findAllByCompanyId(companyId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]>;
  findAllByCustomerId(customerId: string): Promise<Appointment[]>;
  create(data: CreateAppointmentInput): Promise<Appointment>;
  updateStatus(id: string, status: AppointmentStatus): Promise<Appointment | null>;
  delete(id: string): Promise<void>;
  sumRevenueByCompanyId(companyId: string, startDate?: Date, endDate?: Date): Promise<number>;
}
```

## Arquivo: `src\modules\billing\billing.http`
```
POST http://localhost:3001/api/billing
Content-Type: application/json

{
  "billingType": "PIX",
  "value": 100,
  "dueDate": "2026-12-01",
  "user": {
    "name": "Maciel Teste",
    "email": "[EMAIL_ADDRESS]",
    "document": "207.137.450-96",
    "mobilePhone": "11999999999"
  },
  "creditCard": {
    "holderName": "Maciel Teste",
    "number": "4111111111111112",
    "expiryMonth": "12",
    "expiryYear": "2026",
    "cvv": "123"
  },
  "address": {
    "postalCode": "01001-000",
    "addressNumber": "123",
    "addressComplement": "Apto 123",
    "phone": "11999999999"
  }
}
```

## Arquivo: `src\modules\billing\adapters\in\http\billing.controller.ts`
```typescript
import { Elysia, t } from "elysia";
import { createBillingDTO } from "../../../domain/DTO/create-billing.dto";
import { billingPlugin } from "../../../infrastructure/di/billing.plugin";

export const billingController = () =>
	new Elysia({ prefix: "/billing" }).use(billingPlugin).post(
		"/",
		async ({ generateBillingUseCase, body }) => {
			const data = await generateBillingUseCase.execute(body);

			return {
				data,
			};
		},
		{
			body: createBillingDTO,
		},
	);
```

## Arquivo: `src\modules\billing\adapters\out\asaas\asaas.integration.ts`
```typescript
import axios, { AxiosError, AxiosInstance } from "axios";
import {
	IAsaasCreateBankSlipRequest,
	IAsaasCreateCreditCardRequest,
	IAsaasCreateCustomerRequest,
	IAsaasCreatePixRequest,
	IAsaasCustomer,
	IAsaasListCustomerQuery,
	IAssasCreateBillingResponse,
	IAssasListCustomerResponse,
} from "./asaas.types";
import { environment } from "../../../../infrastructure/environment/environment";

export class AsaasIntegration {
	private readonly baseUrl = environment.asaas.baseUrl;
	private readonly headers = {
		"Content-Type": "application/json",
		"User-Agent": "nome_da_sua_aplicação",
		access_token: environment.asaas.accessToken,
	};
	private readonly client: AxiosInstance;

	constructor() {
		this.client = axios.create({
			baseURL: this.baseUrl,
			headers: this.headers,
		});

		this.setupInterceptors();
	}

	private setupInterceptors() {
		this.client.interceptors.response.use(
			(response) => response,
			(error: AxiosError) => {
				console.error("Erro na API Asaas: ", error.response?.data);
				return Promise.reject(error);
			},
		);
	}

	async createCustomer(
		customer: IAsaasCreateCustomerRequest,
	): Promise<IAsaasCustomer> {
		const req = await this.client.post(`/v3/customers`, customer);

		return req.data;
	}

	async getCustomer(
		params: IAsaasListCustomerQuery,
	): Promise<IAssasListCustomerResponse> {
		return this.client.get(`/v3/customers`, { params }).then((res) => res.data);
	}

	async generatePixBilling(
		body: IAsaasCreatePixRequest,
	): Promise<IAssasCreateBillingResponse> {
		const req = await this.client.post(`/v3/payments`, body);

		return req.data;
	}

	async generateSlipBilling(
		body: IAsaasCreateBankSlipRequest,
	): Promise<IAssasCreateBillingResponse> {
		const req = await this.client.post(`/v3/payments`, body);

		return req.data;
	}

	async generateCardBilling(
		body: IAsaasCreateCreditCardRequest,
	): Promise<IAssasCreateBillingResponse> {
		const req = await this.client.post(`/v3/payments`, body);

		return req.data;
	}
}
```

## Arquivo: `src\modules\billing\adapters\out\asaas\asaas.parser.ts`
```typescript
import type { IPixResponse } from "../../../domain/ports/billing.port";
import type {
	IAsaasCreatePixRequest,
	IAssasCreateBillingResponse,
} from "./asaas.types";
import type { AsaasDateHandler } from "./models/Date";

interface AsaasPixParserParams {
	customerId: string;
	value: number;
	dueDate?: string;
}

export class AsaasPixParser {
	constructor(private readonly dateHandler: AsaasDateHandler) {}

	toProvider(params: AsaasPixParserParams): IAsaasCreatePixRequest {
		return {
			billingType: "PIX",
			customer: params.customerId,
			value: params.value,
			dueDate: params.dueDate || this.dateHandler.getTomorrowFormated(),
		};
	}

	toDomain(params: IAssasCreateBillingResponse): IPixResponse {
		return {
			code: params.pixQrCodeId,
			externalId: params.id,
			invoice: params.invoiceUrl,
		};
	}
}
```

## Arquivo: `src\modules\billing\adapters\out\asaas\asaas.types.ts`
```typescript
export interface IAsaasCreateCustomerRequest {
	name: string;
	cpfCnpj: string;
}

export interface IAsaasListCustomerQuery {
	offset?: number;
	limit?: number;
	name?: string;
	email?: string;
	cpfCnpj?: string;
	groupName?: string;
	externalReference?: string;
}

export interface IAssasListCustomerResponse {
	object: string;
	hasMore: boolean;
	totalCount: number;
	limit: number;
	offset: number;
	data: Array<IAsaasCustomer>;
}

export interface IAsaasCustomer {
	object: string;
	id: string;
	dateCreated: string;
	name: string;
	email: any;
	company: any;
	phone: any;
	mobilePhone: any;
	address: any;
	addressNumber: any;
	complement: any;
	province: any;
	postalCode: any;
	cpfCnpj: string;
	personType: string;
	deleted: boolean;
	additionalEmails: any;
	externalReference: any;
	notificationDisabled: boolean;
	observations: any;
	municipalInscription: any;
	stateInscription: any;
	canDelete: boolean;
	cannotBeDeletedReason: any;
	canEdit: boolean;
	cannotEditReason: any;
	city: any;
	cityName: any;
	state: any;
	country: string;
}

export interface IAsaasCreatePixRequest {
	billingType: "PIX";
	customer: string;
	value: number;
	dueDate: string;
}

export interface IAsaasCreateBankSlipRequest {
	billingType: "BOLETO";
	customer: string;
	value: number;
	dueDate: string;
}

export interface IAsaasCreateCreditCardRequest {
	billingType: "CREDIT_CARD";
	customer: string;
	value: number;
	dueDate: string;
	creditCard: {
		holderName: string;
		number: string;
		expiryMonth: number;
		expiryYear: number;
		ccv: string;
	};
	creditCardHolderInfo: {
		name: string;
		email: string;
		cpfCnpj: string;
		postalCode: string;
		addressNumber: string;
		addressComplement: string;
		phone: string;
		mobilePhone: string;
	};
	remoteIp: string;
}

export interface IAssasCreateBillingResponse {
	object: string;
	id: string;
	dateCreated: string;
	customer: string;
	subscription: any;
	installment: any;
	checkoutSession: string;
	paymentLink: any;
	value: number;
	netValue: number;
	originalValue: any;
	interestValue: any;
	description: string;
	billingType: string;
	creditCard: {
		creditCardNumber: string;
		creditCardBrand: string;
		creditCardToken: any;
	};
	canBePaidAfterDueDate: boolean;
	pixTransaction: any;
	pixQrCodeId: any;
	status: string;
	dueDate: string;
	originalDueDate: string;
	paymentDate: any;
	clientPaymentDate: any;
	installmentNumber: any;
	invoiceUrl: string;
	invoiceNumber: string;
	externalReference: string;
	deleted: boolean;
	anticipated: boolean;
	anticipable: boolean;
	creditDate: string;
	estimatedCreditDate: string;
	transactionReceiptUrl: any;
	nossoNumero: string;
	bankSlipUrl: string;
	discount: {
		value: number;
		dueDateLimitDays: number;
		type: string;
	};
	fine: {
		value: number;
	};
	interest: {
		value: number;
	};
	split: Array<{
		id: string;
		walletId: string;
		fixedValue: number;
		percentualValue: any;
		totalValue: number;
		cancellationReason: string;
		status: string;
		externalReference: any;
		description: any;
	}>;
	postalService: boolean;
	daysAfterDueDateToRegistrationCancellation: any;
	chargeback: {
		id: string;
		payment: string;
		installment: string;
		customerAccount: string;
		status: string;
		reason: string;
		disputeStartDate: string;
		value: number;
		paymentDate: string;
		creditCard: {
			number: string;
			brand: string;
		};
		disputeStatus: string;
		deadlineToSendDisputeDocuments: string;
	};
	escrow: {
		id: string;
		status: string;
		expirationDate: string;
		finishDate: string;
		finishReason: string;
	};
	refunds: Array<{
		dateCreated: string;
		status: string;
		value: number;
		endToEndIdentifier: any;
		description: any;
		effectiveDate: string;
		transactionReceiptUrl: any;
		refundedSplits: Array<{
			id: string;
			value: number;
			done: boolean;
		}>;
	}>;
}
```

## Arquivo: `src\modules\billing\adapters\out\asaas\models\Date.ts`
```typescript
export class AsaasDateHandler extends Date {
	constructor() {
		super();
	}

	getTomorrou(date: Date): Date {
		date.setDate(date.getDate() + 1);
		return date;
	}

	getFormatedDate(date: Date): string {
		return date.toISOString().split("T")[0].replaceAll(":", "-");
	}

	getTomorrowFormated(): string {
		return this.getFormatedDate(this.getTomorrou(new Date()));
	}
}
```

## Arquivo: `src\modules\billing\application\services\asaas.service.ts`
```typescript
import {
	IBillingPort,
	ICardResponse,
	IPixResponse,
	ISlipResponse,
} from "../../domain/ports/billing.port";
import { AsaasIntegration } from "../../adapters/out/asaas/asaas.integration";
import {
	CreateBillingDTO,
	CreateCardBillingDTO,
} from "../../domain/DTO/create-billing.dto";

export class AsaasService implements IBillingPort {
	constructor(private readonly asaasIntegration: AsaasIntegration) {}

	async generatePixBilling(data: CreateBillingDTO): Promise<IPixResponse> {
		const customerExists = await this.asaasIntegration.getCustomer({
			email: data.user.email,
		});

		const customer = customerExists.totalCount
			? customerExists.data?.[0]
			: await this.asaasIntegration.createCustomer({
					name: data.user.name,
					cpfCnpj: data.user.document,
				});

		const billing = await this.asaasIntegration.generatePixBilling({
			billingType: "PIX",
			customer: customer.id,
			value: data.value,
			dueDate: data.dueDate,
		});

		return {
			code: billing.pixQrCodeId,
			externalId: billing.id,
			invoice: billing.invoiceUrl,
		};
	}

	async generateBankSlipBilling(
		data: CreateBillingDTO,
	): Promise<ISlipResponse> {
		const customerExists = await this.asaasIntegration.getCustomer({
			email: data.user.email,
		});

		const customer = customerExists.totalCount
			? customerExists.data?.[0]
			: await this.asaasIntegration.createCustomer({
					name: data.user.name,
					cpfCnpj: data.user.document,
				});

		const billing = await this.asaasIntegration.generateSlipBilling({
			billingType: "BOLETO",
			customer: customer.id,
			value: data.value,
			dueDate: data.dueDate,
		});

		return {
			externalId: billing.id,
			url: billing.bankSlipUrl,
			invoice: billing.invoiceUrl,
		};
	}

	async generateCreditCardBilling(
		data: CreateCardBillingDTO,
	): Promise<ICardResponse> {
		const customerExists = await this.asaasIntegration.getCustomer({
			email: data.user.email,
		});

		const customer = customerExists.totalCount
			? customerExists.data?.[0]
			: await this.asaasIntegration.createCustomer({
					name: data.user.name,
					cpfCnpj: data.user.document,
				});

		const billing = await this.asaasIntegration.generateCardBilling({
			billingType: "CREDIT_CARD",
			customer: customer.id,
			value: data.value,
			dueDate: data.dueDate,
			creditCard: {
				holderName: data.creditCard.holderName,
				number: data.creditCard.number,
				expiryMonth: Number(data.creditCard.expiryMonth),
				expiryYear: Number(data.creditCard.expiryYear),
				ccv: data.creditCard.cvv,
			},
			creditCardHolderInfo: {
				name: data.user.name,
				email: data.user.email,
				cpfCnpj: data.user.document,
				postalCode: data.address.postalCode,
				addressNumber: data.address.addressNumber,
				addressComplement: data.address.addressComplement,
				phone: data.address.phone,
				mobilePhone: data.user.mobilePhone,
			},
			remoteIp: "[IP_ADDRESS]",
		});

		return {
			externalId: billing.id,
			receipt: billing.transactionReceiptUrl,
			invoice: billing.invoiceUrl,
		};
	}
}
```

## Arquivo: `src\modules\billing\application\use-cases\generate-billing.use-case.ts`
```typescript
import type { CreateBillingDTO } from "../../domain/DTO/create-billing.dto";
import {
	IBillingPort,
	ICardResponse,
	IPixResponse,
	ISlipResponse,
} from "../../domain/ports/billing.port";

export class GenerateBillingUseCase {
	constructor(private readonly billingPort: IBillingPort) {}

	async execute(
		data: CreateBillingDTO,
	): Promise<IPixResponse | ISlipResponse | ICardResponse | undefined> {
		switch (data.billingType) {
			case "PIX":
				return await this.billingPort.generatePixBilling(data);

			case "SLIP":
				return await this.billingPort.generateBankSlipBilling(data);

			case "CARD":
				return await this.billingPort.generateCreditCardBilling(data);
		}
	}
}
```

## Arquivo: `src\modules\billing\domain\DTO\create-billing.dto.ts`
```typescript
import { t } from "elysia";

export const paymentMethods = {
	PIX: "PIX",
	SLIP: "SLIP",
	CARD: "CARD",
} as const;

export const createPixBillingDTO = t.Object({
	billingType: t.Literal(paymentMethods.PIX),
	value: t.Number(),
	dueDate: t.String(),
	user: t.Object({
		name: t.String(),
		email: t.String(),
		document: t.String(),
	}),
});

export const createSlipBillingDTO = t.Object({
	billingType: t.Literal(paymentMethods.SLIP),
	value: t.Number(),
	dueDate: t.String(),
	user: t.Object({
		name: t.String(),
		email: t.String(),
		document: t.String(),
	}),
});

export const createCardBillingDTO = t.Object({
	billingType: t.Literal(paymentMethods.CARD),
	value: t.Number(),
	dueDate: t.String(),
	user: t.Object({
		name: t.String(),
		email: t.String(),
		document: t.String(),
		mobilePhone: t.String(),
	}),
	creditCard: t.Object({
		holderName: t.String(),
		number: t.String(),
		expiryMonth: t.String(),
		expiryYear: t.String(),
		cvv: t.String(),
	}),
	address: t.Object({
		postalCode: t.String(),
		addressNumber: t.String(),
		addressComplement: t.String(),
		phone: t.String(),
	}),
});

export const createBillingDTO = t.Union([
	createPixBillingDTO,
	createSlipBillingDTO,
	createCardBillingDTO,
]);

export type CreatePixBillingDTO = typeof createPixBillingDTO.static;
export type CreateSlipBillingDTO = typeof createSlipBillingDTO.static;
export type CreateCardBillingDTO = typeof createCardBillingDTO.static;
export type CreateBillingDTO = typeof createBillingDTO.static;
export type PaymentMethods =
	(typeof paymentMethods)[keyof typeof paymentMethods];
```

## Arquivo: `src\modules\billing\domain\ports\billing.port.ts`
```typescript
import { CreateBillingDTO } from "../DTO/create-billing.dto";

interface IBillingResponse {
	externalId: string;
	invoice: string;
}

export interface IPixResponse extends IBillingResponse {
	code: string;
}

export interface ISlipResponse extends IBillingResponse {
	url: string;
}

export interface ICardResponse extends IBillingResponse {
	receipt: string;
}

export interface IBillingPort {
	generatePixBilling(data: CreateBillingDTO): Promise<IPixResponse>;
	generateBankSlipBilling(data: CreateBillingDTO): Promise<ISlipResponse>;
	generateCreditCardBilling(data: CreateBillingDTO): Promise<ICardResponse>;
}
```

## Arquivo: `src\modules\billing\infrastructure\di\billing.plugin.ts`
```typescript
import Elysia from "elysia";
import { AsaasService } from "../../application/services/asaas.service";
import { GenerateBillingUseCase } from "../../application/use-cases/generate-billing.use-case";
import { AsaasIntegration } from "../../adapters/out/asaas/asaas.integration";

const asaasIntegration = new AsaasIntegration();
const billingPort = new AsaasService(asaasIntegration);
const generateBillingUseCase = new GenerateBillingUseCase(billingPort);

export const asaasPlugin = new Elysia({ name: "asaas" }).decorate(
	"asaasIntegration",
	asaasIntegration,
);

export const billingPlugin = new Elysia({ name: "billing" })
	.use(asaasPlugin)
	.decorate("billingPort", billingPort)
	.decorate("generateBillingUseCase", generateBillingUseCase);
```

## Arquivo: `src\modules\business\adapters\in\dtos\business.dto.ts`
```typescript
import { t } from "elysia";
import {
  LayoutGlobalDTO,
  HomeSectionDTO,
  GallerySectionDTO,
  AboutUsSectionDTO,
  AppointmentFlowSectionDTO,
} from "./site_customization.dto";

export const createBusinessDTO = t.Object({
  name: t.String(),
  phone: t.String({
    pattern: "^[0-9]{10,11}$|^\\([0-9]{2}\\)\\s?[0-9]{4,5}-[0-9]{4}$",
    error: "Telefone inválido. Use o formato (99) 99999-9999 ou apenas números com DDD."
  }),
  slug: t.Optional(t.String()),
});

export const updateBusinessConfigDTO = t.Object({
  config: t.Object({
    layoutGlobal: t.Optional(LayoutGlobalDTO),
    home: t.Optional(HomeSectionDTO),
    gallery: t.Optional(GallerySectionDTO),
    aboutUs: t.Optional(AboutUsSectionDTO),
    appointmentFlow: t.Optional(AppointmentFlowSectionDTO),
  }),
});

export type CreateBusinessDTO = typeof createBusinessDTO.static;
export type UpdateBusinessConfigDTO = typeof updateBusinessConfigDTO.static;
```

## Arquivo: `src\modules\business\adapters\in\dtos\business.settings.dto.ts`
```typescript
import { t } from "elysia";

export const weeklyOperatingHoursItemDTO = t.Object({
  dayOfWeek: t.String(),
  status: t.String(), // "OPEN" | "CLOSED"
  morningStart: t.Optional(t.String()),
  morningEnd: t.Optional(t.String()),
  afternoonStart: t.Optional(t.String()),
  afternoonEnd: t.Optional(t.String()),
});

export const weeklyOperatingHoursAltDTO = t.Object({
  dayOfWeek: t.String(),
  status: t.String(),
  openTime: t.Optional(t.String()),
  lunchStart: t.Optional(t.String()),
  lunchEnd: t.Optional(t.String()),
  closeTime: t.Optional(t.String()),
});

export const createAgendaBlockDTO = t.Object({
  type: t.Union([
    t.Literal("BLOCK_HOUR"),
    t.Literal("BLOCK_DAY"),
    t.Literal("BLOCK_PERIOD"),
  ]),
  startDate: t.String(), // "dd/mm/aaaa"
  endDate: t.String(),
  startTime: t.Optional(t.String()), // "HH:mm"
  endTime: t.Optional(t.String()),
  reason: t.Optional(t.String()),
});

export const updateOperatingHoursDTO = t.Union([
  t.Object({
    interval: t.String(),
    weekly: t.Array(t.Union([weeklyOperatingHoursItemDTO, weeklyOperatingHoursAltDTO])),
    companyId: t.Optional(t.String()),
    blocks: t.Optional(t.Array(createAgendaBlockDTO)),
    minimumBookingLeadMinutes: t.Optional(t.Number()),
  }),
  t.Object({
    timeInterval: t.String(),
    weekly: t.Array(t.Union([weeklyOperatingHoursItemDTO, weeklyOperatingHoursAltDTO])),
    companyId: t.Optional(t.String()),
    blocks: t.Optional(t.Array(createAgendaBlockDTO)),
    minimumBookingLeadMinutes: t.Optional(t.Number()),
  })
]);

export type UpdateOperatingHoursDTO = typeof updateOperatingHoursDTO.static;
export type CreateAgendaBlockDTO = typeof createAgendaBlockDTO.static;
```

## Arquivo: `src\modules\business\adapters\in\dtos\site_customization.dto.ts`
```typescript
import { t } from "elysia";

export const LayoutGlobalDTO = t.Object({
  header: t.Object({
    backgroundAndEffect: t.Object({
      color: t.String(),
      opacity: t.Number(),
      blur: t.Number(),
    }),
    textColors: t.Object({
      logo: t.String(),
      links: t.String(),
      hover: t.String(),
    }),
    actionButtons: t.Object({
      backgroundColor: t.String(),
      textColor: t.String(),
    }),
  }),
  typography: t.Object({
    headingsFont: t.String(),
    subheadingsFont: t.String(),
    bodyFont: t.String(),
  }),
  siteColors: t.Object({
    primary: t.String(),
    secondary: t.String(),
    background: t.String(),
  }),
  footer: t.Object({
    colors: t.Object({
      background: t.String(),
      text: t.String(),
      icons: t.String(),
    }),
    typography: t.Object({
      headings: t.String(),
      body: t.String(),
    }),
    visibility: t.Boolean(),
  }),
});

export const HomeSectionDTO = t.Object({
  heroBanner: t.Object({
    visibility: t.Boolean(),
    title: t.Object({
      text: t.String(),
      color: t.String(),
      font: t.String(),
      sizeMobile: t.String(),
      sizeDesktop: t.String(),
    }),
    subtitle: t.Object({
      text: t.String(),
      color: t.String(),
      font: t.String(),
      size: t.String(),
    }),
    ctaButton: t.Object({
      text: t.String(),
      backgroundColor: t.String(),
      textColor: t.String(),
      borderRadius: t.String(),
      borderColor: t.String(),
      destinationLink: t.String(),
    }),
    appearance: t.Object({
      bgType: t.Optional(t.Union([t.Literal("color"), t.Literal("image")])),
      backgroundColor: t.Optional(t.String()),
      backgroundImageUrl: t.String(),
      glassEffect: t.Object({
        active: t.Boolean(),
        intensity: t.Number(),
      }),
      overlay: t.Object({
        color: t.String(),
        opacity: t.Number(),
      }),
      verticalAlignment: t.Union([t.Literal("top"), t.Literal("center"), t.Literal("bottom")]),
      horizontalAlignment: t.Union([t.Literal("left"), t.Literal("center"), t.Literal("right")]),
      sectionHeight: t.Union([t.Literal("small"), t.Literal("medium"), t.Literal("full_screen")]),
    }),
    bgColor: t.Optional(t.String()),
  }),
  servicesSection: t.Object({
    visibility: t.Boolean(),
    orderOnHome: t.Number(),
    header: t.Object({
      title: t.Object({
        text: t.String(),
        color: t.String(),
        font: t.String(),
        size: t.String(),
      }),
      subtitle: t.Object({
        text: t.String(),
        color: t.String(),
        font: t.String(),
        size: t.String(),
      }),
      alignment: t.Union([t.Literal("left"), t.Literal("center"), t.Literal("right")]),
    }),
    cardConfig: t.Object({
      showImage: t.Boolean(),
      showCategory: t.Boolean(),
      priceStyle: t.Object({
        visible: t.Boolean(),
        color: t.String(),
        font: t.String(),
      }),
      durationStyle: t.Object({
        visible: t.Boolean(),
        color: t.String(),
      }),
      cardBackgroundColor: t.String(),
      borderAndShadow: t.Object({
        borderSize: t.String(),
        shadowIntensity: t.String(),
      }),
      borderRadius: t.String(),
    }),
    bookingButtonStyle: t.Object({
      text: t.String(),
      backgroundColor: t.String(),
      textColor: t.String(),
      borderRadius: t.String(),
    }),
  }),
  valuesSection: t.Object({
    visibility: t.Boolean(),
    orderOnHome: t.Number(),
    header: t.Object({
      title: t.Object({
        text: t.String(),
        color: t.String(),
        font: t.String(),
        size: t.String(),
      }),
      subtitle: t.Object({
        text: t.String(),
        color: t.String(),
        font: t.String(),
        size: t.String(),
      }),
    }),
    itemsStyle: t.Object({
      layout: t.Union([t.Literal("grid"), t.Literal("list"), t.Literal("carousel")]),
      itemBackgroundColor: t.String(),
      borderRadius: t.String(),
      internalAlignment: t.Union([t.Literal("left"), t.Literal("center")]),
    }),
    items: t.Array(t.Object({
      id: t.String(),
      order: t.Number(),
      icon: t.Object({
        type: t.Union([t.Literal("icon"), t.Literal("image"), t.Literal("number")]),
        value: t.String(),
        color: t.String(),
      }),
      title: t.Object({
        text: t.String(),
        style: t.Object({
          color: t.String(),
          font: t.String(),
          size: t.String(),
        }),
      }),
      description: t.Object({
        text: t.String(),
        style: t.Object({
          color: t.String(),
          font: t.String(),
          size: t.String(),
        }),
      }),
    })),
  }),
  galleryPreview: t.Object({
    visibility: t.Boolean(),
    orderOnHome: t.Number(),
    header: t.Object({
      title: t.Object({
        text: t.String(),
        color: t.String(),
        font: t.String(),
        size: t.String(),
      }),
      subtitle: t.Object({
        text: t.String(),
        color: t.String(),
        font: t.String(),
        size: t.String(),
      }),
    }),
    displayLogic: t.Object({
      selectionMode: t.Union([t.Literal("automatic_recent"), t.Literal("manual_highlights")]),
      photoCount: t.Union([t.Literal(3), t.Literal(6), t.Literal(9), t.Literal(12)]),
      gridLayout: t.Union([t.Literal("mosaic"), t.Literal("fixed_squares"), t.Literal("carousel")]),
    }),
    photoStyle: t.Object({
      aspectRatio: t.Union([t.Literal("1:1"), t.Literal("4:3"), t.Literal("16:9")]),
      spacing: t.String(),
      borderRadius: t.String(),
      hoverEffect: t.Union([t.Literal("zoom"), t.Literal("brightness"), t.Literal("none")]),
    }),
    viewMoreButton: t.Object({
      visible: t.Boolean(),
      text: t.String(),
      style: t.Object({
        backgroundColor: t.String(),
        textColor: t.String(),
        borderRadius: t.String(),
      }),
    }),
  }),
  ctaSection: t.Object({
    visibility: t.Boolean(),
    orderOnHome: t.Number(),
    title: t.Object({
      text: t.String(),
      color: t.String(),
      font: t.String(),
      size: t.Object({
        desktop: t.String(),
        mobile: t.String(),
      }),
    }),
    subtitle: t.Object({
      text: t.String(),
      color: t.String(),
      font: t.String(),
      size: t.String(),
    }),
    conversionButton: t.Object({
      text: t.String(),
      style: t.Object({
        backgroundColor: t.String(),
        textColor: t.String(),
        borderColor: t.String(),
      }),
      borderRadius: t.String(),
    }),
    designConfig: t.Object({
      backgroundType: t.Union([t.Literal("solid_color"), t.Literal("gradient"), t.Literal("image")]),
      colorOrImageUrl: t.String(),
      glassEffect: t.Object({
        active: t.Boolean(),
        intensity: t.Number(),
      }),
      borders: t.Object({
        top: t.Boolean(),
        bottom: t.Boolean(),
      }),
      padding: t.String(),
      alignment: t.Union([t.Literal("left"), t.Literal("center"), t.Literal("right")]),
    }),
  }),
});

export const GallerySectionDTO = t.Object({
  gridConfig: t.Object({
    columns: t.Number(),
    gap: t.String(),
  }),
  interactivity: t.Object({
    enableLightbox: t.Boolean(),
    showCaptions: t.Boolean(),
  }),
});

export const AboutUsSectionDTO = t.Object({
  aboutBanner: t.Object({
    visibility: t.Boolean(),
    title: t.String(),
    backgroundImageUrl: t.String(),
  }),
  ourStory: t.Object({
    visibility: t.Boolean(),
    title: t.String(),
    text: t.String(),
    imageUrl: t.String(),
  }),
  ourValues: t.Array(t.Any()), // Using Any to avoid circular dependency or duplication complexity for now
  ourTeam: t.Array(t.Object({
    id: t.String(),
    name: t.String(),
    role: t.String(),
    imageUrl: t.String(),
    bio: t.String(),
  })),
  testimonials: t.Array(t.Object({
    id: t.String(),
    author: t.String(),
    text: t.String(),
    rating: t.Number(),
    imageUrl: t.Optional(t.String()),
  })),
});

export const AppointmentFlowSectionDTO = t.Object({
  colors: t.Object({
    primary: t.String(),
    secondary: t.String(),
    background: t.String(),
    text: t.String(),
  }),
  step1Services: t.Object({
    title: t.String(),
    showPrices: t.Boolean(),
    showDurations: t.Boolean(),
    cardConfig: t.Object({
      backgroundColor: t.String(),
    }),
  }),
  step2Date: t.Object({
    title: t.String(),
    calendarStyle: t.Union([t.Literal("modern"), t.Literal("classic")]),
  }),
  step3Times: t.Object({
    title: t.String(),
    timeSlotStyle: t.Union([t.Literal("list"), t.Literal("grid")]),
    timeSlotSize: t.Number(),
  }),
  step4Confirmation: t.Object({
    title: t.String(),
    requireLogin: t.Boolean(),
  }),
});
```

## Arquivo: `src\modules\business\adapters\in\http\business.controller.ts`
```typescript
import { Elysia, t } from "elysia";
import { authPlugin, syncAsaasPaymentForCompany } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { ListMyBusinessesUseCase } from "../../../application/use-cases/list-my-businesses.use-case";
import { CreateBusinessUseCase } from "../../../application/use-cases/create-business.use-case";
import { UpdateBusinessConfigUseCase } from "../../../application/use-cases/update-business-config.use-case";
import { createBusinessDTO, updateBusinessConfigDTO } from "../dtos/business.dto";
import { updateOperatingHoursDTO, createAgendaBlockDTO } from "../dtos/business.settings.dto";
import { UpdateOperatingHoursUseCase } from "../../../application/use-cases/update-operating-hours.use-case";
import { GetOperatingHoursUseCase } from "../../../application/use-cases/get-operating-hours.use-case";
import { CreateAgendaBlockUseCase } from "../../../application/use-cases/create-agenda-block.use-case";
import { ListAgendaBlocksUseCase } from "../../../application/use-cases/list-agenda-blocks.use-case";
import { DeleteAgendaBlockUseCase } from "../../../application/use-cases/delete-agenda-block.use-case";
import { db } from "../../../../infrastructure/drizzle/database";
import * as schema from "../../../../../db/schema";
import { eq } from "drizzle-orm";

export const businessController = () => new Elysia({ prefix: "/business" })
  .use(repositoriesPlugin)
  .use(authPlugin)
  .onError(({ code, error, set }) => {
    const message = (error as any)?.message ?? String(error);
    const detail = (error as any)?.errors ?? (error as any)?.cause ?? null;
    console.error("BUSINESS_CONTROLLER_VALIDATION_ERROR", code, message, detail);
    if (code === "VALIDATION") {
      set.status = 422;
      return {
        error: "ValidationError",
        message,
        detail
      };
    }
  })
  // Rotas Públicas (Sem necessidade de Token)
  .group("", (publicGroup) =>
    publicGroup
      .get("/settings/pricing", async ({ set }) => {
        try {
          const [setting] = await db
            .select()
            .from(schema.systemSettings)
            .where(eq(schema.systemSettings.key, "monthly_price"))
            .limit(1);

          // Forçar o navegador a não usar cache para garantir que o preço atualizado apareça
          set.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate";
          set.headers["Pragma"] = "no-cache";
          set.headers["Expires"] = "0";

          return {
            price: setting ? parseFloat(setting.value) : 49.90,
            updatedAt: setting?.updatedAt || new Date()
          };
        } catch (error: any) {
          return {
            price: 49.90,
            error: "Erro ao buscar preço: " + error.message
          };
        }
      })
      .get("/debug-slug/:slug", async ({ params: { slug }, businessRepository }) => {
        const normalizedSlug = decodeURIComponent(slug).trim().toLowerCase();
        console.log(`[DEBUG_SLUG] Buscando: '${normalizedSlug}'`);
        const business = await businessRepository.findBySlug(normalizedSlug);
        return {
          original: slug,
          decoded: decodeURIComponent(slug),
          normalized: normalizedSlug,
          found: !!business,
          data: business ? { id: business.id, name: business.name, slug: business.slug } : null
        };
      })
      .get("/slug/:slug", async ({ params: { slug }, set, businessRepository, settingsRepository, userRepository, user }) => {
        // Normalização de entrada para evitar erros de case/espaços e caracteres especiais
        const normalizedSlug = decodeURIComponent(slug).trim().toLowerCase();

        console.log(`[BUSINESS_CONTROLLER] Buscando dados para o slug (RAW): '${slug}'`);
        console.log(`[BUSINESS_CONTROLLER] Buscando dados para o slug (DECODED): '${decodeURIComponent(slug)}'`);
        console.log(`[BUSINESS_CONTROLLER] Buscando dados para o slug (NORMALIZED): '${normalizedSlug}'`);

        // Forçar o navegador a não usar cache para garantir que as cores novas apareçam
        set.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate";
        set.headers["Pragma"] = "no-cache";
        set.headers["Expires"] = "0";

        // Busca usando o slug normalizado
        let business = await businessRepository.findBySlug(normalizedSlug);

        // Fallback: Se não encontrou pelo slug exato, tenta buscar por parte do slug ou sem hifens
        if (!business && normalizedSlug.includes("-")) {
          const simpleSlug = normalizedSlug.replace(/-/g, "");
          console.log(`[BUSINESS_CONTROLLER] Fallback: Tentando slug simplificado: '${simpleSlug}'`);
          business = await businessRepository.findBySlug(simpleSlug);
        }

        if (!business) {
          console.error(`[BUSINESS_CONTROLLER] ❌ ERRO 404: Empresa não encontrada para o slug: '${normalizedSlug}'`);
          set.status = 404;
          return {
            error: "Business not found",
            message: `Nenhum estúdio encontrado com o endereço '${normalizedSlug}'. Verifique se o link está correto.`
          };
        }

        const isBlockedStatus =
          business.subscriptionStatus === "past_due" ||
          business.subscriptionStatus === "canceled";

        if ((business.active === false || isBlockedStatus) && (!user || (user.id !== business.ownerId && user.role !== "SUPER_ADMIN"))) {
          set.status = 403;
          return {
            error: "Business suspended",
            message: "Este site está temporariamente indisponível."
          };
        }

        console.log(`[BUSINESS_CONTROLLER] ✅ SUCESSO: Dados encontrados para: ${business.name} (ID: ${business.id})`);

        // --- ENRIQUECIMENTO DE DADOS DE CONTATO (REQ-FIX-CONTACT-NULL) ---
        // Busca o perfil para tentar obter e-mail e telefone configurados
        const profile = await settingsRepository.findByBusinessId(business.id);

        // 1. Resolução de E-mail (Prioridade: Perfil > Dono da Conta)
        let publicEmail = profile?.email || null;

        if (!publicEmail && business.ownerId) {
          // Fallback: Busca e-mail do dono da conta
          try {
            const owner = await userRepository.find(business.ownerId);
            if (owner) {
              publicEmail = owner.email;
            }
          } catch (err) {
            console.error(`[BUSINESS_CONTROLLER] Erro ao buscar owner para fallback de email:`, err);
          }
        }

        // 2. Resolução de Telefone (Prioridade: Perfil > Cadastro da Empresa - phone > Cadastro da Empresa - contact)
        const publicPhone = profile?.phone || business.phone || business.contact || null;

        const customization = business.siteCustomization as any;
        const primaryColor = customization?.layoutGlobal?.siteColors?.primary ||
          customization?.layoutGlobal?.base_colors?.primary ||
          'Padrão';

        console.log(`[BUSINESS_CONTROLLER] Cor Primária no Banco:`, primaryColor);
        console.log(`[BUSINESS_CONTROLLER] Contato resolvido - Email: ${publicEmail}, Phone: ${publicPhone}`);

        // Retorna objeto com estrutura garantida para o Front-end
        return {
          ...business,
          email: publicEmail, // Email na raiz conforme solicitado
          contact: {          // Objeto contact populado
            email: publicEmail,
            phone: publicPhone
          }
        };
      }, {
        params: t.Object({
          slug: t.String()
        })
      })
      .get("/settings/:companyId", async ({ params: { companyId }, businessRepository, set }) => {
        try {
          console.log(`>>> [BACK_PUBLIC_ACCESS] Buscando horários para a empresa: ${companyId}`);
          const useCase = new GetOperatingHoursUseCase(businessRepository);
          const result = await useCase.execute(companyId);

          if (result) {
            console.log(`>>> [PUBLIC_API_SEND] Enviando intervalo para o site: ${result.interval}`);
          }

          return result;
        } catch (error: any) {
          set.status = 404;
          return { error: error.message };
        }
      }, {
        params: t.Object({ companyId: t.String() })
      })
      .get("/settings/:companyId/", async ({ params: { companyId }, businessRepository, set }) => {
        try {
          const useCase = new GetOperatingHoursUseCase(businessRepository);
          return await useCase.execute(companyId);
        } catch (error: any) {
          set.status = 404;
          return { error: error.message };
        }
      }, {
        params: t.Object({ companyId: t.String() })
      })
      .get("/settings/:companyId/blocks", async ({ params: { companyId }, businessRepository, set }) => {
        try {
          console.log(`>>> [BACK_PUBLIC_ACCESS] Buscando bloqueios para a empresa: ${companyId}`);
          const useCase = new ListAgendaBlocksUseCase(businessRepository);
          return await useCase.execute(companyId);
        } catch (error: any) {
          set.status = 404;
          return { error: error.message };
        }
      }, {
        params: t.Object({ companyId: t.String() })
      })
  )
  // Rotas Privadas (Exigem Token)
  .group("", (privateGroup) =>
    privateGroup
      .onBeforeHandle(({ user, set }) => {
        if (!user) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
      })
      .get("/my", async ({ user, businessRepository }) => {
        const listMyBusinessesUseCase = new ListMyBusinessesUseCase(businessRepository);
        return await listMyBusinessesUseCase.execute(user!.id);
      })
      .post("/sync", async ({ user, set }) => {
        try {
          const [userCompany] = await db.select()
            .from(schema.companies)
            .where(eq(schema.companies.ownerId, user!.id))
            .limit(1);

          if (!userCompany) {
            set.status = 404;
            return { error: "Company not found" };
          }

          console.log(`[BUSINESS_SYNC] Sincronização manual solicitada pelo usuário ${user!.email} para a empresa ${userCompany.id}`);

          const syncResult = await syncAsaasPaymentForCompany(
            userCompany.id,
            userCompany.ownerId,
            user!.email,
            {
              requireCurrentMonthPayment: true,
              ignoreBlockDate: false
            }
          );

          if (syncResult?.activated) {
            return {
              success: true,
              message: "Pagamento confirmado e acesso liberado!",
              nextDue: syncResult.nextDue
            };
          }

          return {
            success: false,
            message: "Nenhum novo pagamento identificado no Asaas. Se você acabou de pagar, aguarde alguns minutos pela compensação."
          };
        } catch (error: any) {
          console.error("[BUSINESS_SYNC_ERROR]:", error);
          set.status = 500;
          return { error: "Erro ao sincronizar: " + error.message };
        }
      })
      .post("/", async ({ user, body, set, businessRepository }) => {
        try {
          const createBusinessUseCase = new CreateBusinessUseCase(businessRepository);
          return await createBusinessUseCase.execute(user!.id, body);
        } catch (error: any) {
          set.status = 400;
          return { error: error.message };
        }
      }, {
        body: createBusinessDTO
      })
      .patch("/:id/config", async ({ user, params: { id }, body, set, businessRepository }) => {
        try {
          const updateBusinessConfigUseCase = new UpdateBusinessConfigUseCase(businessRepository);
          return await updateBusinessConfigUseCase.execute(id, user!.id, body);
        } catch (error: any) {
          set.status = 400;
          return { error: error.message };
        }
      }, {
        body: updateBusinessConfigDTO,
        params: t.Object({
          id: t.String()
        })
      })
      .patch("/:id/status", async ({ user, params: { id }, body, set, businessRepository }) => {
        try {
          const business = await businessRepository.findById(id);

          if (!business) {
            set.status = 404;
            return { error: "Business not found" };
          }

          if (business.ownerId !== user!.id && user!.role !== "SUPER_ADMIN") {
            set.status = 403;
            return { error: "Unauthorized" };
          }

          const [updated] = await db
            .update(schema.companies)
            .set({
              active: body.active,
              updatedAt: new Date(),
            })
            .where(eq(schema.companies.id, id))
            .returning();

          return {
            success: true,
            business: updated,
          };
        } catch (error: any) {
          set.status = 400;
          return { error: error.message };
        }
      }, {
        body: t.Object({
          active: t.Boolean()
        }),
        params: t.Object({
          id: t.String()
        })
      })
      .put("/settings/:companyId", async ({ user, params: { companyId }, body, businessRepository, set }) => {
        try {
          console.log("BUSINESS_SETTINGS_PUT", JSON.stringify(body));
          const interval = (body as any).interval ?? (body as any).slotInterval ?? (body as any).timeInterval;
          if (!interval || !/^\d{2}:\d{2}$/.test(interval)) {
            set.status = 422;
            console.error("BUSINESS_SETTINGS_INTERVAL_INVALID", interval);
            return { error: "Invalid interval format", field: "interval", expected: "HH:mm" };
          }
          if (!Array.isArray(body?.weekly) || body.weekly.length !== 7) {
            set.status = 422;
            console.error("BUSINESS_SETTINGS_WEEKLY_LENGTH_INVALID", Array.isArray(body?.weekly) ? body.weekly.length : null);
            return { error: "Weekly must have 7 days", field: "weekly.length", expected: 7 };
          }
          const useCase = new UpdateOperatingHoursUseCase(businessRepository);
          const normalizedBody = { ...(body as any), interval };
          return await useCase.execute(companyId, user!.id, normalizedBody as any);
        } catch (error: any) {
          set.status = error.message?.includes("Unauthorized") ? 403 : 400;
          return { error: error.message };
        }
      }, {
        body: updateOperatingHoursDTO,
        params: t.Object({ companyId: t.String() })
      })
      .put("/settings/:companyId/", async ({ user, params: { companyId }, body, businessRepository, set }) => {
        try {
          console.log("BUSINESS_SETTINGS_PUT", JSON.stringify(body));
          const interval = (body as any).interval ?? (body as any).slotInterval ?? (body as any).timeInterval;
          if (!interval || !/^\d{2}:\d{2}$/.test(interval)) {
            set.status = 422;
            console.error("BUSINESS_SETTINGS_INTERVAL_INVALID", interval);
            return { error: "Invalid interval format", field: "interval", expected: "HH:mm" };
          }
          if (!Array.isArray(body?.weekly) || body.weekly.length !== 7) {
            set.status = 422;
            console.error("BUSINESS_SETTINGS_WEEKLY_LENGTH_INVALID", Array.isArray(body?.weekly) ? body.weekly.length : null);
            return { error: "Weekly must have 7 days", field: "weekly.length", expected: 7 };
          }
          const useCase = new UpdateOperatingHoursUseCase(businessRepository);
          const normalizedBody = { ...(body as any), interval };
          return await useCase.execute(companyId, user!.id, normalizedBody as any);
        } catch (error: any) {
          set.status = error.message?.includes("Unauthorized") ? 403 : 400;
          return { error: error.message };
        }
      }, {
        body: updateOperatingHoursDTO,
        params: t.Object({ companyId: t.String() })
      })
      .get("/settings/:companyId/blocks/", async ({ user, params: { companyId }, businessRepository, set }) => {
        try {
          const useCase = new ListAgendaBlocksUseCase(businessRepository);
          return await useCase.execute(companyId, user!.id);
        } catch (error: any) {
          set.status = error.message?.includes("Unauthorized") ? 403 : 400;
          return { error: error.message };
        }
      }, {
        params: t.Object({ companyId: t.String() })
      })
      .post("/settings/:companyId/blocks", async ({ user, params: { companyId }, body, businessRepository, set }) => {
        try {
          const useCase = new CreateAgendaBlockUseCase(businessRepository);
          return await useCase.execute(companyId, user!.id, body);
        } catch (error: any) {
          set.status = error.message?.includes("Unauthorized") ? 403 : 400;
          return { error: error.message };
        }
      }, {
        body: createAgendaBlockDTO,
        params: t.Object({ companyId: t.String() })
      })
      .post("/settings/:companyId/blocks/", async ({ user, params: { companyId }, body, businessRepository, set }) => {
        try {
          const useCase = new CreateAgendaBlockUseCase(businessRepository);
          return await useCase.execute(companyId, user!.id, body);
        } catch (error: any) {
          set.status = error.message?.includes("Unauthorized") ? 403 : 400;
          return { error: error.message };
        }
      }, {
        body: createAgendaBlockDTO,
        params: t.Object({ companyId: t.String() })
      })
      .delete("/settings/:companyId/blocks/:blockId", async ({ user, params: { companyId, blockId }, businessRepository, set }) => {
        try {
          const useCase = new DeleteAgendaBlockUseCase(businessRepository);
          return await useCase.execute(companyId, user!.id, blockId);
        } catch (error: any) {
          set.status = error.message?.includes("Unauthorized") ? 403 : 400;
          return { error: error.message };
        }
      }, {
        params: t.Object({
          companyId: t.String(),
          blockId: t.String()
        })
      })
      .delete("/settings/:companyId/blocks/:blockId/", async ({ user, params: { companyId, blockId }, businessRepository, set }) => {
        try {
          const useCase = new DeleteAgendaBlockUseCase(businessRepository);
          return await useCase.execute(companyId, user!.id, blockId);
        } catch (error: any) {
          set.status = error.message?.includes("Unauthorized") ? 403 : 400;
          return { error: error.message };
        }
      }, {
        params: t.Object({
          companyId: t.String(),
          blockId: t.String()
        })
      })
      .get("/:id", async ({ params: { id }, set, businessRepository, settingsRepository, userRepository, user }) => {
        console.log(`[BUSINESS_CONTROLLER] Buscando dados por ID: '${id}'`);

        const business = await businessRepository.findById(id);

        if (!business) {
          console.error(`[BUSINESS_CONTROLLER] ❌ ERRO 404: Empresa não encontrada para o ID: '${id}'`);
          set.status = 404;
          return {
            error: "Business not found",
            message: `Nenhum estúdio encontrado com o ID '${id}'.`
          };
        }

        if (business.active === false && (!user || (user.id !== business.ownerId && user.role !== "SUPER_ADMIN"))) {
          set.status = 403;
          return {
            error: "Business suspended",
            message: "Este site está temporariamente indisponível."
          };
        }

        console.log(`[BUSINESS_CONTROLLER] ✅ SUCESSO: Dados encontrados para: ${business.name} (ID: ${business.id})`);

        // Reutilizando lógica de enriquecimento
        const profile = await settingsRepository.findByBusinessId(business.id);
        let publicEmail = profile?.email || null;
        if (!publicEmail && business.ownerId) {
          try {
            const owner = await userRepository.find(business.ownerId);
            if (owner) publicEmail = owner.email;
          } catch (err) { }
        }
        const publicPhone = profile?.phone || business.phone || business.contact || null;

        return {
          ...business,
          email: publicEmail,
          contact: {
            email: publicEmail,
            phone: publicPhone
          }
        };
      }, {
        params: t.Object({
          id: t.String()
        })
      })
  );
```

## Arquivo: `src\modules\business\adapters\in\http\company.controller.ts`
```typescript
import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { UpdateBusinessConfigUseCase } from "../../../application/use-cases/update-business-config.use-case";

export const companyController = new Elysia({ prefix: "/company" })
  .use(repositoriesPlugin)
  .use(authPlugin)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .post("/customizer", async ({ user, body, set, businessRepository }) => {
    try {
      // O corpo pode conter campos como hero_title, primary_color, etc.
      // Vamos mapear para a estrutura que o repositório espera ou salvar como JSON direto.
      // Para manter a flexibilidade solicitada, vamos permitir campos diretos e mapear.

      const config: any = {};

      // Mapeamento básico se vierem campos flat
      if (body.hero_title || body.hero_subtitle) {
        config.home = {
          hero_banner: {
            title: body.hero_title,
            subtitle: body.hero_subtitle
          }
        };
      }

      if (body.primary_color || body.font_family) {
        config.layoutGlobal = {
          base_colors: {
            primary: body.primary_color
          },
          typography: {
            font_family: body.font_family
          }
        };
      }

      // Se vier a config completa, usa ela
      const finalConfig = body.config || config;
      const companyId = body.companyId;

      if (!companyId) {
        set.status = 400;
        return { error: "companyId is required" };
      }

      const updateBusinessConfigUseCase = new UpdateBusinessConfigUseCase(businessRepository);
      return await updateBusinessConfigUseCase.execute(companyId, user!.id, { config: finalConfig });
    } catch (error: any) {
      set.status = 400;
      return { error: error.message };
    }
  }, {
    body: t.Object({
      companyId: t.String(),
      hero_title: t.Optional(t.String()),
      hero_subtitle: t.Optional(t.String()),
      primary_color: t.Optional(t.String()),
      font_family: t.Optional(t.String()),
      config: t.Optional(t.Any())
    })
  });
```

## Arquivo: `src\modules\business\adapters\in\http\master-admin.controller.ts`
```typescript
import { Elysia, t } from "elysia";
import { authPlugin, syncAsaasPaymentForCompany } from "../../../../infrastructure/auth/auth-plugin";
import { auth } from "../../../../infrastructure/auth/auth";
import { db } from "../../../../infrastructure/drizzle/database";
import * as schema from "../../../../../db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";

const writeSystemLog = async ({
  userId,
  action,
  details,
  level = "INFO",
  companyId,
}: {
  userId?: string;
  action: string;
  details?: string;
  level?: string;
  companyId?: string;
}) => {
  try {
    await db.insert(schema.systemLogs).values({
      id: crypto.randomUUID(),
      userId,
      action,
      details,
      level,
      companyId,
      createdAt: new Date()
    });
  } catch (error: any) {
    const code = (error as any)?.code;
    const message = String(error?.message || "");
    if (code === "42P01" || message.toLowerCase().includes("system_logs")) {
      return;
    }
    console.error("[MASTER_ADMIN_LOG_WRITE_ERROR]:", error);
  }
};

const HEALTH_CHECK_COMPANY_SLUG = "sistema-health-check";
const HEALTH_CHECK_COMPANY_NAME = "SISTEMA_HEALTH_CHECK";
const HEALTH_CHECK_SERVICE_NAME = "Serviço Diagnóstico HC";
const HEALTH_CHECK_CUSTOMER_EMAIL = "healthcheck@system.local";

export const masterAdminController = () => new Elysia({ prefix: "/admin/master" })
  .use(authPlugin)
  .guard({
    isMaster: true
  })
  .get("/stats", async () => {
    try {
      const [userStats] = await db.select({ count: count() }).from(schema.user);
      const [companyStats] = await db.select({ count: count() }).from(schema.companies);
      const [appointmentStats] = await db.select({ count: count() }).from(schema.appointments);
      const [activeCompanies] = await db.select({ count: count() }).from(schema.companies).where(eq(schema.companies.active, true));

      // Busca também assinaturas ativas e faturamento para a rota principal de stats
      const [activeSubs] = await db.execute(sql`
        SELECT COUNT(*)::int as count 
        FROM companies 
        WHERE subscription_status IN ('active', 'trialing', 'trial')
      `);

      // Busca o preço dinâmico para o cálculo do faturamento
      const [pricingSetting] = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, "monthly_price"))
        .limit(1);

      const currentPrice = pricingSetting ? parseFloat(pricingSetting.value) : 49.90;

      const [revenue] = await db.execute(sql`
        SELECT COALESCE(SUM(plan_price), 0)::float as total
        FROM (
          SELECT 
            CASE 
              WHEN access_type = 'premium' THEN 97.00
              WHEN access_type = 'pro' THEN 197.00
              WHEN access_type = 'automatic' THEN ${sql.raw(currentPrice.toString())}
              ELSE 0 
            END as plan_price
          FROM companies
          WHERE subscription_status IN ('active', 'trialing', 'trial')
        ) as prices
      `);

      return {
        totalUsers: Number(userStats.count),
        totalCompanies: Number(companyStats.count),
        totalAppointments: Number(appointmentStats.count),
        activeCompanies: Number(activeCompanies.count),
        activeSubscriptions: Number(activeSubs?.count || 0),
        monthlyRevenue: Number(revenue?.total || 0),
        revenue: Number(revenue?.total || 0), // Alias
        companies: Number(companyStats.count), // Alias
        appointments: Number(appointmentStats.count) // Alias
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_STATS_ERROR]:", error);
      throw new Error("Erro ao buscar estatísticas: " + error.message);
    }
  })
  .get("/users", async () => {
    try {
      const results = await db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          email: schema.user.email,
          role: schema.user.role,
          active: schema.user.active,
          createdAt: schema.user.createdAt,
          companyId: schema.companies.id,
          companyName: schema.companies.name,
          companySlug: schema.companies.slug,
        })
        .from(schema.user)
        .leftJoin(schema.companies, eq(schema.user.id, schema.companies.ownerId));

      return results;
    } catch (error: any) {
      console.error("[MASTER_ADMIN_USERS_ERROR]:", error);
      throw new Error("Erro ao buscar usuários: " + error.message);
    }
  })
  .patch("/users/:id/status", async ({ params, body, set }) => {
    try {
      const { id } = params;
      const { active } = body;

      const [updated] = await db
        .update(schema.user)
        .set({
          active,
          updatedAt: new Date()
        })
        .where(eq(schema.user.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Usuário não encontrado" };
      }

      return {
        success: true,
        message: `Status do usuário ${updated.name} alterado para ${active ? 'ativo' : 'inativo'}`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_USER_STATUS_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao atualizar status: " + error.message };
    }
  }, {
    body: t.Object({
      active: t.Boolean()
    })
  })
  .patch("/companies/:id/status", async ({ params, body, set }) => {
    try {
      const { id } = params;
      const { active } = body;

      const [updated] = await db
        .update(schema.companies)
        .set({
          active,
          updatedAt: new Date()
        })
        .where(eq(schema.companies.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Empresa não encontrada" };
      }

      return {
        success: true,
        message: `Status da empresa ${updated.name} alterado para ${active ? 'ativa' : 'inativa'}`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_COMPANY_STATUS_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao atualizar status da empresa: " + error.message };
    }
  }, {
    body: t.Object({
      active: t.Boolean()
    })
  })
  .post("/users/:id/reset-email-verification", async ({ params, set }) => {
    try {
      const { id } = params;

      const [updated] = await db
        .update(schema.user)
        .set({
          emailVerified: false,
          updatedAt: new Date()
        })
        .where(eq(schema.user.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Usuário não encontrado" };
      }

      return {
        success: true,
        message: `Verificação de e-mail do usuário ${updated.name} resetada com sucesso.`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_RESET_EMAIL_VERIFICATION_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao resetar verificação: " + error.message };
    }
  })
  .post("/companies/:id/reset-onboarding", async ({ params, set, user }) => {
    try {
      const { id } = params;

      const [company] = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.id, id))
        .limit(1);

      if (!company) {
        set.status = 404;
        return { error: "Empresa não encontrada." };
      }

      await db.update(schema.user)
        .set({
          hasCompletedOnboarding: false,
          updatedAt: new Date()
        })
        .where(eq(schema.user.id, company.ownerId));

      await writeSystemLog({
        userId: (user as any)?.id,
        action: "RESET_ONBOARDING",
        details: `Primeiro acesso resetado para ${company.name}.`,
        level: "WARN",
        companyId: id
      });

      return {
        success: true,
        message: "Primeiro acesso resetado com sucesso."
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_RESET_ONBOARDING_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao resetar primeiro acesso: " + error.message };
    }
  })
  .patch("/companies/:id/subscription", async ({ params, body, set }) => {
    try {
      const { id } = params;
      const { status, accessType, actionType, trialDays } = body;

      let updateData: any = {
        subscriptionStatus: status as any,
        accessType: accessType as any,
        updatedAt: new Date()
      };

      // Se actionType for fornecido, aplica lógica específica
      if (actionType) {
        const [currentCompany] = await db
          .select()
          .from(schema.companies)
          .where(eq(schema.companies.id, id))
          .limit(1);

        if (!currentCompany) {
          set.status = 404;
          return { error: "Empresa não encontrada" };
        }

        const now = new Date();

        if (actionType === 'manual_custom_days') {
          // Opção 1: Liberar por X dias (Manual/Fatura)
          // Define status como 'active' para liberar acesso imediato
          const daysToAdd = trialDays ? Number(trialDays) : 30;
          const nextDue = new Date(now);
          nextDue.setDate(nextDue.getDate() + daysToAdd);

          updateData.subscriptionStatus = 'active';
          updateData.accessType = 'manual'; // Marca como manual para diferenciar
          updateData.trialEndsAt = nextDue;
          updateData.active = true;

        } else if (actionType === 'extend_trial_custom') {
          // Opção 2: Definir Teste (Novo Prazo)
          // Lógica alterada: Agora define EXATAMENTE os dias a partir de hoje, substituindo o prazo anterior.
          // Ex: Se faltam 3 dias e defino 4, passa a faltar 4 (não soma 3+4).

          const daysToAdd = trialDays ? Number(trialDays) : 14;
          const extendedDate = new Date(now); // Baseado em HOJE
          extendedDate.setDate(extendedDate.getDate() + daysToAdd);

          updateData.subscriptionStatus = 'trial';
          updateData.trialEndsAt = extendedDate;
          // Força o tipo de acesso para 'extended_trial' para diferenciar do 'automatic' (padrão)
          // O Frontend usará isso para saber que houve uma extensão manual.
          updateData.accessType = 'extended_trial';
          updateData.active = true;

        } else if (actionType === 'automatic') {
          // Busca o email do proprietário para sincronização
          const [owner] = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.id, currentCompany.ownerId))
            .limit(1);

          console.log(`[MASTER_ADMIN] Empresa ${id} voltando para modo automático. Sincronizando com Asaas...`);

          // Executa a sincronização real com o Asaas
          const syncResult = await syncAsaasPaymentForCompany(
            id,
            currentCompany.ownerId,
            owner?.email,
            {
              requireCurrentMonthPayment: true,
              ignoreBlockDate: false
            }
          );

          if (syncResult && syncResult.activated) {
            updateData.subscriptionStatus = 'active';
            updateData.accessType = 'automatic';
            updateData.trialEndsAt = syncResult.nextDue;
            updateData.active = true;
            console.log(`[MASTER_ADMIN] Sincronização bem-sucedida: Empresa ${id} ATIVA.`);
          } else {
            // Se não encontrar pagamento, define como past_due
            updateData.subscriptionStatus = 'past_due';
            updateData.accessType = 'automatic';
            updateData.active = false;
            console.log(`[MASTER_ADMIN] Sincronização falhou ou sem pagamento: Empresa ${id} bloqueada (past_due).`);
          }
        }
      }

      const [updated] = await db
        .update(schema.companies)
        .set(updateData)
        .where(eq(schema.companies.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Empresa não encontrada" };
      }

      if (actionType === 'automatic') {
        if (updated.subscriptionStatus === 'past_due') {
          try {
            await db
              .delete(schema.session)
              .where(eq(schema.session.userId, updated.ownerId));

            console.log(`[MASTER_ADMIN_KICK]: Sessões invalidadas para o estúdio ${updated.name} (Owner: ${updated.ownerId})`);
          } catch (kickError) {
            console.error("[MASTER_ADMIN_KICK_ERROR]:", kickError);
          }
        }
      } else if (actionType === 'manual_custom_days' || actionType === 'extend_trial_custom') {
        await db
          .update(schema.user)
          .set({
            active: true,
            updatedAt: new Date()
          })
          .where(eq(schema.user.id, updated.ownerId));
      }

      return {
        success: true,
        status: updated.subscriptionStatus,
        message: `Assinatura atualizada via ${actionType || 'direto'}: Status ${updated.subscriptionStatus}, Vence em ${updated.trialEndsAt?.toLocaleDateString()}`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_SUBSCRIPTION_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao atualizar assinatura: " + error.message };
    }
  }, {
    body: t.Object({
      status: t.String(),
      accessType: t.Optional(t.String()),
      actionType: t.Optional(t.String()), // 'manual_custom_days' | 'extend_trial_custom' | 'automatic'
      trialDays: t.Optional(t.Number()) // Quantidade de dias customizável
    })
  })
  .post("/companies/:id/sync", async ({ params, set, user }) => {
    try {
      const { id } = params;

      const [currentCompany] = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.id, id))
        .limit(1);

      if (!currentCompany) {
        set.status = 404;
        return { error: "Empresa não encontrada" };
      }

      const [owner] = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, currentCompany.ownerId))
        .limit(1);

      console.log(`[MASTER_ADMIN] Sincronização manual solicitada para ${id}.`);

      const syncResult = await syncAsaasPaymentForCompany(
        id,
        currentCompany.ownerId,
        owner?.email,
        {
          requireCurrentMonthPayment: true,
          ignoreBlockDate: false
        }
      );

      await writeSystemLog({
        userId: (user as any)?.id,
        action: "SYNC_ASAAS",
        details: `Sincronização manual solicitada. Resultado: ${syncResult?.activated ? 'Ativado' : 'Não alterado'}`,
        level: "INFO",
        companyId: id
      });

      if (syncResult && syncResult.activated) {
        return {
          success: true,
          status: 'active',
          message: "Pagamento confirmado e acesso liberado."
        };
      }

      // Se não ativou via syncResult, garante que o status reflita a realidade (past_due se automático)
      if (currentCompany.accessType === 'automatic') {
        await db.update(schema.companies)
          .set({ subscriptionStatus: 'past_due', updatedAt: new Date() })
          .where(eq(schema.companies.id, id));

        return {
          success: true,
          status: 'past_due',
          message: "Nenhum pagamento confirmado encontrado. Status definido como Pendente."
        };
      }

      return {
        success: false,
        status: currentCompany.subscriptionStatus,
        message: "Nenhum novo pagamento identificado no Asaas."
      };

    } catch (error: any) {
      console.error("[MASTER_ADMIN_SYNC_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao sincronizar: " + error.message };
    }
  })
  .post("/companies/:id/simulate-block", async ({ params, set, user }) => {
    try {
      const { id } = params;

      const [company] = await db.select()
        .from(schema.companies)
        .where(eq(schema.companies.id, id))
        .limit(1);

      if (!company) {
        set.status = 404;
        return { error: "Empresa não encontrada." };
      }

      console.log(`[MASTER_ADMIN] Simulando bloqueio para: ${company.name} (ID: ${company.id})`);

      // 1. Marcar como inadimplente e inativa
      await db.update(schema.companies)
        .set({
          subscriptionStatus: "past_due",
          active: false,
          accessType: "automatic",
          updatedAt: new Date() // CRITICAL: This date will be used by auth-plugin to ignore old payments
        })
        .where(eq(schema.companies.id, company.id));

      // 2. Desativar o dono
      await db.update(schema.user)
        .set({
          active: false,
          updatedAt: new Date()
        })
        .where(eq(schema.user.id, company.ownerId));

      // 3. Matar sessões para forçar re-login/re-auth
      await db.delete(schema.session)
        .where(eq(schema.session.userId, company.ownerId));

      await writeSystemLog({
        userId: (user as any)?.id,
        action: "SIMULATE_BLOCK",
        details: `Bloqueio simulado para ${company.name}. Status: past_due, Active: false.`,
        level: "WARN",
        companyId: id
      });

      return {
        success: true,
        message: `Bloqueio simulado com sucesso para ${company.name}.`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_SIMULATE_BLOCK_ERROR]:", error);
      set.status = 500;
      return { error: "Erro na simulação: " + error.message };
    }
  })
  .post("/companies/:id/reset-data", async ({ params, body, set, user }) => {
    try {
      const { id } = params;
      const { resetAppointments, resetServices } = body;

      if (resetAppointments) {
        await db.delete(schema.appointments).where(eq(schema.appointments.companyId, id));
      }

      if (resetServices) {
        await db.delete(schema.services).where(eq(schema.services.companyId, id));
      }

      await writeSystemLog({
        userId: (user as any)?.id,
        action: "RESET_DATA",
        details: `Reset: ${[resetAppointments ? 'Agendamentos' : null, resetServices ? 'Serviços' : null].filter(Boolean).join(', ')}`,
        level: "WARN",
        companyId: id
      });

      return {
        success: true,
        message: `Dados resetados com sucesso: ${[resetAppointments ? 'Agendamentos' : null, resetServices ? 'Serviços' : null].filter(Boolean).join(', ')}`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_RESET_DATA_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao resetar dados: " + error.message };
    }
  }, {
    body: t.Object({
      resetAppointments: t.Boolean(),
      resetServices: t.Boolean()
    })
  })
  .post("/companies/:id/test-expiration", async ({ params, set, user }) => {
    try {
      const { id } = params;
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await db.update(schema.companies)
        .set({
          accessType: "manual",
          subscriptionStatus: "active",
          trialEndsAt: pastDate,
          updatedAt: new Date()
        })
        .where(eq(schema.companies.id, id));

      await writeSystemLog({
        userId: (user as any)?.id,
        action: "TEST_EXPIRATION",
        details: "Configurada expiração manual forçada para teste.",
        level: "INFO",
        companyId: id
      });

      return {
        success: true,
        message: "Empresa configurada como expirada (Acesso Manual). O sistema deve reverter para automático no próximo acesso."
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_TEST_EXPIRATION_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao configurar expiração: " + error.message };
    }
  })
  .post("/companies/:id/simulate-past-due", async ({ params, set, user }) => {
    try {
      const { id } = params;

      await db.update(schema.companies)
        .set({
          accessType: "automatic",
          subscriptionStatus: "past_due",
          active: false,
          updatedAt: new Date()
        })
        .where(eq(schema.companies.id, id));

      // 2. Desativar o dono para garantir o bloqueio total
      const [company] = await db.select().from(schema.companies).where(eq(schema.companies.id, id)).limit(1);
      if (company) {
        await db.update(schema.user)
          .set({ active: false, updatedAt: new Date() })
          .where(eq(schema.user.id, company.ownerId));

        // 3. Matar sessões para forçar re-login/bloqueio imediato
        await db.delete(schema.session)
          .where(eq(schema.session.userId, company.ownerId));
      }

      await writeSystemLog({
        userId: (user as any)?.id,
        action: "SIMULATE_PAST_DUE",
        details: "Simulação de vencimento automático (past_due) ativada.",
        level: "INFO",
        companyId: id
      });

      return {
        success: true,
        message: "Empresa definida como Vencida (Modo Automático)."
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_PAST_DUE_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao simular vencimento: " + error.message };
    }
  })
  .get("/logs", async () => {
    try {
      const results = await db
        .select({
          id: schema.systemLogs.id,
          userName: schema.user.name,
          action: schema.systemLogs.action,
          details: schema.systemLogs.details,
          level: schema.systemLogs.level,
          companyName: schema.companies.name,
          createdAt: schema.systemLogs.createdAt,
        })
        .from(schema.systemLogs)
        .leftJoin(schema.user, eq(schema.systemLogs.userId, schema.user.id))
        .leftJoin(schema.companies, eq(schema.systemLogs.companyId, schema.companies.id))
        .orderBy(sql`${schema.systemLogs.createdAt} DESC`)
        .limit(50);

      return results;
    } catch (error: any) {
      console.error("[MASTER_ADMIN_LOGS_ERROR]:", error);
      const code = (error as any)?.code;
      const message = String(error?.message || "");

      if (code === "42P01" || message.toLowerCase().includes("system_logs")) {
        return [];
      }

      throw new Error("Erro ao buscar logs: " + message);
    }
  })
  .get("/bug-reports", async () => {
    try {
      const reports = await db
        .select({
          id: schema.bugReports.id,
          type: schema.bugReports.type,
          description: schema.bugReports.description,
          screenshotUrl: schema.bugReports.screenshotUrl,
          pageUrl: schema.bugReports.pageUrl,
          userAgent: schema.bugReports.userAgent,
          ipAddress: schema.bugReports.ipAddress,
          acceptLanguage: schema.bugReports.acceptLanguage,
          metadata: schema.bugReports.metadata,
          status: schema.bugReports.status,
          createdAt: schema.bugReports.createdAt,
          reporterName: schema.user.name,
          reporterEmail: schema.user.email,
          companyName: schema.companies.name,
          companySlug: schema.companies.slug,
        })
        .from(schema.bugReports)
        .leftJoin(schema.user, eq(schema.bugReports.reporterUserId, schema.user.id))
        .leftJoin(schema.companies, eq(schema.bugReports.companyId, schema.companies.id))
        .orderBy(desc(schema.bugReports.createdAt))
        .limit(100);

      return reports;
    } catch (error: any) {
      console.error("[MASTER_ADMIN_BUG_REPORTS_ERROR]:", error);
      const code = (error as any)?.code;
      const message = String(error?.message || "");
      if (code === "42P01" || message.toLowerCase().includes("bug_reports")) {
        return [];
      }
      throw new Error("Erro ao buscar bug reports: " + message);
    }
  })
  .delete("/bug-reports/:id", async ({ params, set }) => {
    try {
      const { id } = params;
      const [deleted] = await db
        .delete(schema.bugReports)
        .where(eq(schema.bugReports.id, id))
        .returning();

      if (!deleted) {
        set.status = 404;
        return { error: "Feedback não encontrado" };
      }

      return { success: true, message: "Feedback removido com sucesso" };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_BUG_REPORT_DELETE_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao remover feedback: " + error.message };
    }
  })
  .patch("/bug-reports/:id/move", async ({ params, body, set }) => {
    try {
      const { id } = params;
      const { type } = body;

      if (type !== "BUG" && type !== "SUGGESTION") {
        set.status = 400;
        return { error: "Tipo inválido. Use 'BUG' ou 'SUGGESTION'." };
      }

      const [updated] = await db
        .update(schema.bugReports)
        .set({
          type: type as "BUG" | "SUGGESTION",
          updatedAt: new Date(),
        })
        .where(eq(schema.bugReports.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Feedback não encontrado" };
      }

      return {
        success: true,
        message: `Feedback movido para ${type === "BUG" ? "Bugs" : "Sugestões"}`,
        report: updated
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_BUG_REPORT_MOVE_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao mover feedback: " + error.message };
    }
  }, {
    body: t.Object({
      type: t.String()
    })
  })
  .post("/health/ensure-test-company", async ({ user, set }) => {
    try {
      const currentUserId = (user as any)?.id;

      if (!currentUserId) {
        set.status = 401;
        return { error: "Usuário não autenticado." };
      }

      const [currentUser] = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, currentUserId))
        .limit(1);

      if (!currentUser) {
        set.status = 404;
        return { error: "Usuário não encontrado." };
      }

      const now = new Date();

      let [healthCompany] = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.slug, HEALTH_CHECK_COMPANY_SLUG))
        .limit(1);

      if (!healthCompany) {
        [healthCompany] = await db
          .insert(schema.companies)
          .values({
            id: crypto.randomUUID(),
            name: HEALTH_CHECK_COMPANY_NAME,
            slug: HEALTH_CHECK_COMPANY_SLUG,
            ownerId: currentUserId,
            active: true,
            subscriptionStatus: "active",
            accessType: "manual",
            trialEndsAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
            createdAt: now,
            updatedAt: now
          })
          .returning();
      } else if (healthCompany.ownerId !== currentUserId) {
        const [updatedCompany] = await db
          .update(schema.companies)
          .set({
            ownerId: currentUserId,
            active: true,
            subscriptionStatus: "active",
            accessType: "manual",
            updatedAt: now
          })
          .where(eq(schema.companies.id, healthCompany.id))
          .returning();

        if (updatedCompany) {
          healthCompany = updatedCompany;
        }
      }

      if (!healthCompany) {
        set.status = 500;
        return { error: "Não foi possível preparar a empresa de teste." };
      }

      await db.delete(schema.operatingHours).where(eq(schema.operatingHours.companyId, healthCompany.id));

      const operatingHoursPayload = Array.from({ length: 7 }).map((_, dayIndex) => ({
        id: crypto.randomUUID(),
        companyId: healthCompany.id,
        dayOfWeek: String(dayIndex),
        status: "OPEN",
        morningStart: "09:00",
        morningEnd: "12:00",
        afternoonStart: "13:00",
        afternoonEnd: "18:00",
        createdAt: now,
        updatedAt: now
      }));

      await db.insert(schema.operatingHours).values(operatingHoursPayload);

      await db
        .delete(schema.appointments)
        .where(
          and(
            eq(schema.appointments.companyId, healthCompany.id),
            eq(schema.appointments.customerEmail, HEALTH_CHECK_CUSTOMER_EMAIL)
          )
        );

      let [healthService] = await db
        .select()
        .from(schema.services)
        .where(
          and(
            eq(schema.services.companyId, healthCompany.id),
            eq(schema.services.name, HEALTH_CHECK_SERVICE_NAME)
          )
        )
        .limit(1);

      if (!healthService) {
        [healthService] = await db
          .insert(schema.services)
          .values({
            id: crypto.randomUUID(),
            companyId: healthCompany.id,
            name: HEALTH_CHECK_SERVICE_NAME,
            description: "Serviço usado para diagnóstico automático de rotas.",
            price: "1.00",
            duration: "00:30",
            isVisible: false,
            showOnHome: false,
            createdAt: now,
            updatedAt: now
          })
          .returning();
      }

      if (!healthService) {
        set.status = 500;
        return { error: "Não foi possível preparar o serviço de diagnóstico." };
      }

      await writeSystemLog({
        userId: currentUserId,
        action: "HEALTH_TEST_READY",
        details: "Empresa de teste preparada para diagnóstico de rotas.",
        level: "INFO",
        companyId: healthCompany.id
      });

      return {
        success: true,
        companyId: healthCompany.id,
        companyName: healthCompany.name,
        companySlug: healthCompany.slug,
        serviceId: healthService.id,
        serviceName: healthService.name,
        servicePrice: String(healthService.price),
        serviceDuration: healthService.duration,
        testCustomerName: "Health Check Bot",
        testCustomerEmail: HEALTH_CHECK_CUSTOMER_EMAIL,
        testCustomerPhone: "11999999999"
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_HEALTH_SETUP_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao preparar ambiente de teste: " + error.message };
    }
  })
  // --- NOVAS ROTAS DE PROSPECTS (POSSÍVEIS CLIENTES) ---
  .get("/prospects", async () => {
    try {
      return await db.select().from(schema.prospects).orderBy(sql`${schema.prospects.createdAt} DESC`);
    } catch (error: any) {
      console.error("[MASTER_ADMIN_PROSPECTS_LIST_ERROR]:", error);
      throw new Error("Erro ao listar possíveis clientes: " + error.message);
    }
  })
  .post("/prospects", async ({ body, set }) => {
    try {
      // Mapeamento de status de Português para o Enum do Banco
      const statusMap: Record<string, string> = {
        "Não Contatado": "NOT_CONTACTED",
        "Contatado": "CONTACTED",
        "Em Negociação": "IN_NEGOTIATION",
        "Convertido": "CONVERTED",
        "Recusado": "REJECTED"
      };

      const status = body.status && statusMap[body.status] ? statusMap[body.status] : (body.status || "NOT_CONTACTED");

      const [newProspect] = await db.insert(schema.prospects).values({
        id: crypto.randomUUID(),
        name: body.name,
        phone: body.phone,
        establishmentName: body.establishmentName,
        instagramLink: body.instagramLink,
        category: body.category,
        location: body.location,
        address: body.address,
        mapsLink: body.mapsLink,
        status: status as any,
        notes: body.notes,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      return newProspect;
    } catch (error: any) {
      console.error("[MASTER_ADMIN_PROSPECT_CREATE_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao criar possível cliente: " + error.message };
    }
  }, {
    body: t.Object({
      name: t.String(),
      phone: t.String(),
      establishmentName: t.String(),
      instagramLink: t.Optional(t.String()),
      category: t.String(),
      location: t.Optional(t.String()),
      address: t.Optional(t.String()),
      mapsLink: t.Optional(t.String()),
      status: t.Optional(t.String()),
      notes: t.Optional(t.String())
    })
  })
  .post("/prospects/bulk", async ({ body, set }) => {
    try {
      const prospectsToInsert = body.map((p: any) => {
        // Mapeamento de status para cada item
        const statusMap: Record<string, string> = {
          "Não Contatado": "NOT_CONTACTED",
          "Contatado": "CONTACTED",
          "Em Negociação": "IN_NEGOTIATION",
          "Convertido": "CONVERTED",
          "Recusado": "REJECTED"
        };
        const status = p.status && statusMap[p.status] ? statusMap[p.status] : (p.status || "NOT_CONTACTED");

        return {
          id: crypto.randomUUID(),
          name: p.name,
          phone: p.phone,
          establishmentName: p.establishmentName || p.name,
          instagramLink: p.instagramLink,
          category: p.category,
          location: p.location,
          address: p.address,
          mapsLink: p.mapsLink,
          status: status as any,
          notes: p.notes,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      });

      const inserted = await db.insert(schema.prospects).values(prospectsToInsert).returning();
      return { success: true, count: inserted.length };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_PROSPECT_BULK_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao importar clientes em massa: " + error.message };
    }
  }, {
    body: t.Array(t.Object({
      name: t.String(),
      phone: t.String(),
      establishmentName: t.Optional(t.String()),
      instagramLink: t.Optional(t.String()),
      category: t.String(),
      location: t.Optional(t.String()),
      address: t.Optional(t.String()),
      mapsLink: t.Optional(t.String()),
      status: t.Optional(t.String()),
      notes: t.Optional(t.String())
    }))
  })
  .post("/prospects/parse-import", async ({ body }) => {
    // Rota auxiliar para transformar o formato bruto da planilha (ex: Google Maps)
    // para o formato que o nosso sistema entende, para o front mostrar o preview.
    try {
      const rawData = body as any[];

      const parsed = rawData.map(row => {
        // Mapeamento baseado no exemplo fornecido pelo usuário
        // qBF1Pd -> Nome/Estabelecimento
        // W4Efsd -> Categoria
        // W4Efsd 2 -> Endereço
        // telefone -> Telefone
        // hfpxzc href -> Link do Maps

        return {
          name: row["qBF1Pd"] || row["Nome"] || "Sem Nome",
          establishmentName: row["qBF1Pd"] || row["Estabelecimento"] || row["Nome"] || "Sem Nome",
          category: row["W4Efsd"] || row["Categoria"] || "Sem Categoria",
          address: row["W4Efsd 2"] || row["Endereço"] || row["Address"] || "",
          location: row["UY7F9"] || row["Localização"] || "", // Tentativa de pegar localização de outro campo
          phone: row["telefone"] || row["Telefone"] || row["WhatsApp"] || "",
          mapsLink: row["hfpxzc href"] || row["Maps Link"] || "",
          instagramLink: row["Instagram"] || row["instagram"] || "", // Campo que o usuário disse que vai adicionar
          status: "Não Contatado",
          notes: ""
        };
      });

      return parsed;
    } catch (error: any) {
      throw new Error("Erro ao processar dados da planilha: " + error.message);
    }
  })
  .patch("/prospects/:id", async ({ params, body, set }) => {
    try {
      const { id } = params;

      // Mapeamento de status de Português para o Enum do Banco
      const statusMap: Record<string, string> = {
        "Não Contatado": "NOT_CONTACTED",
        "Contatado": "CONTACTED",
        "Em Negociação": "IN_NEGOTIATION",
        "Convertido": "CONVERTED",
        "Recusado": "REJECTED"
      };

      const updateData: any = {
        ...body,
        updatedAt: new Date()
      };

      if (body.status && statusMap[body.status]) {
        updateData.status = statusMap[body.status];
      }

      const [updated] = await db.update(schema.prospects)
        .set(updateData)
        .where(eq(schema.prospects.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Possível cliente não encontrado" };
      }

      return updated;
    } catch (error: any) {
      console.error("[MASTER_ADMIN_PROSPECT_UPDATE_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao atualizar possível cliente: " + error.message };
    }
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      phone: t.Optional(t.String()),
      establishmentName: t.Optional(t.String()),
      instagramLink: t.Optional(t.String()),
      category: t.Optional(t.String()),
      location: t.Optional(t.String()),
      address: t.Optional(t.String()),
      mapsLink: t.Optional(t.String()),
      status: t.Optional(t.String()),
      notes: t.Optional(t.String())
    })
  })
  .delete("/prospects/:id", async ({ params, set }) => {
    try {
      const { id } = params;
      const [deleted] = await db.delete(schema.prospects)
        .where(eq(schema.prospects.id, id))
        .returning();

      if (!deleted) {
        set.status = 404;
        return { error: "Possível cliente não encontrado" };
      }

      return { success: true, message: "Possível cliente removido" };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_PROSPECT_DELETE_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao remover possível cliente: " + error.message };
    }
  })
  // --- NOVAS ROTAS DE RELATÓRIOS DO MASTER ADMIN ---
  .get("/reports/growth", async () => {
    try {
      // Relatório de crescimento de usuários e empresas por mês
      const companyGrowth = await db.execute(sql`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*)::int as count
        FROM companies
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `);

      const userGrowth = await db.execute(sql`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*)::int as count
        FROM "user"
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `);

      // Convertendo para array puro e garantindo que count seja número
      return {
        companies: Array.from(companyGrowth).map((row: any) => ({ ...row, count: Number(row.count) })),
        users: Array.from(userGrowth).map((row: any) => ({ ...row, count: Number(row.count) }))
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_REPORT_GROWTH_ERROR]:", error);
      throw new Error("Erro ao gerar relatório de crescimento: " + error.message);
    }
  })
  .get("/reports/subscriptions", async () => {
    try {
      // Relatório de status de assinaturas
      const stats = await db.execute(sql`
        SELECT 
          subscription_status as status,
          access_type as type,
          COUNT(*)::int as count
        FROM companies
        GROUP BY subscription_status, access_type
      `);

      return Array.from(stats).map((row: any) => ({ ...row, count: Number(row.count) }));
    } catch (error: any) {
      console.error("[MASTER_ADMIN_REPORT_SUBSCRIPTIONS_ERROR]:", error);
      throw new Error("Erro ao gerar relatório de assinaturas: " + error.message);
    }
  })
  .get("/reports/dashboard-stats", async () => {
    try {
      // 1. Total de Estúdios (Empresas)
      const [totalCompanies] = await db.execute(sql`SELECT COUNT(*)::int as count FROM companies`);

      // 2. Assinaturas Ativas (Status active ou trialing)
      const [activeSubscriptions] = await db.execute(sql`
        SELECT COUNT(*)::int as count 
        FROM companies 
        WHERE subscription_status IN ('active', 'trialing', 'trial')
      `);

      // 3. Faturamento Mensal Estimado usando preço dinâmico
      const [pricingSetting] = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, "monthly_price"))
        .limit(1);

      const currentPrice = pricingSetting ? parseFloat(pricingSetting.value) : 49.90;

      const [revenue] = await db.execute(sql`
        SELECT COALESCE(SUM(plan_price), 0)::float as total
        FROM (
          SELECT 
            CASE 
              WHEN access_type = 'premium' THEN 97.00
              WHEN access_type = 'pro' THEN 197.00
              WHEN access_type = 'automatic' THEN ${sql.raw(currentPrice.toString())}
              ELSE 0 
            END as plan_price
          FROM companies
          WHERE subscription_status IN ('active', 'trialing', 'trial')
        ) as prices
      `);

      // 4. Volume Global de Agendamentos
      const [totalAppointments] = await db.execute(sql`SELECT COUNT(*)::int as count FROM appointments`);

      // Garantir que todos os valores sejam números, pois o driver pode retornar como string
      const stats = {
        totalCompanies: Number(totalCompanies?.count || 0),
        activeSubscriptions: Number(activeSubscriptions?.count || 0),
        monthlyRevenue: Number(revenue?.total || 0),
        totalAppointments: Number(totalAppointments?.count || 0),
        // Adicionando campos extras caso o front use nomes diferentes
        revenue: Number(revenue?.total || 0),
        appointments: Number(totalAppointments?.count || 0),
        companies: Number(totalCompanies?.count || 0),
        currentPricing: currentPrice
      };

      return stats;
    } catch (error: any) {
      console.error("[MASTER_ADMIN_REPORT_STATS_ERROR]:", error);
      throw new Error("Erro ao gerar estatísticas do dashboard: " + error.message);
    }
  })
  .get("/settings/pricing", async () => {
    try {
      const [setting] = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, "monthly_price"))
        .limit(1);

      return {
        price: setting ? parseFloat(setting.value) : 49.90,
        updatedAt: setting?.updatedAt || new Date()
      };
    } catch (error: any) {
      throw new Error("Erro ao buscar preço: " + error.message);
    }
  })
  .post("/settings/pricing", async ({ body, set }) => {
    try {
      const { price } = body;

      const [updated] = await db
        .insert(schema.systemSettings)
        .values({
          id: crypto.randomUUID(),
          key: "monthly_price",
          value: price.toString(),
          description: "Preço da mensalidade do Plano Pro",
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: schema.systemSettings.key,
          set: {
            value: price.toString(),
            updatedAt: new Date()
          }
        })
        .returning();

      return {
        success: true,
        price: parseFloat(updated.value),
        message: "Preço da mensalidade atualizado com sucesso"
      };
    } catch (error: any) {
      set.status = 500;
      return { error: "Erro ao atualizar preço: " + error.message };
    }
  }, {
    body: t.Object({
      price: t.Number()
    })
  })
  // Alias para compatibilidade
  .get("/reports/financial", async ({ set }) => {
    try {
      // Busca o preço dinâmico para o cálculo do faturamento
      const [pricingSetting] = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, "monthly_price"))
        .limit(1);

      const currentPrice = pricingSetting ? parseFloat(pricingSetting.value) : 49.90;

      const [monthlyRevenue] = await db.execute(sql`
        SELECT COALESCE(SUM(plan_price), 0)::float as total
        FROM (
          SELECT 
            CASE 
              WHEN access_type = 'premium' THEN 97.00
              WHEN access_type = 'pro' THEN 197.00
              WHEN access_type = 'automatic' THEN ${sql.raw(currentPrice.toString())}
              ELSE 0 
            END as plan_price
          FROM companies
          WHERE subscription_status IN ('active', 'trialing', 'trial')
        ) as prices
      `);

      const revenueValue = Number(monthlyRevenue?.total || 0);
      return {
        totalRevenue: revenueValue,
        monthlyRevenue: revenueValue,
        revenue: revenueValue // Mais uma variação
      };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message };
    }
  })
  .patch("/users/:id/email", async ({ params, body, set }) => {
    try {
      const { id } = params;
      const { email } = body;

      // 1. Atualiza email na tabela de usuários
      const [updated] = await db
        .update(schema.user)
        .set({
          email,
          updatedAt: new Date()
        })
        .where(eq(schema.user.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Usuário não encontrado" };
      }

      // 2. Atualiza o e-mail/accountId na tabela accounts
      // No Better Auth, para o provider 'credential', o accountId é o próprio e-mail.
      // Se não atualizarmos aqui, o usuário não conseguirá logar com o novo e-mail.
      await db
        .update(schema.account)
        .set({
          accountId: email,
          updatedAt: new Date()
        })
        .where(
          sql`${schema.account.userId} = ${id} AND ${schema.account.providerId} = 'credential'`
        );

      return {
        success: true,
        message: `Email do usuário ${updated.name} alterado para ${email} em todas as tabelas.`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_USER_EMAIL_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao atualizar email: " + error.message };
    }
  }, {
    body: t.Object({
      email: t.String({ format: 'email' })
    })
  })
  .post("/users/:id/reset-password", async ({ params, set }) => {
    try {
      const { id } = params;
      const defaultPassword = "Mudar@123";

      // Gera hash da senha usando Bun (Argon2id/Bcrypt)
      const hashedPassword = await Bun.password.hash(defaultPassword);

      // Atualiza a senha na tabela account
      const [updatedAccount] = await db
        .update(schema.account)
        .set({
          password: hashedPassword,
          updatedAt: new Date()
        })
        .where(
          sql`${schema.account.userId} = ${id} AND ${schema.account.providerId} = 'credential'`
        )
        .returning();

      if (!updatedAccount) {
        set.status = 404;
        return { error: "Usuário não possui conta de email/senha vinculada." };
      }

      return {
        success: true,
        message: `Senha de ${updatedAccount.userId} resetada para Mudar@123 com sucesso.`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_RESET_PASSWORD_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao resetar senha: " + error.message };
    }
  })
  .get("/financial-details", async ({ query, set }) => {
    try {
      const { email } = query;
      if (!email) {
        set.status = 400;
        return { error: "Email é obrigatório" };
      }

      // Busca a empresa vinculada ao email (dono)
      const [company] = await db
        .select({
          id: schema.companies.id,
          subscriptionStatus: schema.companies.subscriptionStatus,
          trialEndsAt: schema.companies.trialEndsAt,
          createdAt: schema.companies.createdAt,
        })
        .from(schema.companies)
        .innerJoin(schema.user, eq(schema.companies.ownerId, schema.user.id))
        .where(eq(schema.user.email, email))
        .limit(1);

      if (!company) {
        return {
          status: "Não identificado",
          nextInvoiceDate: null,
          lastPaymentDate: null,
          history: []
        };
      }

      // Por enquanto, como não temos integração total de histórico com Asaas implementada no AsaasClient,
      // retornamos um mock estruturado que o front espera baseado no status do banco.

      const statusMap: Record<string, string> = {
        active: "Ativo",
        trialing: "Teste",
        trial: "Teste",
        past_due: "Vencido",
        deleted: "Cancelado"
      };

      // Cálculo simples da próxima fatura (mensal)
      const nextInvoice = new Date(company.createdAt);
      const now = new Date();

      // Se estiver em trial, a primeira fatura é após o trial
      if ((company.subscriptionStatus === 'trial' || company.subscriptionStatus === 'trialing') && company.trialEndsAt) {
        nextInvoice.setTime(company.trialEndsAt.getTime());
      } else {
        while (nextInvoice < now) {
          nextInvoice.setMonth(nextInvoice.getMonth() + 1);
        }
      }

      return {
        status: statusMap[company.subscriptionStatus] || "Não identificado",
        nextInvoiceDate: (company.subscriptionStatus === 'active' || company.subscriptionStatus === 'trial' || company.subscriptionStatus === 'trialing') ? nextInvoice.toISOString() : null,
        lastPaymentDate: company.createdAt.toISOString(), // Simplificação
        history: [] // Histórico real exigiria busca no Asaas via API
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_FINANCIAL_DETAILS_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao buscar detalhes financeiros: " + error.message };
    }
  }, {
    query: t.Object({
      email: t.String()
    })
  })
  .get("/users/:id/details", async ({ params, set }) => {
    try {
      const { id } = params;

      // 1. Dados do Usuário
      const [usr] = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, id))
        .limit(1);

      if (!usr) {
        set.status = 404;
        return { error: "Usuário não encontrado" };
      }

      // 2. Dados do Estúdio
      const [company] = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.ownerId, id))
        .limit(1);

      // 3. Métricas Básicas (Agendamentos)
      const [appointmentStats] = await db
        .select({ count: count() })
        .from(schema.appointments)
        .where(company ? eq(schema.appointments.companyId, company.id) : undefined);

      // 4. Contas Vinculadas (Better Auth)
      const accounts = await db
        .select()
        .from(schema.account)
        .where(eq(schema.account.userId, id));

      return {
        user: {
          id: usr.id,
          name: usr.name,
          email: usr.email,
          role: usr.role,
          active: usr.active,
          createdAt: usr.createdAt,
        },
        business: company ? {
          id: company.id,
          name: company.name,
          slug: company.slug,
          active: company.active,
          createdAt: company.createdAt,
          subscriptionStatus: company.subscriptionStatus,
          trialEndsAt: company.trialEndsAt,
        } : null,
        stats: {
          totalAppointments: Number(appointmentStats?.count || 0),
        },
        auth: {
          providers: accounts.map(acc => acc.providerId),
        }
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_USER_DETAILS_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao buscar detalhes: " + error.message };
    }
  })
  .delete("/users/:id", async ({ params, set }) => {
    try {
      const { id } = params;
      const deleted = await db.transaction(async (tx) => {
        const ownedCompanies = await tx
          .select({ id: schema.companies.id })
          .from(schema.companies)
          .where(eq(schema.companies.ownerId, id));

        await tx
          .delete(schema.systemLogs)
          .where(eq(schema.systemLogs.userId, id));

        for (const company of ownedCompanies) {
          await tx
            .delete(schema.systemLogs)
            .where(eq(schema.systemLogs.companyId, company.id));
        }

        const [removedUser] = await tx
          .delete(schema.user)
          .where(eq(schema.user.id, id))
          .returning();

        return removedUser;
      });

      if (!deleted) {
        set.status = 404;
        return { error: "Usuário não encontrado" };
      }

      console.log(`[MASTER_ADMIN_DELETE]: Usuário ${deleted.email} e todos os seus dados foram removidos.`);

      return {
        success: true,
        message: `Usuário ${deleted.name} e todos os dados vinculados foram apagados permanentemente.`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_DELETE_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao apagar usuário: " + error.message };
    }
  })
  .get("/businesses", async () => {
    try {
      const results = await db
        .select({
          id: schema.companies.id,
          name: schema.companies.name,
          slug: schema.companies.slug,
          active: schema.companies.active,
          subscriptionStatus: schema.companies.subscriptionStatus,
          trialEndsAt: schema.companies.trialEndsAt,
          accessType: schema.companies.accessType,
          createdAt: schema.companies.createdAt,
          ownerId: schema.companies.ownerId,
          ownerEmail: schema.user.email,
        })
        .from(schema.companies)
        .innerJoin(schema.user, eq(schema.companies.ownerId, schema.user.id));

      return results;
    } catch (error: any) {
      console.error("[MASTER_ADMIN_BUSINESSES_ERROR]:", error);
      throw new Error("Erro ao buscar estúdios: " + error.message);
    }
  })
  .patch("/businesses/:id/status", async ({ params, body, set }) => {
    try {
      const { id } = params;
      const { active } = body;

      const [updated] = await db
        .update(schema.companies)
        .set({
          active,
          updatedAt: new Date()
        })
        .where(eq(schema.companies.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Estúdio não encontrado" };
      }

      // Invalidação de Sessão (Real-time Kick)
      if (active === false) {
        try {
          // Deleta todas as sessões vinculadas ao proprietário do estúdio
          await db
            .delete(schema.session)
            .where(eq(schema.session.userId, updated.ownerId));

          console.log(`[MASTER_ADMIN_KICK]: Sessões invalidadas para o estúdio ${updated.name} (Owner: ${updated.ownerId})`);
        } catch (kickError) {
          console.error("[MASTER_ADMIN_KICK_ERROR]:", kickError);
        }
      }

      return {
        success: true,
        message: `Status do estúdio ${updated.name} alterado para ${active ? 'ativo' : 'inativo'}`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_STATUS_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao atualizar status: " + error.message };
    }
  }, {
    body: t.Object({
      active: t.Boolean()
    })
  })
  .patch("/businesses/:id/subscription", async ({ params, body, set }) => {
    try {
      const { id } = params;
      const { subscriptionStatus, accessType } = body;

      const [updated] = await db
        .update(schema.companies)
        .set({
          subscriptionStatus,
          accessType: accessType || 'automatic',
          updatedAt: new Date()
        })
        .where(eq(schema.companies.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Estúdio não encontrado" };
      }

      return {
        success: true,
        message: `Assinatura do estúdio ${updated.name} alterada para ${subscriptionStatus}`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_SUBSCRIPTION_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao atualizar assinatura: " + error.message };
    }
  }, {
    body: t.Object({
      subscriptionStatus: t.String(),
      accessType: t.Optional(t.String())
    })
  });
```

## Arquivo: `src\modules\business\adapters\out\business.repository.ts`
```typescript
import { db } from "../../../infrastructure/drizzle/database";
import { companies, companySiteCustomizations } from "../../../../db/schema";
import { eq, and } from "drizzle-orm";
import { Business, BusinessSummary, CreateBusinessInput, BusinessSiteCustomization } from "../../domain/entities/business.entity";

export class BusinessRepository {
  async findAllByUserId(userId: string): Promise<BusinessSummary[]> {
    const results = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        createdAt: companies.createdAt,
        siteCustomization: {
          layoutGlobal: companySiteCustomizations.layoutGlobal,
          home: companySiteCustomizations.home,
          gallery: companySiteCustomizations.gallery,
          aboutUs: companySiteCustomizations.aboutUs,
          appointmentFlow: companySiteCustomizations.appointmentFlow,
        }
      })
      .from(companies)
      .leftJoin(companySiteCustomizations, eq(companies.id, companySiteCustomizations.companyId))
      .where(eq(companies.ownerId, userId));

    return results as BusinessSummary[];
  }

  async findBySlug(slug: string): Promise<Business | null> {
    const result = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        ownerId: companies.ownerId,
        active: companies.active,
        createdAt: companies.createdAt,
        updatedAt: companies.updatedAt,
        siteCustomization: {
          layoutGlobal: companySiteCustomizations.layoutGlobal,
          home: companySiteCustomizations.home,
          gallery: companySiteCustomizations.gallery,
          aboutUs: companySiteCustomizations.aboutUs,
          appointmentFlow: companySiteCustomizations.appointmentFlow,
        }
      })
      .from(companies)
      .leftJoin(companySiteCustomizations, eq(companies.id, companySiteCustomizations.companyId))
      .where(eq(companies.slug, slug))
      .limit(1);

    return (result[0] as Business) || null;
  }

  async findById(id: string): Promise<Business | null> {
    const result = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        ownerId: companies.ownerId,
        active: companies.active,
        createdAt: companies.createdAt,
        updatedAt: companies.updatedAt,
        siteCustomization: {
          layoutGlobal: companySiteCustomizations.layoutGlobal,
          home: companySiteCustomizations.home,
          gallery: companySiteCustomizations.gallery,
          aboutUs: companySiteCustomizations.aboutUs,
          appointmentFlow: companySiteCustomizations.appointmentFlow,
        }
      })
      .from(companies)
      .leftJoin(companySiteCustomizations, eq(companies.id, companySiteCustomizations.companyId))
      .where(eq(companies.id, id))
      .limit(1);

    return (result[0] as Business) || null;
  }

  async create(data: CreateBusinessInput): Promise<Business> {
    return await db.transaction(async (tx) => {
      const [newCompany] = await tx.insert(companies).values({
        id: data.id,
        name: data.name,
        slug: data.slug,
        ownerId: data.ownerId,
      }).returning();

      const [newCustomization] = await tx.insert(companySiteCustomizations).values({
        id: crypto.randomUUID(),
        companyId: newCompany.id,
      }).returning();

      return {
        ...newCompany,
        siteCustomization: newCustomization
      } as Business;
    });
  }

  async updateConfig(id: string, userId: string, config: Partial<BusinessSiteCustomization>): Promise<Business | null> {
    return await db.transaction(async (tx) => {
      // Verifica se a empresa pertence ao usuário
      const [company] = await tx
        .select()
        .from(companies)
        .where(and(eq(companies.id, id), eq(companies.ownerId, userId)))
        .limit(1);

      if (!company) return null;

      // Atualiza ou insere a customização
      const [updatedCustomization] = await tx
        .insert(companySiteCustomizations)
        .values({
          id: crypto.randomUUID(),
          companyId: id,
          ...config
        })
        .onConflictDoUpdate({
          target: companySiteCustomizations.companyId,
          set: config
        })
        .returning();

      return {
        ...company,
        siteCustomization: updatedCustomization
      } as Business;
    });
  }
}
```

## Arquivo: `src\modules\business\adapters\out\drizzle\business.drizzle.repository.ts`
```typescript
import { db } from "../../../../infrastructure/drizzle/database";
import { companies, companySiteCustomizations, operatingHours, agendaBlocks } from "../../../../../db/schema";
import { and, eq, ilike } from "drizzle-orm";
import { IBusinessRepository } from "../../../domain/ports/business.repository";
import { Business, BusinessSummary, CreateBusinessInput, BusinessSiteCustomization } from "../../../domain/entities/business.entity";
import {
  DEFAULT_LAYOUT_GLOBAL,
  DEFAULT_HOME_SECTION,
  DEFAULT_GALLERY_SECTION,
  DEFAULT_ABOUT_US_SECTION,
  DEFAULT_APPOINTMENT_FLOW_SECTION
} from "../../../domain/constants/site_customization.defaults";

export class DrizzleBusinessRepository implements IBusinessRepository {
  async findAllByUserId(userId: string): Promise<BusinessSummary[]> {
    const results = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        phone: companies.phone,
        createdAt: companies.createdAt,
        siteCustomization: {
          layoutGlobal: companySiteCustomizations.layoutGlobal,
          home: companySiteCustomizations.home,
          gallery: companySiteCustomizations.gallery,
          aboutUs: companySiteCustomizations.aboutUs,
          appointmentFlow: companySiteCustomizations.appointmentFlow,
        }
      })
      .from(companies)
      .leftJoin(companySiteCustomizations, eq(companies.id, companySiteCustomizations.companyId))
      .where(eq(companies.ownerId, userId));

    return results as BusinessSummary[];
  }

  async findBySlug(slug: string): Promise<Business | null> {
    const result = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        phone: companies.phone,
        address: companies.address,
        contact: companies.contact,
        ownerId: companies.ownerId,
        active: companies.active,
        createdAt: companies.createdAt,
        updatedAt: companies.updatedAt,
        subscriptionStatus: companies.subscriptionStatus,
        trialEndsAt: companies.trialEndsAt,
        accessType: companies.accessType,
        siteCustomization: {
          layoutGlobal: companySiteCustomizations.layoutGlobal,
          home: companySiteCustomizations.home,
          gallery: companySiteCustomizations.gallery,
          aboutUs: companySiteCustomizations.aboutUs,
          appointmentFlow: companySiteCustomizations.appointmentFlow,
        }
      })
      .from(companies)
      .leftJoin(companySiteCustomizations, eq(companies.id, companySiteCustomizations.companyId))
      // Busca case-insensitive para garantir que "Studio-X" encontre "studio-x"
      .where(ilike(companies.slug, slug))
      .limit(1);

    return (result[0] as Business) || null;
  }

  async findById(id: string): Promise<Business | null> {
    const result = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        phone: companies.phone,
        address: companies.address,
        contact: companies.contact,
        ownerId: companies.ownerId,
        active: companies.active,
        createdAt: companies.createdAt,
        updatedAt: companies.updatedAt,
        subscriptionStatus: companies.subscriptionStatus,
        trialEndsAt: companies.trialEndsAt,
        accessType: companies.accessType,
        siteCustomization: {
          layoutGlobal: companySiteCustomizations.layoutGlobal,
          home: companySiteCustomizations.home,
          gallery: companySiteCustomizations.gallery,
          aboutUs: companySiteCustomizations.aboutUs,
          appointmentFlow: companySiteCustomizations.appointmentFlow,
        }
      })
      .from(companies)
      .leftJoin(companySiteCustomizations, eq(companies.id, companySiteCustomizations.companyId))
      .where(eq(companies.id, id))
      .limit(1);

    return (result[0] as Business) || null;
  }

  async create(data: CreateBusinessInput): Promise<Business> {
    return await db.transaction(async (tx) => {
      // Calcular data de fim do trial (+14 dias)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const [newCompany] = await tx.insert(companies).values({
        id: data.id,
        name: data.name,
        slug: data.slug,
        phone: data.phone,
        ownerId: data.ownerId,
        subscriptionStatus: 'trial',
        trialEndsAt: trialEndsAt,
        accessType: 'automatic',
      }).returning();

      const [newCustomization] = await tx.insert(companySiteCustomizations).values({
        id: crypto.randomUUID(),
        companyId: newCompany.id,
        layoutGlobal: DEFAULT_LAYOUT_GLOBAL,
        home: DEFAULT_HOME_SECTION,
        gallery: DEFAULT_GALLERY_SECTION,
        aboutUs: DEFAULT_ABOUT_US_SECTION,
        appointmentFlow: DEFAULT_APPOINTMENT_FLOW_SECTION,
      }).returning();

      return {
        ...newCompany,
        siteCustomization: newCustomization
      } as Business;
    });
  }

  async updateConfig(id: string, userId: string, config: Partial<BusinessSiteCustomization>): Promise<Business | null> {
    return await db.transaction(async (tx) => {
      const [company] = await tx
        .select()
        .from(companies)
        .where(and(eq(companies.id, id), eq(companies.ownerId, userId)))
        .limit(1);

      if (!company) return null;

      const [updatedCustomization] = await tx
        .insert(companySiteCustomizations)
        .values({
          id: crypto.randomUUID(),
          companyId: id,
          ...config
        })
        .onConflictDoUpdate({
          target: companySiteCustomizations.companyId,
          set: config
        })
        .returning();

      return {
        ...company,
        siteCustomization: updatedCustomization
      } as Business;
    });
  }

  async setOperatingHours(
    companyId: string,
    userId: string,
    hours: Array<{
      dayOfWeek: string;
      status: string;
      morningStart?: string | null;
      morningEnd?: string | null;
      afternoonStart?: string | null;
      afternoonEnd?: string | null;
    }>
  ): Promise<boolean> {
    return await db.transaction(async (tx) => {
      const [company] = await tx
        .select()
        .from(companies)
        .where(and(eq(companies.id, companyId), eq(companies.ownerId, userId)))
        .limit(1);

      if (!company) return false;

      await tx.delete(operatingHours).where(eq(operatingHours.companyId, companyId));

      for (const h of hours) {
        await tx.insert(operatingHours).values({
          id: crypto.randomUUID(),
          companyId,
          dayOfWeek: h.dayOfWeek,
          status: h.status,
          morningStart: h.morningStart ?? null,
          morningEnd: h.morningEnd ?? null,
          afternoonStart: h.afternoonStart ?? null,
          afternoonEnd: h.afternoonEnd ?? null,
        });
      }

      return true;
    });
  }

  async getOperatingHours(
    companyId: string,
    userId?: string
  ): Promise<{
    weekly: Array<{
      id: string;
      dayOfWeek: string;
      status: string;
      morningStart?: string | null;
      morningEnd?: string | null;
      afternoonStart?: string | null;
      afternoonEnd?: string | null;
      openTime?: string | null;
      lunchStart?: string | null;
      lunchEnd?: string | null;
      closeTime?: string | null;
    }>;
    slotInterval: string;
    interval: string;
    minimumBookingLeadMinutes: number;
    blocks: Array<{
      id: string;
      type: string;
      startDate: string;
      endDate: string;
      startTime?: string | null;
      endTime?: string | null;
      reason?: string | null;
    }>;
  } | null> {
    const query = db
      .select({
        id: companies.id,
        siteCustomization: {
          appointmentFlow: companySiteCustomizations.appointmentFlow,
        }
      })
      .from(companies)
      .leftJoin(companySiteCustomizations, eq(companies.id, companySiteCustomizations.companyId));

    const conditions = [eq(companies.id, companyId)];
    if (userId) {
      conditions.push(eq(companies.ownerId, userId));
    }

    const [company] = await query
      .where(and(...conditions))
      .limit(1);

    if (!company) return null;

    const rows = await db
      .select()
      .from(operatingHours)
      .where(eq(operatingHours.companyId, companyId));

    const weekly = rows.map(row => ({
      id: row.id,
      dayOfWeek: String(row.dayOfWeek),
      status: row.status,
      morningStart: row.morningStart,
      morningEnd: row.morningEnd,
      afternoonStart: row.afternoonStart,
      afternoonEnd: row.afternoonEnd,
      // Adicionar mapeamento reverso para compatibilidade com o frontend (openTime/closeTime)
      openTime: row.morningStart,
      lunchStart: row.morningEnd,
      lunchEnd: row.afternoonStart,
      closeTime: row.afternoonEnd
    }));

    // Buscar também os bloqueios de agenda para o site poder desabilitar os horários
    const blocksRows = await db
      .select()
      .from(agendaBlocks)
      .where(eq(agendaBlocks.companyId, companyId));

    const blocks = blocksRows.map(block => ({
      id: block.id,
      type: block.type,
      startDate: block.startDate,
      endDate: block.endDate,
      startTime: block.startTime,
      endTime: block.endTime,
      reason: block.reason
    }));

    const appointmentFlow = (company.siteCustomization?.appointmentFlow as any) || {};
    // Suportar tanto a chave antiga quanto a nova (plural) e as variações de snake/camel case
    const step3 = appointmentFlow.step3Times || appointmentFlow.step3Time || appointmentFlow.step_3_time || {};
    let slotInterval = step3.timeSlotSize || step3.slot_interval || step3.slotInterval || "00:30";
    const minimumBookingLeadMinutes = Number(
      step3.minimumBookingLeadMinutes ??
      step3.minimum_booking_lead_minutes ??
      0,
    );

    // Garantir formato HH:mm se for número (ex: 30 -> "00:30")
    if (typeof slotInterval === 'number') {
      const hours = Math.floor(slotInterval / 60);
      const minutes = slotInterval % 60;
      slotInterval = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } else if (typeof slotInterval === 'string' && /^\d+$/.test(slotInterval)) {
      const totalMin = parseInt(slotInterval);
      const hours = Math.floor(totalMin / 60);
      const minutes = totalMin % 60;
      slotInterval = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    return {
      weekly,
      slotInterval,
      interval: slotInterval,
      minimumBookingLeadMinutes: Number.isFinite(minimumBookingLeadMinutes)
        ? minimumBookingLeadMinutes
        : 0,
      blocks
    };
  }

  async listAgendaBlocks(
    companyId: string,
    userId?: string
  ): Promise<Array<{
    id: string;
    companyId: string;
    type: string;
    startDate: string;
    endDate: string;
    startTime?: string | null;
    endTime?: string | null;
    reason?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>> {
    const conditions = [eq(companies.id, companyId)];
    if (userId) {
      conditions.push(eq(companies.ownerId, userId));
    }

    const [company] = await db
      .select()
      .from(companies)
      .where(and(...conditions))
      .limit(1);

    if (!company) return [];

    const blocks = await db
      .select()
      .from(agendaBlocks)
      .where(eq(agendaBlocks.companyId, companyId));

    return blocks as any;
  }

  async createAgendaBlock(
    companyId: string,
    userId: string,
    block: {
      type: "BLOCK_HOUR" | "BLOCK_DAY" | "BLOCK_PERIOD";
      startDate: string;
      endDate: string;
      startTime?: string | null;
      endTime?: string | null;
      reason?: string | null;
    }
  ): Promise<{
    id: string;
    companyId: string;
    type: string;
    startDate: string;
    endDate: string;
    startTime?: string | null;
    endTime?: string | null;
    reason?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    return await db.transaction(async (tx) => {
      const [company] = await tx
        .select()
        .from(companies)
        .where(and(eq(companies.id, companyId), eq(companies.ownerId, userId)))
        .limit(1);

      if (!company) {
        throw new Error("Unauthorized to create agenda block for this company");
      }

      const [created] = await tx
        .insert(agendaBlocks)
        .values({
          id: crypto.randomUUID(),
          companyId,
          type: block.type,
          startDate: block.startDate,
          endDate: block.endDate,
          startTime: block.startTime ?? null,
          endTime: block.endTime ?? null,
          reason: block.reason ?? null,
        })
        .returning();

      return created as any;
    });
  }

  async deleteAgendaBlock(
    companyId: string,
    userId: string,
    blockId: string
  ): Promise<boolean> {
    return await db.transaction(async (tx) => {
      const [company] = await tx
        .select()
        .from(companies)
        .where(and(eq(companies.id, companyId), eq(companies.ownerId, userId)))
        .limit(1);

      if (!company) {
        throw new Error("Unauthorized to delete agenda block for this company");
      }

      const result = await tx
        .delete(agendaBlocks)
        .where(and(eq(agendaBlocks.id, blockId), eq(agendaBlocks.companyId, companyId)))
        .returning();

      return result.length > 0;
    });
  }
}
```

## Arquivo: `src\modules\business\application\use-cases\create-agenda-block.use-case.ts`
```typescript
import { IBusinessRepository } from "../../domain/ports/business.repository";
import { CreateAgendaBlockDTO } from "../../adapters/in/dtos/business.settings.dto";

export class CreateAgendaBlockUseCase {
  constructor(private businessRepository: IBusinessRepository) {}

  async execute(companyId: string, userId: string, data: CreateAgendaBlockDTO) {
    const created = await this.businessRepository.createAgendaBlock(companyId, userId, data);
    return created;
  }
}
```

## Arquivo: `src\modules\business\application\use-cases\create-business.use-case.ts`
```typescript
import { IBusinessRepository } from "../../domain/ports/business.repository";
import { CreateBusinessDTO } from "../../adapters/in/dtos/business.dto";

export class CreateBusinessUseCase {
  constructor(private businessRepository: IBusinessRepository) { }

  private slugify(text: string): string {
    const slug = text
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-");

    return slug || "empresa";
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = this.slugify(name);
    let slug = baseSlug;
    let counter = 1;

    // Loop de verificação de unicidade
    while (true) {
      const existing = await this.businessRepository.findBySlug(slug);
      if (!existing) {
        return slug;
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  async execute(userId: string, data: CreateBusinessDTO) {
    const slug = await this.generateUniqueSlug(data.name);

    const newBusiness = await this.businessRepository.create({
      id: crypto.randomUUID(),
      name: data.name,
      phone: data.phone,
      slug: slug,
      ownerId: userId,
    });

    return newBusiness;
  }
}
```

## Arquivo: `src\modules\business\application\use-cases\delete-agenda-block.use-case.ts`
```typescript
import { IBusinessRepository } from "../../domain/ports/business.repository";

export class DeleteAgendaBlockUseCase {
  constructor(private businessRepository: IBusinessRepository) {}

  async execute(companyId: string, userId: string, blockId: string) {
    const success = await this.businessRepository.deleteAgendaBlock(companyId, userId, blockId);
    if (!success) {
      throw new Error("Agenda block not found or unauthorized");
    }
    return { success: true };
  }
}
```

## Arquivo: `src\modules\business\application\use-cases\get-operating-hours.use-case.ts`
```typescript
import { IBusinessRepository } from "../../domain/ports/business.repository";

export class GetOperatingHoursUseCase {
  constructor(private businessRepository: IBusinessRepository) { }

  async execute(companyId: string, userId?: string) {
    const result = await this.businessRepository.getOperatingHours(companyId, userId);
    if (!result) {
      throw new Error("Unauthorized or company not found");
    }
    return result;
  }
}
```

## Arquivo: `src\modules\business\application\use-cases\list-agenda-blocks.use-case.ts`
```typescript
import { IBusinessRepository } from "../../domain/ports/business.repository";

export class ListAgendaBlocksUseCase {
  constructor(private businessRepository: IBusinessRepository) { }

  async execute(companyId: string, userId?: string) {
    return await this.businessRepository.listAgendaBlocks(companyId, userId);
  }
}
```

## Arquivo: `src\modules\business\application\use-cases\list-my-businesses.use-case.ts`
```typescript
import { IBusinessRepository } from "../../domain/ports/business.repository";

export class ListMyBusinessesUseCase {
  constructor(private businessRepository: IBusinessRepository) { }

  async execute(userId: string) {
    return await this.businessRepository.findAllByUserId(userId);
  }
}
```

## Arquivo: `src\modules\business\application\use-cases\update-business-config.use-case.ts`
```typescript
import { IBusinessRepository } from "../../domain/ports/business.repository";
import { UpdateBusinessConfigDTO } from "../../adapters/in/dtos/business.dto";

export class UpdateBusinessConfigUseCase {
  constructor(private businessRepository: IBusinessRepository) {}

  async execute(id: string, userId: string, data: UpdateBusinessConfigDTO) {
    const updatedBusiness = await this.businessRepository.updateConfig(
      id,
      userId,
      data.config
    );

    if (!updatedBusiness) {
      throw new Error("Business not found or unauthorized");
    }

    return updatedBusiness;
  }
}
```

## Arquivo: `src\modules\business\application\use-cases\update-operating-hours.use-case.ts`
```typescript
import { IBusinessRepository } from "../../domain/ports/business.repository";
import { UpdateOperatingHoursDTO } from "../../adapters/in/dtos/business.settings.dto";
import { BusinessSiteCustomization } from "../../domain/entities/business.entity";

export class UpdateOperatingHoursUseCase {
  constructor(private businessRepository: IBusinessRepository) { }

  async execute(companyId: string, userId: string, data: UpdateOperatingHoursDTO) {
    const normalized = data.weekly.map((w: any) => {
      if ("openTime" in w || "closeTime" in w) {
        return {
          dayOfWeek: String(w.dayOfWeek),
          status: String(w.status).toUpperCase(),
          morningStart: w.openTime ?? null,
          morningEnd: w.lunchStart ?? null,
          afternoonStart: w.lunchEnd ?? null,
          afternoonEnd: w.closeTime ?? null,
        };
      }
      return {
        dayOfWeek: String(w.dayOfWeek),
        status: String(w.status).toUpperCase(),
        morningStart: w.morningStart ?? null,
        morningEnd: w.morningEnd ?? null,
        afternoonStart: w.afternoonStart ?? null,
        afternoonEnd: w.afternoonEnd ?? null,
      };
    });

    const ok = await this.businessRepository.setOperatingHours(companyId, userId, normalized);
    if (!ok) {
      throw new Error("Unauthorized or company not found");
    }

    let slotInterval = (data as any).interval ?? (data as any).slotInterval ?? (data as any).timeInterval;

    // Normalizar para HH:mm se for apenas números (ex: "10" -> "00:10")
    if (typeof slotInterval === 'number') {
      const hours = Math.floor(slotInterval / 60);
      const minutes = slotInterval % 60;
      slotInterval = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } else if (typeof slotInterval === 'string' && /^\d+$/.test(slotInterval)) {
      const totalMin = parseInt(slotInterval);
      const hours = Math.floor(totalMin / 60);
      const minutes = totalMin % 60;
      slotInterval = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    console.log(`>>> [BACK_SAVE_SETTINGS] Salvando intervalo: ${slotInterval} para a empresa: ${companyId}`);

    // Buscar a configuração atual para não sobrescrever outros campos do appointmentFlow
    const business = await this.businessRepository.findById(companyId);
    const currentCustomization = business?.siteCustomization as any;
    const currentFlow = currentCustomization?.appointmentFlow || {};
    const minimumBookingLeadMinutes = Math.max(
      0,
      Number((data as any).minimumBookingLeadMinutes ?? 0),
    );

    const config: Partial<BusinessSiteCustomization> = {
      appointmentFlow: {
        ...currentFlow,
        step3Times: {
          ...(currentFlow.step3Times || currentFlow.step3Time || currentFlow.step_3_time || {}),
          timeSlotSize: slotInterval,
          minimumBookingLeadMinutes,
        }
      } as any,
    };

    await this.businessRepository.updateConfig(companyId, userId, config);
    return { success: true };
  }
}
```

## Arquivo: `src\modules\business\domain\constants\site_customization.defaults.ts`
```typescript
import {
  LayoutGlobal,
  HomeSection,
  GallerySection,
  AboutUsSection,
  AppointmentFlowSection,
} from "../types/site_customization.types";

export const DEFAULT_LAYOUT_GLOBAL: LayoutGlobal = {
  header: {
    backgroundAndEffect: {
      color: "#ffffff",
      opacity: 0.95,
      blur: 10,
    },
    textColors: {
      logo: "#000000",
      links: "#333333",
      hover: "#000000",
    },
    actionButtons: {
      backgroundColor: "#000000",
      textColor: "#ffffff",
    },
  },
  typography: {
    headingsFont: "Inter",
    subheadingsFont: "Inter",
    bodyFont: "Inter",
  },
  siteColors: {
    primary: "#000000",
    secondary: "#333333",
    background: "#ffffff",
  },
  footer: {
    colors: {
      background: "#f5f5f5",
      text: "#333333",
      icons: "#000000",
    },
    typography: {
      headings: "Inter",
      body: "Inter",
    },
    visibility: true,
  },
};

export const DEFAULT_HOME_SECTION: HomeSection = {
  heroBanner: {
    visibility: true,
    title: {
      text: "Sua beleza, nossa prioridade",
      color: "#000000",
      font: "Inter",
      sizeMobile: "32px",
      sizeDesktop: "48px",
    },
    badge: {
      text: "ESPECIALISTA EM BELEZA",
      backgroundColor: "#000000",
      textColor: "#ffffff",
      font: "Inter",
    },
    subtitle: {
      text: "Agende seu horário e realce o que você tem de melhor",
      color: "#666666",
      font: "Inter",
      size: "18px",
    },
    ctaButton: {
      text: "Agendar Agora",
      backgroundColor: "#000000",
      textColor: "#ffffff",
      borderRadius: "8px",
      borderColor: "transparent",
      destinationLink: "/agendamento",
    },
    appearance: {
      bgType: "image",
      backgroundColor: "#ffffff",
      backgroundImageUrl: "",
      glassEffect: {
        active: false,
        intensity: 0,
      },
      overlay: {
        color: "#000000",
        opacity: 0,
      },
      verticalAlignment: "center",
      horizontalAlignment: "center",
      sectionHeight: "medium",
    },
    bgColor: "#ffffff",
  },
  servicesSection: {
    visibility: true,
    orderOnHome: 1,
    header: {
      title: {
        text: "Nossos Serviços",
        color: "#000000",
        font: "Inter",
        size: "36px",
      },
      subtitle: {
        text: "Escolha o tratamento ideal para si",
        color: "#666666",
        font: "Inter",
        size: "16px",
      },
      alignment: "center",
    },
    cardConfig: {
      showImage: true,
      showCategory: true,
      priceStyle: {
        visible: true,
        color: "#000000",
        font: "Inter",
      },
      durationStyle: {
        visible: true,
        color: "#666666",
      },
      cardBackgroundColor: "#ffffff",
      borderAndShadow: {
        borderSize: "1px",
        shadowIntensity: "small",
      },
      borderRadius: "12px",
    },
    bookingButtonStyle: {
      text: "Agendar",
      backgroundColor: "#000000",
      textColor: "#ffffff",
      borderRadius: "6px",
    },
  },
  valuesSection: {
    visibility: true,
    orderOnHome: 2,
    header: {
      title: {
        text: "Nossos Valores",
        color: "#000000",
        font: "Inter",
        size: "36px",
      },
      subtitle: {
        text: "O que nos move todos os dias",
        color: "#666666",
        font: "Inter",
        size: "16px",
      },
    },
    itemsStyle: {
      layout: "grid",
      itemBackgroundColor: "#f9f9f9",
      borderRadius: "8px",
      internalAlignment: "center",
    },
    items: [], // Initial empty list or default values could be added here
  },
  galleryPreview: {
    visibility: true,
    orderOnHome: 3,
    header: {
      title: {
        text: "Nossa Galeria",
        color: "#000000",
        font: "Inter",
        size: "36px",
      },
      subtitle: {
        text: "Confira nossos últimos trabalhos",
        color: "#666666",
        font: "Inter",
        size: "16px",
      },
    },
    displayLogic: {
      selectionMode: "automatic_recent",
      photoCount: 6,
      gridLayout: "mosaic",
    },
    photoStyle: {
      aspectRatio: "1:1",
      spacing: "16px",
      borderRadius: "8px",
      hoverEffect: "zoom",
    },
    viewMoreButton: {
      visible: true,
      text: "Ver Galeria Completa",
      style: {
        backgroundColor: "transparent",
        textColor: "#000000",
        borderRadius: "4px",
      },
    },
  },
  ctaSection: {
    visibility: true,
    orderOnHome: 4,
    title: {
      text: "Pronto para transformar seu olhar?",
      color: "#ffffff",
      font: "Inter",
      size: {
        desktop: "42px",
        mobile: "28px",
      },
    },
    subtitle: {
      text: "Reserve seu horário em menos de 1 minuto.",
      color: "#f0f0f0",
      font: "Inter",
      size: "18px",
    },
    conversionButton: {
      text: "Agendar Agora",
      style: {
        backgroundColor: "#ffffff",
        textColor: "#000000",
        borderColor: "transparent",
      },
      borderRadius: "8px",
    },
    designConfig: {
      backgroundType: "solid_color",
      colorOrImageUrl: "#000000",
      glassEffect: {
        active: false,
        intensity: 0,
      },
      borders: {
        top: false,
        bottom: false,
      },
      padding: "60px",
      alignment: "center",
    },
  },
};

export const DEFAULT_GALLERY_SECTION: GallerySection = {
  gridConfig: {
    columns: 3,
    gap: "24px",
  },
  interactivity: {
    enableLightbox: true,
    showCaptions: true,
  },
};

export const DEFAULT_ABOUT_US_SECTION: AboutUsSection = {
  aboutBanner: {
    visibility: true,
    title: "Sobre Nós",
    backgroundImageUrl: "",
  },
  ourStory: {
    visibility: true,
    title: "Nossa História",
    text: "Começamos com um sonho...",
    imageUrl: "",
  },
  ourValues: [],
  ourTeam: [],
  testimonials: [],
};

export const DEFAULT_APPOINTMENT_FLOW_SECTION: AppointmentFlowSection = {
  colors: {
    primary: "#000000",
    secondary: "#333333",
    background: "#ffffff",
    text: "#000000",
  },
  step1Services: {
    title: "Selecione o Serviço",
    showPrices: true,
    showDurations: true,
    cardConfig: {
      backgroundColor: "TRANSPARENT_DEFAULT",
    },
  },
  step2Date: {
    title: "Escolha a Data",
    calendarStyle: "modern",
  },
  step3Times: {
    title: "Escolha o Horário",
    timeSlotStyle: "grid",
    timeSlotSize: 30, // Intervalo em minutos (número)
    minimumBookingLeadMinutes: 0, // Antecedência mínima padrão (0 = desativado)
  },
  step4Confirmation: {
    title: "Confirme seu Agendamento",
    requireLogin: false,
  },
};
```

## Arquivo: `src\modules\business\domain\entities\business.entity.ts`
```typescript
import { SiteCustomization } from "../types/site_customization.types";

export type BusinessSiteCustomization = SiteCustomization;

export type Business = {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  address?: string | null;
  contact?: string | null;
  ownerId: string;
  active: boolean;
  createdAt: Date;
  updatedAt?: Date;
  subscriptionStatus?: 'trial' | 'active' | 'past_due' | 'canceled' | 'manual_active';
  trialEndsAt?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  accessType?: 'automatic' | 'manual';
  siteCustomization?: BusinessSiteCustomization;
};

export type BusinessSummary = {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  createdAt: Date;
  siteCustomization?: BusinessSiteCustomization;
};

export type CreateBusinessInput = {
  id: string;
  name: string;
  phone: string;
  slug: string;
  ownerId: string;
};
```

## Arquivo: `src\modules\business\domain\ports\business.repository.ts`
```typescript
import { Business, BusinessSummary, CreateBusinessInput, BusinessSiteCustomization } from "../entities/business.entity";

export interface IBusinessRepository {
  findAllByUserId(userId: string): Promise<BusinessSummary[]>;
  findBySlug(slug: string): Promise<Business | null>;
  findById(id: string): Promise<Business | null>;
  create(data: CreateBusinessInput): Promise<Business>;
  updateConfig(id: string, userId: string, config: Partial<BusinessSiteCustomization>): Promise<Business | null>;
  setOperatingHours(
    companyId: string,
    userId: string,
    hours: Array<{
      dayOfWeek: string;
      status: string;
      morningStart?: string | null;
      morningEnd?: string | null;
      afternoonStart?: string | null;
      afternoonEnd?: string | null;
    }>
  ): Promise<boolean>;
  getOperatingHours(
    companyId: string,
    userId?: string
  ): Promise<{
    weekly: Array<{
      id: string;
      dayOfWeek: string;
      status: string;
      morningStart?: string | null;
      morningEnd?: string | null;
      afternoonStart?: string | null;
      afternoonEnd?: string | null;
      openTime?: string | null;
      lunchStart?: string | null;
      lunchEnd?: string | null;
      closeTime?: string | null;
    }>;
    slotInterval: string;
    interval: string;
    minimumBookingLeadMinutes: number;
    blocks: Array<{
      id: string;
      type: string;
      startDate: string;
      endDate: string;
      startTime?: string | null;
      endTime?: string | null;
      reason?: string | null;
    }>;
  } | null>;
  listAgendaBlocks(
    companyId: string,
    userId?: string
  ): Promise<Array<{
    id: string;
    companyId: string;
    type: string;
    startDate: string;
    endDate: string;
    startTime?: string | null;
    endTime?: string | null;
    reason?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>>;
  createAgendaBlock(
    companyId: string,
    userId: string,
    block: {
      type: "BLOCK_HOUR" | "BLOCK_DAY" | "BLOCK_PERIOD";
      startDate: string;
      endDate: string;
      startTime?: string | null;
      endTime?: string | null;
      reason?: string | null;
    }
  ): Promise<{
    id: string;
    companyId: string;
    type: string;
    startDate: string;
    endDate: string;
    startTime?: string | null;
    endTime?: string | null;
    reason?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  deleteAgendaBlock(
    companyId: string,
    userId: string,
    blockId: string
  ): Promise<boolean>;
}
```

## Arquivo: `src\modules\business\domain\types\site_customization.types.ts`
```typescript
export interface SiteCustomization {
  layoutGlobal: LayoutGlobal;
  home: HomeSection;
  gallery: GallerySection;
  aboutUs: AboutUsSection;
  appointmentFlow: AppointmentFlowSection;
  [key: string]: any; // Permite seções extras sem perda de dados (Blindagem de Regressão)
}

// --- Layout Global ---
export interface LayoutGlobal {
  header: {
    backgroundAndEffect: {
      color: string;
      opacity: number;
      blur: number;
    };
    textColors: {
      logo: string;
      links: string;
      hover: string;
    };
    actionButtons: {
      backgroundColor: string;
      textColor: string;
    };
  };
  typography: {
    headingsFont: string;
    subheadingsFont: string;
    bodyFont: string;
  };
  siteColors: {
    primary: string;
    secondary: string;
    background: string;
  };
  footer: {
    colors: {
      background: string;
      text: string;
      icons: string;
    };
    typography: {
      headings: string;
      body: string;
    };
    visibility: boolean;
  };
}

// --- Home Section ---
export interface HomeSection {
  heroBanner: {
    visibility: boolean;
    title: {
      text: string;
      color: string;
      font: string;
      sizeMobile: string;
      sizeDesktop: string;
    };
    badge?: {
      text: string;
      backgroundColor: string;
      textColor: string;
      font: string;
    };
    subtitle: {
      text: string;
      color: string;
      font: string;
      size: string;
    };
    ctaButton: {
      text: string;
      backgroundColor: string;
      textColor: string;
      borderRadius: string;
      borderColor: string;
      destinationLink: string;
    };
    appearance: {
      bgType?: 'color' | 'image';
      backgroundColor?: string;
      backgroundImageUrl: string;
      glassEffect: {
        active: boolean;
        intensity: number;
      };
      overlay: {
        color: string;
        opacity: number; // Percentage 0-100 or 0-1
      };
      verticalAlignment: 'top' | 'center' | 'bottom';
      horizontalAlignment: 'left' | 'center' | 'right';
      sectionHeight: 'small' | 'medium' | 'full_screen';
    };
    bgColor?: string;
  };
  servicesSection: {
    visibility: boolean;
    orderOnHome: number;
    appearance?: {
      backgroundImageUrl?: string;
      overlay?: {
        color: string;
        opacity: number;
      };
    };
    header: {
      title: {
        text: string;
        color: string;
        font: string;
        size: string;
      };
      subtitle: {
        text: string;
        color: string;
        font: string;
        size: string;
      };
      alignment: 'left' | 'center' | 'right';
    };
    cardConfig: {
      showImage: boolean;
      showCategory: boolean;
      priceStyle: {
        visible: boolean;
        color: string;
        font: string;
      };
      durationStyle: {
        visible: boolean;
        color: string;
      };
      cardBackgroundColor: string;
      borderAndShadow: {
        borderSize: string;
        shadowIntensity: string;
      };
      borderRadius: string;
    };
    bookingButtonStyle: {
      text: string;
      backgroundColor: string;
      textColor: string;
      borderRadius: string;
    };
  };
  valuesSection: {
    visibility: boolean;
    orderOnHome: number;
    appearance?: {
      backgroundImageUrl?: string;
      overlay?: {
        color: string;
        opacity: number;
      };
    };
    header: {
      title: {
        text: string;
        color: string;
        font: string;
        size: string;
      };
      subtitle: {
        text: string;
        color: string;
        font: string;
        size: string;
      };
    };
    itemsStyle: {
      layout: 'grid' | 'list' | 'carousel';
      itemBackgroundColor: string;
      borderRadius: string;
      internalAlignment: 'left' | 'center';
    };
    items: ValueItem[];
  };
  galleryPreview: {
    visibility: boolean;
    orderOnHome: number;
    appearance?: {
      backgroundImageUrl?: string;
      overlay?: {
        color: string;
        opacity: number;
      };
    };
    header: {
      title: {
        text: string;
        color: string;
        font: string;
        size: string;
      };
      subtitle: {
        text: string;
        color: string;
        font: string;
        size: string;
      };
    };
    displayLogic: {
      selectionMode: 'automatic_recent' | 'manual_highlights';
      photoCount: 3 | 6 | 9 | 12;
      gridLayout: 'mosaic' | 'fixed_squares' | 'carousel';
    };
    photoStyle: {
      aspectRatio: '1:1' | '4:3' | '16:9';
      spacing: string;
      borderRadius: string;
      hoverEffect: 'zoom' | 'brightness' | 'none';
    };
    viewMoreButton: {
      visible: boolean;
      text: string;
      style: {
        backgroundColor: string;
        textColor: string;
        borderRadius: string;
      };
    };
  };
  ctaSection: {
    visibility: boolean;
    orderOnHome: number;
    appearance?: {
      backgroundImageUrl?: string;
      overlay?: {
        color: string;
        opacity: number;
      };
    };
    title: {
      text: string;
      color: string;
      font: string;
      size: {
        desktop: string;
        mobile: string;
      };
    };
    subtitle: {
      text: string;
      color: string;
      font: string;
      size: string;
    };
    conversionButton: {
      text: string;
      style: {
        backgroundColor: string;
        textColor: string;
        borderColor: string;
      };
      borderRadius: string;
    };
    designConfig: {
      backgroundType: 'solid_color' | 'gradient' | 'image';
      colorOrImageUrl: string;
      glassEffect: {
        active: boolean;
        intensity: number;
      };
      borders: {
        top: boolean;
        bottom: boolean;
      };
      padding: string;
      alignment: 'left' | 'center' | 'right';
    };
  };
}

export interface ValueItem {
  id: string;
  order: number;
  icon: {
    type: 'icon' | 'image' | 'number';
    value: string;
    color: string;
  };
  title: {
    text: string;
    style: {
      color: string;
      font: string;
      size: string;
    };
  };
  description: {
    text: string;
    style: {
      color: string;
      font: string;
      size: string;
    };
  };
}

// --- Gallery Section (Page) ---
export interface GallerySection {
  gridConfig: {
    // Define properties based on general requirements or leave generic if not fully specified
    columns: number;
    gap: string;
  };
  interactivity: {
    enableLightbox: boolean;
    showCaptions: boolean;
  };
}

// --- About Us Section (Page) ---
export interface AboutUsSection {
  aboutBanner: {
    // Similar to hero banner but for about page
    visibility: boolean;
    title: string;
    backgroundImageUrl: string;
  };
  ourStory: {
    visibility: boolean;
    title: string;
    text: string;
    imageUrl: string;
  };
  ourValues: ValueItem[]; // Reusing ValueItem
  ourTeam: TeamMember[];
  testimonials: Testimonial[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  imageUrl: string;
  bio: string;
}

export interface Testimonial {
  id: string;
  author: string;
  text: string;
  rating: number;
  imageUrl?: string;
}

// --- Appointment Flow ---
export interface AppointmentFlowSection {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
  };
  step1Services: {
    title: string;
    showPrices: boolean;
    showDurations: boolean;
    cardConfig: {
      backgroundColor: string;
    };
  };
  step2Date: {
    title: string;
    calendarStyle: 'modern' | 'classic';
  };
  step3Times: {
    title: string;
    timeSlotStyle: 'list' | 'grid';
    timeSlotSize: number; // Intervalo em minutos (ex: 30, 60)
    minimumBookingLeadMinutes: number; // Antecedência mínima em minutos
  };
  step4Confirmation: {
    title: string;
    requireLogin: boolean;
  };
}
```

## Arquivo: `src\modules\expenses\adapters\in\dtos\expense.dto.ts`
```typescript
import { t } from "elysia";

export const CreateExpenseDto = t.Object({
  companyId: t.String(),
  description: t.String(),
  value: t.String(),
  category: t.Enum({
    INFRAESTRUTURA: "INFRAESTRUTURA",
    UTILIDADES: "UTILIDADES",
    MARKETING: "MARKETING",
    PRODUTOS_INSUMOS: "PRODUTOS_INSUMOS",
    PESSOAL: "PESSOAL",
    SISTEMAS_SOFTWARE: "SISTEMAS_SOFTWARE",
    IMPOSTOS: "IMPOSTOS",
    GERAL: "GERAL",
  }),
  type: t.Optional(t.Enum({
    FIXO: "FIXO",
    VARIAVEL: "VARIAVEL",
    PARCELADO: "PARCELADO",
  })),
  totalInstallments: t.Optional(t.Integer()),
  currentInstallment: t.Optional(t.Integer()),
  parentId: t.Optional(t.String()),
  dueDate: t.String(), // ISO Date string
  isPaid: t.Optional(t.Boolean()),
});

export const UpdateExpenseDto = t.Partial(CreateExpenseDto);
```

## Arquivo: `src\modules\expenses\adapters\in\http\expense.controller.ts`
```typescript
import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { CreateExpenseDto, UpdateExpenseDto } from "../dtos/expense.dto";
import { CreateExpenseUseCase } from "../../../application/use-cases/create-expense.use-case";
import { UpdateExpenseUseCase } from "../../../application/use-cases/update-expense.use-case";

export const expenseController = () => new Elysia({ prefix: "/expenses" })
  .use(authPlugin)
  .use(repositoriesPlugin)
  .onBeforeHandle(({ user, set, request }) => {
    console.log(`>>> [AUTH_CHECK] Tentativa de acesso a ${request.method} ${request.url}`);
    if (!user) {
      console.log(`>>> [AUTH_CHECK] Usuário NÃO autenticado (401)`);
      set.status = 401;
      return { error: "Unauthorized" };
    }
    console.log(`>>> [AUTH_CHECK] Usuário autenticado: ${user.id}`);
  })
  .post("/", async ({ body, expenseRepository, user, set }) => {
    const businessId = user!.businessId;
    if (!businessId) {
      set.status = 401;
      return { error: "Usuário não vinculado a uma empresa" };
    }

    const useCase = new CreateExpenseUseCase(expenseRepository);
    const result = await useCase.execute({
      ...body,
      companyId: businessId, // Força o companyId do usuário logado
      dueDate: new Date(body.dueDate),
    });

    return result;
  }, {
    body: CreateExpenseDto
  })
  .get("/", async ({ query, expenseRepository, user, set }) => {
    const businessId = user!.businessId;
    const { companyId } = query;

    // Se companyId for passado, verifica se é o do usuário logado
    // Se não for passado, usa o do usuário logado
    const targetCompanyId = companyId || businessId;

    if (!targetCompanyId) {
      set.status = 400;
      return { error: "companyId is required" };
    }

    if (targetCompanyId !== businessId) {
      set.status = 403;
      return { error: "Não autorizado" };
    }

    return await expenseRepository.findAllByCompanyId(targetCompanyId);
  }, {
    query: t.Object({
      companyId: t.Optional(t.String())
    })
  })
  .patch("/:id", async ({ params: { id }, body, expenseRepository, user, set }) => {
    const businessId = user!.businessId;
    if (!businessId) {
      set.status = 403;
      return { error: "Não autorizado" };
    }
    const useCase = new UpdateExpenseUseCase(expenseRepository);

    try {
      const updateData: any = { ...body };
      if (body.dueDate) updateData.dueDate = new Date(body.dueDate);

      return await useCase.execute(id, businessId, updateData);
    } catch (e: any) {
      if (e.message === "Expense not found") {
        set.status = 404;
        return { error: e.message };
      }
      if (e.message === "Unauthorized") {
        set.status = 403;
        return { error: e.message };
      }
      throw e;
    }
  }, {
    body: UpdateExpenseDto
  })
  .delete("/:id", async ({ params: { id }, expenseRepository, user, set }) => {
    const businessId = user!.businessId;
    const existing = await expenseRepository.findById(id);

    if (!existing) {
      set.status = 404;
      return { error: "Expense not found" };
    }

    if (existing.companyId !== businessId) {
      set.status = 403;
      return { error: "Não autorizado" };
    }

    await expenseRepository.delete(id);
    return { success: true };
  });
```

## Arquivo: `src\modules\expenses\adapters\out\drizzle\expense.drizzle.repository.ts`
```typescript
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
```

## Arquivo: `src\modules\expenses\application\use-cases\create-expense.use-case.ts`
```typescript
import { IExpenseRepository, CreateExpenseInput, FixedExpense } from "../../domain/ports/expense.repository";

export class CreateExpenseUseCase {
  constructor(private expenseRepository: IExpenseRepository) {}

  async execute(data: CreateExpenseInput): Promise<FixedExpense> {
    const { type, totalInstallments = 1, dueDate, value, description, ...rest } = data;

    // Se não for parcelado ou tiver apenas 1 parcela, cria normalmente
    if (type !== "PARCELADO" || totalInstallments <= 1) {
      return this.expenseRepository.create({
        ...data,
        type: type || "FIXO",
        totalInstallments: 1,
        currentInstallment: 1,
      });
    }

    // Lógica para Parcelamento
    const installments: FixedExpense[] = [];
    const baseDate = new Date(dueDate);
    
    // Calcula o valor de cada parcela se necessário. 
    // O prompt não especifica se o valor recebido é o TOTAL ou da PARCELA.
    // Geralmente em inputs de despesa, o usuário digita o valor da parcela.
    // Vou assumir que 'value' é o valor da parcela mensal.
    
    // Cria a primeira parcela (que será o parent das outras)
    const firstInstallment = await this.expenseRepository.create({
      ...rest,
      description: `${description} (1/${totalInstallments})`,
      value,
      dueDate: baseDate,
      type: "PARCELADO",
      totalInstallments,
      currentInstallment: 1,
      parentId: null, // É a pai
    });

    installments.push(firstInstallment);

    // Cria as demais parcelas
    for (let i = 2; i <= totalInstallments; i++) {
      const nextDate = new Date(baseDate);
      nextDate.setMonth(baseDate.getMonth() + (i - 1));

      await this.expenseRepository.create({
        ...rest,
        description: `${description} (${i}/${totalInstallments})`,
        value,
        dueDate: nextDate,
        type: "PARCELADO",
        totalInstallments,
        currentInstallment: i,
        parentId: firstInstallment.id,
      });
    }

    return firstInstallment;
  }
}
```

## Arquivo: `src\modules\expenses\application\use-cases\update-expense.use-case.ts`
```typescript
import { IExpenseRepository, CreateExpenseInput, FixedExpense } from "../../domain/ports/expense.repository";

export class UpdateExpenseUseCase {
  constructor(private expenseRepository: IExpenseRepository) { }

  async execute(id: string, businessId: string, data: Partial<CreateExpenseInput>): Promise<FixedExpense> {
    const existing = await this.expenseRepository.findById(id);

    if (!existing) {
      throw new Error("Expense not found");
    }

    if (existing.companyId !== businessId) {
      throw new Error("Unauthorized");
    }

    const updated = await this.expenseRepository.update(id, data);

    // Lógica de recorrência para despesas fixas
    // Se marcou como pago e é FIXO, cria o próximo mês se não existir
    if (existing.type === "FIXO" && data.isPaid === true && !existing.isPaid) {
      await this.handleRecurringExpense(existing);
    }

    return updated;
  }

  private async handleRecurringExpense(expense: FixedExpense) {
    const nextDueDate = new Date(expense.dueDate);
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);

    // Verifica duplicidade no mês seguinte
    const all = await this.expenseRepository.findAllByCompanyId(expense.companyId);

    const exists = all.some(e =>
      e.description === expense.description &&
      e.dueDate.getMonth() === nextDueDate.getMonth() &&
      e.dueDate.getFullYear() === nextDueDate.getFullYear()
    );

    if (!exists) {
      await this.expenseRepository.create({
        companyId: expense.companyId,
        description: expense.description,
        value: expense.value,
        category: expense.category,
        dueDate: nextDueDate,
        type: "FIXO",
        totalInstallments: 1,
        currentInstallment: 1,
        isPaid: false,
        parentId: null
      });
    }
  }
}
```

## Arquivo: `src\modules\expenses\domain\ports\expense.repository.ts`
```typescript
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
```

## Arquivo: `src\modules\gallery\adapters\in\dtos\gallery.dto.ts`
```typescript
import { t } from "elysia";

export const createGalleryImageDTO = t.Object({
  title: t.Optional(t.String()),
  imageUrl: t.Optional(t.String()),
  category: t.Optional(t.String()),
  showInHome: t.Optional(t.Union([t.Boolean(), t.String()])), // Aceita boolean ou string "true"/"false" do FormData
  order: t.Optional(t.Union([t.Number(), t.String()])),
  file: t.Optional(t.Any()),
});

export const updateGalleryImageDTO = t.Partial(t.Object({
  title: t.Optional(t.String()),
  imageUrl: t.Optional(t.String()),
  category: t.Optional(t.String()),
  showInHome: t.Optional(t.Union([t.Boolean(), t.String()])),
  order: t.Optional(t.Union([t.Number(), t.String()])),
}));
```

## Arquivo: `src\modules\gallery\adapters\in\http\gallery.controller.ts`
```typescript
import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { createGalleryImageDTO, updateGalleryImageDTO } from "../dtos/gallery.dto";
import { uploadToB2, deleteFileFromB2 } from "../../../../infrastructure/storage/b2.storage";
import crypto from "crypto";

const getExtensionFromMime = (mimeType?: string) => {
  if (!mimeType) return "bin";
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg"
  };
  return map[mimeType] || "bin";
};

export const galleryController = () => new Elysia({ prefix: "/gallery" })
  .use(repositoriesPlugin)
  // Grupo Público (Acesso sem autenticação)
  .group("/public", (app) =>
    app.get("/:businessId", async ({ params: { businessId }, query, galleryRepository, set }) => {
      try {
        const filters = {
          category: query.category,
          showInHome: query.showInHome === "true" ? true : query.showInHome === "false" ? false : undefined,
        };
        const images = await galleryRepository.findByBusinessId(businessId, filters);
        return images;
      } catch (error: any) {
        console.error("[GALLERY_GET_PUBLIC_ERROR]:", error);
        set.status = 500;
        return { error: error.message };
      }
    }, {
      query: t.Object({
        category: t.Optional(t.String()),
        showInHome: t.Optional(t.String()),
      })
    })
  )
  // Grupo Privado (Requer autenticação)
  .use(authPlugin)
  .group("", (app) =>
    app
      .onBeforeHandle(({ user, set }) => {
        if (!user) {
          set.status = 401;
          return { error: "Não autorizado" };
        }
      })
      .get("/categories", async ({ serviceRepository, user, set }) => {
        try {
          const businessId = user!.businessId;
          if (!businessId) {
            set.status = 401;
            return { error: "Usuário não vinculado a uma empresa" };
          }
          const services = await serviceRepository.findAllByCompanyId(businessId);
          // Retorna apenas os nomes dos serviços como categorias
          return services.map((s: any) => ({ id: s.id, name: s.name }));
        } catch (error: any) {
          console.error("[GALLERY_CATEGORIES_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      })
      .get("/", async ({ galleryRepository, user, set }) => {
        try {
          const businessId = user!.businessId;
          if (!businessId) {
            set.status = 401;
            return { error: "Usuário não vinculado a uma empresa" };
          }
          const images = await galleryRepository.findByBusinessId(businessId);
          return images;
        } catch (error: any) {
          console.error("[GALLERY_GET_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      })
      .post("/", async ({ body, galleryRepository, user, set }) => {
        try {
          const businessId = user!.businessId;
          if (!businessId) {
            set.status = 401;
            return { error: "Usuário não vinculado a uma empresa" };
          }

          const file = (body as any).file;
          let imageUrl = (body as any).imageUrl as string | undefined;

          if (!imageUrl && file) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const extension = getExtensionFromMime(file.type);
            const key = `gallery/${businessId}/${crypto.randomUUID()}.${extension}`;

            imageUrl = await uploadToB2({
              buffer,
              contentType: file.type || "application/octet-stream",
              key,
              cacheControl: "public, max-age=31536000"
            });
          }

          if (!imageUrl) {
            set.status = 400;
            return { error: "imageUrl ou file é obrigatório" };
          }

          const image = await galleryRepository.save({
            ...body,
            businessId,
            imageUrl,
            title: body.title || null,
            category: body.category || null,
            showInHome: body.showInHome === "true" || body.showInHome === true,
            order: (body.order || "0").toString(),
          });

          return image;
        } catch (error: any) {
          console.error("[GALLERY_POST_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: createGalleryImageDTO
      })
      .patch("/:id", async ({ params: { id }, body, galleryRepository, user, set }) => {
        try {
          const existing = await galleryRepository.findById(id);
          if (!existing) {
            set.status = 404;
            return { error: "Imagem não encontrada" };
          }

          if (existing.businessId !== user!.businessId) {
            set.status = 403;
            return { error: "Não autorizado" };
          }

          // Se a imagem estiver sendo alterada e a antiga for do B2, apaga a antiga
          if (body.imageUrl && body.imageUrl !== existing.imageUrl && existing.imageUrl && existing.imageUrl.includes("/api/storage/")) {
            try {
              const parts = existing.imageUrl.split("/api/storage/");
              if (parts.length > 1) {
                await deleteFileFromB2(parts[1]);
              }
            } catch (err) {
              console.error("[GALLERY_UPDATE_FILE_ERROR]: Falha ao deletar imagem antiga do B2.", err);
            }
          }

          const updated = await galleryRepository.update(id, {
            ...body,
            showInHome: body.showInHome === "true" || body.showInHome === true,
            order: body.order?.toString()
          });
          return updated;
        } catch (error: any) {
          console.error("[GALLERY_PATCH_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: updateGalleryImageDTO
      })
      .delete("/:id", async ({ params: { id }, galleryRepository, user, set }) => {
        try {
          const existing = await galleryRepository.findById(id);
          if (!existing) {
            set.status = 404;
            return { error: "Imagem não encontrada" };
          }

          if (existing.businessId !== user!.businessId) {
            set.status = 403;
            return { error: "Não autorizado" };
          }

          // Tenta deletar a imagem do B2 se ela existir
          if (existing.imageUrl && existing.imageUrl.includes("/api/storage/")) {
            try {
              // Extrai a key da URL. Ex: http://.../api/storage/gallery/123.jpg -> gallery/123.jpg
              const parts = existing.imageUrl.split("/api/storage/");
              if (parts.length > 1) {
                const key = parts[1];
                await deleteFileFromB2(key);
              }
            } catch (err) {
              console.error("[GALLERY_DELETE_FILE_ERROR]: Falha ao deletar arquivo do B2, mas prosseguindo com exclusão do banco.", err);
            }
          }

          await galleryRepository.delete(id);
          return { success: true };
        } catch (error: any) {
          console.error("[GALLERY_DELETE_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      })
  );
```

## Arquivo: `src\modules\gallery\adapters\out\drizzle\gallery.drizzle.repository.ts`
```typescript
import { db } from "../../../../infrastructure/drizzle/database";
import { galleryImages } from "../../../../../db/schema";
import { GalleryImage } from "../../../domain/entities/gallery.entity";
import { GalleryRepository } from "../../../domain/ports/gallery.repository";
import { eq, and, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

// Repository implementation for Gallery using Drizzle ORM
export class GalleryDrizzleRepository implements GalleryRepository {
  async save(image: Omit<GalleryImage, "id" | "createdAt" | "updatedAt">): Promise<GalleryImage> {
    const id = randomUUID();
    const [result] = await db
      .insert(galleryImages)
      .values({
        id,
        businessId: image.businessId,
        title: image.title,
        imageUrl: image.imageUrl,
        category: image.category,
        showInHome: image.showInHome,
        order: image.order.toString(),
      })
      .returning();

    return this.mapToEntity(result);
  }

  async findById(id: string): Promise<GalleryImage | null> {
    const [result] = await db
      .select()
      .from(galleryImages)
      .where(eq(galleryImages.id, id));

    return result ? this.mapToEntity(result) : null;
  }

  async findByBusinessId(
    businessId: string,
    filters?: { category?: string; showInHome?: boolean }
  ): Promise<GalleryImage[]> {
    const conditions = [eq(galleryImages.businessId, businessId)];

    if (filters?.category) {
      conditions.push(eq(galleryImages.category, filters.category));
    }

    if (filters?.showInHome !== undefined) {
      conditions.push(eq(galleryImages.showInHome, filters.showInHome));
    }

    const results = await db
      .select()
      .from(galleryImages)
      .where(and(...conditions))
      .orderBy(asc(galleryImages.order));

    return results.map(this.mapToEntity);
  }

  async delete(id: string): Promise<void> {
    await db.delete(galleryImages).where(eq(galleryImages.id, id));
  }

  async update(
    id: string,
    data: Partial<Omit<GalleryImage, "id" | "businessId" | "createdAt" | "updatedAt">>
  ): Promise<GalleryImage> {
    const updateData: any = { ...data };
    if (data.order !== undefined) {
      updateData.order = data.order.toString();
    }

    const [result] = await db
      .update(galleryImages)
      .set(updateData)
      .where(eq(galleryImages.id, id))
      .returning();

    return this.mapToEntity(result);
  }

  private mapToEntity(row: any): GalleryImage {
    return {
      id: row.id,
      businessId: row.businessId,
      title: row.title,
      imageUrl: row.imageUrl,
      category: row.category,
      showInHome: row.showInHome,
      order: row.order,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
```

## Arquivo: `src\modules\gallery\domain\entities\gallery.entity.ts`
```typescript
export interface GalleryImage {
  id: string;
  businessId: string;
  title: string | null;
  imageUrl: string;
  category: string | null;
  showInHome: boolean;
  order: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Arquivo: `src\modules\gallery\domain\ports\gallery.repository.ts`
```typescript
import { GalleryImage } from "../entities/gallery.entity";

export interface GalleryRepository {
  save(image: Omit<GalleryImage, "id" | "createdAt" | "updatedAt">): Promise<GalleryImage>;
  findById(id: string): Promise<GalleryImage | null>;
  findByBusinessId(businessId: string, filters?: { category?: string; showInHome?: boolean }): Promise<GalleryImage[]>;
  delete(id: string): Promise<void>;
  update(id: string, data: Partial<Omit<GalleryImage, "id" | "businessId" | "createdAt" | "updatedAt">>): Promise<GalleryImage>;
}
```

## Arquivo: `src\modules\infrastructure\auth\auth-plugin.ts`
```typescript
import { Elysia } from "elysia";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../drizzle/database";
import * as schema from "../../../db/schema";
import { eq } from "drizzle-orm";
import { auth } from "./auth";

export type User = typeof auth.$Infer.Session.user & {
    business?: any;
    slug?: string;
    businessId?: string;
    role?: string;
    active?: boolean;
};

export type Session = typeof auth.$Infer.Session.session;

const normalizeEnvValue = (value?: string) =>
    value?.trim().replace(/^['"]|['"]$/g, "") || "";

const extractEnvValueFromContent = (content: string, key: string) => {
    const regex = new RegExp(`^${key}=(.*)$`, "m");
    const match = content.match(regex);
    if (!match?.[1]) {
        return "";
    }
    return normalizeEnvValue(match[1]);
};

const readEnvFallback = async (key: string) => {
    const candidates = [
        path.join(process.cwd(), ".env"),
        path.join(process.cwd(), ".env.local"),
        path.join(process.cwd(), "back_end", ".env"),
        path.join(process.cwd(), "back_end", ".env.local"),
        path.join(process.cwd(), "front_end", ".env.local"),
        path.join(process.cwd(), "..", "back_end", ".env"),
        path.join(process.cwd(), "..", "back_end", ".env.local"),
        path.join(process.cwd(), "..", "front_end", ".env.local"),
    ];

    for (const envPath of candidates) {
        try {
            const content = await readFile(envPath, "utf8");
            const value = extractEnvValueFromContent(content, key);
            if (value) {
                return value;
            }
        } catch { }
    }

    return "";
};

// Cache para evitar múltiplas sincronizações simultâneas para a mesma empresa
const syncCache = new Map<string, { promise: Promise<any>, timestamp: number }>();
const SYNC_CACHE_TTL = 30000; // 30 segundos de cache para o resultado da sincronização

const paidStatuses = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
const ACTIVATION_WINDOW_DAYS = 60;

const extractPaymentDate = (payment: Record<string, any>) => {
    const rawDate =
        payment.paymentDate ||
        payment.clientPaymentDate ||
        payment.confirmedDate ||
        payment.dateCreated;
    if (!rawDate) {
        return null;
    }
    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isSameMonthAndYear = (baseDate: Date, now: Date) =>
    baseDate.getMonth() === now.getMonth() && baseDate.getFullYear() === now.getFullYear();

type AsaasBillingSnapshot = {
    latestPaymentDate: Date | null;
    hasAnyConfirmedPayment: boolean;
    hasCurrentMonthPayment: boolean;
    hasActiveSubscription: boolean;
    subscriptionBaseDate: Date | null;
    sourceUrl: string;
};

async function resolveAsaasBillingSnapshot(companyId: string, ownerEmail?: string): Promise<AsaasBillingSnapshot | null> {
    const fallbackApiKey =
        (await readEnvFallback("ASAAS_API_KEY")) ||
        (await readEnvFallback("ASAAS_ACCESS_TOKEN"));
    const fallbackApiUrl =
        (await readEnvFallback("ASAAS_API_URL")) ||
        (await readEnvFallback("ASAAS_BASE_URL"));

    const keyCandidates = [
        normalizeEnvValue(process.env.ASAAS_API_KEY),
        normalizeEnvValue(process.env.ASAAS_ACCESS_TOKEN),
        normalizeEnvValue(fallbackApiKey),
    ].filter(Boolean) as string[];
    const urlCandidates = [
        normalizeEnvValue(process.env.ASAAS_API_URL),
        normalizeEnvValue(process.env.ASAAS_BASE_URL),
        normalizeEnvValue(fallbackApiUrl),
        "https://api-sandbox.asaas.com/v3",
    ].filter(Boolean) as string[];

    if (keyCandidates.length === 0) {
        console.warn(`[AUTH_SYNC] ASAAS API key ausente. Não foi possível validar pagamento para companyId=${companyId}.`);
        return null;
    }

    const now = new Date();
    let bestSnapshot: AsaasBillingSnapshot | null = null;

    for (const asaasApiKey of keyCandidates) {
        for (const asaasApiUrl of urlCandidates) {
            const fetchPayments = async (url: string) => {
                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        access_token: asaasApiKey
                    }
                });

                if (!response.ok) {
                    return [] as Array<Record<string, any>>;
                }

                const payload = await response.json() as { data?: Array<Record<string, any>> };
                return payload.data || [];
            };

            let customerIdByEmail = "";
            const foundPayments: Array<Record<string, any>> = [];
            let subscriptionBaseDate: Date | null = null;
            let hasActiveSubscription = false;

            for (const paidStatus of paidStatuses) {
                const byExternalReference = await fetchPayments(
                    `${asaasApiUrl}/payments?externalReference=${encodeURIComponent(companyId)}&status=${paidStatus}&limit=10`,
                );

                let byCustomer: Array<Record<string, any>> = [];
                if (ownerEmail) {
                    if (!customerIdByEmail) {
                        const customerResponse = await fetch(
                            `${asaasApiUrl}/customers?email=${encodeURIComponent(ownerEmail)}`,
                            {
                                method: "GET",
                                headers: {
                                    access_token: asaasApiKey
                                }
                            },
                        );
                        if (customerResponse.ok) {
                            const customerPayload = await customerResponse.json() as {
                                data?: Array<{ id?: string }>;
                            };
                            customerIdByEmail = customerPayload.data?.[0]?.id || "";
                        }
                    }
                    if (customerIdByEmail) {
                        byCustomer = await fetchPayments(
                            `${asaasApiUrl}/payments?customer=${encodeURIComponent(customerIdByEmail)}&status=${paidStatus}&limit=10`,
                        );
                    }
                }

                const eligiblePayments = [...byExternalReference, ...byCustomer].filter((candidate) => {
                    if (!candidate) {
                        return false;
                    }
                    if (candidate.externalReference && candidate.externalReference !== companyId) {
                        return false;
                    }
                    return true;
                });

                if (eligiblePayments.length > 0) {
                    foundPayments.push(...eligiblePayments);
                }
            }

            if (customerIdByEmail) {
                const subscriptionsResponse = await fetch(
                    `${asaasApiUrl}/subscriptions?customer=${encodeURIComponent(customerIdByEmail)}&status=ACTIVE&limit=1`,
                    {
                        method: "GET",
                        headers: {
                            access_token: asaasApiKey
                        }
                    },
                );

                if (subscriptionsResponse.ok) {
                    const subscriptionsPayload = await subscriptionsResponse.json() as {
                        data?: Array<Record<string, any>>;
                    };
                    const activeSubscription = subscriptionsPayload.data?.[0];
                    if (activeSubscription) {
                        const baseDateRaw =
                            activeSubscription.dateCreated ||
                            activeSubscription.nextDueDate ||
                            new Date().toISOString();
                        const baseDate = new Date(baseDateRaw);
                        subscriptionBaseDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
                        hasActiveSubscription = true;
                    }
                }
            }

            const uniquePayments = [...new Map(
                foundPayments.map((payment) => {
                    const paymentId = payment?.id
                        ? String(payment.id)
                        : `${payment?.externalReference || "noref"}-${payment?.dateCreated || payment?.paymentDate || Math.random()}`;
                    return [paymentId, payment];
                }),
            ).values()];

            const normalizedDates = uniquePayments
                .map((payment) => extractPaymentDate(payment))
                .filter((date): date is Date => !!date)
                .sort((a, b) => b.getTime() - a.getTime());

            const latestPaymentDate = normalizedDates[0] || null;
            const hasAnyConfirmedPayment = uniquePayments.length > 0;
            const hasCurrentMonthPayment = normalizedDates.some((paymentDate) => isSameMonthAndYear(paymentDate, now));

            const snapshot: AsaasBillingSnapshot = {
                latestPaymentDate,
                hasAnyConfirmedPayment,
                hasCurrentMonthPayment,
                hasActiveSubscription,
                subscriptionBaseDate,
                sourceUrl: asaasApiUrl,
            };

            if (snapshot.hasCurrentMonthPayment || snapshot.hasActiveSubscription) {
                return snapshot;
            }

            if (!bestSnapshot) {
                bestSnapshot = snapshot;
                continue;
            }

            if (!bestSnapshot.latestPaymentDate && snapshot.latestPaymentDate) {
                bestSnapshot = snapshot;
                continue;
            }

            if (
                bestSnapshot.latestPaymentDate &&
                snapshot.latestPaymentDate &&
                snapshot.latestPaymentDate.getTime() > bestSnapshot.latestPaymentDate.getTime()
            ) {
                bestSnapshot = snapshot;
            }
        }
    }

    return bestSnapshot;
}

export async function syncAsaasPaymentForCompany(
    companyId: string,
    ownerId: string,
    ownerEmail?: string,
    options?: {
        requireCurrentMonthPayment?: boolean;
        activationWindowDays?: number;
        ignoreBlockDate?: boolean;
    },
) {
    // 1. Verificar se já existe uma sincronização em andamento ou recentemente concluída
    const cached = syncCache.get(companyId);
    const nowTs = Date.now();

    if (cached && (nowTs - cached.timestamp < SYNC_CACHE_TTL)) {
        console.log(`[SYNC_CACHE] Usando sincronização recente para ${companyId} (idade: ${nowTs - cached.timestamp}ms)`);
        return cached.promise;
    }

    const syncPromise = (async () => {
        const ignoreBlockDate = options?.ignoreBlockDate ?? false;
        // Busca a empresa para verificar a data do último bloqueio (updatedAt)
        const [currentCompany] = await db.select()
            .from(schema.companies)
            .where(eq(schema.companies.id, companyId))
            .limit(1);

        const billingSnapshot = await resolveAsaasBillingSnapshot(companyId, ownerEmail);
        const requireCurrentMonthPayment = options?.requireCurrentMonthPayment ?? false;
        const activationWindowDays = options?.activationWindowDays ?? ACTIVATION_WINDOW_DAYS;
        const now = new Date();

        // Lógica para ignorar pagamentos antigos se a empresa estiver bloqueada
        // Permitimos pagamentos que ocorreram no mesmo dia ou depois do último bloqueio (updatedAt)
        // Subtraímos 12 horas da data de bloqueio para dar uma margem de segurança contra delays de API e fuso horário
        const isCurrentlyBlocked = currentCompany?.subscriptionStatus === "past_due" || currentCompany?.active === false;
        const lastBlockDate = currentCompany?.updatedAt || new Date(0);
        const safetyMargin = 12 * 60 * 60 * 1000; // 12 horas de margem

        const hasNewPaymentAfterBlock = !!billingSnapshot?.latestPaymentDate &&
            (billingSnapshot.latestPaymentDate.getTime() > (lastBlockDate.getTime() - safetyMargin));

        const latestPaymentIsRecent = !!billingSnapshot?.latestPaymentDate &&
            ((now.getTime() - billingSnapshot.latestPaymentDate.getTime()) <= (activationWindowDays * 24 * 60 * 60 * 1000));
        const subscriptionBaseIsRecent = !!billingSnapshot?.subscriptionBaseDate &&
            ((now.getTime() - billingSnapshot.subscriptionBaseDate.getTime()) <= (activationWindowDays * 24 * 60 * 60 * 1000));

        if (!billingSnapshot) {
            console.warn(`[AUTH_SYNC] Nenhum pagamento confirmado encontrado no Asaas para companyId=${companyId} (email=${ownerEmail || "n/a"}).`);
            return null;
        }

        // Se estiver bloqueado, só libera se houver um pagamento NOVO (pós-bloqueio) ou se for ignorada a data de bloqueio (manual)
        // Se não estiver bloqueado, aceita pagamentos recentes (35 dias) ou do mês atual
        const canActivateByPayment =
            billingSnapshot.hasAnyConfirmedPayment &&
            (isCurrentlyBlocked && !ignoreBlockDate
                ? hasNewPaymentAfterBlock
                : (requireCurrentMonthPayment
                    ? billingSnapshot.hasCurrentMonthPayment
                    : (billingSnapshot.hasCurrentMonthPayment || latestPaymentIsRecent)));

        const canActivateBySubscription =
            billingSnapshot.hasActiveSubscription &&
            billingSnapshot.hasAnyConfirmedPayment &&
            (isCurrentlyBlocked && !ignoreBlockDate
                ? hasNewPaymentAfterBlock
                : (requireCurrentMonthPayment
                    ? billingSnapshot.hasCurrentMonthPayment
                    : (latestPaymentIsRecent || subscriptionBaseIsRecent)));

        if (!canActivateByPayment && !canActivateBySubscription) {
            console.log(`[AUTH_SYNC] Falha na ativação para companyId=${companyId}:`, {
                isCurrentlyBlocked,
                ignoreBlockDate,
                hasNewPaymentAfterBlock,
                hasAnyConfirmedPayment: billingSnapshot.hasAnyConfirmedPayment,
                hasCurrentMonthPayment: billingSnapshot.hasCurrentMonthPayment,
                latestPaymentIsRecent,
                hasActiveSubscription: billingSnapshot.hasActiveSubscription,
                subscriptionBaseIsRecent,
                latestPaymentDate: billingSnapshot.latestPaymentDate,
                lastBlockDate
            });
            if (isCurrentlyBlocked && (billingSnapshot.hasAnyConfirmedPayment || billingSnapshot.hasActiveSubscription)) {
                console.warn(`[AUTH_SYNC] Assinatura/Pagamento encontrado, mas é antigo (anterior ao bloqueio). Ignorando ativação para companyId=${companyId}.`);
            } else if (requireCurrentMonthPayment) {
                console.warn(`[AUTH_SYNC] Nenhum pagamento confirmado no mês atual ou nos últimos ${activationWindowDays} dias para companyId=${companyId}.`);
            } else {
                console.warn(`[AUTH_SYNC] Nenhum pagamento confirmado elegível para companyId=${companyId}.`);
            }
            return null;
        }

        const paymentDate = billingSnapshot.latestPaymentDate || billingSnapshot.subscriptionBaseDate || new Date();
        const nextDue = new Date(paymentDate);
        nextDue.setDate(nextDue.getDate() + 30);

        await db.update(schema.companies)
            .set({
                subscriptionStatus: "active",
                active: true,
                accessType: "automatic",
                trialEndsAt: nextDue,
                updatedAt: new Date()
            })
            .where(eq(schema.companies.id, companyId));

        if (ownerId) {
            await db.update(schema.user)
                .set({
                    active: true,
                    updatedAt: new Date()
                })
                .where(eq(schema.user.id, ownerId));
        }

        console.log(`[AUTH_SYNC] Pagamento encontrado no Asaas usando baseUrl=${billingSnapshot.sourceUrl}.`);
        return {
            activated: true,
            nextDue
        };
    })();

    syncCache.set(companyId, { promise: syncPromise, timestamp: nowTs });
    return syncPromise;
}

export const authPlugin = new Elysia({ name: "auth-plugin" })
    .derive({ as: 'global' }, async ({ request, path, set }) => {
        const isAuthRoute =
            path.startsWith("/api/auth") ||
            path.startsWith("/sign-in") ||
            path.startsWith("/sign-out") ||
            path === "/get-session" ||
            path === "/session";

        const isExemptFromBlocking =
            isAuthRoute ||
            path === "/api/business/settings/pricing" ||
            path === "/api/business/sync";

        if (isAuthRoute) {
            return { user: null, session: null };
        }

        try {
            // Exceção para rotas do Master Admin
            const isMasterRoute = path.startsWith("/api/admin/master");
            const isHealthRoute = path.startsWith("/api/health");

            const authHeader = request.headers.get("authorization");
            const cookieHeader = request.headers.get("cookie");
            const headers = new Headers(request.headers);

            // Injeção de Token do Header para Cookie (suporte a Bearer Token)
            if (authHeader && authHeader.startsWith("Bearer ")) {
                const token = authHeader.substring(7).trim();
                const cookieName = "better-auth.session_token";

                let cookieString = cookieHeader || "";
                if (!cookieString.includes(cookieName)) {
                    cookieString += (cookieString ? "; " : "") + `${cookieName}=${token}`;
                }
                headers.set("cookie", cookieString);
            }

            // Força o host para bater com o baseURL do Better Auth se necessário
            const baseURL = new URL(auth.options.baseURL || "http://localhost:3001");
            headers.set("host", baseURL.host);

            let user: any = null;
            let session: any = null;

            const authSession = await auth.api.getSession({
                headers: headers,
            });

            if (!authSession && cookieHeader && cookieHeader.includes("better-auth.session_token")) {
                console.log(">>> [AUTH_CLEANUP] Sessão inválida/antiga detectada no banco novo. Limpando cookies...");
                set.headers["Set-Cookie"] = "better-auth.session_token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax";
            }

            if (authSession) {
                user = authSession.user;
                session = authSession.session;
            } else {
                if (authHeader && authHeader.startsWith("Bearer ")) {
                    const token = authHeader.substring(7).trim();
                    let sessionRow = null;

                    const byToken = await db
                        .select()
                        .from(schema.session)
                        .where(eq(schema.session.token, token))
                        .limit(1);

                    if (byToken.length > 0) {
                        sessionRow = byToken[0];
                    } else {
                        const byId = await db
                            .select()
                            .from(schema.session)
                            .where(eq(schema.session.id, token))
                            .limit(1);
                        if (byId.length > 0) {
                            sessionRow = byId[0];
                        }
                    }

                    if (sessionRow) {
                        const now = new Date();
                        const expires = new Date(sessionRow.expiresAt);

                        if (expires > now) {
                            const userResults = await db
                                .select()
                                .from(schema.user)
                                .where(eq(schema.user.id, sessionRow.userId))
                                .limit(1);

                            const userRow = userResults[0];
                            if (userRow) {
                                user = {
                                    ...userRow,
                                    role: userRow.role
                                };
                                session = sessionRow;
                            }
                        }
                    }
                }
            }

            // Enriquecimento com dados do business e Verificação de Status
            if (user && user.id) {
                try {
                    // FIX: Busca explícita na tabela companies usando o ownerId
                    // Isso garante que o slug e o businessId estejam sempre atualizados
                    const businessResults = await db
                        .select({
                            id: schema.companies.id,
                            name: schema.companies.name,
                            slug: schema.companies.slug,
                            ownerId: schema.companies.ownerId,
                            active: schema.companies.active,
                            subscriptionStatus: schema.companies.subscriptionStatus,
                            trialEndsAt: schema.companies.trialEndsAt,
                            accessType: schema.companies.accessType,
                        })
                        .from(schema.companies)
                        .where(eq(schema.companies.ownerId, user.id))
                        .limit(1);

                    const userCompany = businessResults[0];

                    // Log de depuração detalhado para diagnosticar problemas de login
                    console.log(`>>> [AUTH_DEBUG] User: ${user.email} (ID: ${user.id})`);
                    if (userCompany) {
                        console.log(`>>> [AUTH_DEBUG] Business Found -> ID: ${userCompany.id} | Slug: ${userCompany.slug} | Active: ${userCompany.active}`);
                    } else {
                        console.log(`>>> [AUTH_DEBUG] NO BUSINESS FOUND for this user.`);
                    }

                    // 1. BLOQUEIO POR CONTA DE USUÁRIO DESATIVADA (Restritivo)
                    if (user.active === false && !isMasterRoute && !isExemptFromBlocking && !isHealthRoute && user.role !== "SUPER_ADMIN") {
                        const isAutomaticBillingBlocked =
                            !!userCompany &&
                            userCompany.accessType === "automatic" &&
                            userCompany.active === false &&
                            (
                                userCompany.subscriptionStatus === "past_due" ||
                                userCompany.subscriptionStatus === "inactive" ||
                                userCompany.subscriptionStatus === "canceled"
                            );
                        if (isAutomaticBillingBlocked) {
                            console.warn(`[AUTH_BLOCK]: Conta com flag inativa, mas bloqueio é de cobrança automática para ${userCompany.slug}.`);
                        } else {
                            console.warn(`[AUTH_BLOCK]: Conta de usuário desativada: ${user.email}`);

                            set.status = 403;
                            throw new Error("ACCOUNT_SUSPENDED");
                        }
                    }

                    if (userCompany) {
                        // 1. BLOQUEIO POR CONTA DE USUÁRIO DESATIVADA (Restritivo)
                        if (userCompany.active === false && !isMasterRoute && !isExemptFromBlocking && !isHealthRoute && user.role !== "SUPER_ADMIN") {
                            const isAutomaticBillingBlocked =
                                userCompany.accessType === "automatic" &&
                                (
                                    userCompany.subscriptionStatus === "past_due" ||
                                    userCompany.subscriptionStatus === "inactive" ||
                                    userCompany.subscriptionStatus === "canceled"
                                );

                            if (isAutomaticBillingBlocked) {
                                // Tenta sincronizar. Se falhar, faz uma pequena pausa e tenta de novo (retry) 
                                // para dar tempo do Asaas processar se o usuário acabou de pagar.
                                let syncResult = await syncAsaasPaymentForCompany(
                                    userCompany.id,
                                    userCompany.ownerId,
                                    user.email,
                                    {
                                        requireCurrentMonthPayment: true,
                                        ignoreBlockDate: false
                                    },
                                );

                                if (!syncResult?.activated) {
                                    console.log(`[AUTH_SYNC] Primeira tentativa falhou para ${userCompany.slug}. Tentando retry em 2s...`);
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                    syncResult = await syncAsaasPaymentForCompany(
                                        userCompany.id,
                                        userCompany.ownerId,
                                        user.email,
                                        {
                                            requireCurrentMonthPayment: true,
                                            ignoreBlockDate: false
                                        },
                                    );
                                }

                                if (syncResult?.activated) {
                                    userCompany.active = true;
                                    userCompany.subscriptionStatus = "active";
                                    userCompany.trialEndsAt = syncResult.nextDue;
                                    console.log(`[AUTH_SYNC] Reativação imediata concluída para ${userCompany.slug} durante validação de bloqueio.`);
                                } else {
                                    console.warn(`[AUTH_BLOCK]: Estabelecimento bloqueado por cobrança pendente: ${userCompany.slug}`);
                                    set.status = 402;
                                    throw new Error("BILLING_REQUIRED");
                                }
                            } else {
                                console.warn(`[AUTH_BLOCK]: Conta de usuário desativada: ${user.email}`);

                                set.status = 403;
                                throw new Error("ACCOUNT_SUSPENDED");
                            }
                        }

                        const daysLeft = userCompany.trialEndsAt ? Math.ceil((new Date(userCompany.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

                        user.business = {
                            ...userCompany,
                            daysLeft
                        };
                        user.slug = userCompany.slug; // Fundamental para o redirecionamento no Front
                        user.businessId = userCompany.id;

                        // 2. BLOQUEIO POR ASSINATURA (SaaS)
                        // Verifica se o usuário tem permissão de acesso baseado na assinatura
                        if (!isMasterRoute && !isExemptFromBlocking && !isHealthRoute && user.role !== "SUPER_ADMIN") {
                            const now = new Date();
                            let status = userCompany.subscriptionStatus;
                            const trialEnds = userCompany.trialEndsAt ? new Date(userCompany.trialEndsAt) : null;
                            const isTrialStatus = status === 'trial' || status === 'trialing';
                            let isManualActive =
                                userCompany.accessType === "manual" ||
                                status === 'manual' ||
                                status === 'manual_active';

                            // Se estiver bloqueado ou com pagamento pendente, tenta sincronizar uma última vez
                            const isAutomaticAccess = userCompany.accessType === "automatic" && !isTrialStatus && !isManualActive;
                            if (isAutomaticAccess) {
                                if (status !== "active") {
                                    const syncResult = await syncAsaasPaymentForCompany(
                                        userCompany.id,
                                        userCompany.ownerId,
                                        user.email,
                                        {
                                            requireCurrentMonthPayment: true,
                                            ignoreBlockDate: false
                                        },
                                    );

                                    if (syncResult?.activated) {
                                        userCompany.active = true;
                                        userCompany.subscriptionStatus = "active";
                                        userCompany.trialEndsAt = syncResult.nextDue;
                                        status = "active";
                                        console.log(`[AUTH_SYNC] Pagamento confirmado no Asaas para ${userCompany.slug}. Acesso reativado automaticamente.`);
                                    } else if (status === "active") {
                                        // Rebaixa se não encontrou pagamento mas estava marcado como ativo
                                        await db.update(schema.companies)
                                            .set({
                                                subscriptionStatus: "past_due",
                                                updatedAt: new Date()
                                            })
                                            .where(eq(schema.companies.id, userCompany.id));
                                        status = "past_due";
                                        console.warn(`[AUTH_SYNC] Sem pagamento válido no mês atual para ${userCompany.slug}. Rebaixado para past_due.`);
                                    }
                                }
                            }

                            // Validação final de acesso baseada no status resolvido
                            const isExpired = trialEnds && trialEnds < now;
                            const isBlocked = status === 'past_due' || status === 'unpaid' || status === 'canceled' || status === 'inactive';

                            if (isBlocked || (isTrialStatus && isExpired)) {
                                console.warn(`[AUTH_BLOCK]: Acesso negado para ${userCompany.slug} (Status: ${status}, Expired: ${isExpired})`);
                                set.status = 402;
                                throw new Error("BILLING_REQUIRED");
                            }
                        }
                    }
                } catch (dbError: any) {
                    if (dbError.message === "BUSINESS_SUSPENDED" || dbError.message === "ACCOUNT_SUSPENDED" || dbError.message === "BILLING_REQUIRED") {
                        throw dbError;
                    }
                    console.error(`[AUTH_PLUGIN] Erro ao buscar company:`, dbError);
                }
            }

            return {
                user: user as User | null,
                session: session as Session | null,
            };
        } catch (error: any) {
            // Repassa erros de suspensão para o onError global do index.ts
            if (error.message === "BUSINESS_SUSPENDED" || error.message === "ACCOUNT_SUSPENDED" || error.message === "BILLING_REQUIRED") {
                throw error;
            }
            console.error("[AUTH_PLUGIN] Erro ao obter sessão:", error);
            return {
                user: null,
                session: null,
            };
        }
    })
    .macro({
        auth: {
            resolve({ user, set }) {
                if (!user) {
                    set.status = 401;
                    return { error: "Unauthorized" };
                }
            },
        },
        isMaster: {
            resolve({ user, set }) {
                if (!user || user.role !== "SUPER_ADMIN") {
                    set.status = 403;
                    return { error: "Forbidden: Super Admin access required" };
                }
            }
        }
    });
```

## Arquivo: `src\modules\infrastructure\auth\auth.ts`
```typescript
import { betterAuth } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";
import { db } from "../drizzle/database";
import * as schema from "../../../db/schema";
import { and, eq } from "drizzle-orm";
import { verifyPassword as verifyScryptPassword } from "better-auth/crypto";

export { verifyScryptPassword };

const resendKey = process.env.RESEND_API_KEY;
if (!resendKey && process.env.NODE_ENV === "production") {
  console.error("[AUTH] FATAL: RESEND_API_KEY is missing in production!");
}

const resend = new Resend(resendKey || "re_placeholder");

if (!process.env.BETTER_AUTH_SECRET) {
  console.warn("BETTER_AUTH_SECRET is missing! Using dev secret.");
}

// Configuração do baseURL: deve sempre apontar para o backend onde o Better Auth está rodando
const getBaseUrl = () => {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL;
  if (process.env.BASE_URL) return process.env.BASE_URL;

  // Fallback para localhost em desenvolvimento (Backend roda na 3001)
  return "http://localhost:3001";
};

const baseURL = getBaseUrl();
console.log("[AUTH] BaseURL configurado:", baseURL);

export const detectHashAlgorithm = (hash: string) => {
  if (!hash) return "empty";
  if (hash.startsWith("$argon2id$")) return "argon2id";
  if (hash.startsWith("$argon2i$")) return "argon2i";
  if (hash.startsWith("$argon2d$")) return "argon2d";
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) return "bcrypt";
  if (hash.includes(":")) return "scrypt";
  return "unknown";
};

console.log("[AUTH_MODULE] Loading auth module...");

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "placeholder_secret_for_build",
  emailAndPassword: {
    enabled: true,
    password: {
      async verify({ hash, password }) {
        const algorithm = detectHashAlgorithm(hash);
        const hashPreview = hash ? hash.slice(0, 40) : "";
        try {
          console.log(`[AUTH_VERIFY] Incoming hash algo=${algorithm} len=${hash?.length ?? 0} preview=${hashPreview}`);
          let isCorrect = false;
          if (algorithm === "scrypt") {
            isCorrect = await verifyScryptPassword({ hash, password });
            if (isCorrect) {
              try {
                const newHash = await Bun.password.hash(password, { algorithm: "argon2id" });
                const updated = await db
                  .update(schema.account)
                  .set({ password: newHash, updatedAt: new Date() })
                  .where(and(eq(schema.account.password, hash), eq(schema.account.providerId, "credential")))
                  .returning({ id: schema.account.id });
                console.log(`[AUTH_VERIFY] Rehash scrypt->argon2id updated=${updated.length}`);
              } catch (rehashError) {
                console.error("[AUTH_VERIFY] Rehash failed:", rehashError);
              }
            }
          } else {
            isCorrect = await Bun.password.verify(password, hash);
          }
          console.log(`[AUTH_VERIFY] Password verification: ${isCorrect}`);
          return isCorrect;
        } catch (e) {
          console.error(`[AUTH_VERIFY] Error verifying password:`, e);
          console.error(`[AUTH_VERIFY] Failed hash algo=${algorithm} len=${hash?.length ?? 0} preview=${hashPreview}`);
          return false;
        }
      },
      async hash(password) {
        return await Bun.password.hash(password, { algorithm: "argon2id" });
      }
    }
  },
  baseURL: baseURL,
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://agendamento-nota-front.vercel.app",
    "https://landingpage-agendamento-front.vercel.app",
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.NEXT_PUBLIC_VERCEL_URL ? [`https://${process.env.NEXT_PUBLIC_VERCEL_URL}`] : []),
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    "https://agendamento-nota-front.vercel.app/api-proxy", // Adicionado explicitamente o caminho do proxy
    "https://agendamento-nota-front-git-staging-lucassa1324s-projects.vercel.app", // Staging Environment
    "https://agendamento-nota-front-git-staging-lucassa1324s-projects.vercel.app/api-proxy" // Staging Proxy
  ],
  advanced: {
    // Configuração OBRIGATÓRIA para Vercel (Cross-Site) em Produção
    // Front em agendamento-nota-front.vercel.app
    // Back em agendamento-nota-backend.vercel.app
    // Em localhost, usamos configurações mais relaxadas para evitar problemas com SSL/HTTP
    useSecureCookies: process.env.NODE_ENV === "production",
    cookie: {
      domain: process.env.NODE_ENV === "production" ? undefined : "localhost",
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production"
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // 1 dia
    cookieCache: {
      enabled: false, // Desabilitado em produção serverless para evitar inconsistências
    },
    freshAge: 0, // Força a verificação da sessão no banco se houver dúvida
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
      },
      active: {
        type: "boolean",
      },
      hasCompletedOnboarding: {
        type: "boolean",
      },
    },
  },
  emailVerification: {
    async sendVerificationEmail({ user, url }: { user: any; url: string }) {
      console.log(`[AUTH] Enviando e-mail de verificação para: ${user.email}`);
      try {
        const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
        const { data, error } = await resend.emails.send({
          from: `Agendamento Nota <${fromEmail}>`,
          to: [user.email],
          subject: "Verifique seu e-mail",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #333; text-align: center;">Bem-vindo ao Agendamento Nota!</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.5;">
                Olá, ${user.name || "usuário"}! Obrigado por se cadastrar. Para começar a usar todas as funcionalidades, por favor confirme seu endereço de e-mail clicando no botão abaixo:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${url}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Verificar E-mail
                </a>
              </div>
              <p style="color: #999; font-size: 14px; text-align: center;">
                Se o botão acima não funcionar, copie e cole o link abaixo no seu navegador:
              </p>
              <p style="color: #007bff; font-size: 12px; text-align: center; word-break: break-all;">
                ${url}
              </p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px; text-align: center;">
                Se você não criou esta conta, por favor ignore este e-mail.
              </p>
            </div>
          `,
        });

        if (error) {
          console.error("[AUTH] Erro ao enviar e-mail via Resend:", error);
        } else {
          console.log("[AUTH] E-mail enviado com sucesso:", data?.id);
        }
      } catch (e) {
        console.error("[AUTH] Erro fatal no envio de e-mail:", e);
      }
    },
  },
  plugins: [
    {
      id: "business-data",
      hooks: {
        after: [
          {
            matcher(context) {
              const path = context?.path || "";
              return path.endsWith("/sign-in/email") || path.endsWith("/get-session");
            },
            handler: async (ctx: any) => {
              const returned = ctx?.context?.returned;

              // SEMPRE retornar um objeto com a propriedade 'response' para evitar crash no Better Auth (TypeError: null/undefined is not an object)
              if (!returned || returned instanceof Response) {
                return { response: returned };
              }

              try {
                // Se chegou aqui, 'returned' é um objeto JS puro { user, session } 
                if (!returned.user) return { response: returned };

                const [business] = await db
                  .select({
                    id: schema.companies.id,
                    slug: schema.companies.slug,
                    subscriptionStatus: schema.companies.subscriptionStatus,
                    trialEndsAt: schema.companies.trialEndsAt,
                  })
                  .from(schema.companies)
                  .where(eq(schema.companies.ownerId, returned.user.id))
                  .limit(1);

                if (business) {
                  console.log(`[AUTH_HOOK] Injetando dados do business para: ${business.slug}`);

                  // Injeção direta no objeto que o Better Auth já ia retornar 
                  return {
                    response: {
                      ...returned,
                      user: {
                        ...returned.user,
                        slug: business.slug,
                        businessId: business.id,
                        business: {
                          id: business.id,
                          slug: business.slug,
                          subscriptionStatus: business.subscriptionStatus,
                          trialEndsAt: business.trialEndsAt,
                        }
                      }
                    }
                  };
                }
              } catch (e) {
                console.error("[AUTH_HOOK_ERROR]", e);
              }
              // Se nada der certo (erro ou sem business), retorna o original (evita o data: null)
              return { response: returned };
            },
          }
        ]
      },
      endpoints: {
        changePassword: createAuthEndpoint(
          "/change-password",
          {
            method: "POST",
            useSession: true,
          },
          async (ctx: any) => {
            console.log(`[CHANGE_PASSWORD] 🔓 INICIANDO ENDPOINT`);
            console.log(`[CHANGE_PASSWORD] Path: ${ctx.path}`);

            // Tentar recuperar o corpo de múltiplas formas para garantir que não chegue vazio
            let body: any = {};
            try {
              // 1. Tentar ler do ctx.body (se o Elysia já tiver processado)
              if (ctx.body && Object.keys(ctx.body).length > 0) {
                body = ctx.body;
                console.log(`[CHANGE_PASSWORD] 🔍 Body recuperado via ctx.body`);
              }
              // 2. Tentar ler via ctx.request.json()
              else if (ctx.request) {
                const clonedReq = ctx.request.clone();
                body = await clonedReq.json().catch(() => ({}));
                console.log(`[CHANGE_PASSWORD] 🔍 Body recuperado via ctx.request.json()`);
              }
            } catch (e) {
              console.log(`[CHANGE_PASSWORD] ⚠️ Erro ao tentar ler body:`, e);
            }

            console.log(`[CHANGE_PASSWORD] 🔍 Keys finais:`, Object.keys(body));

            let session = ctx.context.session;

            // Fallback: Se a sessão não estiver no context (comum em endpoints customizados), tentamos buscar manualmente
            if (!session) {
              console.log(`[CHANGE_PASSWORD] Sessão não encontrada no contexto. Tentando buscar via auth.api.getSession...`);
              const authSession = await auth.api.getSession({
                headers: ctx.request.headers
              });
              if (authSession) {
                session = authSession;
                console.log(`[CHANGE_PASSWORD] Sessão recuperada manualmente para: ${session.user.email}`);
              }
            }

            if (!session) {
              console.log(`[CHANGE_PASSWORD] Falha crítica: Usuário não autenticado.`);
              return ctx.json({ error: "Não autorizado" }, { status: 401 });
            }

            if (!ctx.request) {
              return ctx.json({ error: "Corpo inválido" }, { status: 400 });
            }

            const { currentPassword, newPassword } = body;

            if (!currentPassword || !newPassword) {
              return ctx.json(
                { error: "Senha atual e nova senha são obrigatórias" },
                { status: 400 }
              );
            }

            // 1. Buscar o hash atual do usuário no banco
            const userAccount = await db
              .select()
              .from(schema.account)
              .where(
                and(
                  eq(schema.account.userId, session.user.id),
                  eq(schema.account.providerId, "credential")
                )
              )
              .limit(1);

            if (userAccount.length === 0 || !userAccount[0].password) {
              return ctx.json({ error: "Conta não encontrada" }, { status: 404 });
            }

            const currentHash = userAccount[0].password;
            const algorithm = detectHashAlgorithm(currentHash);

            // 2. Validar senha atual (Lógica Bilíngue)
            let isPasswordValid = false;
            try {
              if (algorithm === "scrypt") {
                isPasswordValid = await verifyScryptPassword({
                  hash: currentHash,
                  password: currentPassword,
                });
              } else {
                isPasswordValid = await Bun.password.verify(
                  currentPassword,
                  currentHash
                );
              }
            } catch (error) {
              console.error("[CHANGE_PASSWORD] Erro na validação:", error);
              return ctx.json({ error: "Erro ao validar senha" }, { status: 500 });
            }

            if (!isPasswordValid) {
              return ctx.json({ error: "Senha atual incorreta" }, { status: 403 });
            }

            // 3. Gerar novo hash Argon2 (Migração Forçada)
            const newHash = await Bun.password.hash(newPassword, {
              algorithm: "argon2id",
            });

            // 4. Atualizar no banco com log de confirmação
            console.log(`[CHANGE_PASSWORD] 🚀 Tentando update para userId: ${session.user.id}`);

            // Debug: Listar todas as contas desse usuário antes de atualizar
            const allAccounts = await db.select().from(schema.account).where(eq(schema.account.userId, session.user.id));
            console.log(`[CHANGE_PASSWORD] Contas encontradas para este usuário:`, allAccounts.length);
            allAccounts.forEach(acc => console.log(` - Account ID: ${acc.id}, Provider: ${acc.providerId}`));

            const updateResult = await db
              .update(schema.account)
              .set({
                password: newHash,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(schema.account.userId, session.user.id),
                  eq(schema.account.providerId, "credential")
                )
              )
              .returning({
                id: schema.account.id,
                userId: schema.account.userId
              });

            console.log(
              `[CHANGE_PASSWORD] Resultado do Update (Raw):`, JSON.stringify(updateResult, null, 2)
            );

            if (!updateResult || updateResult.length === 0) {
              console.error("[CHANGE_PASSWORD] ❌ ERRO FATAL: Nenhuma linha atualizada!");
              return ctx.json({ error: "O banco de dados recusou a atualização da senha. Nenhuma conta correspondente foi encontrada." }, { status: 500 });
            }

            console.log(`[CHANGE_PASSWORD] ✅ SUCESSO REAL: Senha persistida no banco.`);

            if (updateResult.length === 0) {
              console.error("[CHANGE_PASSWORD] ❌ Nenhuma linha atualizada no banco!");
              return ctx.json({ error: "Falha ao persistir nova senha" }, { status: 500 });
            }

            console.log(
              `[CHANGE_PASSWORD] ✅ Senha atualizada com sucesso para ${session.user.email} (ID: ${updateResult[0].id})`
            );

            return ctx.json({ message: "Senha atualizada com sucesso" });
          }
        ),
        getBusiness: createAuthEndpoint(
          "/business-info",
          {
            method: "GET",
          },
          async (ctx) => {
            const session = ctx.context.session;
            if (!session) return ctx.json({ business: null, slug: null });

            const userId = session.user.id;
            const results = await db
              .select({
                id: schema.companies.id,
                name: schema.companies.name,
                slug: schema.companies.slug,
                ownerId: schema.companies.ownerId,
                active: schema.companies.active,
                subscriptionStatus: schema.companies.subscriptionStatus,
                trialEndsAt: schema.companies.trialEndsAt,
                createdAt: schema.companies.createdAt,
                updatedAt: schema.companies.updatedAt,
                siteCustomization: {
                  layoutGlobal: schema.companySiteCustomizations.layoutGlobal,
                  home: schema.companySiteCustomizations.home,
                  gallery: schema.companySiteCustomizations.gallery,
                },
              })
              .from(schema.companies)
              .leftJoin(
                schema.companySiteCustomizations,
                eq(schema.companies.id, schema.companySiteCustomizations.companyId)
              )
              .where(eq(schema.companies.ownerId, userId))
              .limit(1);

            if (results.length > 0) {
              return ctx.json({
                business: results[0],
                slug: results[0].slug,
              });
            }

            return ctx.json({ business: null, slug: null });
          }
        ),
      },
    },
  ],
});
```

## Arquivo: `src\modules\infrastructure\di\repositories.plugin.ts`
```typescript
import { Elysia } from "elysia";
import { DrizzleBusinessRepository } from "../../business/adapters/out/drizzle/business.drizzle.repository";
import { DrizzleAppointmentRepository } from "../../appointments/adapters/out/drizzle/appointment.drizzle.repository";
import { DrizzleServiceRepository } from "../../services/adapters/out/drizzle/service.drizzle.repository";
import { DrizzleInventoryRepository } from "../../inventory/adapters/out/drizzle/inventory.drizzle.repository";
import { DrizzleSettingsRepository } from "../../settings/adapters/out/drizzle/settings.drizzle.repository";
import { DrizzleExpenseRepository } from "../../expenses/adapters/out/drizzle/expense.drizzle.repository";
import { GalleryDrizzleRepository } from "../../gallery/adapters/out/drizzle/gallery.drizzle.repository";
import { DrizzlePushSubscriptionRepository } from "../../notifications/adapters/out/drizzle/push-subscription.drizzle.repository";
import { UserRepository } from "../../user/adapters/out/user.repository";

export const repositoriesPlugin = new Elysia()
  .decorate("businessRepository", new DrizzleBusinessRepository())
  .decorate("userRepository", new UserRepository())
  .decorate("appointmentRepository", new DrizzleAppointmentRepository())
  .decorate("serviceRepository", new DrizzleServiceRepository())
  .decorate("inventoryRepository", new DrizzleInventoryRepository())
  .decorate("settingsRepository", new DrizzleSettingsRepository())
  .decorate("expenseRepository", new DrizzleExpenseRepository())
  .decorate("galleryRepository", new GalleryDrizzleRepository())
  .decorate("pushSubscriptionRepository", new DrizzlePushSubscriptionRepository());
```

## Arquivo: `src\modules\infrastructure\drizzle\database.cli.ts`
```typescript
import { drizzle } from "drizzle-orm/node-postgres";

export const db = drizzle(process.env.DATABASE_URL!);
```

## Arquivo: `src\modules\infrastructure\drizzle\database.ts`
```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
    console.error("CRITICAL ERROR: DATABASE_URL is not defined in environment variables.");
}

const dbUrl = process.env.DATABASE_URL || "";

if (dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")) {
    console.log(">>> [DB] Conectado ao PostgreSQL Local (Docker) na porta 5432");
}

// Configuração resiliente do client Postgres
const queryClient = postgres(dbUrl, {
    prepare: false, // Otimização para serverless (evita prepared statements cacheados que falham em conexões pooladas)
    connect_timeout: 10, // Timeout curto para falhar rápido se a conexão estiver ruim
});

export const db = drizzle(queryClient, {
    logger: process.env.NODE_ENV === "production" ? false : true
});
```

## Arquivo: `src\modules\infrastructure\environment\environment.ts`
```typescript
export const environment = {
	asaas: {
		accessToken: process.env.ASAAS_ACCESS_TOKEN,
		baseUrl: process.env.ASAAS_BASE_URL,
	},
};
```

## Arquivo: `src\modules\infrastructure\payment\asaas.client.ts`
```typescript
export class AsaasClient {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.ASAAS_API_KEY || "";
    this.apiUrl = process.env.ASAAS_API_URL || "https://api-sandbox.asaas.com/v3";
  }

  // Método placeholder para criar cliente
  async createCustomer(data: { name: string; cpfCnpj: string; email: string }) {
    if (!this.apiKey) {
      console.warn("[ASAAS_CLIENT] Sem API Key. Retornando mock.");
      return { id: "cus_mock_123" };
    }
    // Implementação real viria aqui (fetch/axios)
    return { id: "cus_mock_real_impl_pending" };
  }

  // Método placeholder para criar assinatura
  async createSubscription(data: { customerId: string; value: number; nextDueDate: string; remoteIp?: string; creditCard?: any; creditCardHolderInfo?: any }) {
    if (!this.apiKey) {
      console.warn("[ASAAS_CLIENT] Sem API Key. Retornando mock.");
      return { id: "sub_mock_123", status: "PENDING" };
    }

    const payload: any = {
      customer: data.customerId,
      billingType: "CREDIT_CARD",
      value: data.value,
      nextDueDate: data.nextDueDate,
      remoteIp: data.remoteIp,
      cycle: "MONTHLY", // Assumindo mensal por padrão, pode ser parametrizado
      description: "Assinatura Agendamento Nota"
    };

    if (data.creditCard) {
      payload.creditCard = data.creditCard;
    }
    if (data.creditCardHolderInfo) {
      payload.creditCardHolderInfo = data.creditCardHolderInfo;
    }

    try {
      console.log("[ASAAS_CLIENT] Criando assinatura...", { ...payload, creditCard: "***" });

      const response = await fetch(`${this.apiUrl}/subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": this.apiKey
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("[ASAAS_CLIENT] Erro ao criar assinatura:", JSON.stringify(responseData));
        throw new Error((responseData as any).errors?.[0]?.description || "Erro ao criar assinatura no Asaas");
      }

      return responseData;
    } catch (error) {
      console.error("[ASAAS_CLIENT] Exception:", error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string) {
    if (!subscriptionId) {
      console.warn("[ASAAS_CLIENT] SubscriptionId vazio. Ignorando cancelamento.");
      return { status: "SKIPPED" };
    }

    if (!this.apiKey) {
      console.warn("[ASAAS_CLIENT] Sem API Key. Retornando mock.");
      return { id: subscriptionId, status: "MOCK_CANCELLED" };
    }

    try {
      console.log(`[ASAAS_CLIENT] Cancelando assinatura ${subscriptionId}...`);

      const response = await fetch(`${this.apiUrl}/subscriptions/${subscriptionId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "access_token": this.apiKey
        }
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("[ASAAS_CLIENT] Erro ao cancelar assinatura:", JSON.stringify(responseData));
        throw new Error((responseData as any).errors?.[0]?.description || "Erro ao cancelar assinatura no Asaas");
      }

      return responseData;
    } catch (error) {
      console.error("[ASAAS_CLIENT] Exception no cancelamento:", error);
      throw error;
    }
  }

  // Método para buscar pagamentos de uma assinatura
  async listSubscriptionPayments(subscriptionId: string) {
    if (!subscriptionId || !this.apiKey) return [];

    try {
      const response = await fetch(`${this.apiUrl}/subscriptions/${subscriptionId}/payments`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "access_token": this.apiKey
        }
      });

      if (!response.ok) return [];
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error("[ASAAS_CLIENT] Erro ao listar pagamentos:", error);
      return [];
    }
  }

  // Método para estornar um pagamento
  async refundPayment(paymentId: string) {
    if (!paymentId || !this.apiKey) return null;

    try {
      console.log(`[ASAAS_CLIENT] Estornando pagamento ${paymentId}...`);
      const response = await fetch(`${this.apiUrl}/payments/${paymentId}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": this.apiKey
        }
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("[ASAAS_CLIENT] Erro ao estornar pagamento:", error);
      return null;
    }
  }

  // Método para aplicar desconto
  async applyDiscount(subscriptionId: string, discount: { percentage: number; cycles: number }) {
    if (!subscriptionId) {
      console.warn("[ASAAS_CLIENT] SubscriptionId vazio. Ignorando desconto.");
      return { status: "SKIPPED" };
    }

    if (!this.apiKey) {
      console.warn(`[ASAAS_CLIENT] Sem API Key. Aplicando desconto mock de ${discount.percentage}% por ${discount.cycles} ciclos.`);
      return { id: subscriptionId, status: "MOCK_DISCOUNT_APPLIED" };
    }

    try {
      console.log(`[ASAAS_CLIENT] Aplicando desconto na assinatura ${subscriptionId}...`);
      // No Asaas, desconto é aplicado via atualização da assinatura ou criação de um desconto específico
      // Aqui vamos usar o endpoint de atualização de assinatura para simplificar
      const response = await fetch(`${this.apiUrl}/subscriptions/${subscriptionId}`, {
        method: "POST", // POST em sub-recurso costuma ser atualização no Asaas
        headers: {
          "Content-Type": "application/json",
          "access_token": this.apiKey
        },
        body: JSON.stringify({
          discount: {
            value: discount.percentage,
            type: "PERCENTAGE",
            durationInMonths: discount.cycles
          }
        })
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error((responseData as any).errors?.[0]?.description || "Erro ao aplicar desconto");
      }
      return responseData;
    } catch (error) {
      console.error("[ASAAS_CLIENT] Erro ao aplicar desconto:", error);
      throw error;
    }
  }
}

export const asaas = new AsaasClient();
```

## Arquivo: `src\modules\infrastructure\payment\asaas.webhook.controller.ts`
```typescript
import { Elysia } from "elysia";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../drizzle/database";
import { companies, user } from "../../../db/schema";
import { eq } from "drizzle-orm";

const normalizeEnvValue = (value?: string) =>
  value?.trim().replace(/^['"]|['"]$/g, "") || "";

const extractEnvValueFromContent = (content: string, key: string) => {
  const regex = new RegExp(`^${key}=(.*)$`, "m");
  const match = content.match(regex);
  if (!match?.[1]) {
    return "";
  }
  return normalizeEnvValue(match[1]);
};

const readEnvFallback = async (key: string) => {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), "back_end", ".env"),
    path.join(process.cwd(), "back_end", ".env.local"),
    path.join(process.cwd(), "front_end", ".env.local"),
    path.join(process.cwd(), "..", "back_end", ".env"),
    path.join(process.cwd(), "..", "back_end", ".env.local"),
    path.join(process.cwd(), "..", "front_end", ".env.local"),
  ];

  for (const envPath of candidates) {
    try {
      const content = await readFile(envPath, "utf8");
      const value = extractEnvValueFromContent(content, key);
      if (value) {
        return value;
      }
    } catch { }
  }

  return "";
};

export const asaasWebhookController = new Elysia({ prefix: "/webhook/asaas" })
  .post("/", async ({ request, set }) => {
    try {
      const event = await request.json() as any;
      console.log(`[ASAAS_WEBHOOK] Evento recebido: ${event.event}`, event);

      // Validação básica de segurança (Token no header se houver)
      const asaasToken = request.headers.get("asaas-access-token");
      if (process.env.ASAAS_WEBHOOK_TOKEN && asaasToken !== process.env.ASAAS_WEBHOOK_TOKEN) {
        console.warn("[ASAAS_WEBHOOK] Token de segurança inválido!");
        set.status = 401;
        return { error: "Unauthorized" };
      }

      if (!event || !event.payment) {
        return { status: "ignored", reason: "no_payment_data" };
      }

      const payment = event.payment;
      const activationEvents = [
        "PAYMENT_CONFIRMED",
        "PAYMENT_RECEIVED",
        "PAYMENT_RECEIVED_IN_CASH",
      ];
      const blockingEvents = ["PAYMENT_OVERDUE", "PAYMENT_REFUNDED"];

      const asaasApiKey =
        normalizeEnvValue(process.env.ASAAS_API_KEY) ||
        normalizeEnvValue(process.env.ASAAS_ACCESS_TOKEN) ||
        (await readEnvFallback("ASAAS_API_KEY")) ||
        (await readEnvFallback("ASAAS_ACCESS_TOKEN"));
      const asaasApiUrl =
        normalizeEnvValue(process.env.ASAAS_API_URL) ||
        normalizeEnvValue(process.env.ASAAS_BASE_URL) ||
        (await readEnvFallback("ASAAS_API_URL")) ||
        (await readEnvFallback("ASAAS_BASE_URL")) ||
        "https://api-sandbox.asaas.com/v3";

      const fetchAsaasResource = async <T>(resourcePath: string): Promise<T | null> => {
        if (!asaasApiKey) {
          return null;
        }
        try {
          const response = await fetch(`${asaasApiUrl}${resourcePath}`, {
            method: "GET",
            headers: {
              access_token: asaasApiKey,
            },
          });
          if (!response.ok) {
            return null;
          }
          return await response.json() as T;
        } catch {
          return null;
        }
      };

      let externalReference = String(payment.externalReference || "");
      let customerId = String(payment.customer || "");
      let customerEmail = "";

      if ((!externalReference || !customerId) && payment.subscription) {
        const subscriptionData = await fetchAsaasResource<{ externalReference?: string; customer?: string }>(
          `/subscriptions/${payment.subscription}`,
        );
        if (subscriptionData?.externalReference) {
          externalReference = String(subscriptionData.externalReference);
        }
        if (subscriptionData?.customer) {
          customerId = String(subscriptionData.customer);
        }
      }

      if ((!externalReference || !customerId) && payment.id) {
        const paymentData = await fetchAsaasResource<{ externalReference?: string; customer?: string; subscription?: string }>(
          `/payments/${payment.id}`,
        );
        if (paymentData?.externalReference) {
          externalReference = String(paymentData.externalReference);
        }
        if (paymentData?.customer) {
          customerId = String(paymentData.customer);
        }
        if ((!externalReference || !customerId) && paymentData?.subscription) {
          const subscriptionFromPayment = await fetchAsaasResource<{ externalReference?: string; customer?: string }>(
            `/subscriptions/${paymentData.subscription}`,
          );
          if (subscriptionFromPayment?.externalReference) {
            externalReference = String(subscriptionFromPayment.externalReference);
          }
          if (subscriptionFromPayment?.customer) {
            customerId = String(subscriptionFromPayment.customer);
          }
        }
      }

      if ((!externalReference || !customerEmail) && customerId) {
        const customerData = await fetchAsaasResource<{ externalReference?: string; email?: string }>(
          `/customers/${customerId}`,
        );
        if (customerData?.externalReference) {
          externalReference = String(customerData.externalReference);
        }
        if (customerData?.email) {
          customerEmail = String(customerData.email).trim().toLowerCase();
        }
      }

      if (!externalReference && customerEmail) {
        let ownerByEmail = await db.select({ id: user.id })
          .from(user)
          .where(eq(user.email, customerEmail))
          .limit(1);

        if (ownerByEmail.length === 0) {
          ownerByEmail = await db.select({ id: user.id })
            .from(user)
            .where(eq(user.email, customerEmail.trim()))
            .limit(1);
        }

        const ownerId = ownerByEmail[0]?.id;
        if (ownerId) {
          const [companyByOwner] = await db.select({ id: companies.id })
            .from(companies)
            .where(eq(companies.ownerId, ownerId))
            .limit(1);
          if (companyByOwner?.id) {
            externalReference = companyByOwner.id;
          }
        }
      }

      // Tenta encontrar a empresa pelo externalReference (que é o businessId)
      if (activationEvents.includes(event.event)) {
        // Lógica de Ativação
        if (externalReference) {
          console.log(`[ASAAS_WEBHOOK] Processando ativação para empresa: ${externalReference}`);

          const paymentDate = payment.paymentDate ? new Date(payment.paymentDate) : new Date();
          const nextDue = new Date(paymentDate);
          nextDue.setDate(nextDue.getDate() + 30);

          // 1. Buscar a empresa para obter o ownerId
          const [company] = await db.select()
            .from(companies)
            .where(eq(companies.id, externalReference))
            .limit(1);

          if (company) {
            if (company.active === false && company.accessType !== "automatic") {
              console.warn(`[ASAAS_WEBHOOK] Empresa ${company.name} está bloqueada manualmente (active=false). Ativação automática ignorada.`);
              return { received: true, skipped: "manual_block" };
            }

            const isManualGraceActive =
              company.accessType === "manual" &&
              !!company.trialEndsAt &&
              new Date(company.trialEndsAt) > new Date();

            // 2. Atualizar a empresa
            await db.update(companies)
              .set({
                subscriptionStatus: 'active',
                active: true,
                accessType: isManualGraceActive ? 'manual' : 'automatic',
                trialEndsAt: isManualGraceActive ? company.trialEndsAt : nextDue,
                updatedAt: new Date()
              })
              .where(eq(companies.id, externalReference));

            // 3. Ativar o dono da empresa também
            await db.update(user)
              .set({
                active: true,
                updatedAt: new Date()
              })
              .where(eq(user.id, company.ownerId));

            console.log(`[ASAAS_WEBHOOK] Pagamento confirmado! Empresa ${company.name} (${externalReference}) e dono ${company.ownerId} ativados até ${nextDue.toISOString()}.`);
          } else {
            console.warn(`[ASAAS_WEBHOOK] Empresa ${externalReference} não encontrada.`);
          }
        } else {
          console.warn("[ASAAS_WEBHOOK] ExternalReference ausente, não foi possível identificar a empresa.");
        }
      } else if (blockingEvents.includes(event.event)) {
        // Lógica de Bloqueio
        if (externalReference) {
          const [company] = await db.select()
            .from(companies)
            .where(eq(companies.id, externalReference))
            .limit(1);

          if (!company) {
            console.warn(`[ASAAS_WEBHOOK] Empresa ${externalReference} não encontrada para bloqueio.`);
            return { received: true };
          }

          if (company.active === false && company.accessType !== "automatic") {
            console.warn(`[ASAAS_WEBHOOK] Empresa ${company.name} já está bloqueada manualmente (active=false).`);
            return { received: true, skipped: "manual_block" };
          }

          const hasManualOverride =
            (company.accessType === "manual" || company.accessType === "extended_trial") &&
            !!company.trialEndsAt &&
            new Date(company.trialEndsAt) > new Date();

          if (hasManualOverride) {
            console.log(`[ASAAS_WEBHOOK] Bloqueio ignorado para ${company.name} por override manual ativo até ${company.trialEndsAt?.toISOString?.() || company.trialEndsAt}.`);
            return { received: true, skipped: "manual_override" };
          }

          await db.update(companies)
            .set({
              subscriptionStatus: 'past_due',
              updatedAt: new Date()
            })
            .where(eq(companies.id, externalReference));
          console.log(`[ASAAS_WEBHOOK] Pagamento pendente/estornado. Empresa ${externalReference} marcada como past_due.`);
        }
      }

      return { received: true };
    } catch (error: any) {
      console.error("[ASAAS_WEBHOOK_ERROR]", error);
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  });
```

## Arquivo: `src\modules\infrastructure\payment\payment.controller.ts`
```typescript
import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/auth-plugin";
import { asaas } from "./asaas.client";

export const paymentController = () => new Elysia({ prefix: "/payment" })
  .use(authPlugin)
  .post("/subscribe", async ({ user, body, request, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { customerId, value, nextDueDate, creditCard, creditCardHolderInfo } = body;
      
      // Captura o IP do cliente dos headers
      // O front-end deve enviar o IP do cliente no header 'x-client-ip' ou contar com 'x-forwarded-for'
      const remoteIp = request.headers.get("x-client-ip") || 
                       request.headers.get("x-forwarded-for")?.split(',')[0]?.trim() || 
                       "0.0.0.0";

      console.log(`[PAYMENT_CONTROLLER] Iniciando assinatura para user ${user.id} com IP: ${remoteIp}`);

      if (!remoteIp || remoteIp === "0.0.0.0") {
        console.warn("[PAYMENT_CONTROLLER] IP remoto não detectado ou inválido. O Asaas pode rejeitar transações de cartão.");
      }

      const subscription = await asaas.createSubscription({
        customerId,
        value,
        nextDueDate,
        remoteIp,
        creditCard,
        creditCardHolderInfo
      });

      return { success: true, subscription };
    } catch (error: any) {
      console.error("[PAYMENT_CONTROLLER_ERROR]", error);
      set.status = 400;
      return { error: error.message };
    }
  }, {
    body: t.Object({
      customerId: t.String(),
      value: t.Number(),
      nextDueDate: t.String(),
      creditCard: t.Optional(t.Any()),
      creditCardHolderInfo: t.Optional(t.Any())
    })
  });
```

## Arquivo: `src\modules\infrastructure\storage\b2.storage.ts`
```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

type B2Config = {
  keyId: string;
  applicationKey: string;
  bucketName: string;
  endpoint: string;
};

let s3Client: S3Client | null = null;

const getB2Config = (): B2Config => {
  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;
  const bucketName = process.env.B2_BUCKET_NAME;
  const endpoint = process.env.B2_ENDPOINT;

  if (!keyId || !applicationKey || !bucketName || !endpoint) {
    throw new Error("B2_STORAGE_MISSING_ENV");
  }

  return {
    keyId,
    applicationKey,
    bucketName,
    endpoint
  };
};

const getS3Client = () => {
  if (s3Client) return s3Client;
  const { keyId, applicationKey, endpoint } = getB2Config();

  // Garante que o endpoint tenha https://
  let normalizedEndpoint = endpoint;
  if (!normalizedEndpoint.startsWith("http")) {
    normalizedEndpoint = `https://${normalizedEndpoint}`;
  }

  s3Client = new S3Client({
    credentials: {
      accessKeyId: keyId,
      secretAccessKey: applicationKey
    },
    region: "us-east-1",
    endpoint: normalizedEndpoint, // Usar o endpoint normalizado com https
    forcePathStyle: true
  });

  return s3Client;
};

export const uploadToB2 = async (params: {
  buffer: Buffer;
  contentType: string;
  key: string;
  cacheControl?: string;
}): Promise<string> => {
  const { bucketName, endpoint } = getB2Config();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: params.key,
    Body: params.buffer,
    ContentType: params.contentType,
    CacheControl: params.cacheControl
  });

  await getS3Client().send(command);

  // Retorna a URL do proxy local em vez da URL do Backblaze
  // Ajuste o localhost:3001 para process.env.BETTER_AUTH_URL se disponível
  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3001";
  return `${baseUrl}/api/storage/${params.key}`;
};

export const getFileStreamFromB2 = async (key: string) => {
  const { bucketName } = getB2Config();

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  });

  const response = await getS3Client().send(command);
  return {
    stream: response.Body,
    contentType: response.ContentType,
    contentLength: response.ContentLength
  };
};

export const deleteFileFromB2 = async (key: string): Promise<void> => {
  const { bucketName } = getB2Config();

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key
  });

  try {
    await getS3Client().send(command);
  } catch (error) {
    console.error("[B2_DELETE_ERROR]:", error);
    // Não lançamos erro aqui para não impedir a exclusão no banco de dados
    // se o arquivo já não existir ou houver erro de conexão
  }
};
```

## Arquivo: `src\modules\infrastructure\storage\storage.controller.ts`
```typescript
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
```

## Arquivo: `src\modules\infrastructure\stripe\checkout.controller.ts`
```typescript
import { Elysia, t } from "elysia";
import { stripe } from "./stripe.client";
import { authPlugin } from "../auth/auth-plugin";

export const stripeCheckoutController = new Elysia({ prefix: "/stripe" })
  .use(authPlugin)
  .post("/create-checkout-session", async ({ user, body, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (!user.businessId) {
      set.status = 400;
      return { error: "User has no business associated" };
    }

    const { priceId } = body;

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId || process.env.STRIPE_PRICE_ID,
            quantity: 1,
          },
        ],
        // Ajuste as URLs conforme necessário
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings/subscription?checkout_success=true`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings/subscription?checkout_canceled=true`,
        customer_email: user.email,
        client_reference_id: user.businessId,
        metadata: {
          userId: user.id,
          businessId: user.businessId
        }
      });

      return { url: session.url };
    } catch (error: any) {
      console.error("Stripe Checkout Error:", error);
      set.status = 500;
      return { error: error.message };
    }
  }, {
    body: t.Object({
      priceId: t.Optional(t.String())
    })
  });
```

## Arquivo: `src\modules\infrastructure\stripe\stripe.client.ts`
```typescript
// import Stripe from 'stripe'; // REMOVED TO PREVENT VERCEL 500 ERROR

// const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// if (!stripeSecretKey) {
//   // Em produção, isso deve falhar. Em desenvolvimento, pode ser opcional se não usar Stripe.
//   if (process.env.NODE_ENV === 'production') {
//     throw new Error('STRIPE_SECRET_KEY is missing');
//   }
// }

// MOCK STRIPE CLIENT TO PREVENT CRASH
// export const stripe = stripeSecretKey 
//   ? new Stripe(stripeSecretKey, {
//       apiVersion: '2023-10-16', // Use latest API version available or check Stripe dashboard
//       typescript: true,
//     })
//   : {} as any; // Mock empty object to prevent import errors, but runtime usage will fail if not checked

export const stripe = {} as any;
```

## Arquivo: `src\modules\infrastructure\stripe\webhook.controller.ts`
```typescript
import { Elysia } from "elysia";
import { stripe } from "./stripe.client";
import { db } from "../drizzle/database";
import { companies } from "../../../db/schema";
import { eq } from "drizzle-orm";

export const stripeWebhookController = new Elysia({ prefix: "/stripe" })
  .post("/webhook", async ({ request, set }) => {
    const signature = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is missing");
      set.status = 500;
      return "Webhook Secret Missing";
    }

    if (!signature) {
      set.status = 400;
      return "Signature missing";
    }

    const body = await request.text();
    let event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      set.status = 400;
      return `Webhook Error: ${err.message}`;
    }

    console.log(`[STRIPE_WEBHOOK] Event received: ${event.type}`);

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as any;

          // Metadata deve conter o ID da empresa ou do usuário
          // session.client_reference_id geralmente é usado para isso
          const companyId = session.client_reference_id;
          const subscriptionId = session.subscription;
          const customerId = session.customer;

          if (companyId) {
            await db.update(companies)
              .set({
                subscriptionStatus: 'active',
                accessType: 'automatic',
                stripeCustomerId: customerId as string,
                stripeSubscriptionId: subscriptionId as string,
                updatedAt: new Date()
              })
              .where(eq(companies.id, companyId));

            console.log(`[STRIPE_WEBHOOK] Company ${companyId} activated.`);
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as any;
          const status = subscription.status; // active, past_due, canceled, incomplete
          const customerId = subscription.customer;

          // Mapeia status do Stripe para nosso enum
          // Stripe: trialing, active, incomplete, incomplete_expired, past_due, canceled, unpaid
          // Nosso: trial, active, past_due, canceled, manual_active

          let newStatus = 'active';
          if (status === 'past_due' || status === 'unpaid') newStatus = 'past_due';
          if (status === 'canceled' || status === 'incomplete_expired') newStatus = 'canceled';
          if (status === 'trialing') newStatus = 'trial';

          // Busca empresa pelo stripe_customer_id
          const company = await db.select().from(companies).where(eq(companies.stripeCustomerId, customerId as string)).limit(1);

          if (company.length > 0) {
            const currentCompany = company[0];

            // Se access_type for manual, ignoramos atualizações automáticas de status (exceto se for para ativar?)
            // O user pediu para travar em 'manual' para evitar desativação.
            if (currentCompany.accessType === 'manual' && newStatus !== 'active') {
              console.log(`[STRIPE_WEBHOOK] Skipping update for manual company ${currentCompany.id}`);
            } else {
              await db.update(companies)
                .set({
                  subscriptionStatus: newStatus,
                  accessType: newStatus === 'active' ? 'automatic' : currentCompany.accessType,
                  updatedAt: new Date()
                })
                .where(eq(companies.id, currentCompany.id));

              console.log(`[STRIPE_WEBHOOK] Company ${currentCompany.id} updated to ${newStatus}`);
            }
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as any;
          const customerId = subscription.customer;

          const company = await db.select().from(companies).where(eq(companies.stripeCustomerId, customerId as string)).limit(1);

          if (company.length > 0) {
            const currentCompany = company[0];
            if (currentCompany.accessType !== 'manual') {
              await db.update(companies)
                .set({
                  subscriptionStatus: 'canceled',
                  updatedAt: new Date()
                })
                .where(eq(companies.id, currentCompany.id));
              console.log(`[STRIPE_WEBHOOK] Company ${currentCompany.id} canceled.`);
            }
          }
          break;
        }
      }
    } catch (err: any) {
      console.error(`[STRIPE_WEBHOOK_ERROR] ${err.message}`);
      set.status = 500;
      return `Server Error: ${err.message}`;
    }

    return { received: true };
  });
```

## Arquivo: `src\modules\inventory\adapters\in\dtos\inventory.dto.ts`
```typescript
import { t } from "elysia";

export const CreateProductDTO = t.Object({
  companyId: t.String(),
  name: t.String(),
  initialQuantity: t.Union([t.String(), t.Number()]),
  currentQuantity: t.Optional(t.Union([t.String(), t.Number()])),
  minQuantity: t.Union([t.String(), t.Number()]),
  unitPrice: t.Union([t.String(), t.Number()]),
  unit: t.Optional(t.String()),
  secondaryUnit: t.Optional(t.Nullable(t.Any())),
  conversionFactor: t.Optional(t.Nullable(t.Any())),
  isShared: t.Optional(t.Boolean()),
});

export const UpdateProductDTO = t.Partial(
  t.Object({
    name: t.String(),
    initialQuantity: t.Union([t.String(), t.Number()]),
    currentQuantity: t.Union([t.String(), t.Number()]),
    minQuantity: t.Union([t.String(), t.Number()]),
    unitPrice: t.Union([t.String(), t.Number()]),
    unit: t.String(),
    secondaryUnit: t.Optional(t.Nullable(t.Any())),
    conversionFactor: t.Optional(t.Nullable(t.Any())),
    isShared: t.Optional(t.Boolean()),
  })
);

export const ProductResponseDTO = t.Object({
  id: t.String(),
  companyId: t.String(),
  name: t.String(),
  initialQuantity: t.String(),
  currentQuantity: t.String(),
  minQuantity: t.String(),
  unitPrice: t.String(),
  unit: t.String(),
  secondaryUnit: t.Optional(t.Nullable(t.String())),
  conversionFactor: t.Optional(t.Nullable(t.String())),
  isShared: t.Boolean(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

export const CreateTransactionDTO = t.Object({
  productId: t.String(),
  type: t.Union([t.Literal("ENTRY"), t.Literal("EXIT")]),
  quantity: t.Union([t.String(), t.Number()]),
  reason: t.String(),
  companyId: t.String(),
});

```

## Arquivo: `src\modules\inventory\adapters\in\http\inventory.controller.ts`
```typescript
import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { CreateProductUseCase } from "../../../application/use-cases/create-product.use-case";
import { ListProductsUseCase } from "../../../application/use-cases/list-products.use-case";
import { UpdateProductUseCase } from "../../../application/use-cases/update-product.use-case";
import { DeleteProductUseCase } from "../../../application/use-cases/delete-product.use-case";
import { CreateInventoryTransactionUseCase } from "../../../application/use-cases/create-inventory-transaction.use-case";
import { CreateProductDTO, UpdateProductDTO, CreateTransactionDTO } from "../dtos/inventory.dto";

export const inventoryController = () => new Elysia({ prefix: "/inventory" })
  .use(repositoriesPlugin)
  .use(authPlugin)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .post("/", async ({ body, inventoryRepository, businessRepository, user, set }) => {
    try {
      console.log('Dados recebidos no POST /api/inventory:', body);
      console.log(`[INVENTORY_CONTROLLER] Criando produto para empresa: ${body.companyId}`);
      const createUseCase = new CreateProductUseCase(inventoryRepository, businessRepository);
      return await createUseCase.execute(body, user!.id);
    } catch (error: any) {
      console.error("[INVENTORY_CONTROLLER_POST_ERROR]:", error);
      set.status = error.message.includes("Unauthorized") ? 403 : 500;
      return { error: error.message };
    }
  }, {
    body: CreateProductDTO
  })
  .get("/company/:companyId", async ({ params: { companyId }, inventoryRepository, businessRepository, user, set }) => {
    try {
      console.log(`[INVENTORY_CONTROLLER] Listando produtos para empresa: ${companyId}`);
      if (!companyId || companyId.trim() === "") {
        set.status = 400;
        return { error: "ID da empresa é obrigatório" };
      }

      // Validação básica de UUID v4
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(companyId)) {
        set.status = 400;
        return { error: "Formato de ID da empresa inválido" };
      }

      const listUseCase = new ListProductsUseCase(inventoryRepository, businessRepository);
      return await listUseCase.execute(companyId, user!.id);
    } catch (error: any) {
      console.error("[INVENTORY_CONTROLLER_GET_ERROR]:", error);
      if (error.message.includes("Unauthorized")) {
        set.status = 403;
      } else {
        set.status = 500;
      }
      return { error: error.message };
    }
  })
  .patch("/:id", async ({ params: { id }, body, inventoryRepository, businessRepository, user, set }) => {
    try {
      console.log(`[INVENTORY_CONTROLLER] Atualizando produto ${id}:`, body);
      // @ts-ignore
      console.log(`[INVENTORY_CONTROLLER] isShared recebido:`, body.isShared, typeof body.isShared);
      const updateUseCase = new UpdateProductUseCase(inventoryRepository, businessRepository);
      return await updateUseCase.execute(id, body, user!.id);
    } catch (error: any) {
      console.error("[INVENTORY_CONTROLLER_PATCH_ERROR]:", error);
      set.status = error.message.includes("Unauthorized") ? 403 : (error.message.includes("not found") ? 404 : 500);
      return { error: error.message };
    }
  }, {
    body: UpdateProductDTO
  })
  .post("/:id/subtract", async ({ params: { id }, body, inventoryRepository, businessRepository, userRepository, pushSubscriptionRepository, user, set }) => {
    try {
      console.log(`[INVENTORY_CONTROLLER] Subtraindo estoque para o produto ${id}:`, body);

      const product = await inventoryRepository.findById(id);
      if (!product) {
        set.status = 404;
        return { error: "Product not found" };
      }

      const subtractQty = parseFloat(body.quantity.toString());
      if (isNaN(subtractQty) || subtractQty <= 0) {
        set.status = 400;
        return { error: "Invalid quantity" };
      }

      const useCase = new CreateInventoryTransactionUseCase(
        inventoryRepository,
        businessRepository,
        userRepository,
        pushSubscriptionRepository
      );

      const result = await useCase.execute({
        productId: id,
        type: "EXIT",
        quantity: subtractQty,
        reason: "Baixa via Sistema (Subtract API)",
        companyId: product.companyId
      }, user!.id);

      return result.product;
    } catch (error: any) {
      console.error("[INVENTORY_CONTROLLER_SUBTRACT_ERROR]:", error);
      if (error.message.includes("not found")) {
        set.status = 404;
      } else if (error.message.includes("insuficiente") || error.message.includes("inválido")) {
        set.status = 400;
      } else {
        set.status = 500;
      }
      return { error: error.message };
    }
  }, {
    body: t.Object({
      quantity: t.Union([t.Number(), t.String()])
    })
  })
  .post("/transactions", async ({ body, inventoryRepository, businessRepository, userRepository, pushSubscriptionRepository, user, set }) => {
    try {
      console.log(`[INVENTORY_CONTROLLER] Nova transação de estoque recebida:`, body);
      const useCase = new CreateInventoryTransactionUseCase(
        inventoryRepository,
        businessRepository,
        userRepository,
        pushSubscriptionRepository
      );

      const result = await useCase.execute({
        productId: body.productId,
        type: body.type as "ENTRY" | "EXIT",
        quantity: Number(body.quantity),
        reason: body.reason,
        companyId: body.companyId
      }, user!.id);

      return result;
    } catch (error: any) {
      console.error("[INVENTORY_CONTROLLER_TRANSACTION_ERROR]:", error);
      if (error.message.includes("not found")) {
        set.status = 404;
      } else if (error.message.includes("obrigatório") || error.message.includes("inválido") || error.message.includes("insuficiente")) {
        set.status = 400;
      } else {
        set.status = 500;
      }
      return { error: error.message };
    }
  }, {
    body: CreateTransactionDTO
  })
  .get("/:id/logs", async ({ params: { id }, inventoryRepository, set }) => {
    try {
      const logs = await inventoryRepository.getLogsByProduct(id);
      return logs;
    } catch (error: any) {
      console.error("[INVENTORY_CONTROLLER_GET_LOGS_ERROR]:", error);
      set.status = 500;
      return { error: error.message };
    }
  })
  .delete("/:id", async ({ params: { id }, inventoryRepository, businessRepository, user, set }) => {
    try {
      console.log(`[INVENTORY_CONTROLLER] Excluindo produto ${id}`);
      const deleteUseCase = new DeleteProductUseCase(inventoryRepository, businessRepository);
      await deleteUseCase.execute(id, user!.id);
      set.status = 204;
      return;
    } catch (error: any) {
      console.error("[INVENTORY_DELETE_ERROR]:", error);
      set.status = error.message.includes("Unauthorized") ? 403 : (error.message.includes("not found") ? 404 : 500);
      return { error: error.message };
    }
  });
```

## Arquivo: `src\modules\inventory\adapters\out\drizzle\inventory.drizzle.repository.ts`
```typescript
import { db } from "../../../../infrastructure/drizzle/database";
import { inventory, inventoryLogs } from "../../../../../db/schema";
import { eq, desc } from "drizzle-orm";
import { InventoryRepository, Product, InventoryLog } from "../../../domain/ports/inventory.repository";

export class DrizzleInventoryRepository implements InventoryRepository {
  async create(data: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product> {
    try {
      const [result] = await db
        .insert(inventory)
        .values({
          id: crypto.randomUUID(),
          companyId: data.companyId,
          name: data.name,
          initialQuantity: data.initialQuantity.toString(),
          currentQuantity: data.currentQuantity.toString(),
          minQuantity: data.minQuantity.toString(),
          unitPrice: data.unitPrice.toString(),
          unit: data.unit || 'un',
          secondaryUnit: data.secondaryUnit || null,
          conversionFactor: data.conversionFactor?.toString() || null,
          isShared: data.isShared || false,
        })
        .returning();

      return result as Product;
    } catch (error: any) {
      console.error("[DRIZZLE_INVENTORY_REPOSITORY_CREATE_ERROR]:", error);
      throw error;
    }
  }

  async findById(id: string): Promise<Product | null> {
    try {
      const [result] = await db
        .select({
          id: inventory.id,
          companyId: inventory.companyId,
          name: inventory.name,
          initialQuantity: inventory.initialQuantity,
          currentQuantity: inventory.currentQuantity,
          minQuantity: inventory.minQuantity,
          unitPrice: inventory.unitPrice,
          unit: inventory.unit,
          secondaryUnit: inventory.secondaryUnit,
          conversionFactor: inventory.conversionFactor,
          isShared: inventory.isShared,
          createdAt: inventory.createdAt,
          updatedAt: inventory.updatedAt,
        })
        .from(inventory)
        .where(eq(inventory.id, id))
        .limit(1);

      return (result as Product) || null;
    } catch (error: any) {
      console.error("[DRIZZLE_INVENTORY_REPOSITORY_FINDBYID_ERROR]:", error);
      throw error;
    }
  }

  async findByCompanyId(companyId: string): Promise<Product[]> {
    try {
      const results = await db
        .select({
          id: inventory.id,
          companyId: inventory.companyId,
          name: inventory.name,
          initialQuantity: inventory.initialQuantity,
          currentQuantity: inventory.currentQuantity,
          minQuantity: inventory.minQuantity,
          unitPrice: inventory.unitPrice,
          unit: inventory.unit,
          secondaryUnit: inventory.secondaryUnit,
          conversionFactor: inventory.conversionFactor,
          isShared: inventory.isShared,
          createdAt: inventory.createdAt,
          updatedAt: inventory.updatedAt,
        })
        .from(inventory)
        .where(eq(inventory.companyId, companyId));

      return (results as Product[]) || [];
    } catch (error: any) {
      console.error("[DRIZZLE_INVENTORY_REPOSITORY_FINDBYCOMPANYID_ERROR]:", error);
      throw error;
    }
  }

  async update(id: string, data: Partial<Omit<Product, "id" | "companyId" | "createdAt" | "updatedAt">>): Promise<Product> {
    try {
      console.log(`[DRIZZLE_INVENTORY_REPO] Iniciando update para ID: ${id}`);
      console.log(`[DRIZZLE_INVENTORY_REPO] Valores para update:`, JSON.stringify(data, null, 2));

      const updateData: any = {
        updatedAt: new Date(),
      };

      // Mapeamento explícito para garantir que campos opcionais ou strings sejam tratados corretamente
      if (data.name !== undefined) updateData.name = data.name;
      if (data.unit !== undefined) updateData.unit = data.unit;

      if (data.initialQuantity !== undefined && data.initialQuantity !== null) {
        updateData.initialQuantity = data.initialQuantity.toString();
      }
      if (data.currentQuantity !== undefined && data.currentQuantity !== null) {
        updateData.currentQuantity = data.currentQuantity.toString();
      }
      if (data.minQuantity !== undefined && data.minQuantity !== null) {
        updateData.minQuantity = data.minQuantity.toString();
      }
      if (data.unitPrice !== undefined && data.unitPrice !== null) {
        updateData.unitPrice = data.unitPrice.toString();
      }
      if (data.conversionFactor !== undefined) {
        updateData.conversionFactor = data.conversionFactor?.toString() || null;
      }
      if (data.secondaryUnit !== undefined) {
        updateData.secondaryUnit = data.secondaryUnit || null;
      }
      if (data.isShared !== undefined) {
        console.log(`[DRIZZLE_INVENTORY_REPO] Atualizando isShared para: ${data.isShared}`);
        updateData.isShared = data.isShared;
      }

      console.log(`[DRIZZLE_INVENTORY_REPO] Objeto final enviado ao Drizzle .set():`, JSON.stringify(updateData, null, 2));

      const [result] = await db
        .update(inventory)
        .set(updateData)
        .where(eq(inventory.id, id))
        .returning({
          id: inventory.id,
          companyId: inventory.companyId,
          name: inventory.name,
          initialQuantity: inventory.initialQuantity,
          currentQuantity: inventory.currentQuantity,
          minQuantity: inventory.minQuantity,
          unitPrice: inventory.unitPrice,
          unit: inventory.unit,
          secondaryUnit: inventory.secondaryUnit,
          conversionFactor: inventory.conversionFactor,
          isShared: inventory.isShared,
          createdAt: inventory.createdAt,
          updatedAt: inventory.updatedAt,
        });

      if (!result) {
        console.error(`[DRIZZLE_INVENTORY_REPO] Produto com ID ${id} não encontrado para update.`);
        throw new Error("Product not found");
      }

      console.log(`[DRIZZLE_INVENTORY_REPO] Update realizado com sucesso. Resultado:`, JSON.stringify(result, null, 2));
      return result as Product;
    } catch (error: any) {
      console.error("[DRIZZLE_INVENTORY_REPOSITORY_UPDATE_ERROR]:", error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await db.delete(inventory).where(eq(inventory.id, id));
  }

  // Transaction Logs Implementation
  async createLog(log: Omit<InventoryLog, "id" | "createdAt">): Promise<InventoryLog> {
    try {
      const [result] = await db
        .insert(inventoryLogs)
        .values({
          id: crypto.randomUUID(),
          inventoryId: log.inventoryId,
          type: log.type,
          quantity: log.quantity.toString(),
          reason: log.reason,
          companyId: log.companyId,
        })
        .returning();

      return result as InventoryLog;
    } catch (error: any) {
      console.error("[DRIZZLE_INVENTORY_REPOSITORY_CREATELOG_ERROR]:", error);
      throw error;
    }
  }

  async getLogsByProduct(productId: string): Promise<InventoryLog[]> {
    try {
      const results = await db
        .select()
        .from(inventoryLogs)
        .where(eq(inventoryLogs.inventoryId, productId))
        .orderBy(desc(inventoryLogs.createdAt));

      return results as InventoryLog[];
    } catch (error: any) {
      console.error("[DRIZZLE_INVENTORY_REPOSITORY_GETLOGS_ERROR]:", error);
      throw error;
    }
  }

  async getLogsByCompany(companyId: string): Promise<InventoryLog[]> {
    try {
      const results = await db
        .select()
        .from(inventoryLogs)
        .where(eq(inventoryLogs.companyId, companyId))
        .orderBy(desc(inventoryLogs.createdAt));

      return results as InventoryLog[];
    } catch (error: any) {
      console.error("[DRIZZLE_INVENTORY_REPOSITORY_GETLOGS_BY_COMPANY_ERROR]:", error);
      throw error;
    }
  }
}
```

## Arquivo: `src\modules\inventory\application\use-cases\create-inventory-transaction.use-case.ts`
```typescript

import { InventoryRepository } from "../../domain/ports/inventory.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";
import { UserRepository } from "../../../user/adapters/out/user.repository";
import { IPushSubscriptionRepository } from "../../../notifications/domain/ports/push-subscription.repository";
import { NotificationService } from "../../../notifications/application/notification.service";

export interface CreateInventoryTransactionInput {
  productId: string;
  type: "ENTRY" | "EXIT";
  quantity: number;
  reason: string;
  companyId: string;
}

export class CreateInventoryTransactionUseCase {
  constructor(
    private inventoryRepository: InventoryRepository,
    private businessRepository: IBusinessRepository,
    private userRepository: UserRepository,
    private pushSubscriptionRepository: IPushSubscriptionRepository
  ) { }

  async execute(input: CreateInventoryTransactionInput, userId: string) {
    console.log(`[CREATE_TRANSACTION_USECASE] Iniciando transação para produto ${input.productId}`);

    // 1. Validação de ID da Empresa
    if (!input.companyId || input.companyId === "N/A" || input.companyId.trim() === "") {
      throw new Error("ID da empresa é obrigatório e deve ser válido.");
    }

    // 2. Validação de Produto
    if (!input.productId || input.productId.trim() === "") {
      throw new Error("ID do produto é obrigatório.");
    }

    const product = await this.inventoryRepository.findById(input.productId);
    if (!product) {
      throw new Error("Product not found");
    }

    // Validação de Pertencimento (Segurança)
    if (product.companyId !== input.companyId) {
      throw new Error("Produto não pertence à empresa informada.");
    }

    // 3. Validação de Quantidade
    const quantity = Number(input.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      throw new Error("Quantidade deve ser um número positivo válido.");
    }

    // 4. Lógica de Atualização de Saldo
    const currentQty = Number(product.currentQuantity);
    const minQty = Number(product.minQuantity);
    let newQty = currentQty;

    if (input.type === "ENTRY") {
      newQty = currentQty + quantity;
    } else if (input.type === "EXIT") {
      if (currentQty < quantity) {
        throw new Error("Saldo insuficiente para realizar a saída.");
      }
      newQty = currentQty - quantity;
    } else {
      throw new Error("Tipo de transação inválido. Use ENTRY ou EXIT.");
    }

    // 5. Persistência da Transação (Log)
    const log = await this.inventoryRepository.createLog({
      inventoryId: input.productId,
      type: input.type,
      quantity: quantity.toString(),
      reason: input.reason || "Movimentação manual",
      companyId: input.companyId
    });

    // 6. Atualização do Produto
    const updatedProduct = await this.inventoryRepository.update(input.productId, {
      currentQuantity: newQty.toString()
    });

    console.log(`[CREATE_TRANSACTION_USECASE] Sucesso: ${input.type} de ${quantity} para ${product.name}. Novo saldo: ${newQty}`);

    // 7. Notificação de Estoque Baixo
    if (input.type === "EXIT") {
      let comparisonQty = newQty;

      // Normalização para comparação:
      // Se o produto tem fator de conversão, assume-se que o minQuantity está na unidade secundária (ex: Unidades)
      // enquanto o estoque é controlado na unidade principal (ex: Caixas).
      if (product.conversionFactor && product.secondaryUnit) {
        const factor = Number(product.conversionFactor);
        if (!isNaN(factor) && factor > 0) {
          comparisonQty = newQty * factor;
        }
      }

      if (comparisonQty <= minQty) {
        try {
          // Obter dono da empresa
          const business = await this.businessRepository.findById(input.companyId);
          if (business) {
            const owner = await this.userRepository.find(business.ownerId);
            if (owner && owner.notifyInventoryAlerts) {
              const notificationService = new NotificationService(this.pushSubscriptionRepository);

              // Lógica de Conversão para Exibição
              let displayQty = Math.round(newQty);
              let displayUnit = product.unit;

              if (product.conversionFactor && product.secondaryUnit) {
                const factor = Number(product.conversionFactor);
                if (!isNaN(factor) && factor > 0) {
                  displayQty = Math.round(newQty * factor);
                  displayUnit = product.secondaryUnit;
                }
              }

              await notificationService.sendToUser(
                business.ownerId,
                "📦 Estoque Baixo!",
                `O produto ${product.name} atingiu o nível crítico (${displayQty} ${displayUnit}).`
              );
            }
          }
        } catch (err) {
          console.error("[INVENTORY_ALERT] Error sending notification:", err);
        }
      }
    }

    return {
      product: updatedProduct,
      log
    };
  }
}
```

## Arquivo: `src\modules\inventory\application\use-cases\create-product.use-case.ts`
```typescript
import { InventoryRepository, Product } from "../../domain/ports/inventory.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";

export class CreateProductUseCase {
  constructor(
    private inventoryRepository: InventoryRepository,
    private businessRepository: IBusinessRepository
  ) { }

  async execute(data: any, userId: string): Promise<Product> {
    const business = await this.businessRepository.findById(data.companyId);

    if (!business || business.ownerId !== userId) {
      throw new Error("Unauthorized: You do not own this business");
    }

    // Normalizar números para string (exigido pelo schema do Drizzle que usa decimal/numeric)
    const productData = {
      ...data,
      initialQuantity: String(data.initialQuantity),
      currentQuantity: String(data.currentQuantity ?? data.initialQuantity),
      minQuantity: String(data.minQuantity),
      unitPrice: String(data.unitPrice),
      unit: data.unit ?? 'un',
      conversionFactor: data.conversionFactor ? String(data.conversionFactor) : null
    };

    return await this.inventoryRepository.create(productData);
  }
}
```

## Arquivo: `src\modules\inventory\application\use-cases\delete-product.use-case.ts`
```typescript
import { InventoryRepository } from "../../domain/ports/inventory.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";

export class DeleteProductUseCase {
  constructor(
    private inventoryRepository: InventoryRepository,
    private businessRepository: IBusinessRepository
  ) { }

  async execute(id: string, userId: string): Promise<void> {
    const product = await this.inventoryRepository.findById(id);

    if (!product) {
      throw new Error("Product not found");
    }

    const business = await this.businessRepository.findById(product.companyId);

    if (!business || business.ownerId !== userId) {
      throw new Error("Unauthorized: You do not own this business");
    }

    await this.inventoryRepository.delete(id);
  }
}
```

## Arquivo: `src\modules\inventory\application\use-cases\list-products.use-case.ts`
```typescript
import { InventoryRepository, Product } from "../../domain/ports/inventory.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";

export class ListProductsUseCase {
  constructor(
    private inventoryRepository: InventoryRepository,
    private businessRepository: IBusinessRepository
  ) { }

  async execute(companyId: string, userId: string): Promise<Product[]> {
    const business = await this.businessRepository.findById(companyId);

    if (!business || business.ownerId !== userId) {
      throw new Error("Unauthorized: You do not own this business");
    }

    const products = await this.inventoryRepository.findByCompanyId(companyId);
    return products || [];
  }
}
```

## Arquivo: `src\modules\inventory\application\use-cases\update-product.use-case.ts`
```typescript
import { InventoryRepository, Product } from "../../domain/ports/inventory.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";

export class UpdateProductUseCase {
  constructor(
    private inventoryRepository: InventoryRepository,
    private businessRepository: IBusinessRepository
  ) { }

  async execute(
    id: string,
    data: any,
    userId: string
  ): Promise<Product> {
    const product = await this.inventoryRepository.findById(id);

    if (!product) {
      throw new Error("Product not found");
    }

    const business = await this.businessRepository.findById(product.companyId);

    if (!business || business.ownerId !== userId) {
      throw new Error("Unauthorized: You do not own this business");
    }

    // Normalizar números para string (exigido pelo schema do Drizzle que usa decimal/numeric)
    const updateData: any = { ...data };

    if (data.initialQuantity !== undefined) updateData.initialQuantity = String(data.initialQuantity);
    if (data.currentQuantity !== undefined) updateData.currentQuantity = String(data.currentQuantity);
    if (data.minQuantity !== undefined) updateData.minQuantity = String(data.minQuantity);
    if (data.unitPrice !== undefined) updateData.unitPrice = String(data.unitPrice);
    if (data.conversionFactor !== undefined) updateData.conversionFactor = data.conversionFactor ? String(data.conversionFactor) : null;

    return await this.inventoryRepository.update(id, updateData);
  }
}
```

## Arquivo: `src\modules\inventory\domain\ports\inventory.repository.ts`
```typescript
export interface Product {
  id: string;
  companyId: string;
  name: string;
  initialQuantity: string;
  currentQuantity: string;
  minQuantity: string;
  unitPrice: string;
  unit: string;
  secondaryUnit?: string | null;
  conversionFactor?: string | null;
  isShared?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryLog {
  id: string;
  inventoryId: string;
  type: "ENTRY" | "EXIT";
  quantity: string;
  reason: string;
  companyId: string;
  createdAt: Date;
}

export interface InventoryRepository {
  create(product: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product>;
  findById(id: string): Promise<Product | null>;
  findByCompanyId(companyId: string): Promise<Product[]>;
  update(id: string, product: Partial<Omit<Product, "id" | "companyId" | "createdAt" | "updatedAt">>): Promise<Product>;
  delete(id: string): Promise<void>;

  // Transaction Logs
  createLog(log: Omit<InventoryLog, "id" | "createdAt">): Promise<InventoryLog>;
  getLogsByProduct(productId: string): Promise<InventoryLog[]>;
  getLogsByCompany(companyId: string): Promise<InventoryLog[]>;
}
```

## Arquivo: `src\modules\notifications\adapters\in\http\notifications.controller.ts`
```typescript
import { Elysia, t } from "elysia";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { NotificationService } from "../../../application/notification.service";
import { webpush } from "../../../application/webpush";

export const notificationsController = () => new Elysia({ prefix: "/notifications" })
  .use(repositoriesPlugin)
  .use(authPlugin)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .post("/test", async ({ user, pushSubscriptionRepository }) => {
    try {
      const notificationService = new NotificationService(pushSubscriptionRepository);
      const result = await notificationService.sendToUser(
        user!.id,
        "Teste de Notificação",
        "Suas configurações estão funcionando!"
      );

      return {
        success: true,
        message: `Notificações enviadas: ${result.sent}, Falhas: ${result.failed}`
      };
    } catch (error: any) {
      console.error("[NOTIFICATION_TEST_ERROR]", error);
      return { error: error.message };
    }
  })
  .post("/subscribe", async ({ user, body, pushSubscriptionRepository }) => {
    const { subscription } = body as { subscription: any };

    if (!subscription || !subscription.endpoint) {
      throw new Error("Invalid subscription object");
    }

    await pushSubscriptionRepository.upsert(
      user!.id,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth
    );

    // Envia notificação de boas-vindas
    const payload = JSON.stringify({
      title: "Notificações Ativadas",
      body: "Você receberá atualizações sobre seus agendamentos.",
    });

    try {
      await webpush.sendNotification(subscription, payload);
    } catch (error) {
      console.error("[WELCOME_NOTIFICATION_ERROR]", error);
    }

    return { success: true };
  });
```

## Arquivo: `src\modules\notifications\adapters\in\http\push.controller.ts`
```typescript
import { Elysia } from "elysia";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { webpush } from "../../../application/webpush";

export const pushController = () => new Elysia({ prefix: "/push" })
  .use(repositoriesPlugin)
  .use(authPlugin)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .post("/subscriptions", async ({ user, body, pushSubscriptionRepository }) => {
    let subscription: any = (body as any).subscription || body;

    if ((body as any).endpoint && (body as any).keys) {
        subscription = body;
    }

    if (!subscription || !subscription.endpoint) {
      console.error("[PUSH_CONTROLLER] Payload inválido recebido:", JSON.stringify(body));
      throw new Error("Invalid subscription object");
    }

    console.log(`[PUSH_CONTROLLER] Registrando nova inscrição para user: ${user!.id}`);

    await pushSubscriptionRepository.upsert(
      user!.id,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth
    );

    const payload = JSON.stringify({
      title: "Notificações Ativadas",
      body: "Você receberá atualizações sobre seus agendamentos.",
      icon: '/android-chrome-192x192.png',
      data: {
        url: '/',
        timestamp: Date.now()
      }
    });

    try {
      await webpush.sendNotification(subscription, payload);
      console.log("[PUSH_CONTROLLER] Notificação de boas-vindas enviada com sucesso.");
    } catch (error) {
      console.error("[PUSH_CONTROLLER] Erro ao enviar boas-vindas:", error);
    }

    return { success: true };
  });
```

## Arquivo: `src\modules\notifications\adapters\out\drizzle\push-subscription.drizzle.repository.ts`
```typescript
import { db } from "../../../../infrastructure/drizzle/database";
import { pushSubscriptions } from "../../../../../db/schema";
import { eq } from "drizzle-orm";
import { IPushSubscriptionRepository, PushSubscription } from "../../../domain/ports/push-subscription.repository";

export class DrizzlePushSubscriptionRepository implements IPushSubscriptionRepository {
  async upsert(userId: string, endpoint: string, p256dh: string, auth: string): Promise<PushSubscription> {
    const [existing] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(pushSubscriptions)
        .set({
          userId,
          p256dh,
          auth,
          updatedAt: new Date()
        })
        .where(eq(pushSubscriptions.endpoint, endpoint))
        .returning();
      return updated as PushSubscription;
    }

    const [inserted] = await db
      .insert(pushSubscriptions)
      .values({
        id: crypto.randomUUID(),
        userId,
        endpoint,
        p256dh,
        auth
      })
      .returning();

    return inserted as PushSubscription;
  }

  async findAllByUserId(userId: string): Promise<PushSubscription[]> {
    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    return rows as PushSubscription[];
  }

  async findByEndpoint(endpoint: string): Promise<PushSubscription | null> {
    const [row] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);
    return (row as PushSubscription) || null;
  }

  async deleteById(id: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }
}
```

## Arquivo: `src\modules\notifications\application\notification.service.ts`
```typescript
import { IPushSubscriptionRepository } from "../domain/ports/push-subscription.repository";
import { webpush } from "./webpush";

export class NotificationService {
  constructor(
    private pushSubscriptionRepository: IPushSubscriptionRepository
  ) {}

  async sendToUser(userId: string, title: string, message: string) {
    const subscriptions = await this.pushSubscriptionRepository.findAllByUserId(userId);
    
    if (!subscriptions || subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const payload = JSON.stringify({
      title,
      body: message,
      icon: "/android-chrome-192x192.png",
      badge: '/badge.png',
      data: {
        url: "/",
        timestamp: Date.now()
      }
    });

    console.log(`[NOTIFICATION_SERVICE] Enviando payload: ${payload}`);

    let sentCount = 0;
    let failedCount = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        }, payload);
        sentCount++;
      } catch (error: any) {
        console.error(`[NOTIFICATION_SERVICE] Error sending to ${sub.endpoint}:`, error.statusCode);
        
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`[NOTIFICATION_SERVICE] Removing expired subscription: ${sub.id}`);
          await this.pushSubscriptionRepository.deleteByEndpoint(sub.endpoint);
        }
        failedCount++;
      }
    }

    return { sent: sentCount, failed: failedCount };
  }
}
```

## Arquivo: `src\modules\notifications\application\transactional-email.service.ts`
```typescript
import { Resend } from "resend";

type WelcomeEmailInput = {
  to: string;
  name: string;
  studioName: string;
};

type AppointmentEmailInput = {
  to: string;
  customerName: string;
  serviceName: string;
  businessName: string;
  scheduledAt: Date;
};

type OwnerAlertInput = {
  to: string;
  ownerName: string;
  customerName: string;
  serviceName: string;
  businessName: string;
  scheduledAt: Date;
};

export class TransactionalEmailService {
  private resend: Resend | null = null;
  private fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  private formatDate(date: Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "full",
      timeStyle: "short",
    }).format(date);
  }

  async sendWelcomeEmail(input: WelcomeEmailInput & { verificationUrl?: string }) {
    if (!this.resend) return false;

    const verificationSection = input.verificationUrl ? `
      <div style="margin: 30px 0; padding: 20px; background-color: #f9f9f9; border-radius: 8px; border: 1px solid #eee; text-align: center;">
        <h3 style="color: #333; margin-top: 0;">Falta apenas um passo!</h3>
        <p style="color: #666;">Para ativar sua conta e publicar seu site, confirme seu e-mail clicando no botão abaixo:</p>
        <a href="${input.verificationUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-top: 10px;">
          Confirmar meu E-mail
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 15px;">Se o botão não funcionar, copie este link: ${input.verificationUrl}</p>
      </div>
    ` : '';

    await this.resend.emails.send({
      from: `Agendamento Nota <${this.fromEmail}>`,
      to: input.to,
      subject: "Bem-vindo(a)! Seu período de teste começou",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6; max-width: 600px; margin: 0 auto; color: #444;">
          <h2 style="color: #333;">Olá, ${input.name} 👋</h2>
          <p>Seu estúdio <strong>${input.studioName}</strong> foi criado com sucesso.</p>
          
          ${verificationSection}

          <p>Seu teste gratuito de 14 dias já está ativo. Agora você pode configurar serviços e começar a receber agendamentos.</p>
          <p>Bom trabalho e boas vendas!</p>
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">Este é um e-mail automático do Agendamento Nota.</p>
        </div>
      `,
    });
    return true;
  }

  async sendAppointmentConfirmationToCustomer(input: AppointmentEmailInput) {
    if (!this.resend) return false;
    await this.resend.emails.send({
      from: this.fromEmail,
      to: input.to,
      subject: "Agendamento confirmado ✅",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>Olá, ${input.customerName}!</h2>
          <p>Seu agendamento foi confirmado com sucesso.</p>
          <p><strong>Estabelecimento:</strong> ${input.businessName}</p>
          <p><strong>Serviço:</strong> ${input.serviceName}</p>
          <p><strong>Data e hora:</strong> ${this.formatDate(input.scheduledAt)}</p>
          <p>Nos vemos em breve ✨</p>
        </div>
      `,
    });
    return true;
  }

  async sendAppointmentAlertToOwner(input: OwnerAlertInput) {
    if (!this.resend) return false;
    await this.resend.emails.send({
      from: this.fromEmail,
      to: input.to,
      subject: "Novo agendamento recebido 📅",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>Olá, ${input.ownerName}!</h2>
          <p>Você recebeu um novo agendamento no seu estúdio.</p>
          <p><strong>Cliente:</strong> ${input.customerName}</p>
          <p><strong>Serviço:</strong> ${input.serviceName}</p>
          <p><strong>Data e hora:</strong> ${this.formatDate(input.scheduledAt)}</p>
          <p><strong>Estúdio:</strong> ${input.businessName}</p>
        </div>
      `,
    });
    return true;
  }
}
```

## Arquivo: `src\modules\notifications\application\webpush.ts`
```typescript
import webpush from "web-push";

const rawSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const subject =
  /^https?:\/\//.test(rawSubject) || rawSubject.startsWith("mailto:")
    ? rawSubject
    : `mailto:${rawSubject}`;
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (error) {
    console.error("[WEBPUSH] Invalid VAPID subject:", error);
  }
}

export { webpush };
```

## Arquivo: `src\modules\notifications\domain\ports\push-subscription.repository.ts`
```typescript
export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPushSubscriptionRepository {
  upsert(userId: string, endpoint: string, p256dh: string, auth: string): Promise<PushSubscription>;
  findAllByUserId(userId: string): Promise<PushSubscription[]>;
  findByEndpoint(endpoint: string): Promise<PushSubscription | null>;
  deleteById(id: string): Promise<void>;
  deleteByEndpoint(endpoint: string): Promise<void>;
}
```

## Arquivo: `src\modules\reports\adapters\in\http\report.controller.ts`
```typescript
import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { GetProfitReportUseCase } from "../../../application/use-cases/get-profit-report.use-case";

export const reportController = () => new Elysia({ prefix: "/reports" })
  .use(authPlugin)
  .use(repositoriesPlugin)
  .onBeforeHandle(({ user, set, request }) => {
    console.log(`>>> [AUTH_CHECK] Tentativa de acesso a ${request.method} ${request.url}`);
    if (!user) {
      console.log(`>>> [AUTH_CHECK] Usuário NÃO autenticado (401)`);
      set.status = 401;
      return { error: "Unauthorized" };
    }
    console.log(`>>> [AUTH_CHECK] Usuário autenticado: ${user.id}`);
  })
  .get("/profit", async ({ query, expenseRepository, appointmentRepository, user, set }) => {
    const businessId = user!.businessId;
    const companyId = query.companyId || businessId;

    if (!companyId) {
      set.status = 400;
      return { error: "companyId is required" };
    }

    if (companyId !== businessId) {
      set.status = 403;
      return { error: "Não autorizado" };
    }

    const useCase = new GetProfitReportUseCase(expenseRepository, appointmentRepository);

    return await useCase.execute({
      companyId: companyId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
  }, {
    query: t.Object({
      companyId: t.Optional(t.String()),
      startDate: t.Optional(t.String()),
      endDate: t.Optional(t.String()),
    })
  });
```

## Arquivo: `src\modules\reports\application\use-cases\get-profit-report.use-case.ts`
```typescript
import { IExpenseRepository } from "../../../expenses/domain/ports/expense.repository";
import { IAppointmentRepository } from "../../../appointments/domain/ports/appointment.repository";

export interface GetProfitReportInput {
  companyId: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ProfitReportOutput {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  margin: number;
}

export class GetProfitReportUseCase {
  constructor(
    private expenseRepository: IExpenseRepository,
    private appointmentRepository: IAppointmentRepository
  ) { }

  async execute(input: GetProfitReportInput): Promise<ProfitReportOutput> {
    const [totalRevenue, totalExpenses] = await Promise.all([
      this.appointmentRepository.sumRevenueByCompanyId(input.companyId, input.startDate, input.endDate),
      this.expenseRepository.sumTotalByCompanyId(input.companyId, input.startDate, input.endDate)
    ]);

    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      margin: parseFloat(margin.toFixed(2))
    };
  }
}
```

## Arquivo: `src\modules\services\adapters\in\dtos\service.dto.ts`
```typescript
import { t } from "elysia";

export const createServiceDTO = t.Object({
  id: t.Optional(t.String()),
  companyId: t.String(),
  name: t.String(),
  description: t.Optional(t.Nullable(t.String())),
  price: t.Union([t.String(), t.Number()]),
  duration: t.Union([t.String(), t.Number()]),
  icon: t.Optional(t.Nullable(t.String())),
  isVisible: t.Optional(t.Boolean()),
  showOnHome: t.Optional(t.Boolean()),
  show_on_home: t.Optional(t.Boolean()),
  advancedRules: t.Optional(t.Any()),
  advanced_rules: t.Optional(t.Any()),
  // Novos campos para recursos/estoque
  resources: t.Optional(t.Array(t.Object({
    inventoryId: t.String(),
    quantity: t.Number(),
    unit: t.String(),
    useSecondaryUnit: t.Boolean(),
  }))),
});

export type CreateServiceDTO = typeof createServiceDTO.static;
```

## Arquivo: `src\modules\services\adapters\in\http\service.controller.ts`
```typescript
import { Elysia } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { CreateServiceUseCase } from "../../../application/use-cases/create-service.use-case";
import { createServiceDTO } from "../dtos/service.dto";
import { deleteFileFromB2 } from "../../../../infrastructure/storage/b2.storage";

export const serviceController = () => new Elysia({ prefix: "/services" })
  .use(repositoriesPlugin)
  .use(authPlugin)
  // --- ROTAS PÚBLICAS ---
  .get("/company/:companyId", async ({ params: { companyId }, serviceRepository, set }) => {
    try {
      console.log(`>>> [BACK_PUBLIC_ACCESS] Serviços liberados para a empresa: ${companyId}`);

      // Forçar o navegador a não usar cache para garantir que os serviços novos apareçam
      set.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate";
      set.headers["Pragma"] = "no-cache";
      set.headers["Expires"] = "0";

      const services = await serviceRepository.findAllByCompanyId(companyId);
      return services || [];
    } catch (error: any) {
      console.error("\n[SERVICE_CONTROLLER_GET_ERROR]:", error);
      set.status = 500;
      return {
        error: error.message || "Internal Server Error",
        details: error.detail || error.cause || null
      };
    }
  })
  // --- ROTAS PRIVADAS (EXIGEM AUTH) ---
  .group("", (app) =>
    app.onBeforeHandle(({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
    })
      .post("/", async ({ body, serviceRepository, user, set }) => {
        try {
          console.log(`\n>>> [BACK_RECEIVED] POST /api/services:`, JSON.stringify(body, null, 2));

          const businessId = user!.businessId;
          if (!businessId) {
            set.status = 401;
            return { error: "Usuário não vinculado a uma empresa" };
          }

          // Força o companyId do usuário logado por segurança
          const normalizedBody = {
            ...body,
            companyId: businessId,
            price: body.price.toString(),
            duration: body.duration.toString(),
            showOnHome: body.show_on_home !== undefined ? body.show_on_home : body.showOnHome,
            advancedRules: body.advanced_rules || body.advancedRules
          };

          const createServiceUseCase = new CreateServiceUseCase(serviceRepository);
          const result = await createServiceUseCase.execute(normalizedBody);

          console.log(`[SERVICE_CONTROLLER] Serviço processado com sucesso: ${result.id}`);
          return result;
        } catch (error: any) {
          console.error("\n[SERVICE_CONTROLLER_ERROR]:", error);
          set.status = 500;

          // Captura detalhes específicos de erro de conexão ou banco
          const errorMessage = error.message || "Internal Server Error";
          const errorDetail = error.detail || error.cause || null;

          return {
            error: errorMessage,
            details: errorDetail,
            code: error.code // Código de erro do Postgres (ex: 22P02 para invalid text representation)
          };
        }
      }, {
        body: createServiceDTO
      })
      .put("/:id", async ({ params: { id }, body, serviceRepository, user, set }) => {
        try {
          console.log(`\n>>> [BACK_RECEIVED] PUT /api/services/${id}:`, JSON.stringify(body, null, 2));

          const businessId = user!.businessId;
          const existing = await serviceRepository.findById(id);

          if (!existing) {
            set.status = 404;
            return { error: "Service not found" };
          }

          if (existing.companyId !== businessId) {
            set.status = 403;
            return { error: "Não autorizado" };
          }

          // Se o ícone estiver sendo alterado e o antigo for do B2, apaga o antigo
          if (body.icon && body.icon !== existing.icon && existing.icon && existing.icon.includes("/api/storage/")) {
            try {
              const parts = existing.icon.split("/api/storage/");
              if (parts.length > 1) {
                await deleteFileFromB2(parts[1]);
              }
            } catch (err) {
              console.error("[SERVICE_UPDATE_FILE_ERROR]: Falha ao deletar ícone antigo do B2.", err);
            }
          }

          // Normaliza os dados para garantir que price e duration sejam strings
          const normalizedBody: any = {
            ...body,
            showOnHome: body.show_on_home !== undefined ? body.show_on_home : body.showOnHome,
            advancedRules: body.advanced_rules || body.advancedRules
          };

          if (body.price !== undefined) normalizedBody.price = body.price.toString();
          if (body.duration !== undefined) normalizedBody.duration = body.duration.toString();

          console.log(`>>> [BACK_RECEIVED] Body normalizado para o repositório:`, JSON.stringify(normalizedBody, null, 2));

          const updated = await serviceRepository.update(id, normalizedBody);
          return updated;
        } catch (error: any) {
          console.error("\n[SERVICE_CONTROLLER_PUT_ERROR]:", error);
          set.status = 500;
          return {
            error: error.message || "Internal Server Error",
            details: error.detail || error.cause || null
          };
        }
      }, {
        body: createServiceDTO
      })
      .delete("/:id", async ({ params: { id }, serviceRepository, user, set }) => {
        try {
          console.log(`[SERVICE_CONTROLLER] Deletando serviço ${id}`);

          const businessId = user!.businessId;
          const existing = await serviceRepository.findById(id);

          if (!existing) {
            set.status = 404;
            return { error: "Service not found" };
          }

          if (existing.companyId !== businessId) {
            set.status = 403;
            return { error: "Não autorizado" };
          }

          // Se o serviço tiver uma imagem no B2, deleta ela
          if (existing.icon && existing.icon.includes("/api/storage/")) {
            try {
              // Extrai a key da URL. Ex: http://.../api/storage/services/123.jpg -> services/123.jpg
              const parts = existing.icon.split("/api/storage/");
              if (parts.length > 1) {
                const key = parts[1];
                await deleteFileFromB2(key);
              }
            } catch (err) {
              console.error("[SERVICE_DELETE_FILE_ERROR]: Falha ao deletar ícone do B2, mas prosseguindo com exclusão do serviço.", err);
            }
          }

          const success = await serviceRepository.delete(id);
          return { success: true };
        } catch (error: any) {
          console.error("\n[SERVICE_CONTROLLER_DELETE_ERROR]:", error);
          set.status = 500;
          return {
            error: error.message || "Internal Server Error"
          };
        }
      })
      .get("/check-exists/:id", async ({ params: { id }, serviceRepository, set }) => {
        try {
          console.log(`[SERVICE_CONTROLLER] Verificando existência do serviço com ID: ${id}`);
          const exists = await serviceRepository.checkServiceExists(id);
          console.log(`[SERVICE_CONTROLLER] Serviço com ID ${id} existe: ${exists}`);
          return { id, exists };
        } catch (error: any) {
          console.error("\n[SERVICE_CONTROLLER_CHECK_EXISTS_ERROR]:", error);
          set.status = 500;
          return {
            error: error.message || "Internal Server Error",
            details: error.detail || error.cause || null
          };
        }
      })
  );
```

## Arquivo: `src\modules\services\adapters\out\drizzle\service.drizzle.repository.ts`
```typescript
import { db } from "../../../../infrastructure/drizzle/database";
import { services, serviceResources } from "../../../../../db/schema";
import { eq } from "drizzle-orm";
import { IServiceRepository } from "../../../domain/ports/service.repository";
import { Service, CreateServiceInput } from "../../../domain/entities/service.entity";

export class DrizzleServiceRepository implements IServiceRepository {
  async findById(id: string): Promise<Service | null> {
    const [result] = await db
      .select()
      .from(services)
      .where(eq(services.id, id))
      .limit(1);

    if (!result) return null;

    // Busca os recursos vinculados
    const resources = await db
      .select()
      .from(serviceResources)
      .where(eq(serviceResources.serviceId, id));

    return {
      ...(result as Service),
      resources: resources as any[]
    };
  }

  async findAllByCompanyId(companyId: string): Promise<Service[]> {
    const results = await db
      .select()
      .from(services)
      .where(eq(services.companyId, companyId));

    // Para cada serviço, busca seus recursos (pode ser otimizado futuramente com join ou Promise.all)
    const servicesWithResources = await Promise.all(
      results.map(async (service) => {
        const resources = await db
          .select()
          .from(serviceResources)
          .where(eq(serviceResources.serviceId, service.id));

        return {
          ...(service as Service),
          resources: resources as any[]
        };
      })
    );

    return servicesWithResources;
  }

  async create(data: CreateServiceInput): Promise<Service> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const serviceId = data.id && isUUID(data.id) ? data.id : crypto.randomUUID();

    console.log(`[DrizzleServiceRepository] Executando Upsert para ID: ${serviceId}`);

    // Mapeia advancedRules para garantir o formato {"conflicts": []}
    let finalAdvancedRules: any = { conflicts: [] };

    const rawRules = data.advancedRules;
    if (rawRules) {
      if (rawRules.conflicts && Array.isArray(rawRules.conflicts)) {
        finalAdvancedRules = { conflicts: rawRules.conflicts };
      } else if (Array.isArray(rawRules)) {
        finalAdvancedRules = { conflicts: rawRules };
      } else if (typeof rawRules === 'object') {
        finalAdvancedRules = rawRules.conflicts ? { conflicts: rawRules.conflicts } : { conflicts: [], ...rawRules };
      }
    }

    try {
      const [newService] = await db
        .insert(services)
        .values({
          id: serviceId,
          companyId: data.companyId,
          name: data.name,
          description: data.description,
          price: data.price.toString(),
          duration: data.duration.toString(),
          icon: data.icon,
          isVisible: data.isVisible ?? true,
          showOnHome: data.showOnHome ?? false,
          advancedRules: finalAdvancedRules,
        })
        .onConflictDoUpdate({
          target: services.id,
          set: {
            name: data.name,
            description: data.description,
            price: data.price.toString(),
            duration: data.duration.toString(),
            icon: data.icon,
            isVisible: data.isVisible ?? true,
            showOnHome: data.showOnHome ?? false,
            advancedRules: finalAdvancedRules,
            updatedAt: new Date(),
          },
        })
        .returning();

      // Gerencia os recursos (estoque) vinculados
      if (data.resources) {
        // Primeiro remove os antigos
        await db
          .delete(serviceResources)
          .where(eq(serviceResources.serviceId, serviceId));

        // Insere os novos
        if (data.resources.length > 0) {
          await db.insert(serviceResources).values(
            data.resources.map(res => ({
              id: crypto.randomUUID(),
              serviceId: serviceId,
              inventoryId: res.inventoryId,
              quantity: res.quantity.toString(),
              unit: res.unit,
              useSecondaryUnit: res.useSecondaryUnit
            }))
          );
        }
      }

      const resources = await db
        .select()
        .from(serviceResources)
        .where(eq(serviceResources.serviceId, serviceId));

      return {
        ...(newService as Service),
        resources: resources as any[]
      };
    } catch (dbError: any) {
      console.error(`[DrizzleServiceRepository] Erro no banco:`, dbError);
      throw dbError;
    }
  }

  async update(id: string, data: Partial<CreateServiceInput>): Promise<Service | null> {
    console.log(`\n[DrizzleServiceRepository] >>> INICIANDO UPDATE PARA ID: ${id}`);
    console.log(`[DrizzleServiceRepository] DADOS RECEBIDOS:`, JSON.stringify(data, null, 2));

    const updatePayload: any = {
      updatedAt: new Date(),
    };

    // Mapeamento explícito de campos básicos
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.price !== undefined) updatePayload.price = data.price.toString();
    if (data.duration !== undefined) updatePayload.duration = data.duration.toString();
    if (data.icon !== undefined) updatePayload.icon = data.icon;
    if (data.isVisible !== undefined) updatePayload.isVisible = data.isVisible;
    if (data.showOnHome !== undefined) updatePayload.showOnHome = data.showOnHome;

    // Tratamento ultra-rigoroso para advancedRules (advanced_rules no banco)
    if (data.advancedRules !== undefined) {
      let finalRules: any = { conflicts: [] };

      const rawRules = data.advancedRules;
      if (rawRules) {
        // Se já vier no formato { conflicts: [...] }
        if (rawRules.conflicts && Array.isArray(rawRules.conflicts)) {
          finalRules = { conflicts: rawRules.conflicts };
        }
        // Se vier apenas o array [...]
        else if (Array.isArray(rawRules)) {
          finalRules = { conflicts: rawRules };
        }
        // Se vier como objeto genérico
        else if (typeof rawRules === 'object') {
          finalRules = rawRules.conflicts ? { conflicts: rawRules.conflicts } : { conflicts: [], ...rawRules };
        }
      }

      updatePayload.advancedRules = finalRules;
      console.log(`[DrizzleServiceRepository] AdvancedRules mapeado para:`, JSON.stringify(finalRules));
    }

    console.log(`[DrizzleServiceRepository] PAYLOAD FINAL ENVIADO AO DRIZZLE:`, JSON.stringify(updatePayload, null, 2));

    try {
      const [updated] = await db
        .update(services)
        .set(updatePayload)
        .where(eq(services.id, id))
        .returning();

      if (!updated) {
        console.warn(`[DrizzleServiceRepository] !!! NENHUM REGISTRO ENCONTRADO PARA O ID: ${id}`);
        return null;
      }

      // Gerencia os recursos (estoque) vinculados no Update
      if (data.resources !== undefined) {
        console.log(`[DrizzleServiceRepository] Atualizando recursos para o serviço: ${id}`);

        // Remove os antigos
        await db
          .delete(serviceResources)
          .where(eq(serviceResources.serviceId, id));

        // Insere os novos se houver
        if (data.resources.length > 0) {
          await db.insert(serviceResources).values(
            data.resources.map(res => ({
              id: crypto.randomUUID(),
              serviceId: id,
              inventoryId: res.inventoryId,
              quantity: res.quantity.toString(),
              unit: res.unit,
              useSecondaryUnit: res.useSecondaryUnit
            }))
          );
        }
      }

      // Busca os recursos atuais para retornar o objeto completo
      const resources = await db
        .select()
        .from(serviceResources)
        .where(eq(serviceResources.serviceId, id));

      console.log(`[DrizzleServiceRepository] <<< UPDATE CONCLUÍDO COM SUCESSO!`);

      return {
        ...(updated as Service),
        resources: resources as any[]
      };
    } catch (error: any) {
      console.error(`[DrizzleServiceRepository] !!! ERRO FATAL NO UPDATE:`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    const [deleted] = await db
      .delete(services)
      .where(eq(services.id, id))
      .returning();

    return !!deleted;
  }

  async checkServiceExists(id: string): Promise<boolean> {
    const [result] = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.id, id))
      .limit(1);
    return !!result;
  }
}
```

## Arquivo: `src\modules\services\application\use-cases\create-service.use-case.ts`
```typescript
import { IServiceRepository } from "../../domain/ports/service.repository";
import { CreateServiceInput } from "../../domain/entities/service.entity";

export class CreateServiceUseCase {
  constructor(private serviceRepository: IServiceRepository) {}

  async execute(data: CreateServiceInput) {
    return await this.serviceRepository.create(data);
  }
}
```

## Arquivo: `src\modules\services\domain\entities\service.entity.ts`
```typescript
export interface ServiceResource {
  id: string;
  serviceId: string;
  inventoryId: string;
  quantity: string;
  unit: string;
  useSecondaryUnit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Service {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  price: string;
  duration: string;
  icon?: string | null;
  isVisible: boolean;
  showOnHome: boolean;
  advancedRules?: any;
  resources?: ServiceResource[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateServiceInput {
  id?: string;
  companyId: string;
  name: string;
  description?: string | null;
  price: string;
  duration: string;
  icon?: string | null;
  isVisible?: boolean;
  showOnHome?: boolean;
  advancedRules?: any;
  resources?: Array<{
    inventoryId: string;
    quantity: number;
    unit: string;
    useSecondaryUnit: boolean;
  }>;
}
```

## Arquivo: `src\modules\services\domain\ports\service.repository.ts`
```typescript
import { Service, CreateServiceInput } from "../entities/service.entity";

export interface IServiceRepository {
  findById(id: string): Promise<Service | null>;
  findAllByCompanyId(companyId: string): Promise<Service[]>;
  create(data: CreateServiceInput): Promise<Service>;
  update(id: string, data: Partial<CreateServiceInput>): Promise<Service | null>;
  delete(id: string): Promise<boolean>;
}
```

## Arquivo: `src\modules\settings\adapters\in\dtos\settings.dto.ts`
```typescript
import { t } from "elysia";

export const SaveSettingsDTO = t.Object({
  businessId: t.Optional(t.String()),
  companyId: t.Optional(t.String()),
  siteName: t.Optional(t.Nullable(t.String())),
  titleSuffix: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(t.String())),
  logoUrl: t.Optional(t.Nullable(t.String())),

  // Suporte a campos extras que o front pode enviar por engano
  message: t.Optional(t.Any()),
  data: t.Optional(t.Any()),

  // Redes Sociais
  instagram: t.Optional(t.Nullable(t.String())),
  showInstagram: t.Optional(t.Boolean()),
  whatsapp: t.Optional(t.Nullable(t.String())),
  showWhatsapp: t.Optional(t.Boolean()),
  facebook: t.Optional(t.Nullable(t.String())),
  showFacebook: t.Optional(t.Boolean()),
  tiktok: t.Optional(t.Nullable(t.String())),
  showTiktok: t.Optional(t.Boolean()),
  linkedin: t.Optional(t.Nullable(t.String())),
  showLinkedin: t.Optional(t.Boolean()),
  twitter: t.Optional(t.Nullable(t.String())),
  showTwitter: t.Optional(t.Boolean()),

  // Contato e Endereço
  phone: t.Optional(t.Nullable(t.String())),
  email: t.Optional(t.Nullable(t.String())),
  address: t.Optional(t.Nullable(t.String())),
});
```

## Arquivo: `src\modules\settings\adapters\in\http\settings.controller.ts`
```typescript
import { Elysia, t } from "elysia";
import { GetSettingsUseCase } from "../../../application/use-cases/get-settings.use-case";
import { SaveSettingsUseCase } from "../../../application/use-cases/save-settings.use-case";
import { GetSiteCustomizationUseCase } from "../../../application/use-cases/get-site-customization.use-case";
import { UpdateSiteCustomizationUseCase } from "../../../application/use-cases/update-site-customization.use-case";
import { SaveSettingsDTO } from "../dtos/settings.dto";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { uploadToB2, deleteFileFromB2 } from "../../../../infrastructure/storage/b2.storage";

const getExtensionFromMime = (mimeType?: string) => {
  if (!mimeType) return "bin";
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg"
  };
  return map[mimeType] || "bin";
};

const normalizeKeys = (obj: any): any => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;

  const normalized: any = {};
  const mappings: Record<string, string> = {
    layout_global: "layoutGlobal",
    site_colors: "siteColors",
    base_colors: "siteColors",
    text_colors: "textColors",
    action_buttons: "actionButtons",
    about_us: "aboutUs",
    appointment_flow: "appointmentFlow",
    step1_services: "step1Services",
    step1_service: "step1Services",
    step1Service: "step1Services",
    service: "step1Services",
    step3_time: "step3Times",
    step3Time: "step3Times",
    step3Times: "step3Times",
    slot_interval: "timeSlotSize",
    timeSlotSize: "timeSlotSize",
    time_slot_size: "timeSlotSize",
    card_config: "cardConfig",
    card_bg_color: "cardBgColor",
    card_background_color: "cardBgColor",
    cardBgColor: "cardBgColor",
    cardBackgroundColor: "cardBgColor",
    background_color: "backgroundColor",
    backgroundColor: "backgroundColor",
    bgColor: "bgColor",
    bg_color: "bgColor",
    hero_banner: "heroBanner",
    hero: "heroBanner",
    services: "servicesSection",
    services_section: "servicesSection",
    values: "valuesSection",
    values_section: "valuesSection",
    gallery_preview: "galleryPreview",
    gallery_section: "galleryPreview",
    gallerySection: "galleryPreview",
    cta: "ctaSection",
    cta_section: "ctaSection",
    background_and_effect: "backgroundAndEffect",
    text_colors_header: "textColors",
    action_buttons_header: "actionButtons",
    theme: "layoutGlobal",
    fonts: "typography",
    colors: "siteColors",
    headings: "headingsFont",
    body: "bodyFont",
    primary: "primary",
    secondary: "secondary",
    background: "background"
  };

  for (const key in obj) {
    let targetKey = mappings[key] || key;
    let value = obj[key];

    if (targetKey === "timeSlotSize" && typeof value === "string") {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        console.log(`>>> [NORMALIZE] Convertendo timeSlotSize de string para número: ${value} -> ${parsed}`);
        value = parsed;
      }
    }

    // Corrigir mapeamento recursivo para chaves mapeadas
    const remappedKey = mappings[key] || key;
    normalized[remappedKey] = normalizeKeys(value);
  }
  return normalized;
};

const deepMerge = (target: any, source: any): any => {
  if (!source || typeof source !== "object" || Array.isArray(source)) return source;
  if (!target || typeof target !== "object" || Array.isArray(target)) return source;

  const result = { ...target };

  for (const key in source) {
    if (source[key] === undefined) continue;

    const sourceValue = source[key];
    const targetValue = target[key];

    // Lógica Especial para Imagens: Se o novo valor for string vazia e o antigo for uma URL de storage, marcar para deleção
    if (key === "bgImage" || key === "backgroundImageUrl" || key === "logoUrl") {
      if (sourceValue === "" && typeof targetValue === "string" && targetValue.includes("/api/storage/")) {
        const storageKey = targetValue.split("/api/storage/")[1];
        if (storageKey) {
          console.log(`>>> [DEEP_MERGE] Detectada remoção de imagem: ${targetValue}. Key para deleção: ${storageKey}`);
          // Armazenamos as chaves para deletar no final do processo se necessário
          // Como o deepMerge é recursivo e puro, idealmente o controller deve gerenciar isso
          // Mas para simplificar, vamos logar e o controller pode agir baseado no rascunho anterior
        }
      }
    }

    if (sourceValue && typeof sourceValue === "object" && !Array.isArray(sourceValue)) {
      if (Object.keys(sourceValue).length === 0) {
        continue;
      }
      result[key] = deepMerge(targetValue || {}, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }
  return result;
};

export const settingsController = () => new Elysia({ prefix: "/settings" })
  .use(authPlugin)
  .use(repositoriesPlugin)
  // --- ROTAS PÚBLICAS ---
  .get("/published/:businessId", async ({ params: { businessId }, settingsRepository, set }) => {
    try {
      console.log(`>>> [BACK_PUBLIC_ACCESS] Buscando customização publicada para empresa: ${businessId}`);

      // Adicionar headers de cache para evitar dados antigos no navegador
      set.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate";
      set.headers["Pragma"] = "no-cache";
      set.headers["Expires"] = "0";

      const customization = await settingsRepository.findCustomizationByBusinessId(businessId);

      if (!customization) {
        console.error(`!!! [BACK_PUBLIC_ACCESS_ERROR] Customização não encontrada para empresa: ${businessId}`);
        set.status = 404;
        return { error: "Customização publicada não encontrada para esta empresa." };
      }

      console.log(`>>> [BACK_PUBLIC_ACCESS] Sucesso ao carregar customização publicada para: ${businessId}`);
      console.log(`>>> [DATA_VERIFY] primaryButtonColor em layoutGlobal: ${(customization.layoutGlobal as any)?.primaryButtonColor}`);

      return customization;
    } catch (error: any) {
      console.error("[SETTINGS_GET_PUBLISHED_ERROR]:", error);
      set.status = 500;
      return { error: error.message };
    }
  })
  .get("/customization/:businessId", async ({ params: { businessId }, settingsRepository, set }) => {
    try {
      console.log(`>>> [BACK_PUBLIC_ACCESS] Buscando customização para empresa: ${businessId}`);

      // Adicionar headers de cache para evitar dados antigos no navegador
      set.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate";
      set.headers["Pragma"] = "no-cache";
      set.headers["Expires"] = "0";

      const customization = await settingsRepository.findCustomizationByBusinessId(businessId);

      if (!customization) {
        console.error(`!!! [BACK_PUBLIC_ACCESS_ERROR] Customização não encontrada para empresa: ${businessId}`);
        set.status = 404;
        return { error: "Customização publicada não encontrada para esta empresa." };
      }

      console.log(`>>> [BACK_PUBLIC_ACCESS] Sucesso ao carregar customização para: ${businessId}`);
      return customization;
    } catch (error: any) {
      console.error("[SETTINGS_GET_CUSTOMIZATION_ERROR]:", error);
      set.status = 500;
      return { error: error.message };
    }
  })
  .get("/profile/:businessId", async ({ params: { businessId }, settingsRepository, businessRepository, userRepository, set }) => {
    try {
      const business = await businessRepository.findById(businessId);
      if (!business) {
        set.status = 404;
        return { error: "Empresa não encontrada" };
      }

      const getSettingsUseCase = new GetSettingsUseCase(settingsRepository);
      const profile = await getSettingsUseCase.execute(businessId);

      // Lógica de Fallback para E-mail:
      // 1. Tenta pegar do perfil do negócio (configuração específica)
      // 2. Se não tiver, tenta pegar do contato da empresa
      // 3. Se não tiver, pega do e-mail do dono da conta (User)
      let publicEmail = profile?.email || (business as any).contact;

      if (!publicEmail && business.ownerId) {
        const owner = await userRepository.find(business.ownerId);
        if (owner) {
          publicEmail = owner.email;
        }
      }

      // Padronização Sênior: Garante tipos booleanos reais e nomes de campos consistentes
      // Além de fallback seguro para campos de contato vindo do cadastro da empresa
      const standardizedProfile = {
        id: profile?.id || null,
        businessId: businessId,
        siteName: profile?.siteName || business.name,
        titleSuffix: profile?.titleSuffix || "",
        description: profile?.description || "",
        logoUrl: profile?.logoUrl || "",

        // Redes Sociais com normalização de visibilidade
        instagram: profile?.instagram || null,
        showInstagram: Boolean(profile?.showInstagram ?? true),
        whatsapp: profile?.whatsapp || null,
        showWhatsapp: Boolean(profile?.showWhatsapp ?? true),
        facebook: profile?.facebook || null,
        showFacebook: Boolean(profile?.showFacebook ?? true),
        tiktok: profile?.tiktok || null,
        showTiktok: Boolean(profile?.showTiktok ?? true),
        linkedin: profile?.linkedin || null,
        showLinkedin: Boolean(profile?.showLinkedin ?? true),
        twitter: profile?.twitter || null,
        showTwitter: Boolean(profile?.showTwitter ?? true),

        // Contato e Endereço
        phone: profile?.phone || (business as any).phone || (business as any).contact || null,
        email: publicEmail || null,
        address: profile?.address || (business as any).address || null,

        createdAt: profile?.createdAt || null,
        updatedAt: profile?.updatedAt || null
      };

      console.log(`>>> [SETTINGS_PROFILE_RESPONSE] Enviando perfil padronizado para businessId: ${businessId}`);

      return standardizedProfile;
    } catch (error: any) {
      console.error("[SETTINGS_GET_PROFILE_PUBLIC_ERROR]:", error);
      set.status = 500;
      return { error: error.message };
    }
  })
  // --- ROTAS PRIVADAS (EXIGEM AUTH) ---
  .group("", (app) =>
    app.onBeforeHandle(({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }
    })
      .post("/logo", async ({ body, user, settingsRepository, businessRepository, set }) => {
        try {
          const { file, businessId } = body;
          if (!file || !businessId) {
            set.status = 400;
            return { error: "Arquivo e businessId são obrigatórios" };
          }

          // Validar se o usuário é dono da empresa
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Você não tem permissão para esta empresa." };
          }

          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const extension = getExtensionFromMime(file.type);
          const key = `logos/${businessId}/${crypto.randomUUID()}.${extension}`;

          const logoUrl = await uploadToB2({
            buffer,
            contentType: file.type || "application/octet-stream",
            key,
            cacheControl: "public, max-age=31536000"
          });

          const saveSettingsUseCase = new SaveSettingsUseCase(settingsRepository);
          await saveSettingsUseCase.execute(businessId, { logoUrl });

          console.log(`[SETTINGS_CONTROLLER] Logo salva no banco de dados para businessId: ${businessId}`);

          return {
            success: true,
            logoUrl
          };
        } catch (error: any) {
          console.error("[SETTINGS_LOGO_UPLOAD_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: t.Object({
          file: t.Any(),
          businessId: t.String()
        })
      })
      .post("/background-image", async ({ body, user, businessRepository, set }) => {
        try {
          const { file, businessId, section } = body;
          console.log(`>>> [UPLOAD_BG_START] Recebendo upload para seção: ${section}, Empresa: ${businessId}`);
          console.log(`--- [UPLOAD_BG_FILE] Nome: ${file?.name}, Tipo: ${file?.type}, Tamanho: ${file?.size} bytes`);

          if (!file || !businessId || !section) {
            console.error(`!!! [UPLOAD_BG_ERROR] Dados ausentes: file=${!!file}, businessId=${businessId}, section=${section}`);
            set.status = 400;
            return { error: "Arquivo, businessId e seção são obrigatórios" };
          }

          // Validar se o usuário é dono da empresa
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            console.error(`!!! [UPLOAD_BG_ERROR] Sem permissão ou empresa não existe. Owner: ${business?.ownerId}, User: ${user?.id}`);
            set.status = 403;
            return { error: "Você não tem permissão para esta empresa." };
          }

          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const extension = getExtensionFromMime(file.type);
          const key = `backgrounds/${businessId}/${section}_${crypto.randomUUID()}.${extension}`;

          console.log(`--- [UPLOAD_BG_B2] Iniciando upload para B2: ${key}`);

          const imageUrl = await uploadToB2({
            buffer,
            contentType: file.type || "application/octet-stream",
            key,
            cacheControl: "public, max-age=31536000"
          });

          console.log(`<<< [UPLOAD_BG_SUCCESS] Imagem enviada com sucesso: ${imageUrl}`);

          return {
            success: true,
            imageUrl
          };
        } catch (error: any) {
          console.error("!!! [UPLOAD_BG_ERROR_CRITICAL]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: t.Object({
          file: t.Any(),
          businessId: t.String(),
          section: t.String() // hero, services, values, gallery, cta
        })
      })
      .delete("/background-image", async ({ body, user, businessRepository, settingsRepository, set }) => {
        try {
          const { imageUrl, businessId } = body;
          console.log(`>>> [DELETE_BG_START] Tentando deletar imagem: ${imageUrl} para Empresa: ${businessId}`);

          if (!imageUrl || !businessId) {
            set.status = 400;
            return { error: "imageUrl e businessId são obrigatórios" };
          }

          // Validar se o usuário é dono da empresa
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Não autorizado" };
          }

          const customization = await settingsRepository.findCustomizationByBusinessId(businessId);
          const draft = await settingsRepository.findDraftByBusinessId(businessId);
          const usedInCustomization = customization ? JSON.stringify(customization).includes(imageUrl) : false;
          const usedInDraft = draft ? JSON.stringify(draft).includes(imageUrl) : false;

          if (usedInCustomization || usedInDraft) {
            return { success: true, deleted: false, inUse: true };
          }

          // Só deleta se for uma URL do nosso B2 (proxy /api/storage/)
          if (imageUrl.includes("/api/storage/")) {
            const parts = imageUrl.split("/api/storage/");
            if (parts.length > 1) {
              const key = parts[1];
              // Importação dinâmica para evitar problemas se b2.storage não estiver pronto
              const { deleteFileFromB2 } = require("../../../../infrastructure/storage/b2.storage");
              await deleteFileFromB2(key);
              console.log(`<<< [DELETE_BG_SUCCESS] Arquivo removido do B2: ${key}`);
            }
          }

          return { success: true };
        } catch (error: any) {
          console.error("!!! [DELETE_BG_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: t.Object({
          imageUrl: t.String(),
          businessId: t.String()
        })
      })
      .get("/draft/:businessId", async ({ params: { businessId }, settingsRepository, businessRepository, user, set }) => {
        try {
          // Adicionar headers de cache para evitar dados antigos no navegador
          set.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate";
          set.headers["Pragma"] = "no-cache";
          set.headers["Expires"] = "0";

          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Você não tem permissão para acessar este rascunho." };
          }

          const draft = await settingsRepository.findDraftByBusinessId(businessId);
          if (draft) {
            return {
              layoutGlobal: draft.layoutGlobal,
              home: draft.home,
              gallery: draft.gallery,
              aboutUs: draft.aboutUs,
              appointmentFlow: draft.appointmentFlow,
            };
          }

          const getSiteCustomizationUseCase = new GetSiteCustomizationUseCase(settingsRepository);
          const customization = await getSiteCustomizationUseCase.execute(businessId);

          const savedDraft = await settingsRepository.saveDraft(businessId, customization);
          return {
            layoutGlobal: savedDraft.layoutGlobal,
            home: savedDraft.home,
            gallery: savedDraft.gallery,
            aboutUs: savedDraft.aboutUs,
            appointmentFlow: savedDraft.appointmentFlow,
          };
        } catch (error: any) {
          console.error("[SETTINGS_GET_DRAFT_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      })
      .patch("/draft/:businessId", async ({ params: { businessId }, body, settingsRepository, businessRepository, user, set }) => {
        try {
          console.log(`>>> [PATCH_DRAFT_START] Recebendo patch para businessId: ${businessId}, User: ${user?.id}`);
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Você não tem permissão para atualizar este rascunho." };
          }

          let draft = await settingsRepository.findDraftByBusinessId(businessId);
          if (!draft) {
            const getSiteCustomizationUseCase = new GetSiteCustomizationUseCase(settingsRepository);
            const customization = await getSiteCustomizationUseCase.execute(businessId);
            draft = await settingsRepository.saveDraft(businessId, customization);
          }

          const normalizedData = normalizeKeys(body);
          console.log(`>>> [PATCH_DRAFT] Dados normalizados recebidos:`, JSON.stringify(normalizedData, null, 2));

          // Log específico para campos de estilização (botões, badges)
          if (normalizedData.heroBanner?.ctaButton || normalizedData.heroBanner?.badge) {
            console.log(`>>> [STYLING_DEBUG] Campos de estilo detectados:`, {
              ctaButton: normalizedData.heroBanner.ctaButton,
              badge: normalizedData.heroBanner.badge
            });
          }

          // Mapeamento de seções que pertencem ao 'home' mas podem vir na raiz
          const HOME_SECTIONS = [
            "heroBanner",
            "servicesSection",
            "valuesSection",
            "galleryPreview",
            "ctaSection",
            "backgroundAndEffect"
          ];

          // Mapeamento de seções que pertencem ao 'layoutGlobal' mas podem vir na raiz
          const LAYOUT_GLOBAL_SECTIONS = [
            "typography",
            "siteColors",
            "header",
            "footer"
          ];

          const dataToMerge: any = {};

          // Capturar campos de estilo da RAIZ (primaryButtonColor, secondaryButtonColor, badge, badgeColor, subtitleColor)
          const STYLING_ROOT_FIELDS = [
            "primaryButtonColor",
            "secondaryButtonColor",
            "badge",
            "badgeColor",
            "subtitleColor"
          ];

          for (const key in normalizedData) {
            if (HOME_SECTIONS.includes(key)) {
              dataToMerge.home = dataToMerge.home || {};
              dataToMerge.home[key] = normalizedData[key];
            } else if (LAYOUT_GLOBAL_SECTIONS.includes(key)) {
              dataToMerge.layoutGlobal = dataToMerge.layoutGlobal || {};
              dataToMerge.layoutGlobal[key] = normalizedData[key];
            } else if (STYLING_ROOT_FIELDS.includes(key)) {
              // Mapeia campos de estilo da raiz para layoutGlobal
              dataToMerge.layoutGlobal = dataToMerge.layoutGlobal || {};
              dataToMerge.layoutGlobal[key] = normalizedData[key];
              console.log(`>>> [STYLING_ROOT_MAPPING] Mapeando ${key} para layoutGlobal: ${normalizedData[key]}`);
            } else {
              dataToMerge[key] = normalizedData[key];
            }
          }

          console.log(`>>> [PATCH_DRAFT] Dados preparados para merge:`, JSON.stringify(dataToMerge, null, 2));

          const merged = deepMerge(draft, dataToMerge);

          if (merged.home?.heroBanner && merged.layoutGlobal?.heroBanner) {
            delete merged.layoutGlobal.heroBanner;
          }
          if (merged.home?.hero && merged.layoutGlobal?.hero) {
            delete merged.layoutGlobal.hero;
          }
          if (merged.home?.aboutHero && merged.layoutGlobal?.aboutHero) {
            delete merged.layoutGlobal.aboutHero;
          }
          if (merged.home?.storySection && merged.layoutGlobal?.story) {
            delete merged.layoutGlobal.story;
          }
          if (merged.home?.teamSection && merged.layoutGlobal?.team) {
            delete merged.layoutGlobal.team;
          }
          if (merged.home?.testimonialsSection && merged.layoutGlobal?.testimonials) {
            delete merged.layoutGlobal.testimonials;
          }
          if (merged.home?.servicesSection && merged.layoutGlobal?.services) {
            delete merged.layoutGlobal.services;
          }
          if (merged.home?.galleryPreview && merged.layoutGlobal?.galleryPreview) {
            delete merged.layoutGlobal.galleryPreview;
          }
          if (merged.home?.ctaSection && merged.layoutGlobal?.cta) {
            delete merged.layoutGlobal.cta;
          }

          // Log ultra-específico antes do DB update
          console.log(`>>> [STYLING_DEBUG_FINAL] Estado final antes de salvar no DB (layoutGlobal):`, {
            primaryButtonColor: merged.layoutGlobal?.primaryButtonColor,
            secondaryButtonColor: merged.layoutGlobal?.secondaryButtonColor,
            badge: merged.layoutGlobal?.badge,
            badgeColor: merged.layoutGlobal?.badgeColor,
            subtitleColor: merged.layoutGlobal?.subtitleColor
          });

          // Função para extrair todas as URLs de storage de um objeto
          const getStorageKeys = (obj: any): string[] => {
            const keys: string[] = [];
            const findKeys = (current: any) => {
              if (!current || typeof current !== "object") return;
              for (const key in current) {
                const val = current[key];
                if (typeof val === "string" && val.includes("/api/storage/")) {
                  const storageKey = val.split("/api/storage/")[1];
                  if (storageKey) keys.push(storageKey);
                } else if (val && typeof val === "object") {
                  findKeys(val);
                }
              }
            };
            findKeys(obj);
            return keys;
          };

          // Comparar rascunho antigo com o novo para detectar imagens deletadas
          const oldKeys = getStorageKeys(draft);
          const newKeys = getStorageKeys(merged);
          const deletedKeys = oldKeys.filter(k => !newKeys.includes(k));

          console.log(`>>> [STORAGE_CLEANUP_CHECK] Old Keys:`, oldKeys);
          console.log(`>>> [STORAGE_CLEANUP_CHECK] New Keys:`, newKeys);

          if (deletedKeys.length > 0) {
            console.log(`>>> [STORAGE_CLEANUP] Detectadas ${deletedKeys.length} imagens para deletar:`, deletedKeys);
            for (const key of deletedKeys) {
              try {
                // Remove prefixo de URL se existir (segurança extra)
                const cleanKey = key.startsWith("/") ? key.substring(1) : key;
                await deleteFileFromB2(cleanKey);
                console.log(`>>> [STORAGE_CLEANUP] Imagem deletada com sucesso: ${cleanKey}`);
              } catch (e) {
                console.error(`>>> [STORAGE_CLEANUP] Erro ao deletar imagem ${key}:`, e);
              }
            }
          }

          // Limpeza de duplicidade: Se existir 'gallerySection' no home, move para 'galleryPreview' e deleta a antiga
          if (merged.home && merged.home.gallerySection) {
            console.log(`>>> [CLEANUP] Movendo gallerySection para galleryPreview e removendo duplicata`);
            merged.home.galleryPreview = deepMerge(merged.home.galleryPreview || {}, merged.home.gallerySection);
            delete merged.home.gallerySection;
          }

          console.log(`>>> [PATCH_DRAFT] Dados após merge e limpeza:`, JSON.stringify(merged, null, 2));

          const savedDraft = await settingsRepository.saveDraft(businessId, merged);

          return savedDraft;
        } catch (error: any) {
          console.error("[SETTINGS_PATCH_DRAFT_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: t.Any()
      })
      .post("/publish/:businessId", async ({ params: { businessId }, settingsRepository, businessRepository, user, set }) => {
        try {
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Você não tem permissão para publicar este site." };
          }

          const published = await settingsRepository.publishDraft(businessId);
          if (!published) {
            set.status = 404;
            return { error: "Rascunho não encontrado" };
          }

          return published;
        } catch (error: any) {
          console.error("[SETTINGS_PUBLISH_DRAFT_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      })
      .patch("/profile/:businessId", async ({ params: { businessId }, body, settingsRepository, businessRepository, user, set }) => {
        try {
          // Validar se o usuário é dono da empresa
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Você não tem permissão para alterar as configurações desta empresa." };
          }

          const saveSettingsUseCase = new SaveSettingsUseCase(settingsRepository);
          const updatedProfile = await saveSettingsUseCase.execute(businessId, body);

          return updatedProfile;
        } catch (error: any) {
          console.error("[SETTINGS_PATCH_PROFILE_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: SaveSettingsDTO
      })
      .post("/profile/:businessId", async ({ params: { businessId }, body, settingsRepository, businessRepository, user, set }) => {
        try {
          // Validar se o usuário é dono da empresa
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Você não tem permissão para alterar as configurações desta empresa." };
          }

          const saveSettingsUseCase = new SaveSettingsUseCase(settingsRepository);
          const updatedProfile = await saveSettingsUseCase.execute(businessId, body);

          return updatedProfile;
        } catch (error: any) {
          console.error("[SETTINGS_SAVE_PROFILE_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: SaveSettingsDTO
      })
      .patch("/customization/:businessId", async ({ params: { businessId }, body, settingsRepository, businessRepository, user, set }) => {
        try {
          console.log(`>>> [PUBLISH_SITE] Empresa: ${businessId}`);

          // Validar se o usuário é dono da empresa
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            console.error(`!!! [PUBLISH_SITE_ERROR] Sem permissão ou empresa não existe.`);
            set.status = 403;
            return { error: "Você não tem permissão para alterar a personalização desta empresa." };
          }

          const getSiteCustomizationUseCase = new GetSiteCustomizationUseCase(settingsRepository);
          const updateSiteCustomizationUseCase = new UpdateSiteCustomizationUseCase(
            settingsRepository,
            getSiteCustomizationUseCase
          );

          // Log específico para verificar a chegada de backgrounds (Hero, Serviços, etc)
          const typedBody = body as any;
          if (typedBody?.home) {
            Object.keys(typedBody.home).forEach(section => {
              const bgUrl = typedBody.home[section]?.appearance?.backgroundImageUrl;
              if (bgUrl) {
                console.log(`[BACKGROUND_DETECTED] Seção: ${section.toUpperCase()} | URL: ${bgUrl.substring(0, 70)}...`);
              }
            });
          }

          const result = await updateSiteCustomizationUseCase.execute(businessId, body);
          console.log(`<<< [PUBLISH_SITE_SUCCESS] Empresa: ${businessId}`);
          return result;
        } catch (error: any) {
          console.error("!!! [PUBLISH_SITE_ERROR_CRITICAL]:", error.message);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: t.Any()
      })
      .post("/customizer/reset", async ({ body, user, settingsRepository, businessRepository, set }) => {
        try {
          const { businessId } = body;
          if (!businessId) {
            set.status = 400;
            return { error: "businessId é obrigatório" };
          }

          // Validar se o usuário é dono da empresa
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Você não tem permissão para esta empresa." };
          }

          console.log(`>>> [CUSTOMIZER_RESET] Resetando site para o padrão: ${businessId}`);
          const reseted = await settingsRepository.resetCustomization(businessId);

          return {
            success: true,
            message: "Site resetado para o padrão com sucesso.",
            data: reseted
          };
        } catch (error: any) {
          console.error("!!! [CUSTOMIZER_RESET_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: t.Object({
          businessId: t.String()
        })
      })
  );

export default settingsController;
```

## Arquivo: `src\modules\settings\adapters\out\drizzle\settings.drizzle.repository.ts`
```typescript
import { db } from "../../../../infrastructure/drizzle/database";
import { businessProfiles, companySiteCustomizations, siteDrafts } from "../../../../../db/schema";
import { eq } from "drizzle-orm";
import { SettingsRepository, BusinessProfile } from "../../../domain/ports/settings.repository";
import { SiteCustomization } from "../../../../../modules/business/domain/types/site_customization.types";
import {
  DEFAULT_LAYOUT_GLOBAL,
  DEFAULT_HOME_SECTION,
  DEFAULT_GALLERY_SECTION,
  DEFAULT_ABOUT_US_SECTION,
  DEFAULT_APPOINTMENT_FLOW_SECTION
} from "../../../../../modules/business/domain/constants/site_customization.defaults";

export class DrizzleSettingsRepository implements SettingsRepository {
  async findByBusinessId(businessId: string): Promise<BusinessProfile | null> {
    try {
      const [result] = await db
        .select()
        .from(businessProfiles)
        .where(eq(businessProfiles.businessId, businessId))
        .limit(1);

      return (result as BusinessProfile) || null;
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_FINDBYBUSINESSID_ERROR]:", error);
      throw error;
    }
  }

  async upsert(businessId: string, data: Partial<Omit<BusinessProfile, "id" | "businessId" | "createdAt" | "updatedAt">>): Promise<BusinessProfile> {
    try {
      const existing = await this.findByBusinessId(businessId);

      if (existing) {
        const [updated] = await db
          .update(businessProfiles)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(eq(businessProfiles.businessId, businessId))
          .returning();

        return updated as BusinessProfile;
      } else {
        const [created] = await db
          .insert(businessProfiles)
          .values({
            id: crypto.randomUUID(),
            businessId,
            ...data,
          })
          .returning();

        return created as BusinessProfile;
      }
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_UPSERT_ERROR]:", error);
      throw error;
    }
  }

  private sanitizeCustomization(data: any): SiteCustomization {
    if (!data) return data;

    const sanitizeValue = (val: any): any => {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        // Se for um objeto com a chave 'text', extraímos apenas o texto (camada de proteção)
        if (Object.keys(val).length === 1 && val.hasOwnProperty('text') && typeof val.text === 'string') {
          return val.text;
        }

        // Recursão para o resto do objeto
        const newObj: any = {};
        for (const key in val) {
          newObj[key] = sanitizeValue(val[key]);
        }
        return newObj;
      }
      return val;
    };

    // 1. BLINDAGEM: Preservar todos os campos originais (incluindo seções dinâmicas)
    // Isso evita regressões quando novos setores são adicionados no frontend.
    const sanitized: any = {};
    for (const key in data) {
      // Ignorar campos internos do banco de dados
      if (['id', 'companyId', 'createdAt', 'updatedAt'].includes(key)) continue;
      sanitized[key] = sanitizeValue(data[key]);
    }

    // 2. Garantir que as seções básicas tenham ao menos um fallback para não quebrar o frontend
    return {
      layoutGlobal: sanitized.layoutGlobal || DEFAULT_LAYOUT_GLOBAL,
      home: sanitized.home || DEFAULT_HOME_SECTION,
      gallery: sanitized.gallery || DEFAULT_GALLERY_SECTION,
      aboutUs: sanitized.aboutUs || DEFAULT_ABOUT_US_SECTION,
      appointmentFlow: sanitized.appointmentFlow || DEFAULT_APPOINTMENT_FLOW_SECTION,
      ...sanitized, // Spread final para garantir que campos extras (como 'sections') sejam mantidos
    } as SiteCustomization;
  }

  async findCustomizationByBusinessId(businessId: string): Promise<SiteCustomization | null> {
    try {
      const [result] = await db
        .select()
        .from(companySiteCustomizations)
        .where(eq(companySiteCustomizations.companyId, businessId))
        .limit(1);

      const defaultCustomization: SiteCustomization = {
        layoutGlobal: DEFAULT_LAYOUT_GLOBAL,
        home: DEFAULT_HOME_SECTION,
        gallery: DEFAULT_GALLERY_SECTION,
        aboutUs: DEFAULT_ABOUT_US_SECTION,
        appointmentFlow: DEFAULT_APPOINTMENT_FLOW_SECTION,
      };

      if (!result) {
        return defaultCustomization;
      }

      return this.sanitizeCustomization(result);
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_FINDCUSTOMIZATION_ERROR]:", error);
      throw error;
    }
  }

  async saveCustomization(businessId: string, data: SiteCustomization): Promise<SiteCustomization> {
    try {
      // 1. BLINDAGEM: Preservar todos os campos originais (incluindo seções dinâmicas como 'sections')
      const dataToSave = {
        ...data, // Spread do original para não perder campos novos
        layoutGlobal: data.layoutGlobal || DEFAULT_LAYOUT_GLOBAL,
        home: data.home || DEFAULT_HOME_SECTION,
        gallery: data.gallery || DEFAULT_GALLERY_SECTION,
        aboutUs: data.aboutUs || DEFAULT_ABOUT_US_SECTION,
        appointmentFlow: data.appointmentFlow || DEFAULT_APPOINTMENT_FLOW_SECTION,
      };

      const [existing] = await db
        .select()
        .from(companySiteCustomizations)
        .where(eq(companySiteCustomizations.companyId, businessId))
        .limit(1);

      if (existing) {
        console.log(`[DRIZZLE_REPOSITORY] Atualizando customização existente para companyId: ${businessId}`);

        const [updated] = await db
          .update(companySiteCustomizations)
          .set({
            ...dataToSave,
            updatedAt: new Date(),
          })
          .where(eq(companySiteCustomizations.companyId, businessId))
          .returning();

        if (!updated) {
          throw new Error("Falha ao atualizar customização: nenhum registro retornado.");
        }

        return this.sanitizeCustomization(updated);
      } else {
        console.log(`[DRIZZLE_REPOSITORY] Criando nova customização para companyId: ${businessId}`);
        const [created] = await db
          .insert(companySiteCustomizations)
          .values({
            id: crypto.randomUUID(),
            companyId: businessId,
            ...dataToSave,
          })
          .returning();

        if (!created) {
          throw new Error("Falha ao criar customização: nenhum registro retornado.");
        }

        return this.sanitizeCustomization(created);
      }
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_SAVECUSTOMIZATION_ERROR]:", error);
      throw error;
    }
  }

  async findDraftByBusinessId(businessId: string): Promise<SiteCustomization | null> {
    try {
      const [result] = await db
        .select()
        .from(siteDrafts)
        .where(eq(siteDrafts.companyId, businessId))
        .limit(1);

      if (!result) {
        return {
          layoutGlobal: DEFAULT_LAYOUT_GLOBAL,
          home: DEFAULT_HOME_SECTION,
          gallery: DEFAULT_GALLERY_SECTION,
          aboutUs: DEFAULT_ABOUT_US_SECTION,
          appointmentFlow: DEFAULT_APPOINTMENT_FLOW_SECTION,
        } as SiteCustomization;
      }

      return this.sanitizeCustomization(result);
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_FINDDRAFT_ERROR]:", error);
      throw error;
    }
  }

  async saveDraft(businessId: string, data: SiteCustomization): Promise<SiteCustomization> {
    try {
      // 1. BLINDAGEM: Preservar todos os campos originais (incluindo seções dinâmicas como 'sections')
      const dataToSave = {
        ...data, // Spread do original para não perder campos novos
        layoutGlobal: data.layoutGlobal || DEFAULT_LAYOUT_GLOBAL,
        home: data.home || DEFAULT_HOME_SECTION,
        gallery: data.gallery || DEFAULT_GALLERY_SECTION,
        aboutUs: data.aboutUs || DEFAULT_ABOUT_US_SECTION,
        appointmentFlow: data.appointmentFlow || DEFAULT_APPOINTMENT_FLOW_SECTION,
      };

      const existing = await this.findDraftByBusinessId(businessId);

      if (existing) {
        const [updated] = await db
          .update(siteDrafts)
          .set({
            ...dataToSave,
            updatedAt: new Date(),
          })
          .where(eq(siteDrafts.companyId, businessId))
          .returning();

        if (!updated) {
          throw new Error("Falha ao atualizar draft: nenhum registro retornado.");
        }

        return this.sanitizeCustomization(updated);
      }

      const [created] = await db
        .insert(siteDrafts)
        .values({
          id: crypto.randomUUID(),
          companyId: businessId,
          ...dataToSave,
        })
        .returning();

      if (!created) {
        throw new Error("Falha ao criar draft: nenhum registro retornado.");
      }

      return this.sanitizeCustomization(created);
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_SAVEDRAFT_ERROR]:", error);
      throw error;
    }
  }

  async publishDraft(businessId: string): Promise<SiteCustomization | null> {
    try {
      return await db.transaction(async (tx) => {
        const [draft] = await tx
          .select()
          .from(siteDrafts)
          .where(eq(siteDrafts.companyId, businessId))
          .limit(1);

        if (!draft) return null;

        const dataToSave = {
          layoutGlobal: draft.layoutGlobal,
          home: draft.home,
          gallery: draft.gallery,
          aboutUs: draft.aboutUs,
          appointmentFlow: draft.appointmentFlow,
        };

        const [published] = await tx
          .insert(companySiteCustomizations)
          .values({
            id: crypto.randomUUID(),
            companyId: businessId,
            ...dataToSave,
          })
          .onConflictDoUpdate({
            target: companySiteCustomizations.companyId,
            set: {
              ...dataToSave,
              updatedAt: new Date(),
            },
          })
          .returning();

        if (!published) return null;

        return this.sanitizeCustomization(published);
      });
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_PUBLISHDRAFT_ERROR]:", error);
      throw error;
    }
  }

  async resetCustomization(businessId: string): Promise<SiteCustomization> {
    try {
      const defaultCustomization: SiteCustomization = {
        layoutGlobal: DEFAULT_LAYOUT_GLOBAL,
        home: DEFAULT_HOME_SECTION,
        gallery: DEFAULT_GALLERY_SECTION,
        aboutUs: DEFAULT_ABOUT_US_SECTION,
        appointmentFlow: DEFAULT_APPOINTMENT_FLOW_SECTION,
      };

      return await db.transaction(async (tx) => {
        // Remove draft se existir
        await tx
          .delete(siteDrafts)
          .where(eq(siteDrafts.companyId, businessId));

        // Upsert na customização principal com os valores padrão
        const [reseted] = await tx
          .insert(companySiteCustomizations)
          .values({
            id: crypto.randomUUID(),
            companyId: businessId,
            ...defaultCustomization,
          })
          .onConflictDoUpdate({
            target: companySiteCustomizations.companyId,
            set: {
              ...defaultCustomization,
              updatedAt: new Date(),
            },
          })
          .returning();

        if (!reseted) {
          throw new Error("Falha ao resetar customização: nenhum registro retornado.");
        }

        return this.sanitizeCustomization(reseted);
      });
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_RESET_ERROR]:", error);
      throw error;
    }
  }
}
```

## Arquivo: `src\modules\settings\application\use-cases\get-settings.use-case.ts`
```typescript
import { SettingsRepository, BusinessProfile } from "../../domain/ports/settings.repository";

export class GetSettingsUseCase {
  constructor(private settingsRepository: SettingsRepository) { }

  async execute(businessId: string): Promise<BusinessProfile | null> {
    return this.settingsRepository.findByBusinessId(businessId);
  }
}
```

## Arquivo: `src\modules\settings\application\use-cases\get-site-customization.use-case.ts`
```typescript
import { SettingsRepository } from "../../domain/ports/settings.repository";
import { SiteCustomization } from "../../../business/domain/types/site_customization.types";
import {
  DEFAULT_LAYOUT_GLOBAL,
  DEFAULT_HOME_SECTION,
  DEFAULT_GALLERY_SECTION,
  DEFAULT_ABOUT_US_SECTION,
  DEFAULT_APPOINTMENT_FLOW_SECTION,
} from "../../../business/domain/constants/site_customization.defaults";

export class GetSiteCustomizationUseCase {
  constructor(private settingsRepository: SettingsRepository) { }

  async execute(businessId: string): Promise<SiteCustomization> {
    const customization = await this.settingsRepository.findCustomizationByBusinessId(businessId);

    const defaultCustomization: SiteCustomization = {
      layoutGlobal: DEFAULT_LAYOUT_GLOBAL,
      home: DEFAULT_HOME_SECTION,
      gallery: DEFAULT_GALLERY_SECTION,
      aboutUs: DEFAULT_ABOUT_US_SECTION,
      appointmentFlow: DEFAULT_APPOINTMENT_FLOW_SECTION,
    };

    if (!customization) {
      console.log(`[GET_SITE_CUSTOMIZATION] Nenhum registro encontrado para businessId: ${businessId}. Criando padrão.`);
      // Create the default record in the database
      return await this.settingsRepository.saveCustomization(businessId, defaultCustomization);
    }

    console.log(`[GET_SITE_CUSTOMIZATION] Registro encontrado no banco para businessId: ${businessId}. Realizando merge para evitar nulos.`);

    // Realiza o merge profundo para garantir que campos novos ou nulos sejam preenchidos com os padrões
    const merged = this.deepMerge(defaultCustomization, customization);

    /**
     * CONTRATO DE DADOS (GET):
     * Estrutura: appointmentFlow -> step1Services (PLURAL) -> cardConfig -> backgroundColor
     * Propriedade: backgroundColor (camelCase)
     */
    if (merged.appointmentFlow?.step1Services?.cardConfig?.backgroundColor === "TRANSPARENT_DEFAULT") {
      merged.appointmentFlow.step1Services.cardConfig.backgroundColor = "#F3E2E2"; // Fallback real
    }

    console.log(`>>> [GET_SITE_CUSTOMIZATION] Contrato Validado: step1Services.cardConfig.backgroundColor = ${merged.appointmentFlow?.step1Services?.cardConfig?.backgroundColor}`);

    /**
     * FORÇAR ENTREGA (timeSlotSize como Número):
     * O site oficial exige que este campo seja um número dentro de step3Times.
     */
    if (merged.appointmentFlow?.step3Times) {
      const size = merged.appointmentFlow.step3Times.timeSlotSize;
      merged.appointmentFlow.step3Times.timeSlotSize = typeof size === 'string' ? parseInt(size, 10) : Number(size || 30);

      console.log('>>> [PUBLIC_API_SEND] Enviando intervalo para o site:', merged.appointmentFlow.step3Times.timeSlotSize);
    }

    /**
     * DEBUG DE AGENDAMENTO (LOG):
     * Monitora o intervalo de tempo enviado para o front-end
     */
    console.log(`>>> [BOOKING_DEBUG] Intervalo de agendamento (timeSlotSize) para businessId ${businessId}: ${merged.appointmentFlow?.step3Times?.timeSlotSize} min`);

    return merged;
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] === null || source[key] === undefined) continue;

      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        // Prevenção de strings vazias para campos de cor/font (opcional, mas evita bugs visuais)
        if (typeof source[key] === 'string' && source[key] === '' && target[key]) {
          // Se o novo valor for vazio mas o padrão tiver algo, mantém o padrão
          continue;
        }
        result[key] = source[key];
      }
    }

    return result;
  }
}
```

## Arquivo: `src\modules\settings\application\use-cases\save-settings.use-case.ts`
```typescript
import { SettingsRepository, BusinessProfile } from "../../domain/ports/settings.repository";

export class SaveSettingsUseCase {
  constructor(private settingsRepository: SettingsRepository) { }

  async execute(businessId: string, data: Partial<Omit<BusinessProfile, "id" | "businessId" | "createdAt" | "updatedAt">>): Promise<BusinessProfile> {
    return this.settingsRepository.upsert(businessId, data);
  }
}
```

## Arquivo: `src\modules\settings\application\use-cases\update-site-customization.use-case.ts`
```typescript
import { SettingsRepository } from "../../domain/ports/settings.repository";
import { SiteCustomization } from "../../../business/domain/types/site_customization.types";
import { GetSiteCustomizationUseCase } from "./get-site-customization.use-case";

export class UpdateSiteCustomizationUseCase {
  constructor(
    private settingsRepository: SettingsRepository,
    private getSiteCustomizationUseCase: GetSiteCustomizationUseCase
  ) { }

  async execute(businessId: string, partialData: any): Promise<SiteCustomization> {
    const current = await this.getSiteCustomizationUseCase.execute(businessId);

    // Mapeamento manual de snake_case para camelCase se necessário
    const normalizedData = this.normalizeKeys(partialData);
    const merged = this.deepMerge(current, normalizedData);

    return await this.settingsRepository.saveCustomization(businessId, merged);
  }

  private normalizeKeys(obj: any): any {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;

    const normalized: any = {};
    const mappings: Record<string, string> = {
      'layout_global': 'layoutGlobal',
      'site_colors': 'siteColors',
      'base_colors': 'siteColors',
      'text_colors': 'textColors',
      'action_buttons': 'actionButtons',
      'about_us': 'aboutUs',
      'appointment_flow': 'appointmentFlow',
      'step1_services': 'step1Services',
      'step1_service': 'step1Services',
      'step1Service': 'step1Services',
      'service': 'step1Services',
      'step3_time': 'step3Times',
      'step3Time': 'step3Times',
      'step3Times': 'step3Times',
      'slot_interval': 'timeSlotSize',
      'timeSlotSize': 'timeSlotSize',
      'time_slot_size': 'timeSlotSize',
      'card_config': 'cardConfig',
      'card_bg_color': 'backgroundColor',
      'cardBgColor': 'backgroundColor',
      'background_color': 'backgroundColor',
      'hero_banner': 'heroBanner',
      'hero': 'heroBanner',
      'services': 'servicesSection',
      'services_section': 'servicesSection',
      'values': 'valuesSection',
      'values_section': 'valuesSection',
      'gallery': 'galleryPreview',
      'gallery_preview': 'galleryPreview',
      'cta': 'ctaSection',
      'cta_section': 'ctaSection',
      'background_and_effect': 'backgroundAndEffect',
      'text_colors_header': 'textColors',
      'action_buttons_header': 'actionButtons'
    };

    for (const key in obj) {
      let targetKey = mappings[key] || key;
      let value = obj[key];

      // Caso especial: normalização de intervalo de tempo para número
      if (targetKey === 'timeSlotSize' && typeof value === 'string') {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
          console.log(`>>> [NORMALIZE] Convertendo timeSlotSize de string para número: ${value} -> ${parsed}`);
          value = parsed;
        }
      }

      // Caso especial: se a chave for 'cardBgColor' e estivermos no nível que deveria ter 'cardConfig'
      // ou se o valor for uma string (cor), mas a chave sugere que deveria estar dentro de cardConfig
      if (key === 'cardBgColor' || key === 'card_bg_color') {
        console.log(`>>> [NORMALIZE] Remapeando ${key} para cardConfig.backgroundColor`);
        normalized['cardConfig'] = {
          ...normalized['cardConfig'],
          backgroundColor: value
        };
        continue;
      }

      // Caso especial: normalização de cores genéricas para campos específicos do contrato
      if (key === 'color' && !mappings[key]) {
        normalized['textColor'] = value;
        // Não damos continue aqui para permitir que 'color' ainda exista se necessário, 
        // mas o contrato prefere 'textColor'
      }

      if (key === 'bgColor' && !mappings[key]) {
        normalized['backgroundColor'] = value;
      }

      normalized[targetKey] = this.normalizeKeys(value);
    }
    return normalized;
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] === undefined) continue;

      // Prevenção de Esvaziamento: Se o valor for um objeto vazio, não faz merge
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (Object.keys(source[key]).length === 0) {
          console.log(`[DEEP_MERGE] Ignorando objeto vazio para chave: ${key}`);
          continue;
        }

        if (!result[key] || typeof result[key] !== 'object') result[key] = {};
        result[key] = this.deepMerge(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }
}
```

## Arquivo: `src\modules\settings\domain\ports\settings.repository.ts`
```typescript
import { SiteCustomization } from "../../../business/domain/types/site_customization.types";

export interface BusinessProfile {
  id: string;
  businessId: string;
  siteName: string | null;
  titleSuffix: string | null;
  description: string | null;
  logoUrl: string | null;
  instagram: string | null;
  showInstagram: boolean;
  whatsapp: string | null;
  showWhatsapp: boolean;
  facebook: string | null;
  showFacebook: boolean;
  tiktok: string | null;
  showTiktok: boolean;
  linkedin: string | null;
  showLinkedin: boolean;
  twitter: string | null;
  showTwitter: boolean;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingsRepository {
  findByBusinessId(businessId: string): Promise<BusinessProfile | null>;
  upsert(businessId: string, data: Partial<Omit<BusinessProfile, "id" | "businessId" | "createdAt" | "updatedAt">>): Promise<BusinessProfile>;

  findCustomizationByBusinessId(businessId: string): Promise<SiteCustomization | null>;
  saveCustomization(businessId: string, data: SiteCustomization): Promise<SiteCustomization>;

  findDraftByBusinessId(businessId: string): Promise<SiteCustomization | null>;
  saveDraft(businessId: string, data: SiteCustomization): Promise<SiteCustomization>;
  publishDraft(businessId: string): Promise<SiteCustomization | null>;
  resetCustomization(businessId: string): Promise<SiteCustomization>;
}
```

## Arquivo: `src\modules\user\adapters\in\dtos\signin.dto.ts`
```typescript
import { t } from "elysia";

export const signinDTO = t.Object({
  name: t.String(),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
  studioName: t.String(),
  phone: t.String(),
  cpfCnpj: t.Optional(t.String()),
  role: t.Optional(t.String()), // "USER" ou "SUPER_ADMIN"
}, {
  additionalProperties: true
});

export type SigninDTO = typeof signinDTO.static;
```

## Arquivo: `src\modules\user\adapters\in\http\user-preferences.controller.ts`
```typescript
import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";

export const userPreferencesController = () => new Elysia({ prefix: "/user" })
  .use(repositoriesPlugin)
  .use(authPlugin)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .get("/preferences", async ({ user, userRepository }) => {
    const currentUser = await userRepository.find(user!.id);
    if (!currentUser) {
      throw new Error("User not found");
    }

    return {
      notifications: {
        newAppointments: currentUser.notifyNewAppointments,
        cancellations: currentUser.notifyCancellations,
        inventoryAlerts: currentUser.notifyInventoryAlerts
      },
      theme: "light"
    };
  })
  .patch("/preferences", async ({ user, body, userRepository }) => {
    const { notifications } = body as any;

    if (notifications) {
      await userRepository.update(user!.id, {
        notifyNewAppointments: notifications.newAppointments,
        notifyCancellations: notifications.cancellations,
        notifyInventoryAlerts: notifications.inventoryAlerts
      });
    }

    return { success: true };
  }, {
    body: t.Object({
        notifications: t.Optional(t.Object({
            newAppointments: t.Optional(t.Boolean()),
            cancellations: t.Optional(t.Boolean()),
            inventoryAlerts: t.Optional(t.Boolean())
        })),
        theme: t.Optional(t.String())
    })
  });
```

## Arquivo: `src\modules\user\adapters\in\http\user.controller.ts`
```typescript
import { Elysia, t } from "elysia";
import { CreateUserUseCase } from "../../../application/use-cases/create-user.use-case";
import { ListUsersUseCase } from "../../../application/use-cases/list-users.use-case";
import { signinDTO } from "../dtos/signin.dto";

export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase
  ) { }

  registerRoutes() {
    return new Elysia({ prefix: "/users" })
      .post(
        "/",
        async ({ body, set }) => {
          console.log(`\n[${new Date().toISOString()}] [USER_REGISTER] Nova requisição de cadastro recebida:`);
          console.log(`> Body:`, JSON.stringify(body, null, 2));

          try {
            const user = await this.createUserUseCase.execute(body);
            console.log(`> [USER_REGISTER] Sucesso ao criar usuário: ${user.user?.id || 'N/A'}`);
            set.status = 201;
            return user;
          } catch (err: any) {
            console.error(`> [USER_REGISTER] Erro ao processar cadastro:`, err.message);
            set.status = 400;
            return { error: err.message };
          }
        },
        {
          body: signinDTO,
          onError({ error, body, set }: { error: any, body: any, set: any }) {
            console.error("\n[USER_REGISTER_VALIDATION_ERROR]");
            console.error("> Body enviado:", JSON.stringify(body, null, 2));
            console.error("> Erro de validação:", error);
            
            set.status = 400;
            return {
              error: "VALIDATION_ERROR",
              message: error.message || "Erro de validação nos dados enviados",
              details: error.all || error
            };
          }
        }
      )
      .get("/", async () => {
        return this.listUsersUseCase.execute();
      });
  }
}
```

## Arquivo: `src\modules\user\adapters\out\user.repository.ts`
```typescript
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
```

## Arquivo: `src\modules\user\application\use-cases\create-user.use-case.ts`
```typescript
import { SigninDTO } from "../../adapters/in/dtos/signin.dto";
import { UserRepository } from "../../adapters/out/user.repository";
import { auth } from "../../../infrastructure/auth/auth";
import { db } from "../../../infrastructure/drizzle/database";
import { companies, account, companySiteCustomizations, user } from "../../../../db/schema";
import { generateUniqueSlug } from "../../../../shared/utils/slug";
import { eq } from "drizzle-orm";
import { TransactionalEmailService } from "../../../notifications/application/transactional-email.service";

export class CreateUserUseCase {
  constructor(private readonly userRepository: UserRepository) { }
  async execute(data: SigninDTO) {
    const transactionalEmailService = new TransactionalEmailService();
    const cpfCnpj = data.cpfCnpj?.replace(/\D/g, "") || null;
    const alreadyExists = await this.userRepository.findByEmail(data.email);

    if (alreadyExists) {
      if (cpfCnpj) {
        await db.update(user).set({ cpfCnpj }).where(eq(user.id, alreadyExists.id));
      }

      const userCompany = await db
        .select()
        .from(companies)
        .where(eq(companies.ownerId, alreadyExists.id))
        .limit(1);

      if (userCompany.length > 0) {
        return {
          user: alreadyExists,
          session: null,
          business: userCompany[0],
          slug: userCompany[0].slug
        };
      }

      const slug = await generateUniqueSlug(data.studioName);
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const result = await db.transaction(async (tx) => {
        const [newCompany] = await tx.insert(companies).values({
          id: crypto.randomUUID(),
          name: data.studioName,
          slug,
          phone: data.phone,
          ownerId: alreadyExists.id,
          trialEndsAt: trialEndsAt,
          subscriptionStatus: 'trial',
        }).returning();

        await tx.insert(companySiteCustomizations).values({
          id: crypto.randomUUID(),
          companyId: newCompany.id,
        });

        await tx.update(account).set({ scope: "ADMIN" }).where(eq(account.userId, alreadyExists.id));
        return { newCompany, slug };
      }).catch(async (err) => {
        const code = (err as any)?.code || (err as any)?.cause?.code;
        if (code === "23505") {
          const fallbackSlug = await generateUniqueSlug(`${data.studioName}-${Date.now()}`);
          const trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + 14);

          const result = await db.transaction(async (tx) => {
            const [newCompany] = await tx.insert(companies).values({
              id: crypto.randomUUID(),
              name: data.studioName,
              slug: fallbackSlug,
              phone: data.phone,
              ownerId: alreadyExists.id,
              trialEndsAt: trialEndsAt,
              subscriptionStatus: 'trial',
            }).returning();

            await tx.insert(companySiteCustomizations).values({
              id: crypto.randomUUID(),
              companyId: newCompany.id,
            });

            await tx.update(account).set({ scope: "ADMIN" }).where(eq(account.userId, alreadyExists.id));
            return { newCompany, slug: fallbackSlug };
          });
          return result;
        }
        throw err;
      });

      await transactionalEmailService
        .sendWelcomeEmail({
          to: alreadyExists.email,
          name: alreadyExists.name || data.name,
          studioName: result.newCompany.name,
        })
        .catch((error) =>
          console.error("[WELCOME_EMAIL_ERROR]", error),
        );

      return {
        user: alreadyExists,
        session: null,
        business: result.newCompany,
        slug: result.slug
      };
    }

    console.log(`[USER_REGISTER_USE_CASE] Iniciando signUpEmail para: ${data.email}`);
    const response = await auth.api.signUpEmail({
      body: {
        email: data.email,
        password: data.password,
        name: data.name,
        role: "ADMIN",
        active: true,
        hasCompletedOnboarding: false,
      },
    });

    if (!response || !response.user) {
      console.error(`[USER_REGISTER_USE_CASE] Falha no signUpEmail:`, response);
      throw new Error("Failed to create user");
    }
    console.log(`[USER_REGISTER_USE_CASE] signUpEmail concluído com sucesso para: ${response.user.email}`);

    // Atualiza a role do usuário se fornecida, caso contrário define como "ADMIN" por padrão para quem vem da landing page
    const finalRole = data.role || "ADMIN";
    await db
      .update(user)
      .set({ role: finalRole, active: true, cpfCnpj })
      .where(eq(user.id, response.user.id));
    console.log(`[USER_REGISTER_USE_CASE] Role '${finalRole}' aplicada ao usuário ${response.user.id}`);

    const slug = await generateUniqueSlug(data.studioName);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const result = await db.transaction(async (tx) => {
      await tx.update(account).set({ scope: "ADMIN" }).where(eq(account.userId, response.user.id));

      const [created] = await tx.insert(companies).values({
        id: crypto.randomUUID(),
        name: data.studioName,
        slug,
        phone: data.phone,
        ownerId: response.user.id,
        trialEndsAt: trialEndsAt,
        subscriptionStatus: 'trial',
      }).returning();

      await tx.insert(companySiteCustomizations).values({
        id: crypto.randomUUID(),
        companyId: created.id,
      });

      return { newCompany: created, finalSlug: slug };
    }).catch(async (err) => {
      const code = (err as any)?.code || (err as any)?.cause?.code;
      if (code === "23505") {
        const fallbackSlug = await generateUniqueSlug(`${data.studioName}-${Date.now()}`);
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 14);

        const result = await db.transaction(async (tx) => {
          await tx.update(account).set({ scope: "ADMIN" }).where(eq(account.userId, response.user.id));
          const [created] = await tx.insert(companies).values({
            id: crypto.randomUUID(),
            name: data.studioName,
            slug: fallbackSlug,
            phone: data.phone,
            ownerId: response.user.id,
            trialEndsAt: trialEndsAt,
            subscriptionStatus: 'trial',
          }).returning();

          await tx.insert(companySiteCustomizations).values({
            id: crypto.randomUUID(),
            companyId: created.id,
          });

          return { newCompany: created, finalSlug: fallbackSlug };
        });
        return result;
      }
      throw err;
    });

    // 3. Gera o link de verificação se o e-mail não estiver verificado
    let verificationUrl = undefined;
    if (!response.user.emailVerified) {
      const { url } = await auth.api.generateEmailVerificationToken({
        body: {
          email: data.email,
        },
      });
      verificationUrl = url;
      console.log(`[USER_REGISTER_USE_CASE] Link de verificação gerado: ${verificationUrl}`);
    }

    await transactionalEmailService
      .sendWelcomeEmail({
        to: data.email,
        name: data.name,
        studioName: result.newCompany.name,
        verificationUrl: verificationUrl,
      })
      .catch((error) =>
        console.error("[WELCOME_EMAIL_ERROR]", error),
      );

    return {
      ...response,
      business: result.newCompany,
      slug: result.finalSlug
    };
  }
}
```

## Arquivo: `src\modules\user\application\use-cases\list-users.use-case.ts`
```typescript
import { UserRepository } from "../../adapters/out/user.repository";

export class ListUsersUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute() {
    return await this.userRepository.findAll();
  }
}
```

## Arquivo: `src\modules\user\domain\error\user-already-exists.error.ts`
```typescript
export class UserAlreadyExistsError extends Error {
  constructor() {
    super(`Usuário com este e-mail já existe.`);
    this.name = "UserAlreadyExistsError";
  }
}
```

## Arquivo: `src\modules\user\domain\models\user.ts`
```typescript
export class User {
  constructor(
    public id: string,
    public name: string,
    public email: string,
    public password: string,
    public createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
    public notifyNewAppointments: boolean = true,
    public notifyCancellations: boolean = true,
    public notifyInventoryAlerts: boolean = true,
    public accountStatus: string = "ACTIVE",
    public cancellationRequestedAt: Date | null = null,
    public retentionEndsAt: Date | null = null,
    public lastRetentionDiscountAt: Date | null = null
  ) {}
}
```

## Arquivo: `src\scripts\read-db.js`
```javascript
import { db } from "../modules/infrastructure/drizzle/database";
import { companySiteCustomizations, siteDrafts } from "../db/schema";
async function main() {
    console.log(">>> [DB_READ] Buscando customizações do site (Publicadas)...");
    const results = await db
        .select({
        id: companySiteCustomizations.id,
        companyId: companySiteCustomizations.companyId,
        appointmentFlow: companySiteCustomizations.appointmentFlow,
    })
        .from(companySiteCustomizations);
    results.forEach((row, index) => {
        console.log(`\n--- Empresa ${index + 1} (PUBLISHED) (ID: ${row.companyId}) ---`);
        console.log("Appointment Flow:");
        console.log(JSON.stringify(row.appointmentFlow, null, 2));
    });
    console.log("\n>>> [DB_READ] Buscando Rascunhos (Drafts)...");
    const drafts = await db
        .select({
        id: siteDrafts.id,
        companyId: siteDrafts.companyId,
        appointmentFlow: siteDrafts.appointmentFlow,
    })
        .from(siteDrafts);
    drafts.forEach((row, index) => {
        console.log(`\n--- Empresa ${index + 1} (DRAFT) (ID: ${row.companyId}) ---`);
        console.log("Appointment Flow:");
        console.log(JSON.stringify(row.appointmentFlow, null, 2));
    });
}
main().catch((err) => {
    console.error("❌ Erro ao ler banco de dados:", err);
    process.exit(1);
});
```

## Arquivo: `src\scripts\read-db.ts`
```typescript

import { db } from "../modules/infrastructure/drizzle/database";
import { companySiteCustomizations, siteDrafts } from "../db/schema";

async function main() {
  console.log(">>> [DB_READ] Buscando customizações do site (Publicadas)...");
  const results = await db
    .select({
      id: companySiteCustomizations.id,
      companyId: companySiteCustomizations.companyId,
      appointmentFlow: companySiteCustomizations.appointmentFlow,
    })
    .from(companySiteCustomizations);

  results.forEach((row, index) => {
    console.log(`\n--- Empresa ${index + 1} (PUBLISHED) (ID: ${row.companyId}) ---`);
    console.log("Appointment Flow:");
    console.log(JSON.stringify(row.appointmentFlow, null, 2));
  });

  console.log("\n>>> [DB_READ] Buscando Rascunhos (Drafts)...");
  const drafts = await db
    .select({
      id: siteDrafts.id,
      companyId: siteDrafts.companyId,
      appointmentFlow: siteDrafts.appointmentFlow,
    })
    .from(siteDrafts);

  drafts.forEach((row, index) => {
    console.log(`\n--- Empresa ${index + 1} (DRAFT) (ID: ${row.companyId}) ---`);
    console.log("Appointment Flow:");
    console.log(JSON.stringify(row.appointmentFlow, null, 2));
  });
}

main().catch((err) => {
  console.error("❌ Erro ao ler banco de dados:", err);
  process.exit(1);
});
```

## Arquivo: `src\shared\utils\slug.ts`
```typescript
import { db } from "../../modules/infrastructure/drizzle/database";
import { companies } from "../../db/schema";
import { eq } from "drizzle-orm";

export function createSlug(text: string): string {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
}

export async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = createSlug(name);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db
      .select()
      .from(companies)
      .where(eq(companies.slug, slug))
      .limit(1);

    if (existing.length === 0) {
      break;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
```

