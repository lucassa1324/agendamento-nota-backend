export class Staff {
  constructor(
    public id: string,
    public companyId: string,
    public name: string,
    public email: string,
    public isAdmin: boolean,
    public isSecretary: boolean,
    public isProfessional: boolean,
    public calendarColor: string | null,
    public commissionRate: number,
    public isActive: boolean,
    public createdAt: Date,
    public updatedAt: Date,
  ) {}

  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim().toLowerCase());
  }

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
