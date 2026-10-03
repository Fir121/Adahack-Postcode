import type { ActivityDto, ActivityInputDto } from "@/types/api";
import type { Task, TaskCompletion, User } from "@/types/domain";
import { apiRequest, ApiError } from "./client";
import { endpoints } from "./endpoints";
import { communityId, requireList } from "./adapters";
import { isPostcodeFormat, normalizePostcode } from "@/lib/utils";

export interface ActivityFilters {
  user_id?: string;
  task_id?: string;
  date?: string;
}
export interface ActivityKey {
  userId: string;
  taskId: string;
  date: string;
}

export function validActivityDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + "T12:00:00Z");
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}
function requireInput(input: ActivityInputDto): ActivityInputDto {
  if (
    input.points !== undefined &&
    (!Number.isSafeInteger(input.points) || input.points < 0)
  )
    throw new ApiError("Choose a valid number of activity points.", 400);
  return input.points === undefined ? {} : { points: input.points };
}
export function adaptActivity(
  dto: ActivityDto,
  filters: ActivityFilters = {},
): ActivityDto {
  if (
    !dto ||
    typeof dto.user_id !== "string" ||
    !dto.user_id.trim() ||
    (filters.user_id !== undefined && dto.user_id !== filters.user_id) ||
    typeof dto.task_id !== "string" ||
    !dto.task_id.trim() ||
    typeof dto.date !== "string" ||
    !validActivityDate(dto.date) ||
    (filters.task_id !== undefined && dto.task_id !== filters.task_id) ||
    (filters.date !== undefined && dto.date !== filters.date) ||
    (dto.points !== undefined &&
      (!Number.isSafeInteger(dto.points) || dto.points < 0)) ||
    (dto.postcode !== undefined &&
      (typeof dto.postcode !== "string" || !isPostcodeFormat(dto.postcode)))
  )
    throw new ApiError("The API returned invalid activity data.", 502);
  return {
    ...dto,
    postcode:
      dto.postcode === undefined ? undefined : normalizePostcode(dto.postcode),
  };
}
export async function getActivities(
  filters: ActivityFilters = {},
): Promise<ActivityDto[]> {
  if (filters.user_id !== undefined && !filters.user_id.trim())
    throw new ApiError("Select a user first.", 400);
  if (filters.task_id !== undefined && !filters.task_id.trim())
    throw new ApiError("Choose a task first.", 400);
  if (filters.date !== undefined && !validActivityDate(filters.date))
    throw new ApiError("Choose a valid activity date.", 400);
  const query = new URLSearchParams();
  for (const key of ["date", "user_id", "task_id"] as const)
    if (filters[key] !== undefined) query.set(key, filters[key]);
  const seen = new Set<string>();
  return requireList(
    await apiRequest<ActivityDto[]>(
      endpoints.activities + (query.size ? "?" + query : ""),
    ),
  ).map((dto) => {
    const activity = adaptActivity(dto, filters);
    const key = JSON.stringify([
      activity.date,
      activity.user_id,
      activity.task_id,
    ]);
    if (seen.has(key))
      throw new ApiError("The API returned duplicate activity records.", 502);
    seen.add(key);
    return activity;
  });
}
function activityPath(key: ActivityKey): string {
  if (!key.userId.trim() || !key.taskId.trim() || !validActivityDate(key.date))
    throw new ApiError("Choose a user, task and valid activity date.", 400);
  return endpoints.activity(key.date, key.userId, key.taskId);
}
async function writeActivity(
  key: ActivityKey,
  input: ActivityInputDto,
  method: "POST" | "PUT",
) {
  const path = activityPath(key);
  const payload = requireInput(input);
  const activity = adaptActivity(
    await apiRequest<ActivityDto>(path, {
      method,
      body: JSON.stringify(payload),
    }),
    { user_id: key.userId, task_id: key.taskId, date: key.date },
  );
  return activity;
}
export const createActivity = (
  key: ActivityKey,
  input: ActivityInputDto = {},
) => writeActivity(key, input, "POST");
export const updateActivity = (key: ActivityKey, input: ActivityInputDto) =>
  writeActivity(key, input, "PUT");
export async function deleteActivity(key: ActivityKey): Promise<void> {
  return apiRequest<void>(activityPath(key), { method: "DELETE" });
}
export function activityToCompletion(
  activity: ActivityDto,
  user: User,
  tasks: Task[],
): TaskCompletion {
  const task = tasks.find((item) => item.id === activity.task_id);
  return {
    id: JSON.stringify([activity.date, activity.user_id, activity.task_id]),
    userId: activity.user_id,
    communityId: activity.postcode
      ? communityId(activity.postcode)
      : user.communityId,
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
