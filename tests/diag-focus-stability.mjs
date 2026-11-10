/**
 * Focused diag for the "focus" and "stability" marks: render their skeletons as ASCII,
 * show clean self-match scores + nearest rivals, then measure confusion under hand-drawing noise.
 * Uses the exact current browser parameters (VEC=192, SAMPLE=160, rotate ±4.5/±9°, grid weight 0.2).
 */
import { readdirSync, readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const SYMBOL_DIR = "client/public/symbols/signs";

function decodePNG(file) {
  const data = readFileSync(file);
  let pos = 8, width = 0, height = 0, colorType = 0, palette = null, trns = null;
  const idat = [];
  while (pos < data.length) {
    const len = data.readUInt32BE(pos);
    const type = data.toString("ascii", pos + 4, pos + 8);
    const chunk = data.slice(pos + 8, pos + 8 + len);
    if (type === "IHDR") { width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4); colorType = chunk[9]; }
    else if (type === "PLTE") { palette = []; for (let i = 0; i < len; i += 3) palette.push([chunk[i], chunk[i + 1], chunk[i + 2]]); }
    else if (type === "tRNS") trns = chunk;
    else if (type === "IDAT") idat.push(chunk);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = colorType === 3 ? 1 : 4;
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride), offset = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[offset++];
    const line = Buffer.from(raw.slice(offset, offset + stride));
    offset += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let val = line[x];
      if (filter === 1) val = (val + a) & 0xff;
      else if (filter === 2) val = (val + b) & 0xff;
      else if (filter === 3) val = (val + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); val = (val + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff; }
      line[x] = val;
    }
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 255;
      if (colorType === 3) { const idx = line[x]; r = palette[idx][0]; g = palette[idx][1]; b = palette[idx][2]; if (trns && idx < trns.length) a = trns[idx]; }
      else { const o = x * 4; r = line[o]; g = line[o + 1]; b = line[o + 2]; a = line[o + 3]; }
      const o = (y * width + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
    }
    prev = line;
  }
  return { width, height, data: out };
}

function binarySkeleton(input, size) {
  const value = (x, y) => input[y * size + x];
  let changed = true, guard = 0;
  while (changed && guard < 48) {
    changed = false;
    const del1 = [];
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
      if (!value(x, y)) continue;
      const p2 = value(x, y - 1), p3 = value(x + 1, y - 1), p4 = value(x + 1, y), p5 = value(x + 1, y + 1);
      const p6 = value(x, y + 1), p7 = value(x - 1, y + 1), p8 = value(x - 1, y), p9 = value(x - 1, y - 1);
      const n = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
      const t = (p2 === 0 && p3 === 1 ? 1 : 0) + (p3 === 0 && p4 === 1 ? 1 : 0) + (p4 === 0 && p5 === 1 ? 1 : 0) + (p5 === 0 && p6 === 1 ? 1 : 0) + (p6 === 0 && p7 === 1 ? 1 : 0) + (p7 === 0 && p8 === 1 ? 1 : 0) + (p8 === 0 && p9 === 1 ? 1 : 0) + (p9 === 0 && p2 === 1 ? 1 : 0);
      if (n >= 2 && n <= 6 && t === 1 && p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) del1.push(y * size + x);
    }
    if (del1.length) changed = true;
    del1.forEach((i) => { input[i] = 0; });
    const del2 = [];
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
      if (!value(x, y)) continue;
      const p2 = value(x, y - 1), p3 = value(x + 1, y - 1), p4 = value(x + 1, y), p5 = value(x + 1, y + 1);
      const p6 = value(x, y + 1), p7 = value(x - 1, y + 1), p8 = value(x - 1, y), p9 = value(x - 1, y - 1);
      const n = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
      const t = (p2 === 0 && p3 === 1 ? 1 : 0) + (p3 === 0 && p4 === 1 ? 1 : 0) + (p4 === 0 && p5 === 1 ? 1 : 0) + (p5 === 0 && p6 === 1 ? 1 : 0) + (p6 === 0 && p7 === 1 ? 1 : 0) + (p7 === 0 && p8 === 1 ? 1 : 0) + (p8 === 0 && p9 === 1 ? 1 : 0) + (p9 === 0 && p2 === 1 ? 1 : 0);
      if (n >= 2 && n <= 6 && t === 1 && p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) del2.push(y * size + x);
    }
    if (del2.length) changed = true;
    del2.forEach((i) => { input[i] = 0; });
    guard++;
  }
  return input;
}

function evenlySample(points, count) {
  if (!points.length) return [];
  if (points.length === 1) return Array.from({ length: count }, () => points[0]);
  const out = [];
  for (let i = 0; i < count; i++) out.push(points[Math.round((i / (count - 1)) * (points.length - 1))]);
  return out;
}

function normalizePointCloud(points, sampleSize) {
  const sampled = evenlySample(points, sampleSize);
  const minX = Math.min(...sampled.map((p) => p.x)), maxX = Math.max(...sampled.map((p) => p.x));
  const minY = Math.min(...sampled.map((p) => p.y)), maxY = Math.max(...sampled.map((p) => p.y));
  const scale = Math.max(maxX - minX, maxY - minY, 1);
  const scaled = sampled.map((p) => ({ x: ((p.x - minX) / scale) * 2 - 1, y: ((p.y - minY) / scale) * 2 - 1 }));
  const cx = scaled.reduce((s, p) => s + p.x / scaled.length, 0), cy = scaled.reduce((s, p) => s + p.y / scaled.length, 0);
  return scaled.map((p) => ({ x: p.x - cx, y: p.y - cy }));
}

