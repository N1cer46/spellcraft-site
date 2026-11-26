import { projectSpellPoint as project } from "./spell-projection";
import { polygon } from "./spell-scene-art";

const tau = Math.PI * 2;

// Match the silhouettes of the higher fidelity WebGL scenes. These drawings
// are also the opening frames shown before the WebGL textures finish loading.
export function drawWaterOrb(ctx: CanvasRenderingContext2D, time: number) {
  const { x, y } = project(0, 0.24 + Math.sin(time * 1.35) * 0.011, 0);
  const radius = 0.163;
  const body = ctx.createRadialGradient(
    x - 0.061,
    y - 0.074,
    0.004,
    x,
    y,
    radius
  );
  body.addColorStop(0, "#c0f7ffde");
  body.addColorStop(0.29, "#62cbd6c9");
  body.addColorStop(0.69, "#247180d6");
  body.addColorStop(0.89, "#123d4edc");
  body.addColorStop(1, "#62bfd8a6");
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, tau);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const caustic = ctx.createLinearGradient(x - radius, y, x + radius, y);
  caustic.addColorStop(0, "#b9f6ff00");
  caustic.addColorStop(0.27, "#cdfaff7a");
  caustic.addColorStop(0.65, "#76dce056");
  caustic.addColorStop(1, "#a2eaff00");
  ctx.strokeStyle = caustic;
  ctx.lineWidth = 0.0028;
  for (let row = 0; row < 11; row++) {
    ctx.beginPath();
    for (let i = 0; i <= 36; i++) {
      const u = i / 36;
      const edge =
        x +
        (u * 2 - 1) * radius +
        Math.sin(time * 1.2 + row * 0.69 + u * 18) * 0.009;
      const wave =
        y +
        (row - 5) * 0.027 +
        Math.sin(u * 13 + row * 0.8 - time * 2.3) * 0.016;
      if (i === 0) ctx.moveTo(edge, wave);
      else ctx.lineTo(edge, wave);
    }
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "#b0f1f2c0";
  ctx.lineWidth = 0.0024;
  ctx.beginPath();
  ctx.arc(x, y, radius - 0.006, 3.48, 4.94);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const a = (i * tau) / 5 + time * 0.7;
    const depth = Math.sin(a);
    ctx.globalAlpha = 0.52 + depth * 0.36;
    ctx.fillStyle = "#96e7f6";
    ctx.beginPath();
    ctx.arc(
      x + Math.cos(a) * 0.195,
      y + depth * 0.042,
      0.0037 + (i % 3) * 0.0011,
      0,
      tau
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawSealedBarrier(ctx: CanvasRenderingContext2D, time: number) {
  const floor = project(0, 0, 0);
  const rx = 0.282,
    ry = 0.262,
    foot = rx * 0.3;
  const dome = () => {
    ctx.beginPath();
    ctx.ellipse(floor.x, floor.y, rx, ry, 0, Math.PI, tau);
    ctx.ellipse(floor.x, floor.y, rx, foot, 0, 0, Math.PI);
    ctx.closePath();
  };
  const glass = ctx.createLinearGradient(
    floor.x,
    floor.y - ry,
    floor.x,
    floor.y + foot
  );
  glass.addColorStop(0, "#b2f6f3af");
  glass.addColorStop(0.28, "#63bbc580");
  glass.addColorStop(0.62, "#2b717e29");
  glass.addColorStop(1, "#75d5d5a1");
  dome();
  ctx.fillStyle = glass;
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let row = 0; row < 7; row++) {
    for (let col = -4; col <= 4; col++) {
      const centerX = floor.x + (col + (row % 2) * 0.5) * 0.073;
      const centerY = floor.y - ry + 0.029 + row * 0.048;
      const level = 0.5 + 0.5 * Math.cos(time * 1.85 - row * 0.84 + col * 0.43);
      polygon(
        ctx,
        Array.from({ length: 6 }, (_, i) => {
          const a = (i * tau) / 6 - Math.PI / 2;
          return {
            x: centerX + Math.cos(a) * 0.042,
            y: centerY + Math.sin(a) * 0.033,
          };
        })
      );
      ctx.lineWidth = 0.0012;
      ctx.strokeStyle = "#b6f3f69c";
      ctx.globalAlpha = 0.22 + level * 0.47;
      ctx.stroke();
    }
  }
  ctx.restore();
  dome();
  ctx.strokeStyle = "#c6fffaad";
  ctx.lineWidth = 0.0021;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(floor.x, floor.y, rx * 1.04, foot * 1.13, 0, 0, tau);
  ctx.strokeStyle = "#74ced689";
  ctx.stroke();
}
