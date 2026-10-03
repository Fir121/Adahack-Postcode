import type { PostcodeCommunity, TaskCompletion, User } from "@/types/domain";
import { ApiError } from "@/lib/api/client";
import { createMockCommunities } from "./fixtures";

export const STORAGE_KEY = "pl-green-together-demo-v1";
export interface MockAccount {
  user: User;
  passwordHash: string;
  salt: string;
}
export interface MockDatabase {
  version: 1;
  accounts: MockAccount[];
  sessionUserId: string | null;
  communities: PostcodeCommunity[];
  completions: TaskCompletion[];
}

export function emptyDatabase(): MockDatabase {
  return {
    version: 1,
    accounts: [],
    sessionUserId: null,
    communities: createMockCommunities(),
    completions: [],
  };
}

export function readDatabase(): MockDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDatabase();
    const data = JSON.parse(raw) as MockDatabase;
    if (
      data.version !== 1 ||
      !Array.isArray(data.communities) ||
      !Array.isArray(data.accounts) ||
      !Array.isArray(data.completions)
    )
      throw new Error("Invalid demo storage");
    return data;
  } catch {
    throw new ApiError(
      "We couldn’t read your saved demo. Enable browser storage or use Reset demo on the sign-in page.",
      500,
    );
  }
}

export function writeDatabase(data: MockDatabase): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    throw new ApiError(
      "Your browser couldn’t save demo progress. Check that local storage is enabled and has space.",
      500,
    );
  }
}

export function resetDatabase(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    throw new ApiError("Your browser is blocking demo storage.", 500);
  }
}
