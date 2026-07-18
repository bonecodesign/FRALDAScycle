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

const server = createApi({
  authService: new AuthService({
    userRepository: new FileUserRepository(usersDataFile),
    secret: process.env.AUTH_SECRET,
  }),
  moderatorEmails,
  notificationService: new NotificationService({
    repository: new FileNotificationRepository(notificationsDataFile),
  }),
  repository: new FileListingRepository(dataFile),
});

server.listen(port, () => {
  console.log(`FraldaCycle API listening on port ${port}`);
});
