import type { MapAsset } from "@/lib/map/config";

// Keep source timeline playback inside the map's existing arrival/unlock animation.
export function createAssetVisual(
  asset: MapAsset,
  arrivalAnimation: string,
  animate = true,
) {
  const element = document.createElement("div");
  element.className = `map-asset asset-${animate ? arrivalAnimation : "still"}`;
  if (asset.contentOffset) {
    element.style.setProperty(
      "--asset-content-x",
      `${asset.contentOffset.x}px`,
    );
    element.style.setProperty(
      "--asset-content-y",
      `${asset.contentOffset.y}px`,
    );
  }
  if (!asset.sprite) {
    const img = document.createElement("img");
    img.src = asset.src;
    img.alt = "";
    img.width = asset.width;
    img.draggable = false;
    element.append(img);
    return { element, dispose: () => {} };
  }

  const sprite = asset.sprite;
  const viewport = document.createElement("div");
  viewport.className = "map-sprite";
  viewport.style.width = `${asset.width}px`;
  viewport.style.height = `${(asset.width * sprite.frameHeight) / sprite.frameWidth}px`;
  viewport.style.backgroundImage = `url("${sprite.src}")`;
  viewport.style.backgroundSize = `${asset.width * sprite.frameCount}px 100%`;
  viewport.style.backgroundPosition = "0px 0px";
  element.append(viewport);

  const duration = sprite.frameDurationsMs.reduce((sum, ms) => sum + ms, 0);
  let elapsed = 0;
  const keyframes: Keyframe[] = sprite.frameDurationsMs.map((ms, frame) => {
    const keyframe = {
      backgroundPosition: `${-frame * asset.width}px 0px`,
      offset: elapsed / duration,
      easing: "steps(1, end)",
    };
    elapsed += ms;
    return keyframe;
  });
  keyframes.push({ backgroundPosition: "0px 0px", offset: 1 });

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let animation: Animation | undefined;
  function updateMotion() {
    animation?.cancel();
    animation = undefined;
    if (animate && !reducedMotion.matches && sprite.frameCount > 1) {
      animation = viewport.animate(keyframes, {
        id: "sprite-timeline",
        duration,
        iterations: Infinity,
      });
    }
  }
  updateMotion();
  reducedMotion.addEventListener("change", updateMotion);
  return {
    element,
    dispose() {
      animation?.cancel();
      reducedMotion.removeEventListener("change", updateMotion);
    },
  };
}