function vectorize(file, size) {
  const img = decodePNG(file);
  const binary = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = Math.floor((x + 0.5) * img.width / size), sy = Math.floor((y + 0.5) * img.height / size);
    const o = (sy * img.width + sx) * 4;
    const lum = img.data[o] * 0.2126 + img.data[o + 1] * 0.7152 + img.data[o + 2] * 0.0722;
    binary[y * size + x] = img.data[o + 3] > 24 && lum < 235 ? 1 : 0;
  }
  binarySkeleton(binary, size);
  const points = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (binary[y * size + x]) points.push({ x, y });
  return points;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function cloudDistance(points, template) {
  const used = new Set();
  let sum = 0;
  for (const p of points) {
    let best = Infinity, bestIdx = -1;
    template.forEach((c, i) => { if (used.has(i)) return; const d = dist(p, c); if (d < best) { best = d; bestIdx = i; } });
    if (bestIdx >= 0) used.add(bestIdx);
    sum += best;
  }
  return sum / Math.max(points.length, 1);
}
function rotate(points, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  return points.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
}
function gridSignature(points, cells) {
  const grid = new Uint8Array(cells * cells);
  for (const p of points) {
    const cx = Math.min(cells - 1, Math.max(0, Math.floor(((p.x + 1) / 2) * cells)));
    const cy = Math.min(cells - 1, Math.max(0, Math.floor(((p.y + 1) / 2) * cells)));
    grid[cy * cells + cx] = 1;
  }
  return grid;
}
function gridScore(a, b) {
  let hit = 0, total = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] || b[i]) { total++; if (a[i] && b[i]) hit++; } }
  return total ? hit / total : 0;
}

const VEC = 192, SAMPLE = 160;
const GRID_CELLS = parseInt(process.argv[3] || "5", 10);
const GRID_W = parseFloat(process.argv[4] || "0.2");
const ROT = [0, -4.5, 4.5, -9, 9];

const files = readdirSync(SYMBOL_DIR).filter((f) => f.endsWith(".png"));
const templates = new Map();
for (const f of files) {
  const id = f.replace(/\.png$/, "");
  const cloud = normalizePointCloud(vectorize(`${SYMBOL_DIR}/${f}`, VEC), SAMPLE);
  templates.set(id, { cloud, grid: gridSignature(cloud, GRID_CELLS), rotations: ROT.map((a) => rotate(cloud, a)) });
}

function scoreAll(cloud, grid) {
  const scored = [];
  for (const [id, tpl] of templates) {
    let bestCloud = -Infinity;
    for (const v of tpl.rotations) {
      const f = cloudDistance(cloud, v), b = cloudDistance(v, cloud);
      bestCloud = Math.max(bestCloud, 1 - (f + b) / 2.8);
    }
    const g = gridScore(grid, tpl.grid);
    scored.push({ id, score: bestCloud * (1 - GRID_W) + g * GRID_W });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function ascii(id) {
  const img = decodePNG(`${SYMBOL_DIR}/${id}.png`);
  const W = 60, H = 26;
  const rows = [];
  for (let y = 0; y < H; y++) {
    let row = "";
    for (let x = 0; x < W; x++) {
      const sx = Math.floor((x + 0.5) * img.width / W), sy = Math.floor((y + 0.5) * img.height / H);
      const o = (sy * img.width + sx) * 4;
      const lum = img.data[o] * 0.2126 + img.data[o + 1] * 0.7152 + img.data[o + 2] * 0.0722;
      row += img.data[o + 3] > 24 && lum < 200 ? "#" : ".";
    }
    rows.push(row);
  }
  return rows.join("\n");
}

function perturb(points, seed) {
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s / 4294967296) * 2 - 1; };
  const angle = rnd() * 12, scale = 1 + rnd() * 0.1, tx = rnd() * 0.12, ty = rnd() * 0.12;
  const rad = (angle * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  let out = points.map((p) => ({ x: (p.x * cos - p.y * sin) * scale + tx, y: (p.x * sin + p.y * cos) * scale + ty }));
  out = out.map((p) => ({ x: p.x + rnd() * 0.018, y: p.y + rnd() * 0.018 }));
  return normalizePointCloud(out.filter(() => rnd() > 0.06), SAMPLE);
}

const TARGETS = process.argv[2] ? process.argv[2].split(",") : ["focus", "stability"];

for (const target of TARGETS) {
  const tpl = templates.get(target);
  if (!tpl) { console.log(`\n=== ${target}: NOT FOUND ===`); continue; }
  console.log(`\n=== ${target} ===`);
  console.log(ascii(target));
  const clean = scoreAll(tpl.cloud, tpl.grid);
  console.log("clean self-match top-6:");
  clean.slice(0, 6).forEach((r) => console.log(`  ${r.id.padEnd(20)} ${(r.score * 100).toFixed(1)}%`));

  const confused = new Map();
  let correct = 0, ties = 0;
  const TRIALS = 30;
  for (let t = 0; t < TRIALS; t++) {
    const d = perturb(tpl.cloud, (target.length * 7919 + t * 104729) >>> 0);
    const scored = scoreAll(d, gridSignature(d, GRID_CELLS));
    const best = scored[0], second = scored[1];
    if (best.id === target) correct++;
    else confused.set(best.id, (confused.get(best.id) || 0) + 1);
    if (best.score - second.score < 0.05 && best.score >= 0.47) ties++;
  }
  console.log(`perturbed (cells=${GRID_CELLS} grid-w=${GRID_W}): top-1 correct ${correct}/${TRIALS}, near-ties ${ties}/${TRIALS}`);
  if (confused.size) console.log("confused with:", [...confused.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(", "));
}
