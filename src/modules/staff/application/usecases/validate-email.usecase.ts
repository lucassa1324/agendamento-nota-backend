import { Staff } from "../../domain/entities/staff.entity";
import { IStaffRepository } from "../../adapters/out/drizzle/staff.drizzle.repository";

export type ValidateEmailInput = {
  email: string;
  companyId: string;
  excludeStaffId?: string;
};

export type ValidateEmailOutput =
  | { available: true }
  | { available: false; code: "EMAIL_ALREADY_IN_USE"; error: string }
  | { available: false; code: "EMAIL_ALREADY_EXISTS_IN_COMPANY"; error: string }
  | { available: false; code: "INVALID_FORMAT"; error: string };

export class ValidateEmailUseCase {
  constructor(private readonly staffRepository: IStaffRepository) {}

  async execute(input: ValidateEmailInput): Promise<ValidateEmailOutput> {
    const { email, companyId, excludeStaffId } = input;

    // 1. Validar formato
    if (!Staff.isValidEmail(email)) {
      return {
        available: false,
        code: "INVALID_FORMAT",
        error: 'Formato de e-mail inválido.',
      };
    }

    const normalizedEmail = Staff.normalizeEmail(email);

    // 2. Verificar se e-mail existe em OUTRO estúdio (bloqueia primeiro)
    const existsInOtherCompany = await this.staffRepository.existsByEmailInOtherCompany(
      normalizedEmail,
      companyId,
      excludeStaffId,
    );

    if (existsInOtherCompany) {
      return {
        available: false,
        code: "EMAIL_ALREADY_IN_USE",
        error: 'O e-mail "' + normalizedEmail + '" já está vinculado a outro estúdio.',
      };
    }

    // 3. Verificar se e-mail já existe no MESMO estúdio
    const existsInSameCompany = await this.staffRepository.existsByEmailAndCompany(
      normalizedEmail,
      companyId,
    );

    if (existsInSameCompany) {
      return {
        available: false,
        code: "EMAIL_ALREADY_EXISTS_IN_COMPANY",
        error: 'O e-mail "' + normalizedEmail + '" já existe neste estúdio.',
      };
    }

    // Todas as validações passaram — e-mail disponível
    return { available: true };
  }
}
