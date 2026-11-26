import { projectSpellPoint, SPELL_PLANE } from "./spell-projection";

const tau = Math.PI * 2;
const fract = (value: number) => value - Math.floor(value);
const random = (seed: number) =>
  fract(Math.sin(seed * 127.1 + 311.7) * 43758.5453);
const project = projectSpellPoint;

const drops = Array.from({ length: 116 }, (_, i) => {
  const angle = random(i + 1) * tau;
  const radius = 0.31 * Math.sqrt(random(i + 307));
  return {
    x: radius * Math.cos(angle),
    z: radius * Math.sin(angle),
    phase: random(i + 613),
    speed: 0.8 + random(i + 919) * 0.7,
  };
}).sort((a, b) => a.z - b.z);

export function drawRainField(ctx: CanvasRenderingContext2D, time: number) {
  const ground = SPELL_PLANE.y;
  const haze = ctx.createRadialGradient(0.5, ground, 0, 0.5, ground, 0.32);
  haze.addColorStop(0, "#63c4ea44");
  haze.addColorStop(1, "#63c4ea00");
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.ellipse(0.5, ground, 0.34, 0.105, 0, 0, tau);
  ctx.fill();

  const cloud = ctx.createRadialGradient(0.5, 0.25, 0.01, 0.5, 0.25, 0.29);
  cloud.addColorStop(0, "#b2def379");
  cloud.addColorStop(0.55, "#569fbd37");
  cloud.addColorStop(1, "#569fbd00");
  ctx.save();
  ctx.translate(0, 0.19);
  ctx.scale(1, 0.24);
  ctx.fillStyle = cloud;
  ctx.fillRect(0.2, -0.05, 0.6, 0.6);
  ctx.restore();

  ctx.globalCompositeOperation = "lighter";
  for (const drop of drops) {
    const age = fract(time * drop.speed + drop.phase);
    const floor = project(drop.x + 0.035, 0, drop.z);
    ctx.beginPath();
    if (age < 0.76) {
      const falling = age / 0.76;
      const x = drop.x + 0.035 * falling;
      const height = 0.37 * (1 - falling * falling);
      const head = project(x, height, drop.z);
      const tail = project(x - 0.004, height + 0.013 + falling * 0.036, drop.z);
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.lineWidth = (0.00075 + falling * 0.0012) * (1 + drop.z * 1.2);
      ctx.strokeStyle = "#b8edff";
      ctx.globalAlpha = (0.2 + falling * 0.54) * (0.83 + drop.z * 0.5);
    } else {
      const ripple = (age - 0.76) / 0.24;
      const radius = 0.003 + ripple * 0.034;
      ctx.ellipse(floor.x, floor.y, radius, radius * 0.31, 0, 0, tau);
      ctx.lineWidth = 0.001;
      ctx.strokeStyle = "#96dfff";
      ctx.globalAlpha = (1 - ripple) * 0.55;
      if (ripple < 0.53) {
        const splash = Math.sin((ripple * Math.PI) / 0.53) * 0.012;
        ctx.moveTo(floor.x - splash, floor.y - splash);
        ctx.quadraticCurveTo(
          floor.x - splash * 0.7,
          floor.y - splash * 1.2,
          floor.x,
          floor.y
        );
        ctx.quadraticCurveTo(
          floor.x + splash * 0.7,
          floor.y - splash * 1.2,
          floor.x + splash,
          floor.y - splash
        );
      }
    }
    ctx.stroke();
  }
}

const shards = [
  { x: -0.11, z: -0.12, height: 0.22, radius: 0.043, lean: -0.075 },
  { x: 0.11, z: -0.1, height: 0.31, radius: 0.058, lean: 0.075 },
  { x: 0, z: 0, height: 0.49, radius: 0.088, lean: -0.03 },
  { x: -0.15, z: 0.04, height: 0.22, radius: 0.053, lean: -0.065 },
  { x: 0.13, z: 0.07, height: 0.22, radius: 0.052, lean: 0.055 },
  { x: -0.025, z: 0.12, height: 0.17, radius: 0.049, lean: 0.025 },
];

