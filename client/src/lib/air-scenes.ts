import { projectSpellPoint as project } from "./spell-projection";
import { polygon } from "./spell-scene-art";

const tau = Math.PI * 2;
const fract = (n: number) => n - Math.floor(n);
type Point = ReturnType<typeof project>;
type Curve = (progress: number) => Point;

function ribbon(
  ctx: CanvasRenderingContext2D,
  curve: Curve,
  width: number,
  color: string,
  opacity: number,
  flow: number
) {
  const samples: { point: Point; nx: number; ny: number }[] = [];
  for (let i = 0; i <= 48; i++) {
    const u = i / 48;
    const point = curve(u);
    const before = curve(Math.max(0, u - 0.002));
    const after = curve(Math.min(1, u + 0.002));
    const dx = after.x - before.x,
      dy = after.y - before.y;
    const spread =
      (width * Math.sin(u * Math.PI)) /
      Math.max(Math.hypot(dx, dy), width * 0.19);
    samples.push({ point, nx: -dy * spread, ny: dx * spread });
  }
  const start = curve(0),
    middle = curve(0.48),
    end = curve(1);
  const origin =
    Math.hypot(start.x - end.x, start.y - end.y) < 0.035 ? middle : start;
  const tint = ctx.createLinearGradient(origin.x, origin.y, end.x, end.y);
  tint.addColorStop(0, color + "25");
  tint.addColorStop(0.44, color + "c2");
  tint.addColorStop(0.76, color + "73");
  tint.addColorStop(1, color + "24");
  ctx.fillStyle = tint;
  for (const [spread, strength] of [
    [1.65, 0.18],
    [1, 0.65],
    [0.38, 0.47],
  ]) {
    const edge = (side: number) =>
      samples.map(({ point, nx, ny }) => ({
        x: point.x + nx * spread * side,
        y: point.y + ny * spread * side,
      }));
    ctx.globalAlpha = strength * opacity;
    polygon(ctx, [...edge(1), ...edge(-1).reverse()]);
    ctx.fill();
  }

  // A highlight travels along the actual curve and fades at both ends.
  const head = fract(flow);
  const from = Math.max(0, head - 0.19);
  const a = curve(from),
    b = curve(head);
  const streak = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  streak.addColorStop(0, color + "00");
  streak.addColorStop(0.78, "#f0ffffdd");
  streak.addColorStop(1, color + "30");
  ctx.globalAlpha = opacity * Math.sin(head * Math.PI);
  ctx.strokeStyle = streak;
  ctx.lineWidth = Math.max(0.0011, width * 0.14);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  for (let i = 1; i <= 12; i++) {
    const point = curve(from + ((head - from) * i) / 12);
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function ring(
  ctx: CanvasRenderingContext2D,
  p: Point,
  rx: number,
  ry: number,
  color: string,
  opacity: number
) {
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx, ry, 0, 0, tau);
  ctx.lineWidth = 0.0016;
  ctx.strokeStyle = color;
  ctx.globalAlpha = opacity;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function dust(
  ctx: CanvasRenderingContext2D,
  point: Point,
  size: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(point.x, point.y, size, size * 0.55, -0.55, 0, tau);
  ctx.fill();
}

export function drawWindStep(
  ctx: CanvasRenderingContext2D,
  time: number,
  growth: number
) {
  const lift = 0.17 * growth + 0.015 * Math.sin(time * 2.2);
  const center = project(0, lift, 0);
  const floor = project(0, 0.009, 0);
  ring(ctx, floor, 0.158, 0.047, "#8bc6c4", 0.31);
  const cushion = ctx.createRadialGradient(
    center.x,
    center.y,
    0.013,
    center.x,
    center.y,
    0.23
  );
  cushion.addColorStop(0, "#dfedebbb");
  cushion.addColorStop(0.72, "#7bb7c048");
  cushion.addColorStop(1, "#7bb7c000");
  ctx.fillStyle = cushion;
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, 0.238, 0.079, 0, 0, tau);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const level = i / 3;
    const h = lift - level * 0.105 * growth;
    const r = 0.222 - level * 0.06;
    const phase = time * 1.8 + i * 2.05;
    ribbon(
      ctx,
      u => {
        const a = phase + u * tau * 0.84;
        return project(
          Math.cos(a) * r,
          h + 0.014 * Math.sin(a * 2),
          Math.sin(a) * r
        );
      },
      0.011 - level * 0.004,
      "#a8ddec",
      0.88 - level * 0.22,
      time * 0.44 + level
    );
  }
  ring(ctx, center, 0.233, 0.072, "#ccf8f5", 0.63);
  ring(ctx, center, 0.187, 0.056, "#b3e2df", 0.49);
  for (let i = 0; i < 16; i++) {
    const u = fract(time * 0.46 + i * 0.618);
    const a = i * 2.399 + u * 2.6;
    const r = 0.058 + 0.15 * u;
    ctx.globalAlpha = Math.sin(Math.PI * u) * 0.89;
    dust(
      ctx,
      project(Math.cos(a) * r, u * lift, Math.sin(a) * r),
      0.002 + 0.0015 * u,
      "#b8ecebb8"
    );
  }
  ctx.globalAlpha = 1;
}

