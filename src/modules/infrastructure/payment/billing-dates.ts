const DEFAULT_BILLING_ANCHOR_DAY = 27;
const BILLING_GRACE_DAYS = 7;

const clampAnchorDay = (anchorDay: number) => {
  if (!Number.isFinite(anchorDay)) {
    return DEFAULT_BILLING_ANCHOR_DAY;
  }

  if (anchorDay < 1) {
    return 1;
  }

  if (anchorDay > 31) {
    return 31;
  }

  return Math.trunc(anchorDay);
};

const getDaysInMonth = (year: number, monthIndex: number) => {
  return new Date(year, monthIndex + 1, 0).getDate();
};

const buildAnchoredDate = (year: number, monthIndex: number, anchorDay: number) => {
  const boundedAnchor = clampAnchorDay(anchorDay);
  const maxDay = getDaysInMonth(year, monthIndex);
  const day = Math.min(boundedAnchor, maxDay);
  return new Date(year, monthIndex, day);
};

export const resolveBillingAnchorDay = (anchorDay?: number | null) => {
  if (typeof anchorDay !== "number") {
    return DEFAULT_BILLING_ANCHOR_DAY;
  }

  return clampAnchorDay(anchorDay);
};

export const calculateAnchoredNextBillingDate = (
  referenceDate: Date,
  anchorDay?: number | null,
) => {
  const resolvedAnchor = resolveBillingAnchorDay(anchorDay);
  let dueDate = buildAnchoredDate(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    resolvedAnchor,
  );

  if (referenceDate.getTime() >= dueDate.getTime()) {
    dueDate = buildAnchoredDate(
      referenceDate.getFullYear(),
      referenceDate.getMonth() + 1,
      resolvedAnchor,
    );
  }

  return dueDate;
};

export const calculateGraceEndDate = (dueDate: Date) => {
  const graceEnd = new Date(dueDate);
  graceEnd.setDate(graceEnd.getDate() + BILLING_GRACE_DAYS);
  return graceEnd;
};

export const calculateBlockedDataRetentionLimit = (
  blockedAt: Date,
  retentionDays = 365,
) => {
  const retentionLimit = new Date(blockedAt);
  retentionLimit.setDate(retentionLimit.getDate() + retentionDays);
  return retentionLimit;
};

export const DEFAULT_ANCHOR_DAY = DEFAULT_BILLING_ANCHOR_DAY;
