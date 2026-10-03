import { validActivityDate } from "./activities";

// Forward only documented Swagger resources and methods, never an arbitrary URL.
export async function proxyApiRequest(
  request: Request,
  segments: string[],
): Promise<Response> {
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
  try {
    const query = new URLSearchParams();
    const incoming = new URL(request.url).searchParams;
    if (activityList)
      for (const filter of ["date", "user_id", "task_id"]) {
        if (incoming.has(filter)) query.set(filter, incoming.get(filter)!);
      }
    const response = await fetch(
      upstream + "/" + path + (query.size ? "?" + query.toString() : ""),
      {
        method: request.method,
        headers: {
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
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
    if (
      body &&
      !response.headers.get("content-type")?.includes("application/json")
    )
      return Response.json(
        {
          message:
            "The development API returned a non-JSON response. Check that the server and tunnel are running.",
        },
        { status: response.status >= 400 ? response.status : 502 },
      );
    return new Response(body || null, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        message:
          "The development API is unavailable. Check that the server and tunnel are running, then try again.",
      },
      { status: 502 },
    );
  }
}