export function drawCyclone(
  ctx: CanvasRenderingContext2D,
  time: number,
  growth: number
) {
  const core = project(0, 0.2 * growth, 0);
  const haze = ctx.createRadialGradient(
    core.x,
    core.y,
    0.01,
    core.x,
    core.y,
    0.29
  );
  haze.addColorStop(0, "#abc6ed42");
  haze.addColorStop(1, "#abc6ed00");
  ctx.fillStyle = haze;
  ctx.fillRect(core.x - 0.29, core.y - 0.29, 0.58, 0.58);
  for (let lane = 0; lane < 4; lane++) {
    ribbon(
      ctx,
      u => {
        const a = (lane * tau) / 4 + u * tau * 1.51 - time * 2.25;
        const radius = 0.026 + u ** 1.25 * 0.245;
        const height = 0.43 * u * growth;
        return project(
          Math.cos(a) * radius + u * 0.041,
          height,
          Math.sin(a) * radius
        );
      },
      0.015 + (lane % 2) * 0.004,
      lane % 2 ? "#b4d9fa" : "#829dd6",
      0.94,
      time * 0.49 + lane * 0.23
    );
  }
  for (let i = 0; i < 24; i++) {
    const u = fract(time * (0.31 + (i % 3) * 0.05) + i * 0.618);
    const a = i * 2.399 + u * tau * 1.4 - time * 2.3;
    const r = 0.041 + 0.24 * u;
    ctx.globalAlpha = Math.sin(Math.PI * u);
    dust(
      ctx,
      project(Math.cos(a) * r + u * 0.04, 0.44 * u * growth, Math.sin(a) * r),
      0.0025 + u * 0.002,
      "#e2edff"
    );
  }
  ctx.globalAlpha = 1;
}

function corridorCenter(u: number) {
  return project(-0.29 + u * 0.58, 0.09 + u * 0.34, 0.12 - u * 0.23);
}

export function drawWindChannel(ctx: CanvasRenderingContext2D, time: number) {
  const angle = -0.57;
  for (const side of [-1, 1]) {
    for (let lane = 0; lane < 3; lane++) {
      ribbon(
        ctx,
        u => {
          const point = corridorCenter(u);
          const offset =
            side *
            (0.042 + lane * 0.017 + Math.sin(u * 11 - time * 4 + lane) * 0.009);
          return { x: point.x + offset * 0.54, y: point.y + offset * 0.84 };
        },
        0.008 - lane * 0.0018,
        lane === 1 ? "#d5f5fa" : "#68b8d2",
        0.9,
        time * 0.84 + lane * 0.28 + side * 0.1
      );
    }
  }
  for (let i = 0; i < 7; i++) {
    const u = fract(time * 0.78 + i / 7);
    const point = corridorCenter(u);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(angle);
    ring(
      ctx,
      { x: 0, y: 0 },
      0.019,
      0.085 - u * 0.031,
      "#b6f5ff",
      Math.sin(u * Math.PI) * 0.78
    );
    ctx.restore();
  }
}

