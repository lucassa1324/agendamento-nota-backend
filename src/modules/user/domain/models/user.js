export class User {
    constructor(id, name, email, password, createdAt, updatedAt, deletedAt, notifyNewAppointments = true, notifyCancellations = true, notifyInventoryAlerts = true) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.password = password;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.deletedAt = deletedAt;
        this.notifyNewAppointments = notifyNewAppointments;
        this.notifyCancellations = notifyCancellations;
        this.notifyInventoryAlerts = notifyInventoryAlerts;
    }
}
