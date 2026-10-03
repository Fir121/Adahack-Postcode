import type { CommunityLeaderboardDto } from "@/types/api";
import type { CommunityLeaderboard } from "@/types/domain";
import { isPostcodeFormat, normalizePostcode } from "@/lib/utils";
import { apiConfig } from "./config";
import { apiRequest, ApiError } from "./client";
import { endpoints } from "./endpoints";

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
      return {
        postcode: normalized,
        entries: [],
        available: false,
        source: "api",
      };
    throw error;
  }
}
