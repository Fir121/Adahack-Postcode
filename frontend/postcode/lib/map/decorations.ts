import type { PostcodeCommunity } from "@/types/domain";
import { normalizeScore } from "@/lib/scoring";

// These display rules are independent of API decorations and supplied artwork.
export const postcodeSceneLayout = {
  firstTreeOffset: 54,
  treeSpacing: 44,
  labelGap: 8,
  edgePadding: 16,
};

export interface SceneDecoration {
  id: string;
  type: "house" | "tree";
  offsetX: number;
  zIndex: number;
  animation: "appear" | "grow";
  indicator: string;
}

export function treeCount(score: number): number {
  return Math.max(1, Math.ceil(normalizeScore(score) / 10));
}

export function houseSaturation(score: number): number {
  return normalizeScore(score) / 100;
}

export function communityDecorations(
  community: PostcodeCommunity,
): SceneDecoration[] {
  const house: SceneDecoration = {
    id: `${community.id}-house`,
    type: "house",
    offsetX: 0,
    zIndex: 6,
    animation: "appear",
    indicator: "energy",
  };
  const trees: SceneDecoration[] = Array.from(
    { length: treeCount(community.progress.score) },
    (_, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      const position = Math.floor(index / 2);
      return {
        id: `${community.id}-tree-${index + 1}`,
        type: "tree",
        offsetX:
          side *
          (postcodeSceneLayout.firstTreeOffset +
            position * postcodeSceneLayout.treeSpacing),
        zIndex: 5 - position,
        animation: "grow",
        indicator: "green_space",
      };
    },
  );
  // A scene always has one house; earned API decorations never add duplicates.
  return [house, ...trees];
}

export function decorationAnimates(
  type: SceneDecoration["type"],
  score: number,
): boolean {
  return type === "tree" || normalizeScore(score) >= 40;
}
