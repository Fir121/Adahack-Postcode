export function normalizePostcode(value: string): string {
  const compact = value.toUpperCase().replace(/\s/g, "");
  return compact.length > 3
    ? `${compact.slice(0, -3)} ${compact.slice(-3)}`
    : compact;
}

// Formatting only. Supported/existing postcodes are checked separately by the API.
export function isPostcodeFormat(value: string): boolean {
  return /^(GIR 0AA|[A-PR-UWYZ](?:[0-9]{1,2}|[A-HK-Y][0-9]{1,2}|[0-9][A-HJKPSTUW]|[A-HK-Y][0-9][ABEHMNPRVWXY]) [0-9][ABD-HJLNP-UW-Z]{2})$/.test(
    normalizePostcode(value),
  );
}

export function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function dayKey(value: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
