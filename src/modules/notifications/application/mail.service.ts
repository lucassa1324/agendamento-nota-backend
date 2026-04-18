import { Resend } from "resend";

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export class MailService {
  private readonly resend: Resend;
  private readonly defaultFrom: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.defaultFrom = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    
    if (!apiKey) {
      console.warn("[MAIL_SERVICE] RESEND_API_KEY is missing!");
    }
    
    this.resend = new Resend(apiKey || "re_placeholder");
  }

  async sendMail(options: SendMailOptions) {
    const from = options.from || `Aura <${this.defaultFrom}>`;
    
    try {
      const { data, error } = await this.resend.emails.send({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        console.error("[MAIL_SERVICE] Error sending email via Resend:", error);
        throw error;
      }

      return data;
    } catch (e) {
      console.error("[MAIL_SERVICE] Fatal error sending email:", e);
      throw e;
    }
  }
}
