export function pagination(params, { defaultLimit = 50, maxLimit = 100 } = {}) {
  return {
    limit: Math.min(maxLimit, Math.max(1, Number(params.limit) || defaultLimit)),
    offset: Math.max(0, Number(params.offset) || 0),
  };
}
