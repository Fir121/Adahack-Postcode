import type { MapAssetType } from "@/types/domain";
import houseSprite from "@/public/map-assets/house-sprite.json";
import treeSprite from "@/public/map-assets/tree-sprite.json";
import { normalizeScore } from "@/lib/scoring";

export interface SpriteTimeline {
  src: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameDurationsMs: number[];
}

export interface MapAsset {
  src: string;
  label: string;
  width: number;
  contentOffset?: { x: number; y: number };
  sprite?: SpriteTimeline;
}

export const mapConfig = {
  styleUrl:
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
    "https://tiles.openfreemap.org/styles/positron",
  localZoom: 16,
  minZoom: 12,
  maxZoom: 19,
};

// Replace artwork here without changing geographic markers or event handling.
export const mapAssets: Record<MapAssetType, MapAsset> = {
  tree: {
    src: "/map-assets/tree.svg",
    label: "Community tree",
    width: 64,
    // Centre the visible tree pixels within the source canvas.
    contentOffset: { x: 1, y: 0 },
    sprite: { ...treeSprite, src: "/map-assets/tree-sprite.svg" },
  },
  plant: { src: "/map-assets/plant.svg", label: "Community plant", width: 44 },
  house: {
    src: "/map-assets/house.svg",
    label: "Greener home",
    width: 96,
    sprite: { ...houseSprite, src: "/map-assets/house-sprite.svg" },
  },
  "solar-panel": {
    src: "/map-assets/solar-panel.svg",
    label: "Community solar panel",
    width: 55,
  },
  bike: { src: "/map-assets/bike.svg", label: "Active travel", width: 55 },
};

export function readMapPalette(): string[] {
  const style = getComputedStyle(document.documentElement);
  return ["low", "middle", "high"].map((stop) =>
    style.getPropertyValue(`--color-score-${stop}`).trim(),
  );
}

export function scoreColor(score: number, palette: string[]): string {
  const position = (normalizeScore(score) / 100) * (palette.length - 1);
  const low = Math.floor(position);
  const high = Math.min(palette.length - 1, low + 1);
  const rgb = (hex: string) =>
    [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  const from = rgb(palette[low]);
  const to = rgb(palette[high]);
  return `rgb(${from.map((channel, index) => Math.round(channel + (to[index] - channel) * (position - low))).join(",")})`;
}

export function scoreTextColor(background: string): string {
  const channels = background.match(/\d+/g)!.map(Number);
  const linear = channels.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}
