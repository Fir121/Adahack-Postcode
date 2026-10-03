import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { proxyApiRequest } from "../lib/api/proxy";

test("proxy logs correlate responses, separate timeout/tunnel/network failures and omit sensitive data", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "our-patch-proxy-log-"));
  const file = join(directory, "proxy.log");
  const previous = {
    base: process.env.API_BASE_URL,
    file: process.env.API_LOG_FILE,
    level: process.env.API_LOG_LEVEL,
  };
  process.env.API_BASE_URL = "https://user:verysecret@upstream.example/api/v1";
  process.env.API_LOG_FILE = file;
  process.env.API_LOG_LEVEL = "info";
  for (const level of ["info", "warn", "error"] as const)
    t.mock.method(console, level, () => {});
  const metrics = () =>
    proxyApiRequest(new Request("http://app/api/backend/metrics"), ["metrics"]);
  const records = () =>
    readFileSync(file, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  try {
    t.mock.method(
      globalThis,
      "fetch",
      async (_url: string, options: RequestInit) => {
        const id = new Headers(options.headers).get("x-request-id");
        assert.ok(id);
        return Response.json([], { headers: { "x-request-id": id! } });
      },
    );
    let response = await metrics();
    assert.equal(response.status, 200);
    let record = records().at(-1);
    assert.equal(record.request_id, response.headers.get("x-request-id"));
    assert.equal(record.upstream_request_id, record.request_id);
    assert.equal(record.upstream_host, "upstream.example");
    assert.ok(record.duration_ms >= 0);
    assert.equal(record.event, "upstream_response");

    t.mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response("<html>ERR_NGROK_3200</html>", {
          status: 503,
          headers: { "content-type": "text/html" },
        }),
    );
    response = await metrics();
    assert.equal(response.status, 503);
    record = records().at(-1);
    assert.equal(record.event, "upstream_non_json");
    assert.equal(record.upstream_status, 503);
    assert.equal(record.ngrok_error_code, "ERR_NGROK_3200");

    t.mock.method(globalThis, "fetch", async () => {
      throw new DOMException("slow", "TimeoutError");
    });
    response = await metrics();
    assert.equal(response.status, 504);
    assert.equal((await response.json()).code, "UPSTREAM_TIMEOUT");
    assert.equal(records().at(-1).event, "upstream_timeout");

    t.mock.method(globalThis, "fetch", async () => {
      throw new TypeError("verysecret", { cause: { code: "ECONNRESET" } });
    });
    response = await metrics();
    assert.equal(response.status, 502);
    assert.equal(records().at(-1).error_code, "ECONNRESET");
    assert.equal(records().at(-1).event, "upstream_connection_error");

    t.mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response("{broken", {
          headers: { "content-type": "application/json" },
        }),
    );
    response = await metrics();
    assert.equal(response.status, 502);
    assert.equal(records().at(-1).event, "upstream_invalid_json");

    t.mock.method(globalThis, "fetch", async () =>
      Response.json({ message: "Unavailable" }, { status: 503 }),
    );
    response = await metrics();
    assert.equal(response.status, 503);
    assert.equal(records().at(-1).event, "upstream_http_error");
    assert.equal(records().at(-1).upstream_status, 503);

    t.mock.method(globalThis, "fetch", async () =>
      Response.json({ points: 2 }),
    );
    await proxyApiRequest(
      new Request(
        "http://app/api/backend/activities/test?password=verysecret",
        {
          method: "POST",
          body: JSON.stringify({ password: "verysecret" }),
        },
      ),
      ["activities", "2026-10-03", "private@example.test", "1"],
    );
    assert.equal(records().at(-1).route, "/activities/:date/:user_id/:task_id");
    const logged = readFileSync(file, "utf8");
    assert.ok(!logged.includes("verysecret"));
    assert.ok(!logged.includes("private@example.test"));
  } finally {
    for (const [key, value] of [
      ["API_BASE_URL", previous.base],
      ["API_LOG_FILE", previous.file],
      ["API_LOG_LEVEL", previous.level],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
