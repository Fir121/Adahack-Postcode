import type {
  CompletionInput,
  CompletionResponse,
  TaskCompletion,
} from "@/types/domain";
import { apiConfig } from "./config";
import { ApiError } from "./client";
export async function getCompletionHistory(): Promise<TaskCompletion[]> {
  return apiConfig.useMock
    ? (await import("@/lib/mock/backend")).mockHistory()
    : [];
}
export async function completeTask(
  input: CompletionInput,
): Promise<CompletionResponse> {
  if (apiConfig.useMock)
    return (await import("@/lib/mock/backend")).mockCompleteTask(input);
  throw new ApiError("Action completion is not available yet.", 501);
}
