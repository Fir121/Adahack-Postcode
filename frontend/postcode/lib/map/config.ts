import type { MapAssetType } from "@/types/domain";

export const mapConfig = {
  styleUrl:
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
    "https://tiles.openfreemap.org/styles/positron",
  localZoom: 16.4,
  minZoom: 12,
  maxZoom: 19,
};

// Replace artwork here without changing geographic markers or event handling.
export const mapAssets: Record<
  MapAssetType,
  { src: string; label: string; width: number }
> = {
  tree: { src: "/map-assets/tree.svg", label: "Community tree", width: 64 },
  plant: { src: "/map-assets/plant.svg", label: "Community plant", width: 44 },
  house: { src: "/map-assets/house.svg", label: "Greener home", width: 75 },
  "solar-panel": {
    src: "/map-assets/solar-panel.svg",
    label: "Community solar panel",
    width: 55,
  },
  bike: { src: "/map-assets/bike.svg", label: "Active travel", width: 55 },
};

export function readMapPalette(): string[] {
  const style = getComputedStyle(document.documentElement);
  return Array.from({ length: 6 }, (_, level) =>
    style.getPropertyValue(`--color-green-level-${level}`).trim(),
  );
}

export function scoreColor(score: number, palette: string[]): string {
  const position = Math.max(0, Math.min(100, score)) / 20;
  const low = Math.floor(position);
  const high = Math.min(5, low + 1);
  const rgb = (hex: string) =>
    [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  const from = rgb(palette[low]);
  const to = rgb(palette[high]);
  return `rgb(${from.map((channel, index) => Math.round(channel + (to[index] - channel) * (position - low))).join(",")})`;
}
