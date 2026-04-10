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
