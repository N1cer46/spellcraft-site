/**
 * Diag v2: replicates the CURRENT browser recognizer after the accuracy upgrade:
 *   - aspect-aware normalization (independent scale for very elongated shapes)
 *   - density grid (12x12, normalized counts) compared with cosine similarity
 *   - HOG-lite orientation histogram (8 unsigned bins, nearest-neighbour pairing)
 *   - rotation-tolerant templates (±4.5 / ±9 degrees)
 *   - score = cloud 0.45 + grid 0.30 + angle 0.25
 * Measures top-1 robustness to hand-drawing perturbation: rotation, scale, translation,
 * per-point noise and multi-stroke point drop.
 *
 * Usage: node tests/diag-recognizer-v2.mjs [sigil|mark] [noise]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const SYMBOL_DIR = "client/public/symbols";

// ---------- constants (must match recognizer.ts) ----------
const SAMPLE_SIZE = 160;
const VEC = 192;
const ROTATION_VARIANTS = [-9, -4.5, 0, 4.5, 9];
const GRID_CELLS = 12;
const CLOUD_WEIGHT = 0.45;
const GRID_WEIGHT = 0.3;
const ANGLE_WEIGHT = 0.25;
const ORIENTATION_BINS = 8;

// ---------- PNG decode (palette + RGBA, all filter types) ----------
function decodePNG(file) {
  const data = readFileSync(file);
  let pos = 8, width = 0, height = 0, colorType = 0;
  let palette = null, trns = null;
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
  let prev = Buffer.alloc(stride);
  let offset = 0;
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
      if (colorType === 3) { const idx = line[x]; if (palette) { r = palette[idx][0]; g = palette[idx][1]; b = palette[idx][2]; } if (trns && idx < trns.length) a = trns[idx]; }
      else { const o = x * 4; r = line[o]; g = line[o + 1]; b = line[o + 2]; a = line[o + 3]; }
      const o = (y * width + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
    }
    prev = line;
  }
  return { width, height, data: out };
}

// ---------- skeleton (mirrors recognizer.ts binarySkeleton) ----------
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

// ---------- sampling + normalization (mirrors recognizer.ts) ----------
function evenlySample(points, count) {
  if (!points.length) return [];
  if (points.length === 1) return Array.from({ length: count }, () => points[0]);
  const out = [];
  for (let i = 0; i < count; i++) out.push(points[Math.round((i / (count - 1)) * (points.length - 1))]);
  return out;
}

function normalizePointCloud(points) {
  const sampled = evenlySample(points, SAMPLE_SIZE);
  if (!sampled.length) return [];
  const minX = Math.min(...sampled.map((p) => p.x)), maxX = Math.max(...sampled.map((p) => p.x));
  const minY = Math.min(...sampled.map((p) => p.y)), maxY = Math.max(...sampled.map((p) => p.y));
  const width = maxX - minX, height = maxY - minY;
  const scale = Math.max(width, height, 1);
  const aspect = Math.min(width, height) / Math.max(width, height, 1);
  const scaleX = aspect < 0.4 ? (width || 1) : scale;
  const scaleY = aspect < 0.4 ? (height || 1) : scale;
  const scaled = sampled.map((p) => ({ x: ((p.x - minX) / scaleX) * 2 - 1, y: ((p.y - minY) / scaleY) * 2 - 1 }));
  const cx = scaled.reduce((s, p) => s + p.x / scaled.length, 0), cy = scaled.reduce((s, p) => s + p.y / scaled.length, 0);
  return scaled.map((p) => ({ x: p.x - cx, y: p.y - cy }));
}

// ---------- scoring (mirrors recognizer.ts) ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function cloudDistance(points, template) {
  const used = new Set();
  let sum = 0;
  for (const p of points) {
    let best = Infinity, bestIdx = -1;
    template.forEach((c, i) => {
      if (used.has(i)) return;
      const d = dist(p, c);
      if (d < best) { best = d; bestIdx = i; }
    });
    if (bestIdx >= 0) used.add(bestIdx);
    sum += best;
  }
  return sum / Math.max(points.length, 1);
}

function rotate(points, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  return points.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
}

function gridSignature(points, cells = GRID_CELLS) {
  const grid = new Float32Array(cells * cells);
  for (const p of points) {
    const cx = Math.min(cells - 1, Math.max(0, Math.floor(((p.x + 1) / 2) * cells)));
    const cy = Math.min(cells - 1, Math.max(0, Math.floor(((p.y + 1) / 2) * cells)));
    grid[cy * cells + cx] += 1;
  }
  let max = 1;
  for (let i = 0; i < grid.length; i++) if (grid[i] > max) max = grid[i];
  for (let i = 0; i < grid.length; i++) grid[i] /= max;
  return grid;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
  return dot / Math.max(Math.sqrt(normA * normB), 1e-8);
}

function orientationHistogram(points, bins = ORIENTATION_BINS) {
  const hist = new Float32Array(bins);
  for (let i = 0; i < points.length; i++) {
    let best = Infinity, bestJ = -1;
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const d = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      if (d < best) { best = d; bestJ = j; }
    }
    if (bestJ < 0) continue;
    const dx = points[bestJ].x - points[i].x, dy = points[bestJ].y - points[i].y;
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) continue;
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI;
    const bin = Math.min(bins - 1, Math.floor((angle / Math.PI) * bins));
    hist[bin] += 1;
  }
  let sum = 0;
  for (let i = 0; i < bins; i++) sum += hist[i];
  if (sum > 0) for (let i = 0; i < bins; i++) hist[i] /= sum;
  return hist;
}

// ---------- template library ----------
const KIND = process.argv[2] || "sigil";
const NOISE = parseFloat(process.argv[3] || "0.018");
const TRIALS = parseInt(process.argv[4] || "60", 10);

const CACHE = `tests/.skeleton-cache-v2-${VEC}.json`;
let skeletonCache = {};
try { skeletonCache = JSON.parse(readFileSync(CACHE, "utf8")); } catch { /* rebuild */ }
let dirty = false;

