"use client";

import { apiConfig } from "@/lib/api/config";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser, getDemoInfo } from "@/lib/api/auth";
import {
  getCommunities,
  getCommunity,
  getSupportedPostcodes,
} from "@/lib/api/postcodes";
import { getTask, getTasks } from "@/lib/api/tasks";
import { getCommunityLeaderboard } from "@/lib/api/leaderboard";
import { getCompletionHistory } from "@/lib/api/completions";

export const queryKeys = {
  user: ["current-user"] as const,
  communities: ["communities"] as const,
  community: (id: string) => ["community", id] as const,
  tasks: ["tasks"] as const,
  leaderboard: (postcode: string) => ["leaderboard", postcode] as const,
  history: (userId: string) => ["history", userId] as const,
};
export const useCurrentUser = () =>
  useQuery({
    queryKey: queryKeys.user,
    queryFn: getCurrentUser,
    staleTime: 60_000,
  });
export const useDemoInfo = () =>
  useQuery({
    queryKey: ["demo-info"],
    queryFn: getDemoInfo,
    staleTime: Infinity,
  });
export const useSupportedPostcodes = (enabled = true) =>
  useQuery({
    queryKey: ["supported-postcodes"],
    queryFn: getSupportedPostcodes,
    enabled,
    staleTime: apiConfig.useMock ? Infinity : 60_000,
  });
export const useCommunities = () =>
  useQuery({ queryKey: queryKeys.communities, queryFn: getCommunities });
export const useCommunity = (id: string) =>
  useQuery({
    queryKey: queryKeys.community(id),
    queryFn: () => getCommunity(id),
    enabled: Boolean(id),
  });
export const useTasks = () =>
  useQuery({ queryKey: queryKeys.tasks, queryFn: getTasks });
export const useHistory = (userId: string) =>
  useQuery({
    queryKey: queryKeys.history(userId),
    queryFn: () => getCompletionHistory(userId),
    enabled: Boolean(userId),
  });

export const useTask = (id: string, enabled: boolean) =>
  useQuery({ queryKey: ["task", id], queryFn: () => getTask(id), enabled });

export const useCommunityLeaderboard = (postcode: string) =>
  useQuery({
    queryKey: queryKeys.leaderboard(postcode),
    queryFn: () => getCommunityLeaderboard(postcode),
    enabled: Boolean(postcode),
    staleTime: 0,
    retry: false,
  });
