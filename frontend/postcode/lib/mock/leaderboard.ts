import type { CommunityLeaderboard } from "@/types/domain";
import { ApiError } from "@/lib/api/client";
import { normalizePostcode } from "@/lib/utils";
import { mockCurrentUser } from "./backend";
import { readDatabase } from "./store";

export async function mockLeaderboard(
  postcode: string,
): Promise<CommunityLeaderboard> {
  const user = await mockCurrentUser();
  if (!user)
    throw new ApiError(
      "Please sign in to see your community leaderboard.",
      401,
    );
  const normalized = normalizePostcode(postcode);
  if (normalized !== user.postcode)
    throw new ApiError("You can view your own community leaderboard.", 403);
  const db = readDatabase();
  const members = db.accounts.filter(
    (account) => account.user.postcode === normalized,
  );
  const entries = members
    .map(({ user: member }) => ({
      userId: member.id,
      name: member.name,
      rank: 0,
      // Older seeded actions predate recorded points and count as one point.
      points: db.completions
        .filter(
          (completion) =>
            completion.userId === member.id &&
            completion.communityId === member.communityId &&
            completion.status === "approved",
        )
        .reduce((sum, completion) => sum + (completion.points ?? 1), 0),
    }))
    .sort(
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
  return { postcode: normalized, entries, available: true, source: "mock" };
}
