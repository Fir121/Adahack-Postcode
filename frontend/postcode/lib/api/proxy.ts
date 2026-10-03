import { isPostcodeFormat } from "@/lib/utils";

// Swagger resources plus the proposed read-only leaderboard route; never an arbitrary URL.
export async function proxyApiRequest(
  request: Request,
  segments: string[],
): Promise<Response> {
  const [resource, id] = segments;
  const read = request.method === "GET";
  const leaderboard =
    read &&
    segments.length === 3 &&
    resource === "postcodes" &&
    isPostcodeFormat(id ?? "") &&
    segments[2] === "leaderboard";
  const allowed =
    leaderboard ||
    (segments.length <= 2 &&
      segments.length >= 1 &&
      segments.every((part) => part && part !== "." && part !== "..") &&
      ((["coordinates", "tasks"].includes(resource) && read) ||
        (resource === "users" &&
          (read ||
            (!id && request.method === "POST") ||
            (Boolean(id) && ["PUT", "DELETE"].includes(request.method))))));
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
    (resource === "coordinates" && !id ? "/" : "");
  try {
    const response = await fetch(upstream + "/" + path, {
      method: request.method,
      headers: {
        Accept: "application/json",
        "ngrok-skip-browser-warning": "true",
        ...(!read && request.method !== "DELETE"
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body:
        read || request.method === "DELETE" ? undefined : await request.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const body = await response.text();
    // Frameworks often return an HTML 404 for routes still under development.
    if (leaderboard && [404, 501].includes(response.status))
      return Response.json(
        { message: "Community leaderboard is not available yet." },
        { status: response.status },
      );
    if (
      body &&
      !response.headers.get("content-type")?.includes("application/json")
    )
      return Response.json(
        {
          message:
            "The development API returned a non-JSON response. Check that the server and tunnel are running.",
        },
        { status: 502 },
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
