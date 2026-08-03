const SESSION_COOKIE = "fc_session";

export function sessionCookie(token, { secure = true, maxAge }) {
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

export function clearSessionCookie({ secure = true } = {}) {
  return sessionCookie("", { secure, maxAge: 0 });
}

export function readSessionCookie(header = "") {
  for (const pair of header.split(";")) {
    const [name, ...value] = pair.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join("="));
  }
  return null;
}
