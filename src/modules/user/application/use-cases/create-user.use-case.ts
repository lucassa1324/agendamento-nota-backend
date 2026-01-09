import { SigninDTO } from "../../adapters/in/dtos/signin.dto";
import { UserRepository } from "../../adapters/out/user.repository";
import { UserAlreadyExistsError } from "../../domain/error/user-already-exists.error";
import { auth } from "../../../infrastructure/auth/auth";

export class CreateUserUseCase {
  constructor(private readonly userRepository: UserRepository) { }
  async execute(data: SigninDTO) {
    const alreadyExists = await this.userRepository.findByEmail(data.email);

    if (alreadyExists) throw new UserAlreadyExistsError();

    await auth.api.signUpEmail({
      body: {
        email: data.email,
        password: data.password,
        name: data.name,
      },
    });
  }
}
