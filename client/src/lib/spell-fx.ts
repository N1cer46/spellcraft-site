import { composeSpell } from "./spell-composer";
import { SPELL_PLANE, projectSpellPoint } from "./spell-projection";
import {
  drawCrystalSpire, drawIceGlaives, drawRainField, drawStoneHeart,
} from "./spell-scene-art";
import { drawGuidingThread, drawLightWindow, drawMirrorPrism, drawSignalBeacon } from "./light-scenes";
import {
  drawClearBreeze, drawCyclone, drawTidalGather, drawWindChannel, drawWindStep,
} from "./air-scenes";
import { drawBloom, drawPetalVortex, drawWingedChoir } from "./nature-scenes";
import { drawSealedBarrier, drawWaterOrb } from "./water-scenes";
import { drawFireColumn, drawFireLance } from "./fire-scenes";
import type { SpellRecipe, SymbolDefinition } from "@/data/spellbook";

type Material =
  | "fire"
  | "water"
  | "rain"
  | "crystal"
  | "light"
  | "wind"
  | "bird"
  | "thread"
  | "barrier"
  | "petal";
export type SpellFx = {
  id: string;
  material: Material;
  glow: string;
  count: number;
  period: number;
  composed?: SpellRecipe["effect"];
};
const presets: Record<string, Omit<SpellFx, "id">> = {
  "fire-lance": { material: "fire", glow: "#ff863a", count: 150, period: 1.7 },
  "fire-column": { material: "fire", glow: "#ff863a", count: 180, period: 2.6 },
  "water-orb": { material: "water", glow: "#69caff", count: 150, period: 7 },
  rainfield: { material: "rain", glow: "#69caff", count: 100, period: 1.3 },
  "crystal-spire": {
    material: "crystal",
    glow: "#8ce2c0",
    count: 65,
    period: 5,
  },
  "light-window": {
    material: "light",
    glow: "#ffe8ac",
    count: 100,
    period: 2.8,
  },
  "wind-step": { material: "wind", glow: "#c7e9ff", count: 70, period: 2.7 },
  cyclone: { material: "wind", glow: "#c7e9ff", count: 110, period: 3.5 },
  "winged-choir": { material: "bird", glow: "#ffe2b3", count: 24, period: 9 },
  "guiding-thread": {
    material: "thread",
    glow: "#ffe2a0",
    count: 85,
    period: 3.6,
  },
  "sealed-barrier": {
    material: "barrier",
    glow: "#9fdfff",
    count: 140,
    period: 8,
  },
  bloom: { material: "petal", glow: "#ffb5d3", count: 70, period: 6 },
};
export function getSpellFx(
  recipe: SpellRecipe,
  sigil: SymbolDefinition
): SpellFx {
  // New catalogue formulas use the same visual grammar as their drawn ingredients.
  const composed = recipe.custom ? recipe.effect : !presets[recipe.id]
    ? composeSpell(recipe.sigilId, recipe.requiredMarkIds)?.effect : undefined;
  if (composed) {
    const e=composed;
    const colors={fire:"#ff863a",water:"#69caff",crystal:"#8ce2c0",light:"#ffe8ac",wind:"#c7e9ff",bird:"#ffe2b3",thread:"#ffe2a0",barrier:"#9fdfff",petal:"#ffb5d3"};
    return {id:recipe.id,material:e.material,glow:colors[e.material],count:Math.min(180,Math.round(100*e.intensity)),period:4/e.speed,composed:e};
  }
  return {
    id: recipe.id,
    ...(presets[recipe.id] ?? {
      material: "light",
      glow: "#ffe8ac",
      count: 80,
      period: 3,
    }),
  };
}
const TAU = Math.PI * 2;
const fract = (n: number) => n - Math.floor(n);
const noise = (n: number) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const clamp = (n: number) => Math.max(0, Math.min(1, n));
type Point = {
  x: number;
  y: number;
  z: number;
  radius: number;
  alpha: number;
  phase: number;
};

