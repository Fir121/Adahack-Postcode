import { apiConfig } from "./config";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), apiConfig.timeoutMs);
  try {
    const headers = new Headers(options.headers);
    if (options.body && !(options.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
    const response = await fetch(`${apiConfig.baseUrl}${path}`, {
      ...options,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
    if (response.ok && (response.status === 204 || options.method === "DELETE"))
      return undefined as T;
    const body = await response.json().catch(() => null);
    if (!response.ok)
      throw new ApiError(
        body?.message ??
          `The API returned an error (${response.status}). Please try again.`,
        response.status,
        body?.fields ?? body?.errors,
      );
    if (body === null)
      throw new ApiError("The API returned an invalid response.", 502);
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      controller.signal.aborted
        ? "The request timed out. Please try again."
        : "We couldn't reach the API. Check your connection and try again.",
      0,
    );
  } finally {
    clearTimeout(timeout);
  }
}
