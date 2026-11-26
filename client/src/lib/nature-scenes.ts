import { projectSpellPoint as project } from "./spell-projection";
import { polygon } from "./spell-scene-art";

const tau = Math.PI * 2;
const fract = (n: number) => n - Math.floor(n);

function leaf(
  ctx: CanvasRenderingContext2D,
  length: number,
  width: number,
  tipX = 0
) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(
    -width,
    -length * 0.26,
    tipX - width * 0.81,
    -length * 0.66,
    tipX,
    -length
  );
  ctx.bezierCurveTo(
    tipX + width * 0.78,
    -length * 0.69,
    width,
    -length * 0.27,
    0,
    0
  );
  ctx.closePath();
  ctx.fill();
}

function petal(
  ctx: CanvasRenderingContext2D,
  length: number,
  width: number,
  shade: number
) {
  const tint = ctx.createLinearGradient(0, 0, 0, -length);
  tint.addColorStop(0, shade % 2 ? "#71355f" : "#82364e");
  tint.addColorStop(0.38, shade % 2 ? "#b866a5" : "#c65f81");
  tint.addColorStop(0.79, shade % 2 ? "#efb4dc" : "#f7acb7");
  tint.addColorStop(1, shade % 2 ? "#fce0f0" : "#ffe2ca");
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(
    -width * 0.95,
    -length * 0.25,
    -width,
    -length * 0.84,
    -width * 0.24,
    -length * 0.95
  );
  ctx.bezierCurveTo(
    width * 0.32,
    -length * 1.14,
    width * 1.1,
    -length * 0.72,
    width * 0.78,
    -length * 0.44
  );
  ctx.quadraticCurveTo(width * 0.5, -length * 0.19, 0, 0);
  ctx.fill();
  ctx.save();
  ctx.clip();
  const sheen = ctx.createRadialGradient(
    -width * 0.33,
    -length * 0.66,
    0,
    0,
    -length * 0.64,
    length * 0.48
  );
  sheen.addColorStop(0, "#fff4db61");
  sheen.addColorStop(1, "#fff4db00");
  ctx.fillStyle = sheen;
  ctx.fillRect(-width, -length, width * 2, length);
  ctx.restore();
  ctx.lineWidth = 0.0009;
  ctx.strokeStyle = "#ffe3e87e";
  ctx.beginPath();
  ctx.moveTo(0, -length * 0.12);
  ctx.quadraticCurveTo(
    width * 0.25,
    -length * 0.55,
    width * 0.08,
    -length * 0.87
  );
  ctx.stroke();
}

