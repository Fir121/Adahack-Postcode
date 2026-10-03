export const apiConfig = {
  useMock: process.env.NEXT_PUBLIC_USE_MOCK_API !== "false",
  baseUrl: (
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api"
  ).replace(/\/$/, ""),
  timeoutMs: 15_000,
};
