"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as LibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type StyleSpecification,
} from "maplibre-gl";
import { CircleAlert, LocateFixed, Minus, Plus, Sprout } from "lucide-react";
import type { PostcodeCommunity } from "@/types/domain";
import {
  mapAssets,
  mapConfig,
  readMapPalette,
  scoreColor,
  scoreTextColor,
} from "@/lib/map/config";
import { errorMessage } from "@/lib/utils";
import {
  communityDecorations,
  decorationAnimates,
  houseSaturation,
  postcodeSceneLayout,
} from "@/lib/map/decorations";
import { colourStreets, readStreetPalette } from "@/lib/map/basemap";
import { greenLevel } from "@/lib/scoring";
import { createAssetVisual } from "@/lib/map/asset-visual";
import "maplibre-gl/dist/maplibre-gl.css";

interface MapProps {
  communities: PostcodeCommunity[];
  selected: PostcodeCommunity;
  ownCommunityId: string;
  selectedIndicator?: string;
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
    const visuals = new globalThis.Map<
      string,
      { element: HTMLDivElement; dispose: () => void }
    >();
    let scene: Marker | null = null;
    let stage: HTMLDivElement | null = null;
    let sceneCommunityId: string | null = null;
    const labels = new globalThis.Map<string, Marker>();
    const theme = getComputedStyle(document.documentElement);
    const palette = readMapPalette();
    const streetPalette = readStreetPalette();
    const controller = new AbortController();
    let disposed = false;
    let styleReady = false;
    let lastSceneRequest = latest.current.focusRequest;
    const warning =
      "Street tiles are unavailable. Postcode labels and actions still work on this map.";
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

    function clearScene() {
      visuals.forEach((visual) => visual.dispose());
      visuals.clear();
      scene?.remove();
      scene = null;
      stage = null;
      sceneCommunityId = null;
    }

    function sync() {
      if (disposed || !styleReady) return;
      const current = latest.current;
      if (
        current.focusRequest !== lastSceneRequest ||
        sceneCommunityId !== current.selected.id
      ) {
        clearScene();
        lastSceneRequest = current.focusRequest;
      }
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
        label.setLngLat([
          community.centroid.longitude,
          community.centroid.latitude,
        ]);
        const element = label.getElement();
        const color = scoreColor(community.progress.score, palette);
        element.style.setProperty("--postcode-color", color);
        element.style.setProperty("--postcode-ink", scoreTextColor(color));
        element.dataset.communityId = community.id;
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
      }
      const community = current.selected;
      if (!scene) {
        const root = document.createElement("div");
        root.className = "map-postcode-scene";
        root.setAttribute("aria-hidden", "true");
        stage = document.createElement("div");
        stage.className = "postcode-scene-stage";
        root.append(stage);
        scene = new Marker({
          element: root,
          anchor: "bottom",
          rotationAlignment: "viewport",
        })
          .setLngLat([
            community.centroid.longitude,
            community.centroid.latitude,
          ])
          .addTo(instance);
        sceneCommunityId = community.id;
      }
      const visible = new Set<string>();
      const decorations = communityDecorations(community);
      for (const decoration of decorations) {
        const animated = decorationAnimates(
          decoration.type,
          community.progress.score,
        );
        const key = `${decoration.id}:${animated}`;
        visible.add(key);
        let visual = visuals.get(key);
        if (!visual) {
          const wrapper = document.createElement("div");
          wrapper.className = "map-decoration";
          wrapper.dataset.communityId = community.id;
          wrapper.dataset.assetType = decoration.type;
          const art = createAssetVisual(
            mapAssets[decoration.type],
            decoration.animation,
            animated,
          );
          wrapper.append(art.element);
          stage!.append(wrapper);
          visual = { element: wrapper, dispose: art.dispose };
          visuals.set(key, visual);
        }
        const element = visual.element;
        element.style.left = `${decoration.offsetX}px`;
        element.style.zIndex = String(decoration.zIndex);
        element.style.setProperty(
          "--asset-saturation",
          String(
            decoration.type === "house"
              ? houseSaturation(community.progress.score)
              : 1,
          ),
        );
        element.dataset.greenLevel = String(
          greenLevel(community.progress.score),
        );
        element.classList.toggle(
          "asset-highlight",
          decoration.indicator === current.selectedIndicator,
        );
      }
      for (const [key, visual] of visuals) {
        if (!visible.has(key)) {
          visual.dispose();
          visual.element.remove();
          visuals.delete(key);
        }
      }
      // Keep the composition attached to the label in CSS pixels at every zoom.
      const halfWidth = Math.max(
        ...decorations.map(
          (decoration) =>
            Math.abs(decoration.offsetX) + mapAssets[decoration.type].width / 2,
        ),
      );
      const available = Math.max(
        1,
        (container.current?.clientWidth ?? 1) -
          postcodeSceneLayout.edgePadding * 2,
      );
      stage!.style.transform = `scale(${Math.min(1, available / (halfWidth * 2))})`;
      const labelHeight =
        labels.get(community.id)?.getElement().offsetHeight ?? 42;
      scene.setLngLat([
        community.centroid.longitude,
        community.centroid.latitude,
      ]);
      scene.setOffset([0, -labelHeight / 2 - postcodeSceneLayout.labelGap]);
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
    instance.on("error", () => {
      if (!disposed) setProviderWarning(warning);
    });
    instance.on("webglcontextlost", () => {
      if (!disposed)
        setMapError(
          "The browser lost its map graphics connection. Retry the map, or keep exploring with the postcode selector.",
        );
    });
    const resize = new ResizeObserver(() => {
      instance.resize();
      sync();
    });
    resize.observe(container.current);
    const timeout = setTimeout(() => controller.abort(), 12_000);
    void fetch(mapConfig.styleUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Map provider unavailable");
        const style = (await response.json()) as StyleSpecification;
        if (!disposed) {
          styleReady = false;
          instance.setStyle(colourStreets(style, streetPalette));
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
      clearScene();
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
        Postcode colour shows Green Score · tap a label to explore
      </span>
    </div>
  );
}
