import type {
  CompletionInput,
  CompletionResponse,
  TaskCompletion,
} from "@/types/domain";
import { apiConfig } from "./config";
import { apiRequest } from "./client";
import { endpoints } from "./endpoints";
import { greenLevel, normalizeScore } from "@/lib/scoring";

export async function getCompletionHistory(): Promise<TaskCompletion[]> {
  return apiConfig.useMock
    ? (await import("@/lib/mock/backend")).mockHistory()
    : apiRequest(endpoints.completions);
}
export async function completeTask(
  input: CompletionInput,
): Promise<CompletionResponse> {
  if (apiConfig.useMock)
    return (await import("@/lib/mock/backend")).mockCompleteTask(input);
  const form = new FormData();
  form.set("taskId", input.taskId);
  form.set("communityId", input.communityId);
  form.set(
    "proof",
    JSON.stringify({
      declaration: input.proof.declaration,
      text: input.proof.text,
    }),
  );
  if (input.proof.image) form.set("image", input.proof.image);
  const result = await apiRequest<
    CompletionResponse & {
      progress: CompletionResponse["progress"] & { scoreMax?: number };
    }
  >(endpoints.completions, { method: "POST", body: form });
  const { scoreMax = 100, ...progress } = result.progress;
  const score = normalizeScore(progress.score, scoreMax);
  return {
    ...result,
    progress: { ...progress, score, level: greenLevel(score) },
  };
}
