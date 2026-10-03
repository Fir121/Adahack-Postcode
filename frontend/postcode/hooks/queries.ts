"use client";

import { useQuery } from "@tanstack/react-query";
import { getCurrentUser, getDemoInfo } from "@/lib/api/auth";
import {
  getCommunities,
  getCommunity,
  getSupportedPostcodes,
} from "@/lib/api/postcodes";
import { getTasks } from "@/lib/api/tasks";
import { getCompletionHistory } from "@/lib/api/completions";

export const queryKeys = {
  user: ["current-user"] as const,
  communities: ["communities"] as const,
  community: (id: string) => ["community", id] as const,
  tasks: ["tasks"] as const,
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
export const useSupportedPostcodes = () =>
  useQuery({
    queryKey: ["supported-postcodes"],
    queryFn: getSupportedPostcodes,
    staleTime: Infinity,
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
    queryFn: getCompletionHistory,
    enabled: Boolean(userId),
  });
