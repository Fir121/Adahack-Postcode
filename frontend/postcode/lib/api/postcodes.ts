import type { CoordinatesDto } from "@/types/api";
import { adaptCoordinates, postcodeFromId, requireList } from "./adapters";
import type { PostcodeCommunity } from "@/types/domain";
import { apiConfig } from "./config";
import { apiRequest, ApiError } from "./client";
import { errorMessage } from "@/lib/utils";
import {
  getPostcodeMetrics,
  getPostcodeDetailMetric,
  metricProgress,
  metricIndicators,
} from "./metrics";
import { endpoints } from "./endpoints";
import { greenLevel, normalizeScore } from "@/lib/scoring";

type CommunityDto = Omit<
  PostcodeCommunity,
  "progress" | "decorations" | "centroid"
> & {
  centroid:
    | PostcodeCommunity["centroid"]
    | { type: "Point"; coordinates: [number, number] };
  progress: PostcodeCommunity["progress"] & { scoreMax?: number };
  decorations?: PostcodeCommunity["decorations"];
};
export function adaptCommunity(dto: CommunityDto): PostcodeCommunity {
  const { scoreMax = 100, ...progress } = dto.progress;
  const score = normalizeScore(progress.score, scoreMax);
  return {
    ...dto,
    centroid:
      "type" in dto.centroid
        ? {
            longitude: dto.centroid.coordinates[0],
            latitude: dto.centroid.coordinates[1],
          }
        : dto.centroid,
    decorations: dto.decorations ?? [],
    progress: { ...progress, score, level: greenLevel(score) },
  };
}
export async function getCommunities(): Promise<PostcodeCommunity[]> {
  if (apiConfig.useMock)
    return (await (await import("@/lib/mock/backend")).mockCommunities()).map(
      adaptCommunity,
    );
  const [coordinates, metrics] = await Promise.allSettled([
    apiRequest<CoordinatesDto[]>(endpoints.coordinates).then(requireList),
    getPostcodeMetrics(),
  ]);
  if (coordinates.status === "rejected") throw coordinates.reason;
  const scores = new Map(
    metrics.status === "fulfilled"
      ? metrics.value.map((metric) => [metric.postcode, metric])
      : [],
  );
  return coordinates.value.map((dto) => {
    const community = adaptCoordinates(dto);
    const metric = scores.get(community.postcode);
    return {
      ...community,
      progress: metric ? metricProgress(metric) : community.progress,
      dataWarnings:
        metrics.status === "rejected"
          ? { score: errorMessage(metrics.reason) }
          : undefined,
    };
  });
}
export async function getCommunity(id: string): Promise<PostcodeCommunity> {
  if (apiConfig.useMock)
    return adaptCommunity(
      await (await import("@/lib/mock/backend")).mockCommunity(id),
    );
  const postcode = postcodeFromId(id);
  const [coordinate, metrics, detail] = await Promise.allSettled([
    apiRequest<CoordinatesDto>(endpoints.coordinate(postcode)).then(
      adaptCoordinates,
    ),
    getPostcodeMetrics(),
    getPostcodeDetailMetric(postcode),
  ]);
  if (coordinate.status === "rejected") throw coordinate.reason;
  const community = coordinate.value;
  if (community.postcode !== postcode)
    throw new ApiError(
      "The API returned coordinates for a different postcode.",
      502,
    );
  const metric =
    metrics.status === "fulfilled"
      ? metrics.value.find((item) => item.postcode === community.postcode)
      : undefined;
  return {
    ...community,
    progress: metric ? metricProgress(metric) : community.progress,
    indicators:
      detail.status === "fulfilled" ? metricIndicators(detail.value) : [],
    dataWarnings: {
      score:
        metrics.status === "rejected"
          ? errorMessage(metrics.reason)
          : undefined,
      indicators:
        detail.status === "rejected" ? errorMessage(detail.reason) : undefined,
    },
  };
}
export async function getSupportedPostcodes(): Promise<string[]> {
  if (apiConfig.useMock)
    return (await import("@/lib/mock/backend")).mockSupportedPostcodes();
  return [
    ...new Set(
      requireList(
        await apiRequest<CoordinatesDto[]>(endpoints.coordinates),
      ).map((coordinate) => adaptCoordinates(coordinate).postcode),
    ),
  ];
}
