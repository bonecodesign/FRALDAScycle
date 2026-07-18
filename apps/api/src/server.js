import {
  createDatabasePool,
  PostgresListingRepository,
  PostgresNotificationRepository,
  PostgresUserRepository,
} from "@fraldacycle/database";

import { AuthService } from "./auth-service.js";
import { createApi } from "./app.js";
import { FileListingRepository } from "./file-listing-repository.js";
import { FileNotificationRepository } from "./file-notification-repository.js";
import { FileUserRepository } from "./file-user-repository.js";
import { NotificationService } from "./notification-service.js";

const port = Number(process.env.PORT ?? 3000);
const dataFile = process.env.LISTINGS_DATA_FILE ?? "data/listings.json";
const usersDataFile = process.env.USERS_DATA_FILE ?? "data/users.json";
const notificationsDataFile =
  process.env.NOTIFICATIONS_DATA_FILE ?? "data/notifications.json";
const moderatorEmails = (process.env.MODERATOR_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

let userRepository;
let listingRepository;
let notificationRepository;

if (process.env.DATABASE_URL) {
  const pool = createDatabasePool(process.env.DATABASE_URL);
  userRepository = new PostgresUserRepository(pool);
  listingRepository = new PostgresListingRepository(pool);
  notificationRepository = new PostgresNotificationRepository(pool);
} else {
  userRepository = new FileUserRepository(usersDataFile);
  listingRepository = new FileListingRepository(dataFile);
  notificationRepository = new FileNotificationRepository(notificationsDataFile);
}

const server = createApi({
  authService: new AuthService({
    userRepository,
    secret: process.env.AUTH_SECRET,
  }),
  moderatorEmails,
  notificationService: new NotificationService({
    repository: notificationRepository,
  }),
  repository: listingRepository,
});

server.listen(port, () => {
  console.log(`FraldaCycle API listening on port ${port}`);
});
