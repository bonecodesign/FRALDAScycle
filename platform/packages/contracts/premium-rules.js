export const PREMIUM_MONTHLY_CENTS = 1290;
export const FREE_LISTING_LIMIT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new RangeError('An explicit timestamp with timezone is required');
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new RangeError('Invalid timestamp');
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendar = new Date(value.slice(0, 10) + 'T00:00:00Z');
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() + 1 !== month || calendar.getUTCDate() !== day) throw new RangeError('Invalid calendar date');
  return result;
}

// Não concede assinatura, não cobra e não presume um mês como trinta dias.
// O período pago deve vir de uma fonte de pagamento homologada ou fixture isolada.
export function premiumEntitlement(subscription, now) {
  const current = instant(now);
  if (subscription === null) return { state: 'free', benefitsActive: false, paidThrough: null, graceThrough: null, renewalEnabled: false, billingAllowed: false };
  if (!subscription || typeof subscription.renewalEnabled !== 'boolean') throw new TypeError('Invalid subscription');
  const start = instant(subscription.paidPeriodStart);
  const end = instant(subscription.paidPeriodEnd);
  if (start >= end || current < start) throw new RangeError('Invalid paid period');
  let grace = null;
  if (subscription.renewalFailedAt !== null) {
    // Timestamp original da falha; não usar horário de retry/recepção de webhook.
    const failure = instant(subscription.renewalFailedAt);
    if (failure < end || failure > current) throw new RangeError('Renewal failure must belong to the due period');
    grace = failure + 3 * DAY_MS;
  }
  const state = current < end ? 'active' : grace !== null && current < grace ? 'grace' : 'free';
  return {
    state, benefitsActive: state !== 'free', paidThrough: new Date(end).toISOString(),
    graceThrough: grace === null ? null : new Date(grace).toISOString(),
    renewalEnabled: subscription.renewalEnabled, billingAllowed: false,
  };
}

export function cancelPremiumRenewal(subscription) {
  if (!subscription || typeof subscription.renewalEnabled !== 'boolean') throw new TypeError('Invalid subscription');
  return { ...subscription, renewalEnabled: false };
}

// Planeja a pausa; a futura persistência precisa revalidar atomicamente este plano.
// Anúncios e transações nunca são alterados por este módulo.
export function freeListingPlan({ userId, listings, selectedIds = null }) {
  if (typeof userId !== 'string' || !userId || !Array.isArray(listings)) throw new TypeError('Invalid account or listings');
  const seen = new Set();
  const eligible = [];
  const preservedIds = [];
  for (const listing of listings) {
    if (!listing || typeof listing.id !== 'string' || !listing.id || seen.has(listing.id) || listing.sellerId !== userId) throw new RangeError('Duplicate or unowned listing');
    seen.add(listing.id);
    if (listing.status !== 'published') { preservedIds.push(listing.id); continue; }
    if (typeof listing.ongoingTransaction !== 'boolean') throw new TypeError('Transaction state is required');
    if (listing.ongoingTransaction) { preservedIds.push(listing.id); continue; }
    eligible.push({ id: listing.id, publishedAt: instant(listing.publishedAt) });
  }
  const available = new Set(eligible.map(listing => listing.id));
  let keepIds;
  if (selectedIds === null) {
    keepIds = eligible.sort((a, b) => b.publishedAt - a.publishedAt || a.id.localeCompare(b.id, 'en')).slice(0, FREE_LISTING_LIMIT).map(listing => listing.id);
  } else {
    if (!Array.isArray(selectedIds) || selectedIds.length > FREE_LISTING_LIMIT || new Set(selectedIds).size !== selectedIds.length || selectedIds.some(id => !available.has(id))) throw new RangeError('Select at most three owned, available listings');
    keepIds = [...selectedIds];
  }
  const kept = new Set(keepIds);
  return { keepIds, pauseIds: eligible.filter(listing => !kept.has(listing.id)).map(listing => listing.id), preservedIds };
}
