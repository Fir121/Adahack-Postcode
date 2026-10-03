"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as LibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import { CircleAlert, LocateFixed, Minus, Plus, Sprout } from "lucide-react";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { PostcodeCommunity } from "@/types/domain";
import {
  mapAssets,
  mapConfig,
  readMapPalette,
  scoreColor,
} from "@/lib/map/config";
import { errorMessage } from "@/lib/utils";
import "maplibre-gl/dist/maplibre-gl.css";

interface MapProps {
  communities: PostcodeCommunity[];
  selected: PostcodeCommunity;
  ownCommunityId: string;
  selectedIndicator?: string;
  newDecorationId?: string;
  onSelect: (id: string) => void;
  focusRequest: number;
}

export default function CommunityMap(props: MapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const latest = useRef(props);
  const [mapError, setMapError] = useState("");
  const [providerWarning, setProviderWarning] = useState("");
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const updateMap = useRef<(() => void) | null>(null);

  useEffect(() => {
    latest.current = props;
    updateMap.current?.();
  }, [props]);

  useEffect(() => {
    if (!container.current) return;
    let instance: LibreMap;
    const decorations = new globalThis.Map<string, Marker>();
    const labels = new globalThis.Map<string, Marker>();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const theme = getComputedStyle(document.documentElement);
    const palette = readMapPalette();
    const controller = new AbortController();
    let disposed = false;
    let styleReady = false;
    const warning =
      "Street tiles are unavailable. Community areas and actions still work on this illustrative map.";
    const localStyle: StyleSpecification = {
      version: 8,
      sources: {},
      layers: [
        {
          id: "local-background",
          type: "background",
          paint: {
            "background-color": theme
              .getPropertyValue("--color-map-background")
              .trim(),
          },
        },
      ],
    };
    try {
      // v6 workers import a sibling module; serving both locally avoids Turbopack's missing sibling asset.
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      instance = new LibreMap({
        container: container.current,
        style: localStyle,
        center: [
          latest.current.selected.centroid.longitude,
          latest.current.selected.centroid.latitude,
        ],
        zoom: mapConfig.localZoom,
        minZoom: mapConfig.minZoom,
        maxZoom: mapConfig.maxZoom,
        attributionControl: { compact: true },
        renderWorldCopies: false,
      });
      map.current = instance;
      instance
        .getCanvas()
        .setAttribute(
          "aria-label",
          "Interactive community map. Use the postcode selector to explore communities, or the buttons to zoom and return home.",
        );
      // Keyboard navigation is available independently of canvas hit targets.
      instance.addControl(
        new NavigationControl({ showCompass: true, showZoom: false }),
        "bottom-left",
      );
    } catch (error) {
      queueMicrotask(() => {
        if (!disposed)
          setMapError(
            `Your browser couldn’t start the map. ${errorMessage(error)}`,
          );
      });
      return () => {
        disposed = true;
        controller.abort();
      };
    }

    function sync() {
      if (disposed || !styleReady) return;
      const current = latest.current;
      const geojson: FeatureCollection<Polygon | MultiPolygon> = {
        type: "FeatureCollection",
        features: current.communities.flatMap((community) =>
          community.boundary
            ? [
                {
                  ...community.boundary,
                  properties: {
                    communityId: community.id,
                    color: scoreColor(community.progress.score, palette),
                    selected: community.id === current.selected.id,
                  },
                },
              ]
            : [],
        ),
      };
      const source = instance.getSource("communities") as
        GeoJSONSource | undefined;
      if (source) source.setData(geojson);
      else {
        instance.addSource("communities", { type: "geojson", data: geojson });
        instance.addLayer({
          id: "community-fill",
          type: "fill",
          source: "communities",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": ["case", ["get", "selected"], 0.32, 0.2],
            "fill-color-transition": {
              duration: reducedMotion.matches ? 0 : 800,
            },
          },
        });
        instance.addLayer({
          id: "community-border",
          type: "line",
          source: "communities",
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["case", ["get", "selected"], 3, 1.5],
            "line-dasharray": [2, 2],
            "line-opacity": 0.9,
          },
        });
      }
      const visible = new Set<string>();
      for (const community of current.communities) {
        let label = labels.get(community.id);
        if (!label) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "map-postcode-label";
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            latest.current.onSelect(community.id);
          });
          label = new Marker({ element: button, anchor: "center" })
            .setLngLat([
              community.centroid.longitude,
              community.centroid.latitude,
            ])
            .addTo(instance);
          labels.set(community.id, label);
        }
        const element = label.getElement();
        element.textContent = `${community.postcode} · ${community.progress.score}`;
        element.setAttribute(
          "aria-label",
          `Explore ${community.postcode}, Green Score ${community.progress.score}`,
        );
        element.setAttribute(
          "aria-pressed",
          String(community.id === current.selected.id),
        );
        element.classList.toggle(
          "selected",
          community.id === current.selected.id,
        );
        for (const decoration of community.decorations.filter(
          (d) => d.minGreenLevel <= community.progress.level,
        )) {
          const key = `${community.id}:${decoration.id}`;
          visible.add(key);
          let marker = decorations.get(key);
          if (!marker) {
            const wrapper = document.createElement("div");
            wrapper.className = "map-decoration";
            wrapper.setAttribute("aria-hidden", "true");
            const visual = document.createElement("div");
            visual.className = `map-asset asset-${decoration.animation}`;
            const asset = mapAssets[decoration.type];
            const img = document.createElement("img");
            img.src = asset.src;
            img.alt = "";
            img.width = asset.width;
            img.draggable = false;
            visual.append(img);
            wrapper.append(visual);
            marker = new Marker({
              element: wrapper,
              anchor: "bottom",
              rotationAlignment: "viewport",
            })
              .setLngLat([decoration.longitude, decoration.latitude])
              .addTo(instance);
            decorations.set(key, marker);
          }
          const element = marker.getElement();
          element.classList.toggle(
            "asset-highlight",
            Boolean(
              current.selectedIndicator &&
              decoration.indicator === current.selectedIndicator &&
              community.id === current.selected.id,
            ),
          );
          element.classList.toggle(
            "asset-unlocked",
            decoration.id === current.newDecorationId,
          );
        }
      }
      for (const [key, marker] of decorations)
        if (!visible.has(key)) {
          marker.remove();
          decorations.delete(key);
        }
      for (const [id, marker] of labels)
        if (!current.communities.some((c) => c.id === id)) {
          marker.remove();
          labels.delete(id);
        }
    }
    updateMap.current = sync;
    instance.on("style.load", () => {
      styleReady = true;
      sync();
      if (!disposed) setReady(true);
    });
    instance.on("click", "community-fill", (event) => {
      const id = event.features?.[0]?.properties?.communityId;
      if (typeof id === "string") latest.current.onSelect(id);
    });
    instance.on("mouseenter", "community-fill", () => {
      instance.getCanvas().style.cursor = "pointer";
    });
    instance.on("mouseleave", "community-fill", () => {
      instance.getCanvas().style.cursor = "";
    });
    instance.on("error", () => {
      if (!disposed) setProviderWarning(warning);
    });
    instance.on("webglcontextlost", () => {
      if (!disposed)
        setMapError(
          "The browser lost its map graphics connection. Retry the map, or keep exploring with the postcode selector.",
        );
    });
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(container.current);
    const timeout = setTimeout(() => controller.abort(), 12_000);
    void fetch(mapConfig.styleUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Map provider unavailable");
        const style = (await response.json()) as StyleSpecification;
        if (!disposed) {
          styleReady = false;
          instance.setStyle(style);
        }
      })
      .catch(() => {
        if (!disposed) setProviderWarning(warning);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timeout);
      resize.disconnect();
      updateMap.current = null;
      decorations.forEach((m) => m.remove());
      labels.forEach((m) => m.remove());
      instance.remove();
      map.current = null;
    };
  }, [retry]);

  useEffect(() => {
    if (!map.current || !ready) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    map.current.flyTo({
      center: [
        props.selected.centroid.longitude,
        props.selected.centroid.latitude,
      ],
      zoom: mapConfig.localZoom,
      duration: reduced ? 0 : 1000,
    });
  }, [
    props.selected.id,
    props.selected.centroid.latitude,
    props.selected.centroid.longitude,
    props.focusRequest,
    ready,
  ]);

  function retryMap() {
    setMapError("");
    setProviderWarning("");
    setReady(false);
    setRetry((n) => n + 1);
  }
  return (
    <div className="map-frame">
      <div ref={container} className="map-canvas" />
      {!ready && !mapError && (
        <div className="map-loading" role="status">
          <Sprout className="spin" size={21} /> Finding your little corner…
        </div>
      )}
      {mapError && (
        <div className="map-fatal" role="alert">
          <CircleAlert size={27} />
          <h3>Let’s get your map growing.</h3>
          <p>{mapError}</p>
          <button className="button button-secondary" onClick={retryMap}>
            Retry map
          </button>
        </div>
      )}
      {providerWarning && !mapError && (
        <div className="map-provider-warning" role="status">
          <CircleAlert size={16} />
          <span>{providerWarning}</span>
          <button className="text-button" onClick={retryMap}>
            Retry
          </button>
        </div>
      )}
      <div className="map-controls">
        <button
          aria-label="Zoom in"
          onClick={() => map.current?.zoomIn()}
          disabled={!ready}
        >
          <Plus size={20} />
        </button>
        <button
          aria-label="Zoom out"
          onClick={() => map.current?.zoomOut()}
          disabled={!ready}
        >
          <Minus size={20} />
        </button>
        <span />
        <button
          aria-label="Return to my postcode"
          onClick={() => {
            props.onSelect(props.ownCommunityId);
            const own = props.communities.find(
              (c) => c.id === props.ownCommunityId,
            );
            if (own)
              map.current?.flyTo({
                center: [own.centroid.longitude, own.centroid.latitude],
                zoom: mapConfig.localZoom,
                duration: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? 0
                  : 800,
              });
          }}
        >
          <LocateFixed size={20} />
        </button>
      </div>
      <div className="map-legend">
        <span>ROOM TO GROW</span>
        <span className="legend-gradient" />
        <span>THRIVING</span>
      </div>
      <span className="map-geometry-note">
        {props.selected.geometryProvenance === "demo"
          ? "Illustrative areas & decorations"
          : "Community boundaries · illustrative decorations"}
      </span>
    </div>
  );
}
