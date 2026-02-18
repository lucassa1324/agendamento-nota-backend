export class UserAlreadyExistsError extends Error {
    constructor() {
        super(`Usuário com este e-mail já existe.`);
        this.name = "UserAlreadyExistsError";
    }
}
