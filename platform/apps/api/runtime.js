import { loadConfig } from "./config.js";
import { createApiServer } from "./server.js";
import { createDatabase } from "../../database/client.js";
import { createAuthRepository } from "../../database/auth-repository.js";
import { createNotificationRepository } from "../../database/notification-repository.js";
import { createMarketplaceRepository } from "../../database/marketplace-repository.js";
import { createAuthService } from "./auth-service.js";
import { createNotificationService } from "./notifications.js";
import { createMarketplaceService } from "./marketplace-service.js";
import { migrate } from "../../database/migrate.js";

export async function startRuntime(config = loadConfig()) {
  const database = createDatabase(config);
  await migrate(database);
  const notificationService = createNotificationService(createNotificationRepository(database));
  const authService = createAuthService(createAuthRepository(database), {
    sessionTtlSeconds: config.sessionTtlSeconds,
    notificationService,
  });
  const marketplaceService = createMarketplaceService(createMarketplaceRepository(database));
  const server = createApiServer({
    config,
    readiness: () => database.readiness(),
    authService,
    marketplaceService,
  });

  server.listen(config.port, config.host, () => {
    console.log(`FraldaCycle API: http://${config.host}:${config.port}`);
  });

  async function shutdown(signal) {
    console.log(`Stopping FraldaCycle API after ${signal}`);
    server.close(async () => {
      await database.close();
      process.exitCode = 0;
    });
  }
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  return { server, database };
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  startRuntime().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