export function drawCrystalSpire(
  ctx: CanvasRenderingContext2D,
  time: number,
  growth: number
) {
  const ground = SPELL_PLANE.y;
  const glow = ctx.createRadialGradient(0.5, ground, 0, 0.5, ground, 0.23);
  glow.addColorStop(0, "#86f8d66e");
  glow.addColorStop(1, "#86f8d600");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(0.5, ground, 0.24, 0.068, 0, 0, tau);
  ctx.fill();

  const path = (points: { x: number; y: number }[]) => {
    ctx.beginPath();
    points.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
  };
  shards.forEach((shard, index) => {
    const reveal = growth === 1 ? 1 : growth ** (0.8 + index * 0.23);
    const height = shard.height * reveal;
    const angle = index * 0.83;
    const ring = Array.from({ length: 6 }, (_, i) => {
      const phi = angle + (i * tau) / 6;
      return {
        x: Math.cos(phi) * shard.radius,
        z: Math.sin(phi) * shard.radius,
      };
    });
    const tip = project(shard.x + shard.lean * growth, height, shard.z);
    const faces = ring
      .map((a, i) => ({
        a,
        b: ring[(i + 1) % ring.length],
        i,
      }))
      .filter(({ a, b }) => a.z + b.z > 0)
      .sort((a, b) => a.a.z + a.b.z - b.a.z - b.b.z);
    for (const { a, b, i } of faces) {
      const shoulder = (p: typeof a) =>
        project(
          shard.x + p.x * 0.86 + shard.lean * growth * 0.72,
          height * 0.72,
          shard.z + p.z * 0.86
        );
      const bottom = (p: typeof a) =>
        project(shard.x + p.x * 0.76, 0, shard.z + p.z * 0.76);
      const left = shoulder(a);
      const right = shoulder(b);
      const light = 0.5 + 0.5 * Math.cos(angle + (i * tau) / 6);
      const sheen = ctx.createLinearGradient(
        tip.x,
        tip.y,
        shard.x + 0.5,
        ground + 0.03
      );
      sheen.addColorStop(0, "#d8fff0");
      sheen.addColorStop(0.36, light > 0.52 ? "#70d7bb" : "#337e83");
      sheen.addColorStop(0.75, light > 0.52 ? "#236658" : "#143f49");
      sheen.addColorStop(1, "#10362f");
      ctx.fillStyle = sheen;
      ctx.strokeStyle = light > 0.52 ? "#c8ffedb0" : "#79cfc684";
      ctx.lineWidth = 0.0013;
      path([left, bottom(a), bottom(b), right]);
      ctx.fill();
      ctx.stroke();
      path([tip, left, right]);
      ctx.fillStyle = light > 0.52 ? "#a3efda" : "#477f85";
      ctx.fill();
      ctx.stroke();
    }
    const sparkle = Math.pow((1 + Math.cos(time * 2.2 - index * 1.6)) / 2, 9);
    ctx.globalAlpha = sparkle * growth;
    ctx.strokeStyle = "#e0fff4";
    ctx.lineWidth = 0.0018;
    ctx.beginPath();
    ctx.moveTo(tip.x - 0.014, tip.y);
    ctx.lineTo(tip.x + 0.014, tip.y);
    ctx.moveTo(tip.x, tip.y - 0.019);
    ctx.lineTo(tip.x, tip.y + 0.019);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

export function polygon(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[]
) {
  ctx.beginPath();
  points.forEach(({ x, y }, i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

export function drawIceGlaives(
  ctx: CanvasRenderingContext2D,
  time: number,
  growth: number
) {
  for (let i = 0; i < 3; i++) {
    const phase = fract(time / 2.15 + i / 3);
    const point = project(
      -0.2 + phase * 0.44,
      0.13 + i * 0.078 + phase * 0.13,
      (i - 1) * 0.06
    );
    const length = (0.22 + i * 0.023) * growth;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(-0.36 - i * 0.08);
    ctx.globalAlpha = 0.25 + 0.75 * Math.sin(phase * Math.PI) ** 0.62;
    const tail = ctx.createLinearGradient(-length, 0, 0.03, 0);
    tail.addColorStop(0, "#79dbff00");
    tail.addColorStop(1, "#98edff8f");
    ctx.fillStyle = tail;
    polygon(ctx, [
      { x: -length, y: 0.025 },
      { x: 0.025, y: -0.022 },
      { x: 0.02, y: 0.023 },
    ]);
    ctx.fill();
    const heel = { x: -length * 0.48, y: 0.031 },
      shoulder = { x: -length * 0.37, y: -0.036 };
    const ridge = { x: -length * 0.15, y: -0.006 },
      tip = { x: length * 0.53, y: -0.021 };
    const edge = { x: length * 0.14, y: 0.026 };
    const faces = [
      { colors: ["#74c1df", "#d4faff"], points: [shoulder, tip, ridge] },
      { colors: ["#317c99", "#69c4db"], points: [shoulder, ridge, heel] },
      { colors: ["#8cd5ee", "#e8fcff"], points: [heel, ridge, tip, edge] },
    ];
    ctx.lineWidth = 0.0015;
    ctx.strokeStyle = "#e0fbff";
    for (const face of faces) {
      polygon(ctx, face.points);
      const facet = ctx.createLinearGradient(heel.x, heel.y, tip.x, tip.y);
      facet.addColorStop(0, face.colors[0]);
      facet.addColorStop(1, face.colors[1]);
      ctx.fillStyle = facet;
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

const stoneBands = [
  { height: -0.108, radius: 0.047 },
  { height: -0.063, radius: 0.115 },
  { height: 0.01, radius: 0.147 },
  { height: 0.093, radius: 0.112 },
  { height: 0.133, radius: 0.053 },
];
const stoneColors = [
  "#283c42",
  "#35454a",
  "#43565b",
  "#4d6264",
  "#586a65",
  "#677a73",
  "#778a81",
];

export function drawStoneHeart(
  ctx: CanvasRenderingContext2D,
  time: number,
  growth: number
) {
  const rotation = time * 0.37;
  const elevation = 0.23 + Math.sin(time * 1.2) * 0.012;
  const pulse = 0.44 + Math.pow(0.5 + Math.cos(time * 3.7) * 0.5, 5) * 0.56;
  const center = project(0, elevation, 0);
  const aura = ctx.createRadialGradient(
    center.x,
    center.y,
    0.075,
    center.x,
    center.y,
    0.235
  );
  aura.addColorStop(0, "#e39758a0");
  aura.addColorStop(1, "#e3975800");
  ctx.globalAlpha = pulse;
  ctx.fillStyle = aura;
  ctx.fillRect(center.x - 0.235, center.y - 0.235, 0.47, 0.47);
  ctx.globalAlpha = 1;

  const bands = stoneBands.map((band, j) =>
    Array.from({ length: 8 }, (_, i) => {
      const angle = rotation + ((i + j * 0.44) * tau) / 8;
      const r = band.radius * growth * (0.87 + random(i + j * 11) * 0.26);
      const z = r * Math.sin(angle);
      return {
        ...project(
          r * Math.cos(angle),
          elevation +
            (band.height + (random(i * 9 + j * 7) - 0.5) * 0.037) * growth,
          z
        ),
        z,
      };
    })
  );
  const faces = bands.slice(0, -1).flatMap((ring, j) =>
    ring.flatMap((a, i) => {
      const next = (i + 1) % ring.length;
      const b = ring[next],
        c = bands[j + 1][i],
        d = bands[j + 1][next];
      return [
        [a, b, c],
        [c, b, d],
      ].map((points, k) => ({
        points,
        depth: points.reduce((sum, p) => sum + p.z, 0) / 3,
        seed: i + j * 11 + k * 23,
        band: j,
      }));
    })
  );
  for (const side of [0, bands.length - 1]) {
    const ring = bands[side];
    const cap = {
      ...project(0, elevation + stoneBands[side].height * growth, 0),
      z: 0,
    };
    ring.forEach((point, index) => {
      const other = ring[(index + 1) % ring.length];
      faces.push({
        points: [point, other, cap],
        depth: (point.z + other.z) / 3,
        seed: 89 + index,
        band: side,
      });
    });
  }
  faces.sort((a, b) => a.depth - b.depth);

  for (const { points, seed, band } of faces) {
    polygon(ctx, points);
    const light = band * 0.13 + (0.58 - points[0].x) + random(seed + 29) * 0.51;
    ctx.fillStyle =
      stoneColors[Math.min(6, Math.max(0, Math.floor(light * 7)))];
    ctx.fill();
    ctx.lineWidth = 0.0014;
    ctx.strokeStyle = "#15252c";
    ctx.stroke();
    if (seed % 3 === 1) {
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 0.0023;
      ctx.strokeStyle = "#ffae67";
      ctx.beginPath();
      const [a, b, c] = points;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(
        a.x * 0.55 + b.x * 0.3 + c.x * 0.15,
        a.y * 0.55 + b.y * 0.3 + c.y * 0.15
      );
      ctx.lineTo(a.x * 0.25 + b.x * 0.75, a.y * 0.25 + b.y * 0.75);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}
