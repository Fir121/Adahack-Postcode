export const apiConfig = {
  useMock: process.env.NEXT_PUBLIC_USE_MOCK_API === "true",
  baseUrl: (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend").replace(
    /\/$/,
    "",
  ),
  timeoutMs: 15_000,
};