export function drawBloom(
  ctx: CanvasRenderingContext2D,
  time: number,
  growth: number
) {
  const base = project(0, 0, 0);
  // The stem, leaves and two corollas share the same origin above the seal.
  const sway = Math.sin(time * 1.35) * 0.018 * growth;
  const head = project(sway, 0.28 * growth, 0);
  ctx.strokeStyle = "#71b48f";
  ctx.lineWidth = 0.007;
  ctx.beginPath();
  ctx.moveTo(base.x, base.y + 0.01);
  ctx.quadraticCurveTo(base.x - 0.029, (head.y + base.y) / 2, head.x, head.y);
  ctx.stroke();

  for (let i = 0; i < 5; i++) {
    const side = i % 2 ? -1 : 1;
    const point = project((sway * i) / 6, (0.04 + i * 0.037) * growth, 0);
    const tint = ctx.createLinearGradient(
      point.x - 0.14,
      point.y,
      point.x + 0.14,
      point.y
    );
    tint.addColorStop(0, "#488268");
    tint.addColorStop(0.5, "#234b3b");
    tint.addColorStop(1, "#92cea1");
    ctx.fillStyle = tint;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(side * (0.75 + 0.12 * Math.sin(time + i)));
    const length = (0.15 - i * 0.012) * growth;
    const tip = side * 0.021;
    leaf(ctx, length, 0.034 * growth, tip);
    ctx.beginPath();
    ctx.moveTo(0, -length * 0.12);
    ctx.quadraticCurveTo(tip * 0.13, -length * 0.65, tip, -length * 0.95);
    ctx.strokeStyle = "#b1d7a985";
    ctx.lineWidth = 0.001;
    ctx.stroke();
    ctx.restore();
  }

  const halo = ctx.createRadialGradient(
    head.x,
    head.y,
    0,
    head.x,
    head.y,
    0.205
  );
  halo.addColorStop(0, "#eaa2cb52");
  halo.addColorStop(1, "#eaa2cb00");
  ctx.fillStyle = halo;
  ctx.fillRect(head.x - 0.205, head.y - 0.205, 0.41, 0.41);
  for (let layer = 0; layer < 2; layer++) {
    const count = layer ? 7 : 10;
    const opening = layer ? growth ** 1.7 : growth ** 1.35;
    for (let i = 0; i < count; i++) {
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.scale(1, 0.73 + Math.sin(time * 1.1) * 0.045);
      ctx.rotate((i * tau) / count + layer * 0.32 + sway);
      if (layer) ctx.translate(0, -0.013 * growth);
      const length =
        (layer ? 0.095 : 0.166) *
        opening *
        (1 + Math.sin(i * 2.1 + time * 1.3) * 0.07);
      petal(ctx, length, (layer ? 0.036 : 0.054) * opening, i + layer);
      ctx.restore();
    }
  }

  ctx.fillStyle = "#883b5b";
  ctx.beginPath();
  ctx.ellipse(head.x, head.y, 0.042 * growth, 0.03 * growth, 0, 0, tau);
  ctx.fill();
  for (let i = 0; i < 19; i++) {
    const angle = i * 2.399;
    const radius = 0.039 * Math.sqrt(i / 19) * growth;
    ctx.fillStyle = i % 3 === 0 ? "#fff0ad" : "#f2aa6e";
    ctx.beginPath();
    ctx.arc(
      head.x + Math.cos(angle) * radius,
      head.y + Math.sin(angle) * radius * 0.68,
      0.0029 * growth,
      0,
      tau
    );
    ctx.fill();
  }
}

export function drawPetalVortex(
  ctx: CanvasRenderingContext2D,
  time: number,
  growth: number
) {
  const pointAt = (u: number, arm: number) => {
    const angle = (arm * tau) / 3 + u * tau * 1.23 + time * 1.29;
    const radius = (0.04 + 0.226 * u) * growth;
    const z = Math.sin(angle) * radius;
    return {
      ...project(Math.cos(angle) * radius, (0.07 + 0.315 * u) * growth, z),
      z,
    };
  };

  for (let arm = 0; arm < 3; arm++) {
    const a = pointAt(0, arm),
      b = pointAt(1, arm);
    const tint = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    tint.addColorStop(0, "#d86eae00");
    tint.addColorStop(0.45, "#ee9ec069");
    tint.addColorStop(1, "#efb2d800");
    ctx.strokeStyle = tint;
    ctx.lineWidth = 0.003;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    for (let i = 1; i <= 40; i++) {
      const point = pointAt(i / 40, arm);
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }

  const petals = Array.from({ length: 30 }, (_, i) => {
    const u = fract(time * (0.24 + (i % 4) * 0.025) + i * 0.618);
    return { i, u, point: pointAt(u, i % 3) };
  }).sort((a, b) => a.point.z - b.point.z);

  for (const { i, u, point } of petals) {
    const phase = i * 2.399 + time * 3.1;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(phase * (0.52 + (i % 3) * 0.21));
    ctx.scale(0.19 + 0.81 * Math.abs(Math.cos(phase)), 1);
    ctx.globalAlpha = Math.sin(u * Math.PI) ** 0.6 * (0.77 + point.z * 0.74);
    const length = (0.032 + (i % 4) * 0.008 + point.z * 0.03) * growth;
    petal(ctx, length, length * 0.36, i);
    ctx.restore();
  }
}

function bird(ctx: CanvasRenderingContext2D, size: number, flap: number) {
  const glow = ctx.createLinearGradient(0, -size, 0, size * 0.9);
  glow.addColorStop(0, "#fff2ca");
  glow.addColorStop(0.55, "#ebd1a3");
  glow.addColorStop(1, "#9b735f");
  ctx.fillStyle = glow;
  for (const side of [-1, 1]) {
    const wingY = (-0.5 - 0.8 * flap) * size;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.15);
    ctx.bezierCurveTo(
      side * size * 0.39,
      -size * 0.46,
      side * size * 0.74,
      wingY,
      side * size * 1.24,
      wingY
    );
    ctx.quadraticCurveTo(
      side * size * 0.95,
      wingY + size * 0.34,
      side * size * 0.68,
      wingY + size * 0.37
    );
    ctx.lineTo(side * size * 0.8, wingY + size * 0.51);
    ctx.lineTo(side * size * 0.51, wingY + size * 0.49);
    ctx.lineTo(side * size * 0.57, wingY + size * 0.63);
    ctx.quadraticCurveTo(side * size * 0.42, size * 0.27, 0, size * 0.45);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(side * size * 0.18, size * 0.13);
    ctx.quadraticCurveTo(
      side * size * 0.51,
      wingY + size * 0.16,
      side * size * 1.03,
      wingY + size * 0.08
    );
    ctx.strokeStyle = "#fff4ceaa";
    ctx.lineWidth = size * 0.035;
    ctx.stroke();
  }
  polygon(ctx, [
    { x: 0, y: -0.36 * size },
    { x: size * 0.13, y: 0.1 * size },
    { x: size * 0.16, y: 0.62 * size },
    { x: 0, y: 0.52 * size },
    { x: -size * 0.16, y: 0.62 * size },
    { x: -size * 0.13, y: 0.1 * size },
  ]);
  ctx.fill();
}

