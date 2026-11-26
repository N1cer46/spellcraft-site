import { projectSpellPoint as project } from "./spell-projection";
import { polygon } from "./spell-scene-art";

const tau = Math.PI * 2;
const fract = (value: number) => value - Math.floor(value);

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: string
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color + alpha);
  gradient.addColorStop(1, color + "00");
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

const pines = [
  [0.14, 0.54, 0.3],
  [0.22, 0.51, 0.23],
  [0.31, 0.49, 0.17],
  [0.38, 0.47, 0.11],
  [0.42, 0.45, 0.075],
  [0.55, 0.45, 0.081],
  [0.6, 0.46, 0.12],
  [0.67, 0.49, 0.23],
  [0.76, 0.51, 0.27],
  [0.85, 0.54, 0.31],
].sort((a, b) => a[1] - b[1]);

function forest(ctx: CanvasRenderingContext2D, revealed: boolean) {
  if (revealed) {
    const sky = ctx.createLinearGradient(0, 0.19, 0, 0.57);
    sky.addColorStop(0, "#172b45");
    sky.addColorStop(0.58, "#476868");
    sky.addColorStop(1, "#203b38");
    ctx.fillStyle = sky;
    ctx.fillRect(0.19, 0.16, 0.62, 0.45);
  } else {
    glow(ctx, 0.49, 0.38, 0.39, "#071219", "e9");
  }

  polygon(ctx, [
    { x: 0.27, y: 0.57 },
    { x: 0.44, y: 0.49 },
    { x: 0.47, y: 0.456 },
    { x: 0.505, y: 0.432 },
    { x: 0.523, y: 0.436 },
    { x: 0.52, y: 0.47 },
    { x: 0.57, y: 0.5 },
    { x: 0.69, y: 0.57 },
  ]);
  ctx.fillStyle = revealed ? "#87a89b" : "#101f20";
  ctx.fill();

  // The window reveals the same tree silhouettes and path drawn outside it.
  for (const [x, base, height] of pines) {
    const half = height * 0.21;
    ctx.fillStyle = revealed
      ? height > 0.15
        ? "#143a3b"
        : "#365c55"
      : "#0c1b1e";
    const tip = base - height;
    polygon(ctx, [
      { x, y: tip },
      { x: x + half * 0.47, y: base - height * 0.49 },
      { x: x + half * 0.27, y: base - height * 0.5 },
      { x: x + half, y: base - height * 0.07 },
      { x: x + half * 0.13, y: base - height * 0.12 },
      { x: x + half * 0.09, y: base },
      { x: x - half * 0.09, y: base },
      { x: x - half * 0.12, y: base - height * 0.11 },
      { x: x - half, y: base - height * 0.07 },
      { x: x - half * 0.27, y: base - height * 0.5 },
      { x: x - half * 0.47, y: base - height * 0.49 },
    ]);
    ctx.fill();
    if (revealed) {
      ctx.strokeStyle = "#a2c3ae52";
      ctx.lineWidth = 0.0011;
      ctx.beginPath();
      ctx.moveTo(x, tip + height * 0.1);
      ctx.lineTo(x, base - height * 0.1);
      for (let i = 1; i <= 3; i++) {
        const y = tip + height * (0.26 + i * 0.17);
        ctx.moveTo(x - half * i * 0.24, y + height * 0.11);
        ctx.lineTo(x, y);
        ctx.lineTo(x + half * i * 0.18, y + height * 0.085);
      }
      ctx.stroke();
    }
  }

  const arch = () => {
    ctx.beginPath();
    ctx.moveTo(0.489, 0.444);
    ctx.lineTo(0.489, 0.422);
    ctx.bezierCurveTo(0.489, 0.397, 0.533, 0.397, 0.533, 0.422);
    ctx.lineTo(0.533, 0.444);
  };
  arch();
  ctx.strokeStyle = revealed ? "#183635" : "#0e1b1f";
  ctx.lineWidth = 0.012;
  ctx.stroke();
  if (revealed) {
    arch();
    ctx.strokeStyle = "#d1d0a0";
    ctx.lineWidth = 0.006;
    ctx.stroke();
    for (let i = 1; i < 8; i++) {
      const u = i / 8;
      ctx.fillStyle = i % 2 ? "#d4d6aa" : "#b4b895";
      ctx.beginPath();
      ctx.ellipse(
        0.505 - 0.083 * u + Math.sin(u * 4) * 0.018,
        0.448 + 0.112 * u,
        0.004 + u * 0.018,
        0.0015 + u * 0.003,
        -0.17,
        0,
        tau
      );
      ctx.fill();
    }
  }
}

