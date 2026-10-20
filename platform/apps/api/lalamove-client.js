import { createHmac, randomUUID } from "node:crypto";

// Isolated native client. The production logistics flow must not call this until
// address consent, tariff approval and provider reconciliation are wired.
export function createLalamoveClient({ key, secret, environment = "sandbox", fetchImpl = fetch, now = Date.now }) {
  if (!key || !secret || !["sandbox", "production"].includes(environment)) throw new Error("Invalid Lalamove configuration");
  const origin = environment === "sandbox" ? "https://rest.sandbox.lalamove.com" : "https://rest.lalamove.com";
  async function request(path, data) {
    const body = JSON.stringify({ data });
    const timestamp = String(now());
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}\r\nPOST\r\n${path}\r\n\r\n${body}`).digest("hex");
    const response = await fetchImpl(origin + path, {
      method: "POST",
      headers: {
        authorization: `hmac ${key}:${timestamp}:${signature}`,
        market: "BR", "request-id": randomUUID(), "content-type": "application/json",
      },
      body, signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Lalamove request failed (${response.status})`);
    const result = await response.json();
    if (!result?.data || typeof result.data !== "object") throw new Error("Invalid Lalamove response");
    return result.data;
  }
  return Object.freeze({
    async quote({ stops, serviceType = "MOTORCYCLE" }) {
      if (!Array.isArray(stops) || stops.length !== 2 || stops.some(stop =>
        typeof stop?.address !== "string" || !stop.address.trim()
        || stop?.coordinates?.lat == null || stop?.coordinates?.lng == null
        || !Number.isFinite(Number(stop.coordinates.lat))
        || !Number.isFinite(Number(stop.coordinates.lng))
        || Number(stop.coordinates.lat) < -90 || Number(stop.coordinates.lat) > 90
        || Number(stop.coordinates.lng) < -180 || Number(stop.coordinates.lng) > 180)) {
        throw new Error("Two geocoded stops are required");
      }
      const data = await request("/v3/quotations", {
        serviceType, language: "pt_BR", stops: stops.map(stop => ({
          address: stop.address, coordinates: {
            lat: String(stop.coordinates.lat), lng: String(stop.coordinates.lng),
          },
        })),
      });
      if (typeof data.quotationId !== "string" || !Number.isFinite(Date.parse(data.expiresAt))
        || !Array.isArray(data.stops) || data.stops.length !== 2
        || data.stops.some(stop => typeof stop.stopId !== "string")) throw new Error("Invalid Lalamove quotation");
      return data;
    },
    async placeOrder({ quotation, sender, recipient }) {
      if (!quotation || Date.parse(quotation.expiresAt) <= now()
        || !Array.isArray(quotation.stops) || quotation.stops.length !== 2
        || typeof quotation.quotationId !== "string"
        || [sender, recipient].some(person => !person?.name || !person?.phone)) {
        throw new Error("Valid unexpired quotation and contacts are required");
      }
      const data = await request("/v3/orders", {
        quotationId: quotation.quotationId,
        sender: { stopId: quotation.stops[0].stopId, name: sender.name, phone: sender.phone },
        recipients: [{ stopId: quotation.stops[1].stopId, name: recipient.name, phone: recipient.phone }],
        isPODEnabled: true,
      });
      if (typeof data.orderId !== "string") throw new Error("Invalid Lalamove order");
      return data;
    },
  });
}
