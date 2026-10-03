import type {
  PostcodeDetailMetricDto,
  PostcodeMetricDto,
  UserMetricDto,
} from "@/types/api";
import type { CommunityProgress, PostcodeIndicator } from "@/types/domain";
import { isPostcodeFormat, normalizePostcode } from "@/lib/utils";
import { greenLevel, normalizeScore } from "@/lib/scoring";
import { apiRequest, ApiError } from "./client";
import { endpoints } from "./endpoints";
import { requireList } from "./adapters";

function metricPostcode(value: unknown): string {
  if (typeof value !== "string" || !isPostcodeFormat(value))
    throw new ApiError("The API returned invalid metric postcode data.", 502);
  return normalizePostcode(value);
}
export function adaptPostcodeMetric(dto: PostcodeMetricDto): PostcodeMetricDto {
  if (!dto || !Number.isSafeInteger(dto.total_points) || dto.total_points < 0)
    throw new ApiError("The API returned invalid community points.", 502);
  return {
    postcode: metricPostcode(dto.postcode),
    total_points: dto.total_points,
  };
}
export async function getPostcodeMetrics(): Promise<PostcodeMetricDto[]> {
  const seen = new Set<string>();
  return requireList(
    await apiRequest<PostcodeMetricDto[]>(endpoints.metrics),
  ).map((dto) => {
    const metric = adaptPostcodeMetric(dto);
    if (seen.has(metric.postcode))
      throw new ApiError("The API returned duplicate postcode metrics.", 502);
    seen.add(metric.postcode);
    return metric;
  });
}
export function adaptDetailMetric(
  dto: PostcodeDetailMetricDto,
  postcode: string,
): PostcodeDetailMetricDto {
  if (!dto || metricPostcode(dto.postcode) !== normalizePostcode(postcode))
    throw new ApiError(
      "The API returned metrics for a different postcode.",
      502,
    );
  if (
    dto.carbon_intensity != null &&
    (!Number.isFinite(dto.carbon_intensity) || dto.carbon_intensity < 0)
  )
    throw new ApiError(
      "The API returned invalid electricity carbon intensity.",
      502,
    );
  if (
    dto.air_quality != null &&
    (!Number.isInteger(dto.air_quality) ||
      dto.air_quality < 0 ||
      dto.air_quality > 10)
  )
    throw new ApiError("The API returned an invalid air quality index.", 502);
  const seen = new Set<string>();
  if (dto.users !== undefined) {
    requireList(dto.users).forEach((entry: UserMetricDto) => {
      if (
        !entry ||
        typeof entry.user_id !== "string" ||
        !entry.user_id.trim() ||
        typeof entry.name !== "string" ||
        !entry.name.trim() ||
        !Number.isSafeInteger(entry.points) ||
        entry.points < 0 ||
        seen.has(entry.user_id)
      )
        throw new ApiError(
          "The API returned invalid community member points.",
          502,
        );
      seen.add(entry.user_id);
    });
  }
  // The development server can return zero for missing AQI; zero is outside 1–10.
  return {
    ...dto,
    postcode: normalizePostcode(postcode),
    air_quality: dto.air_quality === 0 ? null : dto.air_quality,
  };
}
export async function getPostcodeDetailMetric(
  postcode: string,
): Promise<PostcodeDetailMetricDto> {
  const normalized = metricPostcode(postcode);
  return adaptDetailMetric(
    await apiRequest<PostcodeDetailMetricDto>(endpoints.metric(normalized)),
    normalized,
  );
}
export function metricProgress(metric: PostcodeMetricDto): CommunityProgress {
  // POC display rule: one awarded point equals one score point, on the existing 0–100 scale.
  const score = normalizeScore(metric.total_points);
  return {
    scoreAvailable: true,
    score,
    level: greenLevel(score),
    totalPoints: metric.total_points,
    totalActions: 0,
    activityByIndicator: {},
    stats: [
      {
        key: "points",
        label: "Community points",
        value: metric.total_points,
        icon: "sprout",
        supportingText: "Total reported by the metrics API",
      },
    ],
  };
}
export function metricIndicators(
  metric: PostcodeDetailMetricDto,
): PostcodeIndicator[] {
  const carbon = metric.carbon_intensity;
  const air = metric.air_quality;
  const shared = {
    status: "unknown" as const,
    source: "Our Patch metrics API",
    provenance: "measured" as const,
  };
  return [
    {
      ...shared,
      id: "energy",
      type: "energy",
      label: "Electricity carbon intensity",
      value: carbon ?? undefined,
      unit: "gCO₂/kWh",
      displayValue:
        carbon == null
          ? "Unavailable"
          : `${carbon.toLocaleString("en-GB", { maximumFractionDigits: 2 })} gCO₂/kWh`,
      statusLabel:
        carbon == null
          ? "Unavailable"
          : `${carbon.toLocaleString("en-GB", { maximumFractionDigits: 2 })} gCO₂/kWh`,
      description:
        "Carbon intensity of electricity reported for this postcode. Lower values mean less CO₂ per unit of electricity.",
    },
    {
      ...shared,
      id: "air_quality",
      type: "air_quality",
      label: "Air quality",
      value: air ?? undefined,
      unit: "index",
      displayValue: air == null ? "Unavailable" : `${air} / 10`,
      statusLabel: air == null ? "Unavailable" : `${air} / 10`,
      description:
        "Air quality index reported for this postcode: 1 is low and 10 is very high. Reporting time and source details are not supplied yet.",
    },
  ];
}
