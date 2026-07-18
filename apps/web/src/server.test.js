import assert from "node:assert/strict";
import test from "node:test";

import { createWebServer } from "./server.js";

async function withServer(run) {
  const server = createWebServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("serves every public web and installable app route", async () => {
  await withServer(async (baseUrl) => {
    const routes = [
      ["/", "text/html"],
      ["/index.html", "text/html"],
      ["/app.js", "text/javascript"],
      ["/demo-api.js", "text/javascript"],
      ["/styles.css", "text/css"],
      ["/design.css", "text/css"],
      ["/map.html", "text/html"],
      ["/map.js", "text/javascript"],
      ["/map.css", "text/css"],
      ["/dashboard.html", "text/html"],
      ["/dashboard.css", "text/css"],
      ["/notifications.html", "text/html"],
      ["/notifications.js", "text/javascript"],
      ["/manifest.webmanifest", "application/manifest+json"],
      ["/service-worker.js", "text/javascript"],
      ["/icon.svg", "image/svg+xml"],
    ];

    for (const [route, contentType] of routes) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.status, 200, route);
      assert.match(response.headers.get("content-type"), new RegExp(contentType.replace("+", "\\+")));
      assert.ok((await response.arrayBuffer()).byteLength > 0, route);
    }
  });
});

test("returns not found for unknown routes and unsupported methods", async () => {
  await withServer(async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/missing`)).status, 404);
    assert.equal((await fetch(baseUrl, { method: "POST" })).status, 404);
  });
});

test("exposes a complete demonstrative PWA contract", async () => {
  await withServer(async (baseUrl) => {
    const manifest = await (await fetch(`${baseUrl}/manifest.webmanifest`)).json();
    assert.equal(manifest.name, "FraldaCycle");
    assert.equal(manifest.lang, "pt-BR");
    assert.equal(manifest.start_url, "/");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.theme_color, "#087f3f");
    assert.ok(manifest.icons.some((icon) => icon.src === "/icon.svg"));

    const index = await (await fetch(baseUrl)).text();
    assert.match(index, /rel="manifest" href="\/manifest\.webmanifest"/);
    assert.match(index, /Marketplace demonstrativo/);

    const app = await (await fetch(`${baseUrl}/app.js`)).text();
    assert.match(app, /serviceWorker\.register\("\/service-worker\.js"\)/);
    assert.match(app, /from "\.\/demo-api\.js"/);
    assert.match(app, /createDemoApi\(\{/);
    assert.match(app, /apiUrl: window\.FRALDACYCLE_API_URL/);
  });
});

test("identifies simulated data on every primary screen", async () => {
  await withServer(async (baseUrl) => {
    const routes = ["/", "/map.html", "/dashboard.html", "/notifications.html"];

    for (const route of routes) {
      const content = await (await fetch(`${baseUrl}${route}`)).text();
      assert.match(
        content,
        /demonstr|fictíci|simulad/i,
        `${route} must identify its simulated content`,
      );
    }
  });
});

test("keeps every internal navigation link and asset reachable", async () => {
  await withServer(async (baseUrl) => {
    const pages = ["/", "/map.html", "/dashboard.html", "/notifications.html"];

    for (const page of pages) {
      const html = await (await fetch(`${baseUrl}${page}`)).text();
      const references = [
        ...html.matchAll(/(?:href|src)="([^"]+)"/g),
      ].map((match) => match[1]);

      for (const reference of new Set(references)) {
        if (
          reference.startsWith("http") ||
          reference.startsWith("#") ||
          reference.startsWith("mailto:")
        ) {
          continue;
        }

        const target = new URL(reference, `${baseUrl}${page}`);
        const response = await fetch(target);
        assert.equal(
          response.status,
          200,
          `${page} references unavailable resource ${reference}`,
        );
      }
    }
  });
});

test("keeps essential accessibility landmarks on every screen", async () => {
  await withServer(async (baseUrl) => {
    const pages = ["/", "/map.html", "/dashboard.html", "/notifications.html"];

    for (const page of pages) {
      const html = await (await fetch(`${baseUrl}${page}`)).text();
      assert.match(html, /<html lang="pt-BR">/, `${page} language`);
      assert.match(html, /<meta name="viewport"/, `${page} viewport`);
      assert.match(html, /<title>[^<]+<\/title>/, `${page} title`);
      assert.match(html, /<main(?:\s|>)/, `${page} main landmark`);
      assert.match(html, /<nav[^>]+aria-label=/, `${page} labeled navigation`);
      assert.match(html, /aria-current="page"/, `${page} current navigation state`);

      for (const image of html.matchAll(/<img\b[^>]*>/g)) {
        assert.match(image[0], /\salt="[^"]*"/, `${page} image alternative`);
      }
    }
  });
});

test("keeps every offline app shell resource available", async () => {
  await withServer(async (baseUrl) => {
    const worker = await (await fetch(`${baseUrl}/service-worker.js`)).text();
    const shellSource = /const APP_SHELL = \[([\s\S]*?)\];/.exec(worker)?.[1];
    assert.ok(shellSource, "service worker must declare APP_SHELL");

    const resources = [...shellSource.matchAll(/"([^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.ok(resources.length > 0, "APP_SHELL must not be empty");

    for (const resource of resources) {
      const response = await fetch(`${baseUrl}${resource}`);
      assert.equal(
        response.status,
        200,
        `offline resource unavailable: ${resource}`,
      );
    }
  });
});

test("keeps installable app metadata on every primary screen", async () => {
  await withServer(async (baseUrl) => {
    const pages = ["/", "/map.html", "/dashboard.html", "/notifications.html"];

    for (const page of pages) {
      const html = await (await fetch(`${baseUrl}${page}`)).text();
      assert.match(html, /<meta name="theme-color" content="#087f3f"/, page);
      assert.match(html, /<meta name="description" content="[^"]+"/, page);
      assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest"/, page);
      assert.match(html, /<link rel="icon" href="\/icon\.svg"/, page);
    }
  });
});

test("exposes a safe reset for repeatable demonstration sessions", async () => {
  await withServer(async (baseUrl) => {
    const index = await (await fetch(baseUrl)).text();
    assert.match(index, /id="reset-demo"/);
    assert.match(index, />Restaurar dados de teste<\/button>/);

    const app = await (await fetch(`${baseUrl}/app.js`)).text();
    assert.match(app, /resetDemoListings\(localStorage\)/);
    assert.match(app, /window\.confirm/);
  });
});

test("keeps marketplace cards aligned with available map points", async () => {
  await withServer(async (baseUrl) => {
    const app = await (await fetch(`${baseUrl}/app.js`)).text();
    assert.match(app, /\/map\.html\?offer=/);
    assert.match(app, /Salvo localmente · sem ponto no mapa/);

    const map = await (await fetch(`${baseUrl}/map.js`)).text();
    assert.match(map, /new URLSearchParams\(window\.location\.search\)/);
    assert.match(map, /selectTester\(requestedIndex\)/);
  });
});

test("guards marketplace interactions against duplicate and stale updates", async () => {
  await withServer(async (baseUrl) => {
    const app = await (await fetch(`${baseUrl}/app.js`)).text();
    assert.match(app, /submitButton\.disabled = true/);
    assert.match(app, /submitButton\.disabled = false/);
    assert.match(app, /requestId !== listingRequestId/);
    assert.match(app, /requestId !== myListingsRequestId/);
    assert.match(app, /button\.disabled = true/);
  });
});
