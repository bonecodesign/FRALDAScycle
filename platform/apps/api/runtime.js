import { loadConfig } from "./config.js";
import { createApiServer } from "./server.js";
import { createDatabase } from "../../database/client.js";
import { createAuthRepository } from "../../database/auth-repository.js";
import { createAuthService } from "./auth-service.js";
import { migrate } from "../../database/migrate.js";

export async function startRuntime(config = loadConfig()) {
  const database = createDatabase(config);
  await migrate(database);
  const authService = createAuthService(createAuthRepository(database), {
    sessionTtlSeconds: config.sessionTtlSeconds,
  });
  const server = createApiServer({
    config,
    readiness: () => database.readiness(),
    authService,
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
