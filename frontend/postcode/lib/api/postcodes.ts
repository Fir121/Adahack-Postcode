import type { CoordinatesDto } from "@/types/api";
import { adaptCoordinates, postcodeFromId, requireList } from "./adapters";
import type { PostcodeCommunity } from "@/types/domain";
import { apiConfig } from "./config";
import { apiRequest } from "./client";
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
  return requireList(
    await apiRequest<CoordinatesDto[]>(endpoints.coordinates),
  ).map(adaptCoordinates);
}
export async function getCommunity(id: string): Promise<PostcodeCommunity> {
  if (apiConfig.useMock)
    return adaptCommunity(
      await (await import("@/lib/mock/backend")).mockCommunity(id),
    );
  return adaptCoordinates(
    await apiRequest<CoordinatesDto>(endpoints.coordinate(postcodeFromId(id))),
  );
}
export async function getSupportedPostcodes(): Promise<string[]> {
  if (apiConfig.useMock)
    return (await import("@/lib/mock/backend")).mockSupportedPostcodes();
  return [
    ...new Set((await getCommunities()).map((community) => community.postcode)),
  ];
}
