import { projectSpellPoint as project } from "./spell-projection";

const tau = Math.PI * 2;
const cycle = (value: number) => value - Math.floor(value);

// Layer translucent tongues with different widths and phases. Their base stays
// lit independently of the embers and of the projectile's travel cycle.
function flame(
  ctx: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number
) {
  const glow = ctx.createRadialGradient(
    0,
    -height * 0.24,
    0,
    0,
    -height * 0.24,
    height * 0.68
  );
  glow.addColorStop(0, "#ff681650");
  glow.addColorStop(1, "#ff401000");
  ctx.save();
  ctx.scale((width / height) * 2.7, 1);
  ctx.fillStyle = glow;
  ctx.fillRect(-height, -height, height * 2, height * 2);
  ctx.restore();

  for (let i = 0; i < 13; i++) {
    const phase = i * 2.4 + time * (4 + (i % 3));
    const x = Math.sin(i * 2.4) * width * 0.45;
    const length = height * (0.48 + 0.45 * (0.5 + 0.5 * Math.sin(phase)));
    const w = width * (0.24 + 0.16 * Math.cos(i * 1.8));
    const bend = Math.sin(phase * 0.69) * width * 0.58;
    const color = ctx.createLinearGradient(0, 0, 0, -length);
    color.addColorStop(0, "#ff410b6e");
    color.addColorStop(0.22, i % 3 === 0 ? "#fff0a6e8" : "#ff9a32d2");
    color.addColorStop(0.64, "#ff642a9c");
    color.addColorStop(1, "#fa422900");
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - w, 0);
    ctx.bezierCurveTo(
      x - 1.5 * w,
      -length * 0.42,
      bend - w,
      -length * 0.57,
      x + bend,
      -length
    );
    ctx.bezierCurveTo(
      bend + w,
      -length * 0.53,
      x + 0.9 * w,
      -length * 0.23,
      x + w,
      0
    );
    ctx.quadraticCurveTo(x, width * 0.38, x - w, 0);
    ctx.fill();
  }
}

function embers(
  ctx: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number
) {
  ctx.lineWidth = 0.0018;
  ctx.strokeStyle = "#ffbb61";
  for (let i = 0; i < 32; i++) {
    const age = cycle(time * (0.53 + (i % 5) * 0.07) + i * 0.618);
    const x = Math.sin(i * 2.39 + age * 2.1) * width * (0.35 + age);
    const y = -age * height;
    ctx.globalAlpha = Math.sin(Math.PI * age) * 0.82;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.002 * Math.sin(i), y - 0.003 - age * 0.014);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function drawFireColumn(ctx: CanvasRenderingContext2D, time: number) {
  const base = project(0, 0, 0);
  const glow = ctx.createRadialGradient(
    base.x,
    base.y,
    0,
    base.x,
    base.y,
    0.22
  );
  glow.addColorStop(0, "#ff9b45aa");
  glow.addColorStop(1, "#ff571c00");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, 0.22, 0.067, 0, 0, tau);
  ctx.fill();

  ctx.save();
  ctx.translate(base.x, base.y);
  flame(ctx, time, 0.12, 0.45);
  embers(ctx, time, 0.14, 0.51);
  ctx.restore();
}

export function drawFireLance(ctx: CanvasRenderingContext2D, time: number) {
  const base = project(-0.16, 0.055, 0);
  ctx.save();
  ctx.translate(base.x, base.y);
  // A small live ignition remains at the seal while the next shot forms.
  flame(ctx, time, 0.045, 0.15);
  ctx.restore();

  const progress = cycle(time / 1.36);
  const head = project(-0.16 + progress * 0.46, 0.055 + progress * 0.35, 0);
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(-0.63);
  const length = 0.08 + 0.18 * Math.sin((progress * Math.PI) / 2);
  for (let i = 0; i < 8; i++) {
    const offset = (i - 3.5) * 0.006;
    const bend = Math.sin(time * 12 + i * 2.4) * 0.035;
    const tail = ctx.createLinearGradient(-length, 0, 0.036, 0);
    tail.addColorStop(0, "#f53b1600");
    tail.addColorStop(0.54, "#f755239e");
    tail.addColorStop(0.86, "#ff942dda");
    tail.addColorStop(1, "#fff0ac");
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(-length, bend + offset);
    ctx.quadraticCurveTo(-length * 0.38, offset - 0.018, 0.038, 0);
    ctx.quadraticCurveTo(-0.009, offset + 0.022, -length, bend + offset);
    ctx.fill();
  }
  const core = ctx.createRadialGradient(0.004, 0, 0, 0.004, 0, 0.073);
  core.addColorStop(0, "#fff9c5");
  core.addColorStop(0.28, "#ffa43fea");
  core.addColorStop(1, "#ff461000");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.074, 0.049, 0, 0, tau);
  ctx.fill();
  ctx.rotate(-Math.PI / 2);
  embers(ctx, time + 0.3, 0.044, length);
  ctx.restore();
}
