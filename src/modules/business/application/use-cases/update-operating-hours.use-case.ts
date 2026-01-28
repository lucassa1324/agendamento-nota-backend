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

    const slotInterval = (data as any).interval ?? (data as any).timeInterval;
    const config: Partial<BusinessSiteCustomization> = {
      appointmentFlow: {
        step_1_services: undefined as any,
        step_2_date: undefined as any,
        step_3_time: { slotInterval } as any,
        step_4_confirmation: undefined as any,
      },
    };

    await this.businessRepository.updateConfig(companyId, userId, config);
    return { success: true };
  }
}
