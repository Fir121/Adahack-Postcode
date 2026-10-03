import type {
  AuthResponse,
  DemoInfo,
  LoginInput,
  SignupInput,
  User,
} from "@/types/domain";
import { apiConfig } from "./config";
import { ApiError } from "./client";
import { createUser, getUser } from "./users";

export const PROFILE_KEY = "our-patch-development-profile";
export async function selectDevelopmentProfile(
  id: string,
): Promise<AuthResponse> {
  const user = await getUser(id);
  localStorage.setItem(PROFILE_KEY, user.id);
  return { user };
}
export async function login(input: LoginInput): Promise<AuthResponse> {
  if (apiConfig.useMock)
    return (await import("@/lib/mock/backend")).mockLogin(input);
  throw new ApiError(
    "Password sign-in is not available yet. Choose a development profile.",
    501,
  );
}
export async function signup(input: SignupInput): Promise<AuthResponse> {
  if (apiConfig.useMock)
    return (await import("@/lib/mock/backend")).mockSignup(input);
  const user = await createUser(input);
  localStorage.setItem(PROFILE_KEY, user.id);
  return { user };
}
export async function logout(): Promise<void> {
  if (apiConfig.useMock)
    return (await import("@/lib/mock/backend")).mockLogout();
  localStorage.removeItem(PROFILE_KEY);
}
export async function getCurrentUser(): Promise<User | null> {
  if (apiConfig.useMock)
    return (await import("@/lib/mock/backend")).mockCurrentUser();
  const id =
    typeof localStorage === "undefined"
      ? null
      : localStorage.getItem(PROFILE_KEY);
  if (!id) return null;
  try {
    return await getUser(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      localStorage.removeItem(PROFILE_KEY);
      return null;
    }
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
