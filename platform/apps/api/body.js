export async function readJson(request, { limit = 32_768 } = {}) {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    const error = new TypeError("Content-Type must be application/json");
    error.status = 415;
    error.code = "unsupported_media_type";
    throw error;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      const error = new RangeError("Request body is too large");
      error.status = 413;
      error.code = "payload_too_large";
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new SyntaxError("Invalid JSON");
    error.status = 400;
    error.code = "invalid_json";
    throw error;
  }
}
