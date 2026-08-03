const SECURITY_HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "cache-control": "no-store",
});

export function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, { ...SECURITY_HEADERS, ...extraHeaders });
  response.end(JSON.stringify(payload));
}

export function requestId(request) {
  const supplied = request.headers["x-request-id"];
  return typeof supplied === "string" && supplied.length <= 128
    ? supplied
    : crypto.randomUUID();
}

export function corsHeaders(origin, allowedOrigins) {
  if (!origin || !allowedOrigins.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    vary: "Origin",
  };
}
