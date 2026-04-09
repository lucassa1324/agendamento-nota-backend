import Elysia, { t } from "elysia";
import { dnsPlugin } from "../../../plugin";
import { authPlugin } from "../../../../../infrastructure/auth/auth-plugin";
import { db } from "../../../../../infrastructure/drizzle/database";
import { companies } from "../../../../../../db/schema";
import { eq } from "drizzle-orm";

const forbiddenDomains = [
  'aurasistema.com.br'
]

export const DNSController = () => new Elysia({ prefix: '/dns' })
  .use(authPlugin)
  .use(dnsPlugin)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .get('', async ({ user, set, dnsRepository, dnsService }) => {
    const [company] = await db.select().from(companies).where(eq(companies.ownerId, user!.id)).limit(1);
    
    if (!company) {
      set.status = 403;
      return { error: "Company not found" };
    }

    const localDomain = await dnsRepository.findByCompanyId(company.id);

    if (!localDomain) {
      return { domain: null }
    }

    const { verification, verified } = await dnsService.getDomain(localDomain.domain)

    const newStatus = verified ? "ACTIVE" : "PENDING";

    const data = await dnsRepository.update(localDomain.id, { 
      status: newStatus,
      verificationData: verification 
    });

    return { domain: data };
  })
  .post('', async ({ body, user, set, dnsRepository, dnsService }) => {
    const [company] = await db.select().from(companies).where(eq(companies.ownerId, user!.id)).limit(1);

    if (!company) {
      set.status = 403;
      return { error: "Company not found" };
    }

    const existing = await dnsRepository.findByCompanyId(company.id);

    if (existing) {
      set.status = 400;
      return { error: "Company already has a custom domain" };
    }

    if (forbiddenDomains.some(domain => body.name.includes(domain))) {
      set.status = 403;
      return { error: "Você não tem acesso a esse domínio" };
    }

    const req = await dnsService.createDomain({ name: body.name });

    const record = await dnsRepository.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      domain: (body as any).name,
      status: "PENDING",
      verificationData: req?.verification || null
    });

    return record;
  }, {
    body: t.Object({
      name: t.String()
    })
  })
  .delete('/:domain', async ({ params: { domain }, user, set, dnsRepository, dnsService }) => {
    const [company] = await db.select().from(companies).where(eq(companies.ownerId, user!.id)).limit(1);

    if (!company) {
      set.status = 403;
      return { error: "Company not found" };
    }

    const record = await dnsRepository.findByCompanyId(company.id);

    if (!record || record.domain !== domain) {
      set.status = 403;
      return { error: "Permission denied" };
    }

    await dnsService.removeDomain(domain);
    await dnsRepository.delete(record.id);

    return { success: true };
  })