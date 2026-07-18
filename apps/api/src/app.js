import { createServer } from "node:http";

import { createListing, ListingValidationError } from "@fraldacycle/domain";

import { AuthenticationError } from "./auth-service.js";
import { isListingStatus, LISTING_STATUS } from "./listing-status.js";
import { InMemoryListingRepository } from "./listing-repository.js";

const headers = {
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "DELETE, GET, PATCH, POST, OPTIONS",
  "access-control-allow-origin": "*",
  "content-type": "application/json; charset=utf-8",
};

function send(response, status, body) {
  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

function publicListing(listing) {
  const { ownerId, ...value } = listing;
  return value;
}

function read(request) {
  return new Promise((resolve, reject) => {
    let value = "";
    request.on("data", (chunk) => (value += chunk));
    request.on("end", () => {
      try {
        resolve(value ? JSON.parse(value) : {});
      } catch {
        reject(new Error("Request body must be valid JSON"));
      }
    });
    request.on("error", reject);
  });
}

async function userFor(request, authService) {
  const token = /^Bearer (.+)$/.exec(request.headers.authorization ?? "")?.[1];
  if (!token) throw new AuthenticationError("Authentication token is required");
  return authService.authenticate(token);
}

function fail(response, error) {
  if (error instanceof AuthenticationError) send(response, error.statusCode, { error: error.message });
  else send(response, 500, { error: "Unable to complete request" });
}

export function createApi({
  repository = new InMemoryListingRepository(),
  authService,
  moderatorEmails = [],
  notificationService,
} = {}) {
  return createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const listingId = /^\/listings\/([^/]+)$/.exec(url.pathname)?.[1];
    const moderationId = /^\/moderation\/listings\/([^/]+)$/.exec(url.pathname)?.[1];

    if (request.method === "OPTIONS") {
      response.writeHead(204, headers);
      response.end();
      return;
    }

    if (request.method === "POST" && ["/auth/register", "/auth/login"].includes(url.pathname)) {
      try {
        const action = url.pathname.endsWith("register") ? "register" : "login";
        send(response, action === "register" ? 201 : 200, await authService[action](await read(request)));
      } catch (error) {
        if (error instanceof AuthenticationError) send(response, error.statusCode, { error: error.message });
        else send(response, 400, { error: error.message });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      send(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/my/notifications") {
      try {
        const user = await userFor(request, authService);
        send(response, 200, { notifications: await notificationService.repository.listByUser(user.id) });
      } catch (error) {
        fail(response, error);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/my/listings") {
      try {
        const user = await userFor(request, authService);
        send(response, 200, { listings: (await repository.listByOwner(user.id)).map(publicListing) });
      } catch (error) {
        fail(response, error);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/listings") {
      send(response, 200, { listings: (await repository.list({
        city: url.searchParams.get("city") ?? undefined,
        state: url.searchParams.get("state") ?? undefined,
        type: url.searchParams.get("type") ?? undefined,
      })).map(publicListing) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/listings") {
      try {
        const user = await userFor(request, authService);
        const listing = createListing({ ...(await read(request)), ownerId: user.id });
        send(response, 201, { listing: publicListing(await repository.create(listing)) });
      } catch (error) {
        if (error instanceof AuthenticationError) fail(response, error);
        else if (error instanceof ListingValidationError) send(response, 400, { errors: error.errors });
        else send(response, 400, { error: error.message });
      }
      return;
    }

    if (request.method === "PATCH" && moderationId) {
      try {
        const user = await userFor(request, authService);
        if (!moderatorEmails.includes(user.email)) throw new AuthenticationError("Moderator access is required", 403);
        const { status } = await read(request);
        if (!isListingStatus(status) || status === LISTING_STATUS.PENDING) {
          send(response, 400, { error: "A review must set active, closed, or blocked" });
          return;
        }
        const listing = await repository.updateStatusById(decodeURIComponent(moderationId), status);
        if (!listing) {
          send(response, 404, { error: "Listing not found" });
          return;
        }
        await notificationService?.notifyListingStatus(listing);
        send(response, 200, { listing: publicListing(listing) });
      } catch (error) {
        fail(response, error);
      }
      return;
    }

    if (request.method === "DELETE" && listingId) {
      try {
        const user = await userFor(request, authService);
        if (!(await repository.deleteByIdAndOwner(decodeURIComponent(listingId), user.id))) {
          send(response, 404, { error: "Listing not found" });
          return;
        }
        send(response, 200, { deleted: true });
      } catch (error) {
        fail(response, error);
      }
      return;
    }

    send(response, 404, { error: "Not found" });
  });
}
