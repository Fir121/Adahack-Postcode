import type { Feature, MultiPolygon, Polygon } from "geojson";

export interface User {
  id: string;
  name: string;
  email: string;
  postcode: string;
  communityId: string;
}

export interface AuthResponse {
  user: User;
}
export interface LoginInput {
  email: string;
  password: string;
}
export interface SignupInput extends LoginInput {
  name: string;
  postcode: string;
}

export type IndicatorStatus = "poor" | "fair" | "good" | "excellent";
export interface PostcodeIndicatorTrend {
  direction: "up" | "down" | "flat";
  change?: number;
  period?: string;
  interpretation?: string;
}
export interface PostcodeIndicator {
  id: string;
  type: string;
  label: string;
  displayValue: string;
  value?: number;
  unit?: string;
  score?: number;
  status: IndicatorStatus;
  description?: string;
  trend?: PostcodeIndicatorTrend;
  source?: string;
  updatedAt?: string;
  coverage?: { type: string; description?: string };
  provenance: "mock" | "measured" | "derived";
}

export interface PostcodeStats {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
  icon?: string;
  supportingText?: string;
}
export interface CommunityProgress {
  score: number;
  level: number;
  monthlyChange?: number;
  totalActions: number;
  activityByIndicator: Record<string, number>;
  stats: PostcodeStats[];
}
export type MapAssetType = "tree" | "plant" | "house" | "solar-panel" | "bike";
export interface MapDecoration {
  id: string;
  type: MapAssetType;
  longitude: number;
  latitude: number;
  animation: "grow" | "appear";
  minGreenLevel: number;
  indicator?: string;
}
export interface PostcodeCommunity {
  id: string;
  postcode: string;
  name: string;
  city: string;
  centroid: { latitude: number; longitude: number };
  boundary?: Feature<Polygon | MultiPolygon>;
  geometryProvenance: "demo" | "authoritative";
  indicators: PostcodeIndicator[];
  progress: CommunityProgress;
  decorations: MapDecoration[];
}

export type TaskCategory = string;
export type ProofRequirement =
  | { type: "declaration"; label: string; required: boolean }
  | { type: "text"; label: string; required: boolean; minLength: number }
  | {
      type: "image";
      label: string;
      required: boolean;
      maxBytes: number;
      acceptedTypes: readonly string[];
    };
export interface Task {
  id: string;
  title: string;
  description: string;
  whyItMatters: string;
  targetIndicators: string[];
  category: TaskCategory;
  estimatedTime: string;
  effort: string;
  repeat: "daily" | "once";
  proofRequirements: ProofRequirement[];
  decorationType: MapAssetType;
}
export interface TaskProof {
  declaration?: boolean;
  text?: string;
  image?: File;
}
export interface TaskCompletion {
  id: string;
  userId: string;
  communityId: string;
  taskId: string;
  taskTitle: string;
  category: string;
  targetIndicators: string[];
  completedAt: string;
  status: "pending" | "approved" | "rejected";
  proofStatus?: "pending" | "approved" | "rejected";
}
export interface CompletionInput {
  taskId: string;
  communityId: string;
  proof: TaskProof;
}
export interface CompletionResponse {
  completion: TaskCompletion;
  progress: CommunityProgress;
  decoration?: MapDecoration;
}
export interface DemoInfo {
  email: string;
  password: string;
  postcode: string;
}
