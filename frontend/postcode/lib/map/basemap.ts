import type { StyleSpecification } from "maplibre-gl";

export interface StreetPalette {
  path: string;
  minor: string;
  major: string;
  outline: string;
}

export function readStreetPalette(): StreetPalette {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) =>
    style.getPropertyValue(`--color-street-${name}`).trim();
  return {
    path: read("path"),
    minor: read("minor"),
    major: read("major"),
    outline: read("outline"),
  };
}

// Recolour OpenFreeMap/OpenMapTiles streets; keep widths, labels and other features.
export function colourStreets(
  style: StyleSpecification,
  palette: StreetPalette,
): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      if (
        layer.type !== "line" ||
        layer["source-layer"] !== "transportation" ||
        !/^(highway_|tunnel_motorway)/.test(layer.id)
      )
        return layer;
      const color = layer.id.includes("casing")
        ? palette.outline
        : layer.id.includes("path")
          ? palette.path
          : layer.id.includes("minor")
            ? palette.minor
            : palette.major;
      return { ...layer, paint: { ...layer.paint, "line-color": color } };
    }),
  };
}
