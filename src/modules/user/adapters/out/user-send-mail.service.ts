import { MailService } from "../../../notifications/application/mail.service";
import { TemplateService } from "../../../notifications/application/template.service";

export class UserSendMail {
  private readonly mailService: MailService;
  private readonly templateService: TemplateService;

  constructor() {
    this.mailService = new MailService();
    this.templateService = new TemplateService();
  }

  async sendVerificationEmail(email: string, name: string, verificationUrl: string) {
    const html = await this.templateService.render("verify-email", {
      name: name || "usuário",
      verificationUrl,
    });

    return this.mailService.sendMail({
      to: email,
      subject: "Verifique seu e-mail",
      html,
    });
  }
}