/** Fixed particle lanes recycle at invisible endpoints; no scene-wide reset or accumulating particles. */
export function sampleSpellParticle(
  fx: SpellFx,
  index: number,
  time: number
): Point {
  const a = noise(index + 1),
    b = noise(index + 107),
    c = noise(index + 307);
  if(fx.composed?.frozen)time=1;
  const u = fract(time / fx.period + a),
    angle = b * TAU,
    phase = time * 2 + a * TAU;
  const fade = Math.sin(Math.PI * u);
  let x = 0,
    y = 0,
    z = 0,
    radius = 0.01,
    alpha = fade;
  switch (fx.material) {
    case "fire": {
      const lance = fx.id === "fire-lance";
      y = u * (lance ? 0.47 : 0.44);
      const spread = (lance ? 0.025 : 0.09) * (1 - u * 0.7);
      x = Math.cos(angle) * spread + Math.sin(u * 9 - time * 3 + b * 9) * 0.012;
      if (lance) x += u * 0.085;
      z = Math.sin(angle) * spread;
      radius = (0.018 + c * 0.025) * (1 - u * 0.75);
      alpha = fade * (0.45 + c * 0.4);
      break;
    }
    case "water": {
      const lat = Math.acos(2 * b - 1),
        spin = angle + time * 0.35 + a * TAU;
      const r = 0.145 * Math.cbrt(c) * (1 + 0.055 * Math.sin(phase * 1.3));
      x = Math.sin(lat) * Math.cos(spin) * r;
      y = 0.25 + Math.cos(lat) * r + Math.sin(time * 1.1) * 0.012;
      z = Math.sin(lat) * Math.sin(spin) * r;
      radius = 0.025 + a * 0.026;
      alpha = 0.55;
      break;
    }
    case "rain":
      x = (b - 0.5) * 0.48 + u * 0.018;
      y = 0.39 * (1 - u);
      z = (c - 0.5) * 0.16;
      radius = 0.0015 + c * 0.001;
      alpha = fade * 0.75;
      break;
    case "crystal": {
      const r = 0.12 * Math.sqrt(b),
        spin = angle + time * 0.18;
      x = Math.cos(spin) * r;
      z = Math.sin(spin) * r;
      y = 0.04 + u * (0.2 + c * 0.17);
      radius = (0.008 + b * 0.018) * (0.7 + fade * 0.3);
      alpha = fade * 0.85;
      break;
    }
    case "wind": {
      const cyclone = fx.id === "cyclone",
        r = cyclone ? 0.025 + u * 0.16 : 0.15 * (1 - u * 0.6);
      const spin = angle + u * TAU * (cyclone ? 2 : 0.8) - time * 0.65;
      x = Math.cos(spin) * r;
      z = Math.sin(spin) * r;
      y = u * 0.4;
      radius = 0.001 + c * 0.0015;
      alpha = fade * (0.35 + c * 0.55);
      break;
    }
    case "light":
      x = (b - 0.5) * 0.22;
      z = (c - 0.5) * 0.07;
      y = u * 0.4;
      radius = 0.001 + c * 0.002;
      alpha = fade * 0.65;
      break;
    case "bird": {
      const spin = angle + time * 0.6;
      x = Math.cos(spin) * (0.09 + c * 0.14);
      z = Math.sin(spin) * (0.09 + c * 0.14);
      y = 0.18 + b * 0.16 + Math.sin(phase) * 0.025;
      radius = 0.009 + b * 0.011;
      alpha = 0.8;
      break;
    }
    case "thread":
      x = Math.sin(u * 8 + time * 0.6) * 0.12 * u;
      y = u * 0.43;
      z = Math.cos(u * 8 + time * 0.6) * 0.025;
      radius = 0.002 + c * 0.002;
      alpha = fade * 0.8;
      break;
    case "barrier": {
      const spin = angle + time * 0.12,
        lat = Math.acos(c);
      x = Math.cos(spin) * Math.sin(lat) * 0.255;
      z = Math.sin(spin) * Math.sin(lat) * 0.255;
      y = Math.cos(lat) * 0.255;
      radius = 0.004 + a * 0.005;
      alpha = 0.25 + 0.4 * Math.pow(0.5 + 0.5 * Math.sin(phase), 3);
      break;
    }
    case "petal": {
      const spin = angle + time * 0.38 + u * 2,
        r = 0.04 + Math.sin(u * Math.PI) * 0.16;
      x = Math.cos(spin) * r;
      z = Math.sin(spin) * r;
      y = 0.05 + u * 0.32 + Math.sin(phase) * 0.015;
      radius = 0.009 + b * 0.012;
      alpha = fade * 0.8;
      break;
    }
  }
  if(fx.composed){
    const e=fx.composed;
    const progress=e.reverse?1-u:u;
    const spin=angle+time*e.speed*.6+progress*TAU;
    const r=.13*Math.sqrt(c);
    switch(e.shape){
      case "orb": {const lat=Math.acos(2*b-1);x=Math.cos(spin)*Math.sin(lat)*r;z=Math.sin(spin)*Math.sin(lat)*r;y=.23+Math.cos(lat)*r;break;}
      case "column": x=Math.cos(angle)*.065;z=Math.sin(angle)*.065;y=progress*.38;break;
      case "spiral": x=Math.cos(spin)*(.035+progress*.12);z=Math.sin(spin)*(.035+progress*.12);y=progress*.38;break;
      case "rain": x=(b-.5)*.4;z=(c-.5)*.22;y=(1-progress)*.38;break;
      case "dome": x=Math.cos(spin)*Math.sqrt(1-b*b)*.2;z=Math.sin(spin)*Math.sqrt(1-b*b)*.2;y=b*.2;break;
      case "window": x=(b-.5)*.3;z=(c-.5)*.025;y=progress*.38;break;
      case "diamond": {
        const ring=Math.floor(b*4)*TAU/4;
        const width=(1-Math.abs(progress*2-1))*.16;
        x=Math.cos(ring)*width;z=Math.sin(ring)*width;y=.06+progress*.36;radius*=.55;break;
      }
      case "blades": {
        const arm=Math.floor(b*5)*TAU/5+time*e.speed;
        x=Math.cos(arm)*(.03+progress*.2);z=Math.sin(arm)*(.03+progress*.2);
        y=.2+Math.sin(progress*Math.PI)*.08;radius*=.45;break;
      }
      case "flow": break;
    }
    // Motion modifies the entire geometry, so sphere + direction differs from sphere + dispersion.
    const centerY=.2;
    if(e.motion==="jet"){x=x*.3+progress*.25-.08;z*=.3;y=.08+progress*.3+(y-centerY)*.25;}
    if(e.motion==="burst"){const expansion=.25+progress*1.25;x*=expansion;z*=expansion;y=.16+(y-centerY)*expansion;alpha*=Math.sin(Math.PI*progress);}
    if(e.motion==="gather"){const contraction=1.5-progress*1.3;x*=contraction;z*=contraction;y=.2+(y-centerY)*contraction;}
    if(e.motion==="orbit"){const orbit=time*e.speed+b*TAU;x+=Math.cos(orbit)*.05;z+=Math.sin(orbit)*.05;y+=Math.sin(orbit)*.025;}
    if(e.twist&&e.shape!=="spiral"){const rotation=y*24-time*e.speed;const ox=x;x=ox*Math.cos(rotation)-z*Math.sin(rotation);z=ox*Math.sin(rotation)+z*Math.cos(rotation);}
    if(e.copies>1){const copy=index%e.copies;const orbit=copy*TAU/e.copies+time*.25;x=x*.45+Math.cos(orbit)*.15;z=z*.45+Math.sin(orbit)*.15;y=.18+(y-.18)*.65;}
    if(e.linked){const strand=index%3;const t=progress*TAU+strand*TAU/3;x=x*.45+Math.cos(t)*.09;z=z*.45+Math.sin(t)*.09;}
    if(e.facets&&e.shape!=="diamond"&&e.shape!=="blades"){x=Math.round(x*24)/24;z=Math.round(z*24)/24;}
    x+=e.drift*progress;
    y*=e.stretch;
    x*=e.scale*e.spread*(e.mirror?-1:1);z*=e.scale*e.spread;y=y*e.scale+e.lift;
    x=Math.max(-.34,Math.min(.34,x));z=Math.max(-.28,Math.min(.28,z));y=Math.max(.015,Math.min(.53,y));
    radius*=e.scale;
    alpha=Math.min(.9,alpha*e.intensity*e.clarity)*(e.hidden?.35:1)*(e.pulse?.65+.35*Math.sin(time*e.speed*2)**2:1);
  }
  return { ...projectSpellPoint(x, y, z), z, radius, alpha, phase };
}

