const DEFAULT_API_ORIGIN = "http://127.0.0.1:4200";

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function apiOrigin(documentRoot = document.documentElement) {
  return documentRoot.dataset.apiOrigin || DEFAULT_API_ORIGIN;
}

export async function apiRequest(path, {
  method = "GET",
  body,
  origin = apiOrigin(),
  signal,
} = {}) {
  let response;
  try {
    response = await fetch(`${origin}${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch {
    throw new ApiError("network_error", "Não foi possível conectar. Verifique sua internet.", 0);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      payload.error?.code ?? "request_failed",
      payload.error?.message ?? "Não foi possível concluir a solicitação.",
      response.status,
    );
  }
  return payload;
}
