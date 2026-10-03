import type { CommunityLeaderboardDto } from "@/types/api";
import type { CommunityLeaderboard, LeaderboardEntry } from "@/types/domain";
import { isPostcodeFormat, normalizePostcode } from "@/lib/utils";
import { apiConfig } from "./config";
import { apiRequest, ApiError } from "./client";
import { endpoints } from "./endpoints";
import { getUsers } from "./users";
import { getActivities } from "./activities";

export function adaptLeaderboard(
  dto: CommunityLeaderboardDto,
  postcode: string,
): CommunityLeaderboard {
  const invalid = () =>
    new ApiError("The API returned an invalid community leaderboard.", 502);
  if (
    !dto ||
    typeof dto.postcode !== "string" ||
    normalizePostcode(dto.postcode) !== postcode ||
    !Array.isArray(dto.entries)
  )
    throw invalid();
  const ids = new Set<string>();
  const entries = dto.entries.map((entry) => {
    if (
      !entry ||
      typeof entry.user_id !== "string" ||
      !entry.user_id.trim() ||
      typeof entry.name !== "string" ||
      !entry.name.trim() ||
      !Number.isSafeInteger(entry.rank) ||
      entry.rank < 1 ||
      !Number.isSafeInteger(entry.points) ||
      entry.points < 0 ||
      ids.has(entry.user_id)
    )
      throw invalid();
    ids.add(entry.user_id);
    return {
      userId: entry.user_id,
      name: entry.name,
      rank: entry.rank,
      points: entry.points,
    };
  });
  return {
    postcode,
    entries: entries.sort((a, b) => a.rank - b.rank),
    available: true,
    source: "api",
  };
}
export async function getCommunityLeaderboard(
  postcode: string,
): Promise<CommunityLeaderboard> {
  const normalized = normalizePostcode(postcode);
  if (!isPostcodeFormat(normalized))
    throw new ApiError("Choose a valid community postcode.", 400);
  if (apiConfig.useMock)
    return (await import("@/lib/mock/leaderboard")).mockLeaderboard(normalized);
  try {
    return adaptLeaderboard(
      await apiRequest<CommunityLeaderboardDto>(
        endpoints.leaderboard(normalized),
      ),
      normalized,
    );
  } catch (error) {
    // Missing/not-implemented endpoints are different from an empty, implemented ranking.
    if (error instanceof ApiError && [404, 501].includes(error.status))
      return leaderboardFromActivities(normalized);
    throw error;
  }
}

// Use real records while the dedicated community endpoint is under development.
async function leaderboardFromActivities(
  postcode: string,
): Promise<CommunityLeaderboard> {
  const members = (await getUsers()).filter(
    (user) => user.postcode === postcode,
  );
  const entries: LeaderboardEntry[] = new Array(members.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, members.length) }, async () => {
      while (next < members.length) {
        const index = next++;
        const member = members[index];
        const activities = await getActivities(member.id);
        const points = activities.reduce(
          (sum, activity) => sum + activity.points,
          0,
        );
        if (!Number.isSafeInteger(points))
          throw new ApiError(
            "Activity points exceed the supported total.",
            502,
          );
        entries[index] = {
          userId: member.id,
          name: member.name,
          rank: 0,
          points,
        };
      }
    }),
  );
  entries.sort(
    (a, b) =>
      b.points - a.points ||
      a.name.localeCompare(b.name) ||
      a.userId.localeCompare(b.userId),
  );
  entries.forEach((entry, index) => {
    entry.rank =
      index > 0 && entry.points === entries[index - 1].points
        ? entries[index - 1].rank
        : index + 1;
  });
  return { postcode, entries, available: true, source: "activities" };
}
