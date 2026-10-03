import type { PostcodeDetailMetricDto } from "@/types/api";
import type { CommunityLeaderboard } from "@/types/domain";
import { isPostcodeFormat, normalizePostcode } from "@/lib/utils";
import { apiConfig } from "./config";
import { ApiError } from "./client";
import { adaptDetailMetric, getPostcodeDetailMetric } from "./metrics";

export function leaderboardFromMetric(
  dto: PostcodeDetailMetricDto,
  postcode: string,
): CommunityLeaderboard {
  const metric = adaptDetailMetric(dto, postcode);
  if (metric.users === undefined)
    return {
      postcode: metric.postcode,
      entries: [],
      available: false,
      source: "api",
    };
  const entries = metric.users.map((user) => ({
    userId: user.user_id,
    name: user.name,
    points: user.points,
    rank: 0,
  }));
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
  return { postcode: metric.postcode, entries, available: true, source: "api" };
}
export async function getCommunityLeaderboard(
  postcode: string,
): Promise<CommunityLeaderboard> {
  const normalized = normalizePostcode(postcode);
  if (!isPostcodeFormat(normalized))
    throw new ApiError("Choose a valid community postcode.", 400);
  if (apiConfig.useMock)
    return (await import("@/lib/mock/leaderboard")).mockLeaderboard(normalized);
  return leaderboardFromMetric(
    await getPostcodeDetailMetric(normalized),
    normalized,
  );
}