const dir = KIND === "sigil" ? `${SYMBOL_DIR}/sigils` : `${SYMBOL_DIR}/signs`;
const files = readdirSync(dir).filter((f) => f.endsWith(".png"));
const templates = new Map(); // id -> { variants: [{points, grid, hist}] }

for (const f of files) {
  const id = f.replace(/\.png$/, "");
  let points = skeletonCache[id];
  if (!points) { points = vectorize(`${dir}/${f}`, VEC); skeletonCache[id] = points; dirty = true; }
  const cloud = normalizePointCloud(points);
  templates.set(id, { variants: ROTATION_VARIANTS.map((a) => { const r = a === 0 ? cloud : rotate(cloud, a); return { points: r, grid: gridSignature(r), hist: orientationHistogram(r) }; }) });
}

// ---------- perturbed hand drawings ----------
function perturb(points, seed) {
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s / 4294967296) * 2 - 1; };
  const angle = rnd() * 12;
  const scale = 1 + rnd() * 0.1;
  const tx = rnd() * 0.12, ty = rnd() * 0.12;
  const rad = (angle * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  let out = points.map((p) => ({ x: (p.x * cos - p.y * sin) * scale + tx, y: (p.x * sin + p.y * cos) * scale + ty }));
  out = out.map((p) => ({ x: p.x + rnd() * NOISE, y: p.y + rnd() * NOISE }));
  return normalizePointCloud(out.filter(() => rnd() > 0.06));
}

function scoreAll(userCloud, userGrid, userHist) {
  const scored = [];
  for (const [id, tpl] of templates) {
    let best = -Infinity;
    for (const variant of tpl.variants) {
      const f = cloudDistance(userCloud, variant.points);
      const b = cloudDistance(variant.points, userCloud);
      const cloudScore = Math.max(0, Math.min(1, 1 - (f + b) / 2.8));
      const g = cosineSimilarity(userGrid, variant.grid);
      const angle = cosineSimilarity(userHist, variant.hist);
      const score = cloudScore * CLOUD_WEIGHT + g * GRID_WEIGHT + angle * ANGLE_WEIGHT;
      if (score > best) best = score;
    }
    scored.push({ id, score: best });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// ---------- run ----------
let correctTop1 = 0, correctWithMargin = 0, avgMargin = 0, belowThreshold = 0, nearTie = 0;
const correctScores = [], wrongScores = [];
const confused = new Map();

for (const [target, tpl] of templates) {
  for (let t = 0; t < TRIALS; t++) {
    const drawing = perturb(tpl.variants[2].points, (target.length * 7919 + t * 104729) >>> 0);
    const grid = gridSignature(drawing);
    const hist = orientationHistogram(drawing);
    const scored = scoreAll(drawing, grid, hist);
    const best = scored[0], second = scored[1];
    const margin = best.score - second.score;
    avgMargin += margin;
    if (best.id === target) {
      correctTop1++;
      correctScores.push(best.score);
      if (margin >= 0.03) correctWithMargin++;
    } else {
      const key = `${target} -> ${best.id}`;
      confused.set(key, (confused.get(key) || 0) + 1);
      wrongScores.push(best.score);
    }
    if (best.score < 0.56) belowThreshold++;
    if (margin < 0.05 && best.score >= 0.47) nearTie++;
  }
}

const total = templates.size * TRIALS;
if (dirty) { try { writeFileSync(CACHE, JSON.stringify(skeletonCache)); } catch (e) { console.error("cache write failed", e.message); } }
console.log(`\n=== v2 ${KIND} | grid=${GRID_CELLS}x${GRID_CELLS} bins=${ORIENTATION_BINS} sample=${SAMPLE_SIZE} vec=${VEC}px noise=${NOISE} ===`);
console.log(`symbols: ${templates.size}, trials each: ${TRIALS}`);
console.log(`top-1 correct:      ${(100 * correctTop1 / total).toFixed(1)}%`);
console.log(`top-1 w/ margin>3%: ${(100 * correctWithMargin / total).toFixed(1)}%`);
console.log(`avg top-1 margin:   ${(avgMargin / total).toFixed(3)}`);
console.log(`below sigil thr:    ${(100 * belowThreshold / total).toFixed(1)}%`);
console.log(`near-tie (<5%):     ${(100 * nearTie / total).toFixed(1)}%`);
correctScores.sort((a, b) => a - b);
wrongScores.sort((a, b) => a - b);
if (correctScores.length) console.log(`correct-score  p10/p50/p90: ${correctScores[Math.floor(correctScores.length * 0.1)].toFixed(3)} / ${correctScores[Math.floor(correctScores.length * 0.5)].toFixed(3)} / ${correctScores[Math.floor(correctScores.length * 0.9)].toFixed(3)}`);
if (wrongScores.length) console.log(`wrong-top1 score max: ${wrongScores[wrongScores.length - 1].toFixed(3)} (n=${wrongScores.length})`);
if (confused.size) {
  console.log("confusions (top):");
  [...confused.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log(`  ${k}: ${v}/${TRIALS}`));
}
