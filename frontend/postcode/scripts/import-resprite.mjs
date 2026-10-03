// Lossless export of the simple raster timeline used by our supplied Resprite art.
// SVG containers embed the original PNG cels; no tracing or image resampling.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [source, name] = process.argv.slice(2);
if (!source || !name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error(
    "Usage: node scripts/import-resprite.mjs <file.resprite> <asset-name>",
  );
  process.exit(1);
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function number(value, label, min = 0, max = 16384) {
  check(
    Number.isFinite(value) && value >= min && value <= max,
    `Invalid ${label}`,
  );
  return value;
}

try {
  const archive = resolve(source);
  const entries = execFileSync("unzip", ["-Z1", archive], { encoding: "utf8" })
    .trim()
    .split("\n");
  const documents = entries.filter((entry) => entry.endsWith("/document.json"));
  check(documents.length === 1, "Expected one Resprite document");
  const prefix = documents[0].slice(0, -"document.json".length);
  const read = (entry) =>
    execFileSync("unzip", ["-p", archive, entry], {
      maxBuffer: 32 * 1024 * 1024,
    });
  const document = JSON.parse(read(documents[0]).toString("utf8"));
  check(document.formatVersion === 2, "Only Resprite format 2 is supported");
  check(
    !document.requiredCapabilities?.length && !document.tilesets?.length,
    "Required capabilities or tilesets need a flattened export",
  );
  const width = number(document.canvasSize.width, "canvas width", 1, 2048);
  const height = number(document.canvasSize.height, "canvas height", 1, 2048);
  const count = number(document.frameCount, "frame count", 1, 256);
  check(
    [width, height, count].every(Number.isInteger),
    "Canvas dimensions and frame count must be integers",
  );
  const fps = number(document.frameRate, "frame rate", 0.01, 1000);
  check(
    document.frameDatas.length === count,
    "Frame metadata does not match frame count",
  );
  check(
    document.frameDatas.every(
      (frame) =>
        !frame.isClipHead &&
        !frame.isClipTail &&
        !frame.clipName &&
        (!frame.clipDir || frame.clipDir === "Forward"),
    ),
    "Named or directional clips need an explicit clip export",
  );
  const durations = document.frameDatas.map(
    (frame) => (number(frame.duration, "frame duration", 0.01) * 1000) / fps,
  );
  check(
    document.layerDatas.every((layer) => !layer.isGroup),
    "Layer groups need a flattened export",
  );
  const layers = document.layerDatas
    .filter((layer) => layer.contentVisible)
    .reverse();
  check(layers.length > 0, "No visible layers");
  for (const layer of layers) {
    check(
      layer.layerKind === "raster" &&
        !layer.isGroup &&
        !layer.isClippingMask &&
        layer.blendMode === "bm-normal",
      "Groups, masks or blend modes need a flattened export",
    );
    number(layer.opacity, "layer opacity", 0, 1);
    check(layer.cells.length === count, "Layer cells do not match frame count");
    check(
      layer.cells.every((cell) => !cell.inherit),
      "Linked cels need a flattened export",
    );
  }
  const frames = Array.from({ length: count }, (_, index) =>
    layers
      .map((layer) => {
        const cell = layer.cells[index];
        const opacity = number(cell.opacity, "cel opacity", 0, 1);
        const { origin, size } = cell.bounds;
        const x = number(origin.x, "cel x", -16384);
        const y = number(origin.y, "cel y", -16384);
        const w = number(size.width, "cel width");
        const h = number(size.height, "cel height");
        if (!w || !h || !opacity || !layer.opacity) return "";
        check(/^[a-zA-Z0-9-]+$/.test(cell.id), "Invalid cel identifier");
        const png = read(`${prefix}CellData/${cell.id}.png`);
        check(
          png
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
          "Expected a PNG cel",
        );
        check(
          png.readUInt32BE(16) === w && png.readUInt32BE(20) === h,
          "PNG dimensions do not match cel bounds",
        );
        return `<g opacity="${layer.opacity}"><image x="${x}" y="${y}" width="${w}" height="${h}" opacity="${opacity}" href="data:image/png;base64,${png.toString("base64")}"/></g>`;
      })
      .join(""),
  );
  const svg = (items) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * items.length}" height="${height}" viewBox="0 0 ${width * items.length} ${height}"><g style="image-rendering:pixelated">${items.map((frame, index) => `<svg x="${index * width}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="hidden">${frame}</svg>`).join("")}</g></svg>\n`;
  const output = fileURLToPath(
    new URL("../public/map-assets/", import.meta.url),
  );
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, `${name}.svg`), svg([frames[0]]));
  writeFileSync(resolve(output, `${name}-sprite.svg`), svg(frames));
  writeFileSync(
    resolve(output, `${name}-sprite.json`),
    JSON.stringify(
      {
        source: basename(archive),
        frameWidth: width,
        frameHeight: height,
        frameCount: count,
        frameDurationsMs: durations,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Imported ${basename(archive)}: ${width}×${height}, ${count} frames, ${fps} fps → public/map-assets/${name}*`,
  );
} catch (error) {
  console.error(
    `Cannot import: ${error.message}. Please export a transparent PNG sprite sheet plus frame timing from Resprite instead. The source file was not changed.`,
  );
  process.exit(1);
}
