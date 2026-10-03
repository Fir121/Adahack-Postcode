import type {
  AuthResponse,
  DemoInfo,
  LoginInput,
  SignupInput,
  User,
} from "@/types/domain";
import { apiConfig } from "./config";
import { apiRequest, ApiError } from "./client";
import { endpoints } from "./endpoints";

export async function login(input: LoginInput): Promise<AuthResponse> {
  if (apiConfig.useMock)
    return (await import("@/lib/mock/backend")).mockLogin(input);
  return apiRequest(endpoints.login, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export async function signup(input: SignupInput): Promise<AuthResponse> {
  if (apiConfig.useMock)
    return (await import("@/lib/mock/backend")).mockSignup(input);
  return apiRequest(endpoints.signup, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export async function logout(): Promise<void> {
  if (apiConfig.useMock)
    return (await import("@/lib/mock/backend")).mockLogout();
  return apiRequest(endpoints.logout, { method: "POST" });
}
export async function getCurrentUser(): Promise<User | null> {
  if (apiConfig.useMock)
    return (await import("@/lib/mock/backend")).mockCurrentUser();
  try {
    return await apiRequest<User>(endpoints.me);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
export async function getDemoInfo(): Promise<DemoInfo | null> {
  return apiConfig.useMock
    ? (await import("@/lib/mock/fixtures")).demoInfo
    : null;
}
export async function resetDemo(): Promise<void> {
  if (!apiConfig.useMock)
    throw new ApiError("Demo reset is only available in mock mode.", 400);
  (await import("@/lib/mock/store")).resetDatabase();
}
