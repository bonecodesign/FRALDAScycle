import { createDatabase } from "../database/client.js";
import { createChildProfileLifecycleRepository } from "../database/child-profile-lifecycle-repository.js";
import { isMainModule } from "../packages/contracts/main-module.js";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function waitFor(ms, signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const timer = setTimeout(done, ms);
    function done() { clearTimeout(timer); signal?.removeEventListener("abort", done); resolve(); }
    signal?.addEventListener("abort", done, { once: true });
  });
}

export async function runChildProfileLifecycleWorker({ mode, env = process.env, createDb = createDatabase, createRepository = createChildProfileLifecycleRepository, wait = waitFor, signal } = {}) {
  let url;
  try { url = new URL(env.DATABASE_URL || "invalid:"); } catch { throw new Error("Informe uma conexão PostgreSQL válida."); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error("A rotina de perfis exige PostgreSQL.");
  if (mode === "once" && !LOCAL_HOSTS.has(url.hostname)) throw new Error("A execução manual aceita somente PostgreSQL local.");
  if (mode === "serve" && (env.NODE_ENV !== "production" || env.CHILD_PROFILE_LIFECYCLE_ENABLED !== "true")) {
    throw new Error("O worker periódico exige produção e CHILD_PROFILE_LIFECYCLE_ENABLED=true.");
  }
  if (!['once', 'serve'].includes(mode)) throw new Error("Use --once localmente ou --serve no serviço periódico.");
  const database = createDb({ databaseUrl: url.toString(), databaseSsl: env.DATABASE_SSL !== "false" });
  const repository = createRepository(database);
  try {
    do {
      const result = await repository.process(new Date());
      console.log(JSON.stringify({ type: "child-profile.lifecycle.completed", ...result }));
      if (mode === "once" || signal?.aborted) break;
      await wait(24 * 60 * 60 * 1000, signal);
    } while (!signal?.aborted);
  } finally { await database.close(); }
}

if (isMainModule(import.meta.url)) {
  const argument = process.argv[2];
  const controller = new AbortController();
  process.once("SIGTERM", () => controller.abort());
  process.once("SIGINT", () => controller.abort());
  await runChildProfileLifecycleWorker({ mode: argument === "--once" ? "once" : argument === "--serve" ? "serve" : argument, signal: controller.signal });
}
