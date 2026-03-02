export class AsaasDateHandler extends Date {
	constructor() {
		super();
	}

	getTomorrou(date: Date): Date {
		date.setDate(date.getDate() + 1);
		return date;
	}

	getFormatedDate(date: Date): string {
		return date.toISOString().split("T")[0].replaceAll(":", "-");
	}

	getTomorrowFormated(): string {
		return this.getFormatedDate(this.getTomorrou(new Date()));
	}
}
