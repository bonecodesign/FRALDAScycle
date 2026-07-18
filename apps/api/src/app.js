import { createServer } from "node:http";

import {
  createListing,
  ListingValidationError,
} from "@fraldacycle/domain";

import { InMemoryListingRepository } from "./listing-repository.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const MAX_BODY_SIZE = 100_000;

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, JSON_HEADERS);
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > MAX_BODY_SIZE) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Request body must be valid JSON"));
      }
    });

    request.on("error", reject);
  });
}

export function createApi({ repository = new InMemoryListingRepository() } = {}) {
  return createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/listings") {
      const listings = await repository.list({
        city: url.searchParams.get("city") ?? undefined,
        state: url.searchParams.get("state") ?? undefined,
        type: url.searchParams.get("type") ?? undefined,
      });

      sendJson(response, 200, { listings });
      return;
    }

    if (request.method === "POST" && url.pathname === "/listings") {
      try {
        const listing = createListing(await readJson(request));
        const storedListing = await repository.create(listing);

        sendJson(response, 201, { listing: storedListing });
      } catch (error) {
        if (error instanceof ListingValidationError) {
          sendJson(response, 400, { errors: error.errors });
          return;
        }

        sendJson(response, 400, { error: error.message });
      }

      return;
    }

    sendJson(response, 404, { error: "Not found" });
  });
}
