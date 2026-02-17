export class User {
  constructor(
    public id: string,
    public name: string,
    public email: string,
    public password: string,
    public createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
    public notifyNewAppointments: boolean = true,
    public notifyCancellations: boolean = true,
    public notifyInventoryAlerts: boolean = true
  ) {}
}
