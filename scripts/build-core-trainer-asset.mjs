import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { unzipSync } from "fflate";

const outputPath = process.argv[2] ?? "public/assets/core-trainer.json";
const sourcePage = "https://lottiefiles.com/free-animation/deadbug-fitness-exercise-vPDZn7efNC";
const sourceUrl = "https://assets-v2.lottiefiles.com/a/cdca230e-116c-11ee-95d3-6fb89c296088/WyCgoSoIds.lottie";
const lime = [0.50588, 0.65098, 0.27059, 1];
const mutedLime = [0.44314, 0.52941, 0.36078, 1];
const orange = [0.7451, 0.38824, 0.14118, 1];

const coreLayers = new Set([
  "body_skin",
  "shirt_shadow",
  "shirt",
  "body_shadow",
]);

const mutedLayers = new Set([
  "hair",
  "head_shadow",
  "sole",
  "neck_shadow",
  "ponytail_shadow",
  "thigh_1",
  "calf_1",
  "foot_1",
  "sole_1",
  "calf_skin_1",
  "lower_body",
  "body",
  "hand_1",
  "arm_1",
  "forearm_1",
]);

async function loadSourceAnimation() {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`下载 Lottie 源文件失败：${response.status}`);
  }

  const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const animationEntry = Object.entries(archive).find(([name]) => (
    name.startsWith("animations/") && name.endsWith(".json")
  ));

  if (!animationEntry) {
    throw new Error("Lottie 源文件中没有动画 JSON");
  }

  return JSON.parse(new TextDecoder().decode(animationEntry[1]));
}

function walkShapes(shapes, callback) {
  for (const shape of shapes ?? []) {
    callback(shape);
    if (shape.it) {
      walkShapes(shape.it, callback);
    }
  }
}

function themeColorForLayer(layerName) {
  if (coreLayers.has(layerName)) {
    return orange;
  }

  if (mutedLayers.has(layerName)) {
    return mutedLime;
  }

  return lime;
}

function adaptShapeLayer(layer) {
  const color = themeColorForLayer(layer.nm);

  walkShapes(layer.shapes, (shape) => {
    if (shape.ty === "fl") {
      shape.c = { ...shape.c, a: 0, k: color };
    }
  });
}

const animation = await loadSourceAnimation();

for (const layer of animation.layers ?? []) {
  if (layer.ty === 4) {
    adaptShapeLayer(layer);
  }
}

animation.nm = "练迹核心训练者";
animation.meta = {
  g: "LottieFiles dotLottie React",
  a: "LottieFiles 原作者 / 练迹主题适配",
  d: "基于 Deadbug fitness exercise 的完整对侧手脚训练循环，练迹仅调整主题色、播放速度和训练页布局",
  source: sourcePage,
  sourceFile: sourceUrl,
  license: "Lottie Simple License",
};

await writeFile(path.resolve(outputPath), `${JSON.stringify(animation)}\n`);