export function drawWingedChoir(
  ctx: CanvasRenderingContext2D,
  time: number,
  growth: number
) {
  const birds = Array.from({ length: 7 }, (_, i) => {
    const a = time * 0.92 + (i * tau) / 7;
    const radius = (i % 2 ? 0.2 : 0.17) * growth;
    const z = Math.sin(a) * radius;
    const location = project(
      Math.cos(a) * radius,
      (0.27 + 0.075 * Math.cos(a + i * 0.8)) * growth,
      z
    );
    return { i, a, radius, z, location };
  }).sort((a, b) => a.z - b.z);
  for (const { i, a, radius, z, location } of birds) {
    ctx.beginPath();
    ctx.moveTo(location.x, location.y);
    for (let j = 1; j <= 12; j++) {
      const trailingAngle = a - j * 0.024;
      const p = project(
        Math.cos(trailingAngle) * radius,
        (0.27 + 0.075 * Math.cos(trailingAngle + i * 0.8)) * growth,
        Math.sin(trailingAngle) * radius
      );
      ctx.lineTo(p.x, p.y);
    }
    const tail = project(
      Math.cos(a - 12 * 0.024) * radius,
      (0.27 + 0.075 * Math.cos(a - 12 * 0.024 + i * 0.8)) * growth,
      Math.sin(a - 12 * 0.024) * radius
    );
    const trail = ctx.createLinearGradient(
      location.x,
      location.y,
      tail.x,
      tail.y
    );
    trail.addColorStop(0, "#f4dfb484");
    trail.addColorStop(1, "#e7cb9e00");
    ctx.lineWidth = 0.0028;
    ctx.strokeStyle = trail;
    ctx.stroke();
    ctx.save();
    ctx.translate(location.x, location.y);
    ctx.rotate(Math.sin(a) * 0.63);
    ctx.scale(0.82 + 0.18 * Math.abs(Math.cos(a)), 1);
    ctx.globalAlpha = 0.77 + z * 0.69;
    bird(ctx, (0.034 + z * 0.035) * growth, Math.sin(time * 8.7 + i * 0.75));
    ctx.restore();
  }
}
