import type { Task } from "@/types/domain";
import { apiConfig } from "./config";
import { apiRequest } from "./client";
import { endpoints } from "./endpoints";

export async function getTasks(): Promise<Task[]> {
  return apiConfig.useMock
    ? (await import("@/lib/mock/backend")).mockGetTasks()
    : apiRequest(endpoints.tasks);
}
