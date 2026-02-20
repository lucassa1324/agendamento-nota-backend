export class UpdateOperatingHoursUseCase {
    constructor(businessRepository) {
        this.businessRepository = businessRepository;
    }
    async execute(companyId, userId, data) {
        const normalized = data.weekly.map((w) => {
            if ("openTime" in w || "closeTime" in w) {
                return {
                    dayOfWeek: String(w.dayOfWeek),
                    status: String(w.status).toUpperCase(),
                    morningStart: w.openTime ?? null,
                    morningEnd: w.lunchStart ?? null,
                    afternoonStart: w.lunchEnd ?? null,
                    afternoonEnd: w.closeTime ?? null,
                };
            }
            return {
                dayOfWeek: String(w.dayOfWeek),
                status: String(w.status).toUpperCase(),
                morningStart: w.morningStart ?? null,
                morningEnd: w.morningEnd ?? null,
                afternoonStart: w.afternoonStart ?? null,
                afternoonEnd: w.afternoonEnd ?? null,
            };
        });
        const ok = await this.businessRepository.setOperatingHours(companyId, userId, normalized);
        if (!ok) {
            throw new Error("Unauthorized or company not found");
        }
        let slotInterval = data.interval ?? data.slotInterval ?? data.timeInterval;
        // Normalizar para HH:mm se for apenas números (ex: "10" -> "00:10")
        if (typeof slotInterval === 'number') {
            const hours = Math.floor(slotInterval / 60);
            const minutes = slotInterval % 60;
            slotInterval = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }
        else if (typeof slotInterval === 'string' && /^\d+$/.test(slotInterval)) {
            const totalMin = parseInt(slotInterval);
            const hours = Math.floor(totalMin / 60);
            const minutes = totalMin % 60;
            slotInterval = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }
        console.log(`>>> [BACK_SAVE_SETTINGS] Salvando intervalo: ${slotInterval} para a empresa: ${companyId}`);
        // Buscar a configuração atual para não sobrescrever outros campos do appointmentFlow
        const business = await this.businessRepository.findById(companyId);
        const currentCustomization = business?.siteCustomization;
        const currentFlow = currentCustomization?.appointmentFlow || {};
        const config = {
            appointmentFlow: {
                ...currentFlow,
                step3Times: {
                    ...(currentFlow.step3Times || currentFlow.step3Time || currentFlow.step_3_time || {}),
                    timeSlotSize: slotInterval
                }
            },
        };
        await this.businessRepository.updateConfig(companyId, userId, config);
        return { success: true };
    }
}
