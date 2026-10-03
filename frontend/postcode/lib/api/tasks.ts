import type { TaskDto } from "@/types/api";
import type { Task } from "@/types/domain";
import { apiConfig } from "./config";
import { apiRequest, ApiError } from "./client";
import { endpoints } from "./endpoints";
import { adaptTask, requireList } from "./adapters";
export async function getTasks(): Promise<Task[]> {
  return apiConfig.useMock
    ? (await import("@/lib/mock/backend")).mockGetTasks()
    : requireList(await apiRequest<TaskDto[]>(endpoints.tasks)).map(adaptTask);
}
export async function getTask(id: string): Promise<Task> {
  if (apiConfig.useMock) {
    const task = (await getTasks()).find((item) => item.id === id);
    if (!task) throw new ApiError("This action is no longer available.", 404);
    return task;
  }
  return adaptTask(await apiRequest<TaskDto>(endpoints.task(id)));
}