export function drawLightWindow(
  ctx: CanvasRenderingContext2D,
  time: number,
  growth: number
) {
  const left = 0.3,
    right = 0.7,
    bottom = 0.548;
  const top = bottom - 0.35 * Math.max(growth, 0.28);
  const bevel = 0.025;
  const corners = [
    { x: left + bevel, y: top },
    { x: right - bevel, y: top },
    { x: right, y: top + bevel },
    { x: right, y: bottom - bevel },
    { x: right - bevel, y: bottom },
    { x: left + bevel, y: bottom },
    { x: left, y: bottom - bevel },
    { x: left, y: top + bevel },
  ];
  forest(ctx, false);
  ctx.save();
  polygon(ctx, corners);
  ctx.clip();
  forest(ctx, true);
  glow(ctx, 0.49 + Math.sin(time * 0.85) * 0.06, 0.42, 0.12, "#d2e8b2", "59");
  ctx.restore();
  polygon(ctx, corners);
  ctx.lineWidth = 0.013;
  ctx.strokeStyle = "#bce9bb55";
  ctx.stroke();
  ctx.lineWidth = 0.0035;
  ctx.strokeStyle = "#e7ffce";
  ctx.stroke();
}

export function drawMirrorPrism(
  ctx: CanvasRenderingContext2D,
  time: number,
  growth: number
) {
  const core = project(0, 0.26, 0);
  const radius = 0.116 * growth;
  glow(ctx, core.x, core.y, 0.25, "#9298f2", "4c");
  const gleam = 0.73 + Math.cos(time * 2) * 0.22;
  ctx.save();
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(core.x, core.y);
    ctx.scale(side, 1);
    const spread = 0.27 + Math.sin(time * 1.5) * 0.013;
    ["#a4a9ff", "#77dfed", "#f9b5e6"].forEach((color, i) => {
      const y = -0.109 + i * 0.039;
      const spectrum = ctx.createLinearGradient(radius * 0.55, 0, spread, y);
      spectrum.addColorStop(0, "#edffffd0");
      spectrum.addColorStop(0.45, color + "a0");
      spectrum.addColorStop(1, color + "00");
      ctx.fillStyle = spectrum;
      ctx.globalAlpha = gleam;
      polygon(ctx, [
        { x: radius * 0.39, y: -0.007 },
        { x: spread, y: y - 0.009 },
        { x: spread, y: y + 0.012 },
        { x: radius * 0.45, y: 0.012 },
      ]);
      ctx.fill();
    });
    ctx.restore();
  }
  ctx.restore();

  const top = { x: core.x, y: core.y - radius * 1.52 };
  const bottom = { x: core.x, y: core.y + radius * 1.26 };
  const left = { x: core.x - radius, y: core.y - radius * 0.18 };
  const right = { x: core.x + radius, y: core.y - radius * 0.18 };
  const center = {
    x: core.x + Math.sin(time * 1.25) * radius * 0.25,
    y: core.y + radius * 0.12,
  };
  const faces = [
    { corners: [top, left, center], colors: ["#f0fbff", "#7193b7"] },
    { corners: [top, center, right], colors: ["#9eb4ea", "#455687"] },
    { corners: [left, bottom, center], colors: ["#7185c5", "#242d55"] },
    { corners: [right, center, bottom], colors: ["#f2dafa", "#6373b5"] },
  ];
  for (const face of faces) {
    const glass = ctx.createLinearGradient(
      face.corners[0].x,
      face.corners[0].y,
      face.corners[1].x,
      face.corners[1].y
    );
    glass.addColorStop(0, face.colors[0]);
    glass.addColorStop(1, face.colors[1]);
    ctx.fillStyle = glass;
    polygon(ctx, face.corners);
    ctx.fill();
    ctx.lineWidth = 0.0016;
    ctx.strokeStyle = "#e9ecff";
    ctx.stroke();
  }
  glow(ctx, center.x, center.y, 0.052, "#eaf5ff", "d9");
}

