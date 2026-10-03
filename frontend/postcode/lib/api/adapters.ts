import type { CoordinatesDto, TaskDto, UserDto } from "@/types/api";
import type { PostcodeCommunity, Task, User } from "@/types/domain";
import { isPostcodeFormat, normalizePostcode } from "@/lib/utils";
import { ApiError } from "./client";

function requireFields(
  dto: unknown,
  fields: string[],
): asserts dto is Record<string, unknown> {
  if (
    !dto ||
    typeof dto !== "object" ||
    fields.some(
      (key) =>
        typeof (dto as Record<string, unknown>)[key] !== "string" ||
        !(dto as Record<string, string>)[key].trim(),
    )
  )
    throw new ApiError("The API returned incomplete data.", 502);
}
export function communityId(postcode: string): string {
  return normalizePostcode(postcode).toLowerCase().replace(" ", "-");
}
export function postcodeFromId(id: string): string {
  return normalizePostcode(id.replaceAll("-", " "));
}
export function adaptCoordinates(dto: CoordinatesDto): PostcodeCommunity {
  requireFields(dto, ["postcode"]);
  if (
    !isPostcodeFormat(dto.postcode) ||
    !Number.isFinite(dto.latitude) ||
    !Number.isFinite(dto.longitude) ||
    Math.abs(dto.latitude) > 90 ||
    Math.abs(dto.longitude) > 180
  )
    throw new ApiError("The API returned invalid postcode coordinates.", 502);
  const postcode = normalizePostcode(dto.postcode);
  return {
    id: communityId(postcode),
    postcode,
    name: "Your postcode community",
    city: "",
    centroid: { latitude: dto.latitude, longitude: dto.longitude },
    indicators: [],
    decorations: [],
    // Placeholder only; scoreAvailable=false prevents presenting zero as a measurement.
    progress: {
      score: 0,
      scoreAvailable: false,
      level: 0,
      totalActions: 0,
      activityByIndicator: {},
      stats: [],
    },
  };
}
export function adaptUser(dto: UserDto): User {
  requireFields(dto, ["user_id", "name", "email", "postcode"]);
  if (!isPostcodeFormat(dto.postcode))
    throw new ApiError("The API returned an invalid user postcode.", 502);
  const postcode = normalizePostcode(dto.postcode);
  return {
    id: dto.user_id,
    name: dto.name,
    email: dto.email,
    postcode,
    communityId: communityId(postcode),
  };
}
export function adaptTask(dto: TaskDto): Task {
  requireFields(dto, ["task_id", "name", "description"]);
  if (!Number.isInteger(dto.points) || dto.points < 0)
    throw new ApiError("The API returned invalid task points.", 502);
  return {
    id: dto.task_id,
    title: dto.name,
    description: dto.description,
    whyItMatters: dto.description,
    points: dto.points,
    completionAvailable: false,
    targetIndicators: [],
    category: "Community action",
    estimatedTime: "",
    effort: "",
    repeat: "once",
    proofRequirements: [],
    decorationType: "tree",
  };
}
export function requireList<T>(value: T[]): T[] {
  if (!Array.isArray(value))
    throw new ApiError("The API returned an invalid list.", 502);
  return value;
}
