import type {
  AuthResponse,
  DemoInfo,
  LoginInput,
  SignupInput,
  User,
} from "@/types/domain";
import { apiConfig } from "./config";
import { ApiError } from "./client";
import { createUser, getUser, getUsers } from "./users";

export const PROFILE_KEY = "our-patch-development-profile";
export async function login(input: LoginInput): Promise<AuthResponse> {
  if (apiConfig.useMock)
    return (await import("@/lib/mock/backend")).mockLogin(input);
  const email = input.email.trim().toLowerCase();
  const matches = (await getUsers()).filter(
    (user) => user.email.trim().toLowerCase() === email,
  );
  if (!matches.length)
    throw new ApiError(
      "No account was found for that email. Join us to create one.",
      404,
      { email: "No account found for this email." },
    );
  if (matches.length > 1)
    throw new ApiError(
      "More than one user has this email. Please use a unique email or ask for the duplicate records to be corrected.",
      409,
    );
  const user = await getUser(matches[0].id);
  if (user.email.trim().toLowerCase() !== email)
    throw new ApiError(
      "The user details changed. Please try signing in again.",
      409,
    );
  localStorage.setItem(PROFILE_KEY, user.id);
  return { user };
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
