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

  async sendWelcomeEmail(input: WelcomeEmailInput) {
    if (!this.resend) return false;
    await this.resend.emails.send({
      from: this.fromEmail,
      to: input.to,
      subject: "Bem-vindo(a)! Seu período de teste começou",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>Olá, ${input.name} 👋</h2>
          <p>Seu estúdio <strong>${input.studioName}</strong> foi criado com sucesso.</p>
          <p>Seu teste gratuito já está ativo. Agora você pode configurar serviços e começar a receber agendamentos.</p>
          <p>Bom trabalho e boas vendas!</p>
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
