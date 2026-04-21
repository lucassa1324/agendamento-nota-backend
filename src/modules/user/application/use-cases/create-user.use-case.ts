import { SigninDTO } from "../../adapters/in/dtos/signin.dto";
import { UserRepository } from "../../adapters/out/user.repository";
import { auth } from "../../../infrastructure/auth/auth";
import { db } from "../../../infrastructure/drizzle/database";
import { companies, account, companySiteCustomizations, user } from "../../../../db/schema";
import { generateUniqueSlug } from "../../../../shared/utils/slug";
import { eq } from "drizzle-orm";
import { TransactionalEmailService } from "../../../notifications/application/transactional-email.service";
import { UserAlreadyExistsError } from "../../domain/error/user-already-exists.error";

export class CreateUserUseCase {
  constructor(private readonly userRepository: UserRepository) { }
  async execute(data: SigninDTO) {
    const transactionalEmailService = new TransactionalEmailService();
    const cpfCnpj = data.cpfCnpj?.replace(/\D/g, "") || null;
    const alreadyExists = await this.userRepository.findByEmail(data.email);

    if (alreadyExists) {
      throw new UserAlreadyExistsError();
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
        cpfCnpj: data.cpfCnpj || "",
        acceptedTerms: true,
        acceptedTermsAt: new Date(),
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
      }).returning({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        ownerId: companies.ownerId,
      });

      await tx.insert(companySiteCustomizations).values({
        id: crypto.randomUUID(),
        companyId: created.id,
      });

      return { newCompany: created, slug };
    });

    if (!response.user.emailVerified) {
      await auth.api.sendVerificationEmail({
        body: {
          email: data.email,
        },
      });
      console.log(`[USER_REGISTER_USE_CASE] E-mail de verificação disparado via Better Auth`);
    }

    await transactionalEmailService
      .sendWelcomeEmail({
        to: data.email,
        name: data.name,
        studioName: result.newCompany.name,
      })
      .catch((error) =>
        console.error("[WELCOME_EMAIL_ERROR]", error),
      );

    return {
      ...response,
      business: result.newCompany,
      slug: result.slug
    };
  }
}