const scenes: ReadonlyMap<string, (ctx: CanvasRenderingContext2D, time: number, growth: number) => void> = new Map([
  ["fire-column", drawFireColumn],
  ["fire-lance", drawFireLance],
  ["water-orb", drawWaterOrb],
  ["sealed-barrier", drawSealedBarrier],
  ["rainfield", drawRainField],
  ["crystal-spire", drawCrystalSpire],
  ["light-window", drawLightWindow],
  ["prism-mirror", drawMirrorPrism],
  ["light-beacon", drawSignalBeacon],
  ["guiding-thread", drawGuidingThread],
  ["ice-glaives", drawIceGlaives],
  ["stone-heart", drawStoneHeart],
  ["wind-step", drawWindStep],
  ["cyclone", drawCyclone],
  ["winged-choir", drawWingedChoir],
  ["bloom", drawBloom],
  ["wind-channel", drawWindChannel],
  ["clear-breeze", drawClearBreeze],
  ["tidal-gather", drawTidalGather],
  ["petal-vortex", drawPetalVortex],
]);

export function startSpellFx(
  canvas: HTMLCanvasElement,
  fx: SpellFx,
  reduced: boolean,
  isPaused: () => boolean = () => false
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const scene = scenes.get(fx.id);
  let frame = 0,
    stopped = false,
    time = 0,
    last: number | undefined;
  const sprites = new Map<string, HTMLCanvasElement>();
  const sprite = (color: string) => {
    const cached = sprites.get(color);
    if (cached) return cached;
    const sheet = document.createElement("canvas");
    sheet.width = sheet.height = 64;
    const c = sheet.getContext("2d")!;
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "#fff4ce");
    g.addColorStop(0.18, color);
    g.addColorStop(1, `${color}00`);
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    sprites.set(color, sheet);
    return sheet;
  };
  const glow = (
    x: number,
    y: number,
    r: number,
    color: string,
    alpha: number
  ) => {
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite(color), x - r, y - r, r * 2, r * 2);
  };
  const stroke = (
    points: Point[],
    color: string,
    width: number,
    alpha: number
  ) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  };
  const draw = () => {
    const width = Math.max(1, canvas.clientWidth || canvas.width),
      height = Math.max(1, canvas.clientHeight || canvas.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2),
      size = Math.min(width, height);
    if (
      canvas.width !== Math.round(width * dpr) ||
      canvas.height !== Math.round(height * dpr)
    ) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.translate((width - size) / 2, (height - size) / 2);
    ctx.scale(size, size);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (scene) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      const sceneTime = reduced ? 1.2 : time;
      const growth = reduced ? 1 : 0.2 + 0.8 * (1 - (1 - clamp(time / 0.38)) ** 3);
      scene(ctx, sceneTime, growth);
      ctx.restore();
      return;
    }
    const intro = reduced ? 1 : clamp(time / 0.65),
      t = reduced ? 3 : time;
    const particles = Array.from({ length: fx.count }, (_, i) => ({
      i,
      p: sampleSpellParticle(fx, i, t),
    })).sort((a, b) => a.p.z - b.p.z);
    ctx.globalCompositeOperation = "lighter";
    glow(SPELL_PLANE.x, SPELL_PLANE.y, 0.2, fx.glow, 0.12 * intro);
    // A broad, translucent mass behind the droplets makes water read as liquid, not sparks.
    if (fx.material === "water") {
      ctx.globalCompositeOperation = "source-over";
      const y = projectSpellPoint(0, .25 + Math.sin(t * 1.1) * .012, 0).y;
      const g = ctx.createRadialGradient(0.46, y - 0.05, 0.005, 0.5, y, 0.16);
      g.addColorStop(0, "#b3f0ffb0");
      g.addColorStop(0.5, "#2388c68c");
      g.addColorStop(0.86, "#1269ac88");
      g.addColorStop(1, "#9cdeff20");
      ctx.globalAlpha = intro;
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let j = 0; j <= 80; j++) {
        const a = (j / 80) * TAU,
          r = 0.15 * (1 + 0.035 * Math.sin(a * 5 + t * 1.5));
        const x = 0.5 + Math.cos(a) * r,
          py = y + Math.sin(a) * r;
        j ? ctx.lineTo(x, py) : ctx.moveTo(x, py);
      }
      ctx.closePath();
      ctx.fill();
    }
    for (const { i, p } of particles) {
      const depth = 0.8 + (p.z + 0.26) * 0.6,
        alpha = p.alpha * intro,
        r = p.radius * depth;
      ctx.globalCompositeOperation = "source-over";
      switch (fx.material) {
        case "fire":
          ctx.globalCompositeOperation = "lighter";
          glow(p.x, p.y, r * 2, i % 4 ? "#fa6b22" : "#ffba4b", alpha * 0.65);
          if (i % 7 === 0) glow(p.x, p.y, r * 0.35, "#ffe3a1", alpha);
          break;
        case "water":
          ctx.globalAlpha = alpha * 0.08;
          ctx.fillStyle = i % 4 ? "#329ccc" : "#a4eaff";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, r, r * 0.7, p.phase * 0.15, 0, TAU);
          ctx.fill();
          if (i % 17 === 0) {
            ctx.globalAlpha = alpha * 0.65;
            ctx.strokeStyle = "#d8f7ff";
            ctx.lineWidth = 0.0013;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 0.75, 3.6, 4.8);
            ctx.stroke();
          }
          break;
        case "rain": {
          const end = { ...p, x: p.x + 0.002, y: p.y + 0.025 };
          stroke([p, end], "#8dd7fc", r, alpha);
          const u = fract(t / fx.period + noise(i + 1));
          if (u > 0.82) {
            ctx.globalAlpha = ((1 - u) / 0.18) * 0.35 * intro;
            ctx.strokeStyle = "#8dd7fc";
            ctx.lineWidth = 0.001;
            ctx.beginPath();
            ctx.ellipse(
              p.x,
              projectSpellPoint(0, 0, p.z).y,
              (u - 0.82) * 0.18 + 0.001,
              (u - 0.82) * 0.05 + 0.001,
              0,
              0,
              TAU
            );
            ctx.stroke();
          }
          break;
        }
        case "wind":
        case "thread":
        case "light": {
          const trail =
            fx.material === "light"
              ? 0.55
              : fx.material === "thread"
                ? 0.28
                : 0.3;
          const points = Array.from({ length: 9 }, (_, j) =>
            sampleSpellParticle(fx, i, t - trail + (j / 8) * trail)
          );
          // Suppress a trail when its particle wraps from the end back to the portal.
          if (Math.hypot(points[0].x - p.x, points[0].y - p.y) > 0.16) break;
          ctx.globalCompositeOperation = "lighter";
          stroke(points, fx.glow, r * 5, alpha * 0.09);
          stroke(points, fx.glow, r * 2, alpha * 0.2);
          stroke(points, "#eaf7ff", r * 0.65, alpha);
          break;
        }
        case "crystal": {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.sin(p.phase * 0.4) * 0.4);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = "#467f8288";
          ctx.strokeStyle = "#acedd8";
          ctx.lineWidth = 0.001;
          ctx.beginPath();
          ctx.moveTo(0, -r * 2);
          ctx.lineTo(r, 0);
          ctx.lineTo(0, r * 1.4);
          ctx.lineTo(-r, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#cfffe578";
          ctx.beginPath();
          ctx.moveTo(0, -r * 2);
          ctx.lineTo(r, 0);
          ctx.lineTo(0, r * 1.4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case "bird": {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.sin(p.phase * 0.3) * 0.25);
          const flap = Math.sin(t * 5 + i) * r;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = "#fff0d1";
          ctx.beginPath();
          ctx.moveTo(0, r * 0.25);
          ctx.quadraticCurveTo(-r, -r * 0.2, -r * 2, -flap);
          ctx.quadraticCurveTo(-r, -flap - r * 0.7, 0, 0);
          ctx.quadraticCurveTo(r, -flap - r * 0.7, r * 2, -flap);
          ctx.quadraticCurveTo(r, -r * 0.2, 0, r * 0.25);
          ctx.fill();
          ctx.restore();
          ctx.globalCompositeOperation = "lighter";
          glow(p.x, p.y, r * 2, fx.glow, alpha * 0.12);
          break;
        }
        case "barrier": {
          ctx.globalCompositeOperation = "lighter";
          glow(p.x, p.y, r * 2, fx.glow, alpha * 0.35);
          ctx.globalAlpha = alpha * 0.5;
          ctx.strokeStyle = "#a0dfff";
          ctx.lineWidth = 0.001;
          ctx.beginPath();
          for (let j = 0; j <= 6; j++) {
            const a = (j / 6) * TAU,
              x = p.x + Math.cos(a) * r * 1.8,
              y = p.y + Math.sin(a) * r * 1.8;
            j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
          break;
        }
        case "petal": {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.phase);
          ctx.scale(0.4 + 0.6 * Math.abs(Math.sin(p.phase * 0.6)), 1);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = i % 3 ? "#f1a4c7" : "#d3b7ef";
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.bezierCurveTo(r * 1.5, -r * 0.4, r * 0.6, r, 0, r);
          ctx.bezierCurveTo(-r * 0.6, r, -r * 1.5, -r * 0.4, 0, -r);
          ctx.fill();
          ctx.restore();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };
  const tick = (now: number) => {
    if (stopped) return;
    if (last !== undefined && !isPaused())
      time += Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    draw();
    frame = requestAnimationFrame(tick);
  };
  draw();
  const staticResize = reduced && typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(draw)
    : undefined;
  staticResize?.observe(canvas);
  if (!reduced) frame = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    staticResize?.disconnect();
    sprites.clear();
  };
}
