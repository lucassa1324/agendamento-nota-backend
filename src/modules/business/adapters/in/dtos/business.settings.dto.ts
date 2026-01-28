import { t } from "elysia";

export const weeklyOperatingHoursItemDTO = t.Object({
  dayOfWeek: t.String(),
  status: t.String(), // "OPEN" | "CLOSED"
  morningStart: t.Optional(t.String()),
  morningEnd: t.Optional(t.String()),
  afternoonStart: t.Optional(t.String()),
  afternoonEnd: t.Optional(t.String()),
});

export const weeklyOperatingHoursAltDTO = t.Object({
  dayOfWeek: t.String(),
  status: t.String(),
  openTime: t.Optional(t.String()),
  lunchStart: t.Optional(t.String()),
  lunchEnd: t.Optional(t.String()),
  closeTime: t.Optional(t.String()),
});

export const createAgendaBlockDTO = t.Object({
  type: t.Union([
    t.Literal("BLOCK_HOUR"),
    t.Literal("BLOCK_DAY"),
    t.Literal("BLOCK_PERIOD"),
  ]),
  startDate: t.String(), // "dd/mm/aaaa"
  endDate: t.String(),
  startTime: t.Optional(t.String()), // "HH:mm"
  endTime: t.Optional(t.String()),
  reason: t.Optional(t.String()),
});

export const updateOperatingHoursDTO = t.Union([
  t.Object({
    interval: t.String(),
    weekly: t.Array(t.Union([weeklyOperatingHoursItemDTO, weeklyOperatingHoursAltDTO])),
    companyId: t.Optional(t.String()),
    blocks: t.Optional(t.Array(createAgendaBlockDTO)),
  }),
  t.Object({
    timeInterval: t.String(),
    weekly: t.Array(t.Union([weeklyOperatingHoursItemDTO, weeklyOperatingHoursAltDTO])),
    companyId: t.Optional(t.String()),
    blocks: t.Optional(t.Array(createAgendaBlockDTO)),
  })
]);

export type UpdateOperatingHoursDTO = typeof updateOperatingHoursDTO.static;
export type CreateAgendaBlockDTO = typeof createAgendaBlockDTO.static;
