import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

type LogValue = string | number | boolean | null | undefined;
let fileWarningReported = false;

export function logApiEvent(
  level: "info" | "warn" | "error",
  fields: Record<string, LogValue>,
): void {
  const configured = process.env.API_LOG_LEVEL?.toLowerCase() ?? "info";
  if (
    configured === "off" ||
    (configured === "error" && level !== "error") ||
    (configured === "warn" && level === "info")
  )
    return;
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "api-proxy",
    ...fields,
  });
  console[level](line);
  try {
    const file = resolve(process.env.API_LOG_FILE ?? "logs/api-proxy.log");
    mkdirSync(dirname(file), { recursive: true });
    try {
      if (statSync(file).size >= 5 * 1024 * 1024) {
        // One previous file bounds local storage; stdout remains available to hosts.
        renameSync(file, file + ".1");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    appendFileSync(file, line + "\n", "utf8");
  } catch (error) {
    if (!fileWarningReported) {
      fileWarningReported = true;
      console.warn(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "warn",
          service: "api-proxy",
          event: "log_file_unavailable",
          error_code: (error as NodeJS.ErrnoException).code,
        }),
      );
    }
  }
}

export function logRoute(segments: string[]): string {
  if (segments[0] === "users" && segments.length > 1) return "/users/:user_id";
  if (segments[0] === "activities" && segments.length > 1)
    return "/activities/:date/:user_id/:task_id";
  if (segments[0] === "tasks" && segments.length > 1) return "/tasks/:task_id";
  return "/" + segments.join("/");
}
