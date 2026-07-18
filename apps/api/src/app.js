import { createServer } from "node:http";

import { createListing, ListingValidationError } from "@fraldacycle/domain";

import { AuthenticationError } from "./auth-service.js";
import { isListingStatus, LISTING_STATUS } from "./listing-status.js";
import { InMemoryListingRepository } from "./listing-repository.js";

const JSON_HEADERS = {
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "DELETE, GET, PATCH, POST, OPTIONS",
  "access-control-allow-origin": "*",
  "content-type": "application/json; charset=utf-8",
};
const MAX_BODY_SIZE = 100_000;

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, JSON_HEADERS);
  response.end(JSON.stringify(body));
}

function publicListing(listing) {
  const { ownerId, ...publicData } = listing;
  return publicData;
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
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Request body must be valid JSON"));
      }
    });
    request.on("error", reject);
  });
}

async function authenticateRequest(request, authService) {
  if (!authService) throw new AuthenticationError("Authentication is not configured", 503);

  const match = /^Bearer (.+)$/.exec(request.headers.authorization ?? "");
  if (!match) throw new AuthenticationError("Authentication token is required");

  return authService.authenticate(match[1]);
}

function sendError(response, error) {
  if (error instanceof AuthenticationError) {
    sendJson(response, error.statusCode, { error: error.message });
    return;
  }

  sendJson(response, 500, { error: "Unable to complete request" });
}

function isModerator(user, moderatorEmails) {
  return moderatorEmails.includes(user.email);
}

export function createApi({
  repository = new InMemoryListingRepository(),
  authService,
  moderatorEmails = [],
} = {}) {
  return createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const listingId = /^\/listings\/([^/]+)$/.exec(url.pathname)?.[1];
    const moderationId = /^\/moderation\/listings\/([^/]+)$/.exec(url.pathname)?.[1];

    if (request.method === "OPTIONS") {
      response.writeHead(204, JSON_HEADERS);
      response.end();
      return;
    }

    if (request.method === "POST" && ["/auth/register", "/auth/login"].includes(url.pathname)) {
      try {
        if (!authService) throw new AuthenticationError("Authentication is not configured", 503);
        const action = url.pathname.endsWith("register") ? "register" : "login";
        const result = await authService[action](await readJson(request));
        sendJson(response, action === "register" ? 201 : 200, result);
      } catch (error) {
        if (error instanceof AuthenticationError) sendJson(response, error.statusCode, { error: error.message });
        else sendJson(response, 400, { error: error.message });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/my/listings") {
      try {
        const user = await authenticateRequest(request, authService);
        sendJson(response, 200, { listings: (await repository.listByOwner(user.id)).map(publicListing) });
      } catch (error) {
        sendError(response, error);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/listings") {
      const listings = await repository.list({
        city: url.searchParams.get("city") ?? undefined,
        state: url.searchParams.get("state") ?? undefined,
        type: url.searchParams.get("type") ?? undefined,
      });
      sendJson(response, 200, { listings: listings.map(publicListing) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/listings") {
      try {
        const user = await authenticateRequest(request, authService);
        const listing = createListing({ ...(await readJson(request)), ownerId: user.id });
        sendJson(response, 201, { listing: publicListing(await repository.create(listing)) });
      } catch (error) {
        if (error instanceof AuthenticationError) sendError(response, error);
        else if (error instanceof ListingValidationError) sendJson(response, 400, { errors: error.errors });
        else sendJson(response, 400, { error: error.message });
      }
      return;
    }

    if (request.method === "PATCH" && moderationId) {
      try {
        const user = await authenticateRequest(request, authService);
        if (!isModerator(user, moderatorEmails)) throw new AuthenticationError("Moderator access is required", 403);

        const { status } = await readJson(request);
        if (!isListingStatus(status) || status === LISTING_STATUS.PENDING) {
          sendJson(response, 400, { error: "A review must set active, closed, or blocked" });
          return;
        }

        const listing = await repository.updateStatusById(decodeURIComponent(moderationId), status);
        if (!listing) {
          sendJson(response, 404, { error: "Listing not found" });
          return;
        }

        sendJson(response, 200, { listing: publicListing(listing) });
      } catch (error) {
        sendError(response, error);
      }
      return;
    }

    if (request.method === "DELETE" && listingId) {
      try {
        const user = await authenticateRequest(request, authService);
        if (!(await repository.deleteByIdAndOwner(decodeURIComponent(listingId), user.id))) {
          sendJson(response, 404, { error: "Listing not found" });
          return;
        }
        sendJson(response, 200, { deleted: true });
      } catch (error) {
        sendError(response, error);
      }
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  });
}
