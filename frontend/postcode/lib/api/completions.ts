import type {
  CompletionInput,
  CompletionResponse,
  TaskCompletion,
} from "@/types/domain";
import { apiConfig } from "./config";
import { ApiError } from "./client";
import { getCurrentUser } from "./auth";
import { getUser } from "./users";
import { getTask, getTasks } from "./tasks";
import {
  activityToCompletion,
  createActivity,
  getActivities,
} from "./activities";
import { dayKey } from "@/lib/utils";

export async function getCompletionHistory(
  userId?: string,
): Promise<TaskCompletion[]> {
  if (apiConfig.useMock)
    return (await import("@/lib/mock/backend")).mockHistory();
  if (!userId) return [];
  const [user, tasks, activities] = await Promise.all([
    getUser(userId),
    getTasks(),
    getActivities(userId),
  ]);
  return activities
    .map((activity, index) =>
      activityToCompletion(activity, user, tasks, index),
    )
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}
export async function completeTask(
  input: CompletionInput,
): Promise<CompletionResponse> {
  if (apiConfig.useMock)
    return (await import("@/lib/mock/backend")).mockCompleteTask(input);
  const user = await getCurrentUser();
  if (!user) throw new ApiError("Sign in to record an action.", 401);
  if (user.communityId !== input.communityId)
    throw new ApiError("Record actions for your own postcode.", 403);
  if (input.proof.image || input.proof.text)
    throw new ApiError(
      "Proof uploads and text are not supported by the activities API yet.",
      501,
    );
  const date = dayKey(new Date());
  const [task, activities] = await Promise.all([
    getTask(input.taskId),
    getActivities(user.id, date),
  ]);
  if (
    activities.some(
      (activity) => activity.task_id === input.taskId && activity.date === date,
    )
  )
    throw new ApiError("You have already recorded this action today.", 409);
  const activity = await createActivity(user.id, {
    task_id: input.taskId,
    date,
  });
  return {
    completion: activityToCompletion(activity, user, [task]),
    // Activity points do not define the community Green Score.
    progress: {
      scoreAvailable: false,
      score: 0,
      level: 0,
      totalActions: 0,
      activityByIndicator: {},
      stats: [],
    },
  };
}
