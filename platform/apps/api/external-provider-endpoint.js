import { isIP } from "node:net";

// Validate fixed server-side endpoints BEFORE sending a Bearer/Basic credential.
// This is a configuration guard, not a replacement for outbound-network policy
// or DNS pinning: a public DNS name can still resolve to a private address.
export function validateExternalProviderEndpoint(value, field, { allowQuery = false } = {}) {
  if (typeof value !== "string" || !value || value.trim() !== value ||
      /[\u0000-\u0020\u007f]/.test(value)) {
    throw new Error(field + " must be a valid HTTPS URL");
  }
  let url;
  try { url = new URL(value); }
  catch { throw new Error(field + " must be a valid HTTPS URL"); }
  if (url.protocol !== "https:") throw new Error(field + " must use HTTPS");
  if (url.username || url.password) throw new Error(field + " must not contain credentials");
  if (url.hash || (!allowQuery && url.search)) {
    throw new Error(field + " must not contain query parameters or fragments");
  }
  // URL canonicalizes decimal/octal/short IPv4 forms before hostname checks.
  // Reject all IP literals (including IPv6-mapped IPv4), and hostnames commonly
  // used for loopback, local multicast resolution or instance metadata.
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const unbracketed = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1) : hostname;
  if (isIP(unbracketed) !== 0 ||
      unbracketed === "localhost" || unbracketed.endsWith(".localhost") ||
      unbracketed.endsWith(".local") || unbracketed.endsWith(".internal") ||
      !unbracketed.includes(".")) {
    throw new Error(field + " must use a public DNS hostname, not a local or IP endpoint");
  }
  return url.toString();
}
