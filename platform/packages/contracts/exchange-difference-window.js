export const EXCHANGE_DIFFERENCE_WINDOW_MINUTES = 30;
export const EXCHANGE_DIFFERENCE_WARNING_MINUTES = 20;
export const EXCHANGE_DIFFERENCE_MAX_RENEWALS = 1;

export function exchangeDifferenceWindow({ selectedAt, renewalCount = 0 }) {
  const selected = new Date(selectedAt);
  if (!Number.isFinite(selected.getTime()) || !Number.isSafeInteger(renewalCount)
      || renewalCount < 0 || renewalCount > EXCHANGE_DIFFERENCE_MAX_RENEWALS) {
    throw new Error("invalid_exchange_difference_window");
  }
  return Object.freeze({
    selectedAt: selected.toISOString(),
    warningAt: new Date(selected.getTime() + EXCHANGE_DIFFERENCE_WARNING_MINUTES * 60_000).toISOString(),
    expiresAt: new Date(selected.getTime() + EXCHANGE_DIFFERENCE_WINDOW_MINUTES * 60_000).toISOString(),
    renewalCount,
    canRenew: renewalCount < EXCHANGE_DIFFERENCE_MAX_RENEWALS,
  });
}