export function drawClearBreeze(ctx: CanvasRenderingContext2D, time: number) {
  for (let i = 0; i < 5; i++) {
    ribbon(
      ctx,
      u => {
        const wave = Math.sin(tau * u + i * 0.62 - time * 1.45);
        const y = 0.11 + i * 0.035 + wave * 0.028;
        return project(-0.305 + u * 0.61, y, -0.06 + i * 0.035);
      },
      0.007 + (i % 2) * 0.005,
      i % 2 ? "#b0ece6" : "#89c9d8",
      0.57 + i * 0.074,
      time * 0.4 + i * 0.19
    );
  }
  for (let i = 0; i < 24; i++) {
    const u = fract(time * (0.26 + (i % 4) * 0.045) + i * 0.618);
    const y =
      0.095 +
      (i % 6) * 0.035 +
      Math.sin(tau * u + i * 0.82 - time * 1.45) * 0.034;
    ctx.globalAlpha = Math.sin(Math.PI * u) * 0.85;
    dust(
      ctx,
      project(-0.33 + u * 0.66, y, ((i % 5) - 2) * 0.029),
      0.0039,
      "#d3f5ed"
    );
  }
  ctx.globalAlpha = 1;
}

export function drawTidalGather(
  ctx: CanvasRenderingContext2D,
  time: number,
  growth: number
) {
  const center = project(0, 0.026, 0);
  const pool = ctx.createRadialGradient(
    center.x,
    center.y,
    0,
    center.x,
    center.y,
    0.3
  );
  pool.addColorStop(0, "#0a273c");
  pool.addColorStop(0.18, "#216887");
  pool.addColorStop(0.55, "#24617eaf");
  pool.addColorStop(0.82, "#1d536c8c");
  pool.addColorStop(1, "#23647b18");
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, 0.303, 0.091, 0, 0, tau);
  ctx.fill();
  ring(ctx, center, 0.3, 0.09, "#71d4dd", 0.46);
  // Reflections bend across the basin before they slip into the dark core.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, 0.3, 0.09, 0, 0, tau);
  ctx.clip();
  const reflection = ctx.createLinearGradient(
    center.x,
    center.y - 0.09,
    center.x,
    center.y + 0.09
  );
  reflection.addColorStop(0, "#96eefb00");
  reflection.addColorStop(0.54, "#73e0eb71");
  reflection.addColorStop(1, "#96eefb00");
  ctx.strokeStyle = reflection;
  ctx.lineWidth = 0.002;
  for (let row = 0; row < 9; row++) {
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const x = i / 32 - 0.5;
      const bow = Math.sin(i * 0.51 + row * 0.84 - time * 1.5) * 0.014;
      const y = center.y + (row - 4) * 0.02 + bow + 0.1 * x * x;
      if (i === 0) ctx.moveTo(center.x + x * 0.58, y);
      else ctx.lineTo(center.x + x * 0.58, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  const current = (u: number, phase: number) => {
    const angle = phase + u * tau * 1.65 + time * 1.35;
    const r = 0.026 + (1 - u) * 0.281 * growth;
    return project(
      Math.cos(angle) * r,
      0.03 + 0.1 * (1 - u) ** 1.8,
      Math.sin(angle) * r
    );
  };
  for (let i = 0; i < 5; i++) {
    ribbon(
      ctx,
      u => current(u, (i * tau) / 5),
      0.015 + (i % 2) * 0.003,
      i % 2 ? "#4acbe0" : "#9fe9f4",
      0.94,
      time * 0.55 + i * 0.2
    );
  }
  for (let i = 0; i < 35; i++) {
    const u = fract(time * (0.31 + (i % 4) * 0.05) + i * 0.618);
    ctx.globalAlpha = Math.sin(Math.PI * u);
    dust(ctx, current(u, i * 2.399), 0.0017 + 0.0029 * (1 - u), "#d2fdff");
  }
  ctx.globalAlpha = 1;
  ring(
    ctx,
    center,
    0.038,
    0.017,
    "#a5efff",
    0.45 + 0.25 * Math.sin(time * 2.2)
  );
}
