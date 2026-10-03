import type { ActivityDto, ActivityInputDto } from "@/types/api";
import type { Task, TaskCompletion, User } from "@/types/domain";
import { apiRequest, ApiError } from "./client";
import { endpoints } from "./endpoints";
import { requireList } from "./adapters";

export function validActivityDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + "T12:00:00Z");
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}
function requireInput(input: ActivityInputDto): ActivityInputDto {
  if (!input.task_id.trim() || !validActivityDate(input.date))
    throw new ApiError("Choose a task and a valid activity date.", 400);
  return { task_id: input.task_id, date: input.date };
}
export function adaptActivity(dto: ActivityDto, userId: string): ActivityDto {
  if (
    !dto ||
    typeof dto.user_id !== "string" ||
    dto.user_id !== userId ||
    typeof dto.task_id !== "string" ||
    !dto.task_id.trim() ||
    typeof dto.date !== "string" ||
    !validActivityDate(dto.date) ||
    !Number.isSafeInteger(dto.points) ||
    dto.points < 0
  )
    throw new ApiError("The API returned invalid activity data.", 502);
  return dto;
}
export async function getActivities(
  userId: string,
  date?: string,
): Promise<ActivityDto[]> {
  if (!userId.trim()) throw new ApiError("Select a user first.", 400);
  if (date !== undefined && !validActivityDate(date))
    throw new ApiError("Choose a valid activity date.", 400);
  const path =
    endpoints.activities(userId) +
    (date ? "?date=" + encodeURIComponent(date) : "");
  return requireList(await apiRequest<ActivityDto[]>(path)).map((activity) =>
    adaptActivity(activity, userId),
  );
}
async function writeActivity(
  userId: string,
  input: ActivityInputDto,
  method: "POST" | "PUT",
) {
  if (!userId.trim()) throw new ApiError("Select a user first.", 400);
  const payload = requireInput(input);
  const activity = adaptActivity(
    await apiRequest<ActivityDto>(endpoints.activities(userId), {
      method,
      body: JSON.stringify(payload),
    }),
    userId,
  );
  if (activity.task_id !== payload.task_id || activity.date !== payload.date)
    throw new ApiError(
      "The activity response did not match the submitted action.",
      502,
    );
  return activity;
}
export const createActivity = (userId: string, input: ActivityInputDto) =>
  writeActivity(userId, input, "POST");
export const updateActivity = (userId: string, input: ActivityInputDto) =>
  writeActivity(userId, input, "PUT");
export async function deleteActivity(
  userId: string,
  taskId: string,
): Promise<void> {
  if (!userId.trim() || !taskId.trim())
    throw new ApiError("Choose a user and task to remove.", 400);
  return apiRequest<void>(
    endpoints.activities(userId) + "?task_id=" + encodeURIComponent(taskId),
    { method: "DELETE" },
  );
}
export function activityToCompletion(
  activity: ActivityDto,
  user: User,
  tasks: Task[],
  index = 0,
): TaskCompletion {
  const task = tasks.find((item) => item.id === activity.task_id);
  return {
    id: [activity.user_id, activity.task_id, activity.date, index].join(":"),
    userId: activity.user_id,
    communityId: user.communityId,
    taskId: activity.task_id,
    taskTitle: task?.title ?? "Action " + activity.task_id,
    category: task?.category ?? "Community action",
    targetIndicators: task?.targetIndicators ?? [],
    points: activity.points,
    activityDate: activity.date,
    // Noon is a display placeholder: the API supplies a date, not a completion timestamp.
    completedAt: activity.date + "T12:00:00Z",
    status: "recorded",
  };
}
