export const apiTimeouts = {
  proxyMs: 60_000,
  // Give the proxy time to return its timeout response before the browser aborts.
  clientMs: 65_000,
};

export const apiConfig = {
  useMock: process.env.NEXT_PUBLIC_USE_MOCK_API === "true",
  baseUrl: (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend").replace(
    /\/$/,
    "",
  ),
  timeoutMs: apiTimeouts.clientMs,
};
