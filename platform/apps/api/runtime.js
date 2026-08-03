import { loadConfig } from "./config.js";
import { createApiServer } from "./server.js";
import { createDatabase } from "../../database/client.js";
import { migrate } from "../../database/migrate.js";

export async function startRuntime(config = loadConfig()) {
  const database = createDatabase(config);
  await migrate(database);
  const server = createApiServer({
    config,
    readiness: () => database.readiness(),
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
