import { IBusinessRepository } from "../../domain/ports/business.repository";
import { UpdateOperatingHoursDTO } from "../../adapters/in/dtos/business.settings.dto";
import { BusinessSiteCustomization } from "../../domain/entities/business.entity";

export class UpdateOperatingHoursUseCase {
  constructor(private businessRepository: IBusinessRepository) { }

  async execute(companyId: string, userId: string, data: UpdateOperatingHoursDTO) {
    const normalized = data.weekly.map((w: any) => {
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

    let slotInterval = (data as any).interval ?? (data as any).slotInterval ?? (data as any).timeInterval;

    // Normalizar para HH:mm se for apenas números (ex: "10" -> "00:10")
    if (typeof slotInterval === 'number') {
      const hours = Math.floor(slotInterval / 60);
      const minutes = slotInterval % 60;
      slotInterval = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } else if (typeof slotInterval === 'string' && /^\d+$/.test(slotInterval)) {
      const totalMin = parseInt(slotInterval);
      const hours = Math.floor(totalMin / 60);
      const minutes = totalMin % 60;
      slotInterval = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    console.log(`>>> [BACK_SAVE_SETTINGS] Salvando intervalo: ${slotInterval} para a empresa: ${companyId}`);

    // Buscar a configuração atual para não sobrescrever outros campos do appointmentFlow
    const business = await this.businessRepository.findById(companyId);
    const currentCustomization = business?.siteCustomization as any;
    const currentFlow = currentCustomization?.appointmentFlow || {};

    const config: Partial<BusinessSiteCustomization> = {
      appointmentFlow: {
        ...currentFlow,
        step3Times: {
          ...(currentFlow.step3Times || currentFlow.step3Time || currentFlow.step_3_time || {}),
          timeSlotSize: slotInterval
        }
      } as any,
    };

    await this.businessRepository.updateConfig(companyId, userId, config);
    return { success: true };
  }
}