export function drawSignalBeacon(
  ctx: CanvasRenderingContext2D,
  time: number,
  growth: number
) {
  const ground = project(0, 0, 0);
  const top = ground.y - 0.54 * growth;
  const wave = 0.5 + 0.5 * Math.cos((time * tau) / 1.55);
  const pulse = wave ** 4;
  const ray = ctx.createLinearGradient(0.5, ground.y, 0.5, top);
  ray.addColorStop(0, "#fff5bbf0");
  ray.addColorStop(0.28, "#ffd074a8");
  ray.addColorStop(0.78, "#ffc56051");
  ray.addColorStop(1, "#fff3c900");
  glow(ctx, ground.x, ground.y, 0.19, "#ffca74", "66");
  for (const width of [0.069, 0.035, 0.011]) {
    ctx.globalAlpha = 0.62 + pulse * 0.32;
    ctx.fillStyle = ray;
    polygon(ctx, [
      { x: ground.x - width * 0.53, y: ground.y },
      { x: ground.x - width, y: top },
      { x: ground.x + width, y: top },
      { x: ground.x + width * 0.53, y: ground.y },
    ]);
    ctx.fill();
  }
  for (let i = 0; i < 3; i++) {
    const phase = fract(time / 1.55 + i / 3);
    const y = ground.y - phase * 0.49 * growth;
    ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.81;
    ctx.strokeStyle = "#ffe6a2";
    ctx.lineWidth = 0.0015 + (1 - phase) * 0.0015;
    ctx.beginPath();
    ctx.ellipse(
      ground.x,
      y,
      0.045 + phase * 0.087,
      0.013 + phase * 0.022,
      0,
      0,
      tau
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  glow(ctx, ground.x, ground.y - 0.015, 0.09, "#fff3c3", "bf");
  ctx.strokeStyle = "#ffe6a2b5";
  ctx.lineWidth = 0.002;
  ctx.beginPath();
  ctx.ellipse(ground.x, ground.y, 0.126, 0.042, 0, 0, tau);
  ctx.stroke();
}

function threadPoint(progress: number) {
  return project(
    -0.23 + progress * 0.49,
    0.043 + progress * 0.37 + Math.sin(progress * tau) * 0.07,
    0.12 - progress * 0.26
  );
}

export function drawGuidingThread(ctx: CanvasRenderingContext2D, time: number) {
  const path = (start: number, end: number) => {
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const { x, y } = threadPoint(start + ((end - start) * i) / 48);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };
  path(0, 1);
  ctx.strokeStyle = "#d6a45032";
  ctx.lineWidth = 0.019;
  ctx.stroke();
  ctx.strokeStyle = "#ffbd537e";
  ctx.lineWidth = 0.007;
  ctx.stroke();
  ctx.strokeStyle = "#ffe4a3";
  ctx.lineWidth = 0.002;
  ctx.stroke();

  const pulse = fract(time / 2.1);
  const point = threadPoint(pulse);
  path(Math.max(0, pulse - 0.19), pulse);
  ctx.strokeStyle = "#fff1b6";
  ctx.lineWidth = 0.004;
  ctx.stroke();
  glow(ctx, point.x, point.y, 0.043, "#ffdb8d", "b8");
  const end = threadPoint(1);
  glow(ctx, end.x, end.y, 0.065, "#ffdc93", "86");
  const size = 0.016 + Math.sin(time * 2.5) * 0.003;
  polygon(ctx, [
    { x: end.x, y: end.y - size },
    { x: end.x + size * 0.58, y: end.y },
    { x: end.x, y: end.y + size },
    { x: end.x - size * 0.58, y: end.y },
  ]);
  ctx.fillStyle = "#fff1c8";
  ctx.fill();
}
