import { ServiceError } from './service-error.js';

const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const QUIET_HOURS_EXEMPT = new Set([
  'email_verification', 'password_recovery', 'admin_login_mfa', 'security_alert',
  'payment_status', 'payment_dispute', 'transaction_cancellation', 'delivery_exception',
]);
const QUIET_HOURS_DELAYABLE = new Set(['payment_reminder', 'delivery_reminder', 'general_reminder']);

export function validateOperationalPreferences(input) {
  const invalid = () => { throw new ServiceError('invalid_operational_preferences', 422, 'Informe os canais, a versão atual e um horário silencioso válido com fuso horário.'); };
  if (!exactKeys(input, ['channels', 'quietHours', 'expectedVersion'])
    || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0
    || !exactKeys(input.channels, ['email', 'sms', 'push'])
    || Object.values(input.channels).some(value => typeof value !== 'boolean')
    || !exactKeys(input.quietHours, ['enabled', 'start', 'end', 'timeZone'])) invalid();
  const { enabled, start, end, timeZone } = input.quietHours;
  if (typeof enabled !== 'boolean' || typeof timeZone !== 'string' || timeZone.length > 64) invalid();
  let canonicalZone;
  try { canonicalZone = new Intl.DateTimeFormat('en', { timeZone }).resolvedOptions().timeZone; } catch { invalid(); }
  if (enabled ? !timePattern.test(start ?? '') || !timePattern.test(end ?? '') || start === end : start !== null || end !== null) invalid();
  return { channels: { email: input.channels.email, sms: input.channels.sms, push: input.channels.push }, quietHours: { enabled, start, end, timeZone: canonicalZone }, expectedVersion: input.expectedVersion };
}

// Apenas uma decisão local para lembretes opcionais. Nunca envia nem agenda mensagens.
export function optionalReminderIsQuiet(preferences, instant) {
  if (!preferences?.configured || preferences.quietHours?.enabled !== true) return false;
  const { start, end, timeZone } = preferences.quietHours;
  if (!timePattern.test(start) || !timePattern.test(end) || start === end) throw new RangeError('Invalid quiet hours');
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid instant');
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const time = `${parts.find(part => part.type === 'hour').value}:${parts.find(part => part.type === 'minute').value}`;
  return start < end ? time >= start && time < end : time >= start || time < end;
}

// Política local aprovada em 2026-10-18. Não envia, agenda nem posterga jobs.
// Categorias desconhecidas não são silenciosamente retidas; ficam para a política
// de despacho do canal decidir até que sua criticidade seja classificada.
export function notificationDispatchDecision(kind, preferences, instant) {
  if (QUIET_HOURS_EXEMPT.has(kind)) return 'deliver';
  if (!QUIET_HOURS_DELAYABLE.has(kind)) return 'unclassified';
  return optionalReminderIsQuiet(preferences, instant) ? 'defer' : 'deliver';
}
