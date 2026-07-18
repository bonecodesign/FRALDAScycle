import { createServer } from "node:http";

import {
  createListing,
  ListingValidationError,
} from "@fraldacycle/domain";

import { AuthenticationError } from "./auth-service.js";
import { InMemoryListingRepository } from "./listing-repository.js";

const JSON_HEADERS = {
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-origin": "*",
  "content-type": "application/json; charset=utf-8",
};
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

async function handleAuthentication(
  response,
  authService,
  action,
  statusCode,
  request,
) {
  if (!authService) {
    sendJson(response, 503, { error: "Authentication is not configured" });
    return;
  }

  try {
    const result = await authService[action](await readJson(request));
    sendJson(response, statusCode, result);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      sendJson(response, error.statusCode, { error: error.message });
      return;
    }

    sendJson(response, 400, { error: error.message });
  }
}

export function createApi({
  repository = new InMemoryListingRepository(),
  authService,
} = {}) {
  return createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");

    if (request.method === "OPTIONS") {
      response.writeHead(204, JSON_HEADERS);
      response.end();
      return;
    }

    if (request.method === "POST" && url.pathname === "/auth/register") {
      await handleAuthentication(
        response,
        authService,
        "register",
        201,
        request,
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/auth/login") {
      await handleAuthentication(response, authService, "login", 200, request);
      return;
    }

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
