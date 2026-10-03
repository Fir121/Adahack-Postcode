import type { PostcodeCommunity } from "@/types/domain";
import { apiConfig } from "./config";
import { apiRequest } from "./client";
import { endpoints } from "./endpoints";
import { greenLevel, normalizeScore } from "@/lib/scoring";

type CommunityDto = Omit<PostcodeCommunity, "progress"> & {
  progress: PostcodeCommunity["progress"] & { scoreMax?: number };
};
export function adaptCommunity(dto: CommunityDto): PostcodeCommunity {
  const { scoreMax = 100, ...progress } = dto.progress;
  const score = normalizeScore(progress.score, scoreMax);
  return { ...dto, progress: { ...progress, score, level: greenLevel(score) } };
}
export async function getCommunities(): Promise<PostcodeCommunity[]> {
  const data = apiConfig.useMock
    ? await (await import("@/lib/mock/backend")).mockCommunities()
    : await apiRequest<CommunityDto[]>(endpoints.communities);
  return data.map(adaptCommunity);
}
export async function getCommunity(id: string): Promise<PostcodeCommunity> {
  const data = apiConfig.useMock
    ? await (await import("@/lib/mock/backend")).mockCommunity(id)
    : await apiRequest<CommunityDto>(endpoints.community(id));
  return adaptCommunity(data);
}
export async function getSupportedPostcodes(): Promise<string[]> {
  return apiConfig.useMock
    ? (await import("@/lib/mock/backend")).mockSupportedPostcodes()
    : apiRequest(endpoints.supportedPostcodes);
}
