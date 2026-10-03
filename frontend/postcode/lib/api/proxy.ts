import { validActivityDate } from "./activities";
import { logApiEvent, logRoute } from "./logging";

// Forward only documented Swagger resources and methods, never an arbitrary URL.
export async function proxyApiRequest(
  request: Request,
  segments: string[],
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const started = performance.now();
  const route = logRoute(segments);
  const [resource, id] = segments;
  const read = request.method === "GET";
  const validSegments = segments.every(
    (part) => part && part !== "." && part !== "..",
  );
  const activityList =
    resource === "activities" && segments.length === 1 && read;
  const activityWrite =
    resource === "activities" &&
    segments.length === 4 &&
    validActivityDate(id ?? "") &&
    ["POST", "PUT", "DELETE"].includes(request.method);
  const allowed =
    validSegments &&
    (activityList ||
      activityWrite ||
      (segments.length <= 2 &&
        segments.length >= 1 &&
        ((["coordinates", "tasks", "metrics"].includes(resource) && read) ||
          (resource === "users" &&
            (read ||
              (!id && request.method === "POST") ||
              (Boolean(id) && ["PUT", "DELETE"].includes(request.method)))))));
  if (!allowed)
    return Response.json(
      { message: "This API route is not available." },
      { status: 404 },
    );
  const upstream = (
    process.env.API_BASE_URL ??
    "https://chivalry-handlebar-hangover.ngrok-free.dev/api/v1"
  ).replace(/\/$/, "");
  const path =
    segments.map(encodeURIComponent).join("/") +
    (["coordinates", "metrics"].includes(resource) && !id ? "/" : "");
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Request-ID": requestId,
  };
  let upstreamHost: string | undefined;
  const log = (
    level: "info" | "warn" | "error",
    fields: Record<string, string | number | null | undefined>,
  ) =>
    logApiEvent(level, {
      request_id: requestId,
      method: request.method,
      route,
      duration_ms: Math.round(performance.now() - started),
      timeout_ms: 12_000,
      upstream_host: upstreamHost,
      ...fields,
    });
  try {
    // Log the host only, never credentials, request bodies, or query values.
    upstreamHost = new URL(upstream).host;
    const query = new URLSearchParams();
    const incoming = new URL(request.url).searchParams;
    if (activityList)
      for (const filter of ["date", "user_id", "task_id"]) {
        if (incoming.has(filter)) query.set(filter, incoming.get(filter)!);
      }
    log("info", { event: "upstream_request_started" });
    const response = await fetch(
      upstream + "/" + path + (query.size ? "?" + query.toString() : ""),
      {
        method: request.method,
        headers: {
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
          "X-Request-ID": requestId,
          ...(!read && request.method !== "DELETE"
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body:
          read || request.method === "DELETE"
            ? undefined
            : await request.text(),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      },
    );
    const body = await response.text();
    const contentType = response.headers.get("content-type");
    const ngrokError =
      response.headers.get("ngrok-error-code") ??
      body.match(/ERR_NGROK_\d+/)?.[0];
    if (body && !contentType?.includes("application/json")) {
      const status = response.status >= 400 ? response.status : 502;
      log("error", {
        event: "upstream_non_json",
        status,
        upstream_status: response.status,
        upstream_host: upstreamHost,
        content_type: contentType,
        ngrok_error_code: ngrokError,
      });
      return Response.json(
        {
          message:
            "The development API returned a non-JSON response. Check that the server and tunnel are running.",
          code: "UPSTREAM_NON_JSON",
          requestId,
        },
        { status, headers },
      );
    }
    if (body) {
      try {
        JSON.parse(body);
      } catch {
        const status = response.status >= 400 ? response.status : 502;
        log("error", {
          event: "upstream_invalid_json",
          status,
          upstream_status: response.status,
          content_type: contentType,
        });
        return Response.json(
          {
            message:
              "The development API returned invalid JSON. Please try again.",
            code: "UPSTREAM_INVALID_JSON",
            requestId,
          },
          { status, headers },
        );
      }
    }
    log(
      response.status >= 500
        ? "error"
        : response.status >= 400
          ? "warn"
          : "info",
      {
        event: response.ok ? "upstream_response" : "upstream_http_error",
        status: response.status,
        upstream_status: response.status,
        upstream_host: upstreamHost,
        content_type: contentType,
        ngrok_error_code: ngrokError,
        upstream_request_id: response.headers.get("x-request-id"),
      },
    );
    return new Response(body || null, {
      status: response.status,
      headers,
    });
  } catch (error) {
    const timeout =
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name);
    const cause =
      error instanceof Error
        ? (error.cause as { code?: string } | undefined)
        : undefined;
    log("error", {
      event: timeout ? "upstream_timeout" : "upstream_connection_error",
      status: timeout ? 504 : 502,
      error_type: error instanceof Error ? error.name : "UnknownError",
      error_code: cause?.code,
    });
    return Response.json(
      {
        message: timeout
          ? "The development API took too long to respond. Please try again."
          : "The development API is unavailable. Check that the server and tunnel are running, then try again.",
        code: timeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_CONNECTION_ERROR",
        requestId,
      },
      { status: timeout ? 504 : 502, headers },
    );
  }
}
