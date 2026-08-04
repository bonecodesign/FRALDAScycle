const TARGETS = Object.freeze([
  ["apiHealth", "API_URL", "/health", "api"],
  ["apiReadiness", "API_URL", "/ready", "api"],
  ["site", "SITE_URL", "/site/home", "surface"],
  ["app", "APP_URL", "/app/home", "surface"],
  ["admin", "ADMIN_URL", "/admin/dashboard", "surface"],
]);

function endpoint(base, path, allowHttp) {
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    throw new Error(`${url.hostname || "target"} must use HTTPS`);
  }
  return url;
}

export async function smokeDeployment(env = process.env, { fetchImpl = fetch } = {}) {
  const allowHttp = env.SMOKE_ALLOW_HTTP === "true";
  const targets = TARGETS.map(([name, key, path, kind]) => {
    if (!env[key]) throw new Error(`Missing ${key}`);
    return [name, endpoint(env[key], path, allowHttp), kind];
  });
  const results = [];
  for (const [name, url, kind] of targets) {
    let response;
    try {
      response = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(8_000) });
    } catch {
      throw new Error(`${name} is unavailable`);
    }
    if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}`);
    if (kind === "api") {
      const payload = await response.json();
      if (payload.status !== "ok" && payload.status !== "ready") throw new Error(`${name} returned an invalid contract`);
    } else {
      if (!/^text\/html/.test(response.headers.get("content-type") ?? "")) throw new Error(`${name} did not return HTML`);
      if (response.headers.get("x-content-type-options") !== "nosniff") throw new Error(`${name} is missing security headers`);
    }
    results.push({ name, status: "pass" });
  }
  return Object.freeze({ ready: true, checkedAt: new Date().toISOString(), results });
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  smokeDeployment().then((report) => console.log(JSON.stringify(report, null, 2))).catch((error) => {
    console.error(JSON.stringify({ ready: false, error: error.message }));
    process.exitCode = 1;
  });
}
