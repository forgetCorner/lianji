import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { unzipSync } from "fflate";

const outputPath = process.argv[2] ?? "public/assets/cardio-runner.json";
const sourcePage = "https://lottiefiles.com/free-animation/run-forrest-run-MWGVhDv50J";
const sourceUrl = "https://assets-v2.lottiefiles.com/a/f30bb07e-117b-11ee-96b7-1382b0fc72f5/l8YcD4SvkK.lottie";
const lime = [0.50588, 0.65098, 0.27059, 1];
const speedLime = [0.44314, 0.52941, 0.36078, 1];
const orange = [0.7451, 0.38824, 0.14118, 1];

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

function principalAxes(points) {
  const center = points.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]],
    [0, 0],
  ).map((value) => value / points.length);

  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const point of points) {
    const dx = point[0] - center[0];
    const dy = point[1] - center[1];
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }

  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const major = [Math.cos(angle), Math.sin(angle)];
  const minor = [-major[1], major[0]];
  return { center, major, minor };
}

function scaleVector(vector, major, minor, minorScale) {
  const majorAmount = vector[0] * major[0] + vector[1] * major[1];
  const minorAmount = vector[0] * minor[0] + vector[1] * minor[1];
  return [
    major[0] * majorAmount + minor[0] * minorAmount * minorScale,
    major[1] * majorAmount + minor[1] * minorAmount * minorScale,
  ];
}

function thinStaticPath(pathValue, minorScale) {
  if (!pathValue?.v || pathValue.v.length < 3) {
    return;
  }

  const { center, major, minor } = principalAxes(pathValue.v);
  pathValue.v = pathValue.v.map((point) => {
    const relative = [point[0] - center[0], point[1] - center[1]];
    const scaled = scaleVector(relative, major, minor, minorScale);
    return [center[0] + scaled[0], center[1] + scaled[1]];
  });
  pathValue.i = pathValue.i.map((tangent) => scaleVector(tangent, major, minor, minorScale));
  pathValue.o = pathValue.o.map((tangent) => scaleVector(tangent, major, minor, minorScale));
}

function walkShapes(shapes, callback) {
  for (const shape of shapes ?? []) {
    callback(shape);
    if (shape.it) {
      walkShapes(shape.it, callback);
    }
  }
}

function adaptShapeLayer(layer) {
  const isHead = layer.nm?.includes("kafa");
  const isTorso = layer.nm?.includes("gov");
  const minorScale = isHead ? 1 : isTorso ? 0.84 : 0.74;
  const color = isHead ? orange : lime;

  walkShapes(layer.shapes, (shape) => {
    if (shape.ty === "sh" && shape.ks?.a === 0) {
      thinStaticPath(shape.ks.k, minorScale);
    }
    if (shape.ty === "fl") {
      shape.c = { ...shape.c, a: 0, k: color };
    }
  });

  if (isHead) {
    layer.ks.s = {
      a: 1,
      k: [
        { t: 43, s: [88, 88, 100], i: { x: [0.37], y: [1] }, o: { x: [0.33], y: [0] } },
        { t: 51.5, s: [96, 96, 100], i: { x: [0.37], y: [1] }, o: { x: [0.33], y: [0] } },
        { t: 60, s: [90, 90, 100], i: { x: [0.37], y: [1] }, o: { x: [0.33], y: [0] } },
        { t: 68.5, s: [96, 96, 100], i: { x: [0.37], y: [1] }, o: { x: [0.33], y: [0] } },
        { t: 77, s: [88, 88, 100] },
      ],
    };
  }
}

function animatedProperty(keyframes) {
  return { a: 1, k: keyframes };
}

function withMotionEasing(keyframes) {
  return keyframes.map((keyframe, index) => ({
    ...keyframe,
    ...(index < keyframes.length - 1
      ? {
          i: {
            x: keyframe.s.map(() => 0.37),
            y: keyframe.s.map(() => 1),
          },
          o: {
            x: keyframe.s.map(() => 0.33),
            y: keyframe.s.map(() => 0),
          },
        }
      : {}),
  }));
}

function speedLineLayer({ index, name, y, startX, endX, flightStart }) {
  const visibleFrame = flightStart + 2;
  const middleFrame = flightStart + 9;
  const exitFrame = flightStart + 18;
  const beforeFlight = flightStart > 43
    ? [{ t: 43, s: [0] }, { t: flightStart, s: [0] }]
    : [{ t: 43, s: [0] }];
  const beforePosition = flightStart > 43
    ? [{ t: 43, s: [54, 0, 0] }, { t: flightStart, s: [54, 0, 0] }]
    : [{ t: 43, s: [54, 0, 0] }];

  return {
    ddd: 0,
    ind: index,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: animatedProperty(withMotionEasing([
        ...beforeFlight,
        { t: visibleFrame, s: [88] },
        { t: middleFrame, s: [66] },
        { t: exitFrame, s: [0] },
        { t: 77, s: [0] },
      ])),
      r: { a: 0, k: 0 },
      p: animatedProperty(withMotionEasing([
        ...beforePosition,
        { t: visibleFrame, s: [26, 0, 0] },
        { t: middleFrame, s: [-32, 0, 0] },
        { t: exitFrame, s: [-108, 0, 0] },
        { t: 77, s: [-108, 0, 0] },
      ])),
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    shapes: [
      {
        ty: "gr",
        it: [
          {
            ty: "sh",
            ks: {
              a: 0,
              k: {
                i: [[0, 0], [0, 0]],
                o: [[0, 0], [0, 0]],
                v: [[startX, y], [endX, y]],
                c: false,
              },
            },
            nm: `${name} path`,
          },
          {
            ty: "st",
            c: { a: 0, k: speedLime },
            o: { a: 0, k: 100 },
            w: { a: 0, k: 10 },
            lc: 2,
            lj: 2,
            ml: 4,
            nm: `${name} stroke`,
          },
          {
            ty: "tr",
            p: { a: 0, k: [0, 0] },
            a: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: 0 },
            o: { a: 0, k: 100 },
            sk: { a: 0, k: 0 },
            sa: { a: 0, k: 0 },
          },
        ],
        nm: name,
      },
    ],
    ip: 43,
    op: 77,
    st: 0,
    bm: 0,
  };
}

const animation = await loadSourceAnimation();

for (const asset of animation.assets ?? []) {
  for (const layer of asset.layers ?? []) {
    if (layer.ty === 4) {
      adaptShapeLayer(layer);
    }
  }
}

animation.nm = "练迹有氧跑者";
animation.meta = {
  g: "LottieFiles dotLottie React",
  a: "Musa Adanur / 练迹适配",
  d: "基于 Run Forrest Run 的完整跑步循环，练迹仅调整统一亮色肢体、肢体粗细、头部呼吸和非顺序错峰速度线",
  source: sourcePage,
  license: "Lottie Simple License",
};
animation.layers = [
  speedLineLayer({ index: 20, name: "速度线 1", y: 330, startX: 118, endX: 282, flightStart: 58 }),
  speedLineLayer({ index: 21, name: "速度线 2", y: 395, startX: 78, endX: 250, flightStart: 43 }),
  speedLineLayer({ index: 22, name: "速度线 3", y: 460, startX: 138, endX: 268, flightStart: 49 }),
  ...animation.layers,
];

await writeFile(path.resolve(outputPath), `${JSON.stringify(animation)}\n`);
