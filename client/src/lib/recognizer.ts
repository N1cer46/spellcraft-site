/**
 * Design system: «Обсерватория линий» — recognition compares the user's live ink with
 * hand-drawn reference samples recorded with the standalone tool (tools/record-templates.mjs)
 * and shipped in reference-templates.json. References and input share the same InkPoint
 * format, so there is no PNG→skeleton→cloud vectorization layer at all.
 */
import type { SymbolDefinition } from "@/data/spellbook";
import { loadReferenceTemplates, samplesFor } from "@/data/reference-templates";

export type InkPoint = { x: number; y: number; t?: number };
export type InkStroke = { id: string; points: InkPoint[]; finishedAt: number };
export type Recognition = { symbolId: string; score: number; strokeIds: string[]; zone: "center" | "ring" };

export type SymbolMatch = {
  candidate: SymbolDefinition;
  score: number;
  /** Second-best candidate — used to detect ambiguous, near-tie drawings. */
  runnerUp: { candidate: SymbolDefinition; score: number } | null;
  /** Up to two next-best candidates in score order; powers the top-3 ambiguity picker. */
  runnerUps: { candidate: SymbolDefinition; score: number }[];
  /** Stroke count is diagnostic only; pen lifts do not determine completeness. */
  templateStrokes: number;
  /** Smaller of the two covered-ink fractions; detects missing and extra branches. */
  coverage: number;
};

const CLOUD_POINTS = 96;
const ROTATION_VARIANTS = [-15, -10, -5, 0, 5, 10, 15];

const distance = (a: InkPoint, b: InkPoint) => Math.hypot(a.x - b.x, a.y - b.y);

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export function strokeBounds(stroke: Pick<InkStroke, "points">): Bounds {
  let minX = Number.POSITIVE_INFINITY, minY = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
  for (const point of stroke.points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Distance between two bounding boxes: 0 when they overlap or touch. */
export function boundsGap(a: Bounds, b: Bounds) {
  return Math.hypot(Math.max(a.minX - b.maxX, b.minX - a.maxX, 0), Math.max(a.minY - b.maxY, b.minY - a.maxY, 0));
}

/**
 * Groups strokes of one zone into symbols. A new stroke joins a cluster when it is drawn in the
 * same zone, close in time to the cluster, and its bounding box is near the cluster's — so
 * multi-part signs (e.g. «Сфера»: circle + line) drawn in several movements are recognized as
 * one symbol, while marks placed in different ring positions stay separate. The centre zone is
 * more forgiving in time because the sigil may be built slowly part by part.
 */
export function clusterStrokes(
  strokes: InkStroke[],
  width: number,
  height: number,
  now = Date.now(),
  /** Strokes already committed to a recognized symbol — their clusters are sealed to further merges. */
  lockedStrokeIds?: Set<string>,
) {
  const mergeGap = Math.max(Math.min(width, height) * 0.24, 72);
  const clusters: { zone: "center" | "ring"; strokes: InkStroke[] }[] = [];
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    const zone = zoneFor(stroke, width, height);
    // Sigils are built slowly part by part, so the center keeps a generous window. Ring marks are
    // single quick gestures — 10s keeps unrelated marks apart while still letting a deliberate
    // two-stroke sign (circle + line) merge; premature commits are held back by the mid-assembly
    // gate in SpellCanvas, so the window no longer has to be the only guard.
    const timeWindow = zone === "center" ? 60000 : 10000;
    // Same for the merge radius: ring marks sit close together (guides at 26% of the stage, mark
    // boxes ≤18% wide), so a gap tied to the mark size keeps neighbours separate; the center keeps
    // the generous gap for slow multi-part sigil construction.
    const clusterMergeGap = zone === "ring" ? Math.max(Math.min(width, height) * 0.08, 40) : mergeGap;
    const bounds = strokeBounds(stroke);
    let target = -1;
    let nearest = Infinity;
    const nearbyClusters: number[] = [];
    for (let index = 0; index < clusters.length; index += 1) {
      const cluster = clusters[index];
      if (cluster.zone !== zone) continue;
      // A cluster made entirely of committed (recognized) strokes is sealed: a new mark drawn next
      // to it starts its own cluster instead of gluing onto an already-identified symbol.
      if (lockedStrokeIds && cluster.strokes.every((item) => lockedStrokeIds.has(item.id))) continue;
      const latest = Math.max(...cluster.strokes.map((item) => item.finishedAt));
      if (Math.abs(stroke.finishedAt - latest) > timeWindow) continue;
      const groupBounds = cluster.strokes.reduce<Bounds>((acc, item) => {
        const b = strokeBounds(item);
        return { minX: Math.min(acc.minX, b.minX), minY: Math.min(acc.minY, b.minY), maxX: Math.max(acc.maxX, b.maxX), maxY: Math.max(acc.maxY, b.maxY) };
      }, { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY });
      // Two different marks on opposite sides of the sigil can have nearby bounding boxes; the
      // centroid check prevents a new stroke from «eating» a separate mark in the same zone.
      const centroidA = { x: (groupBounds.minX + groupBounds.maxX) / 2, y: (groupBounds.minY + groupBounds.maxY) / 2 };
      const centroidB = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
      const centroidDist = distance(centroidA, centroidB);
      const gap = boundsGap(bounds, groupBounds);
      const combinedSpan = Math.max(Math.max(bounds.maxX, groupBounds.maxX) - Math.min(bounds.minX, groupBounds.minX), Math.max(bounds.maxY, groupBounds.maxY) - Math.min(bounds.minY, groupBounds.minY));
      const overlaps = gap === 0 && combinedSpan <= Math.min(width, height) * (zone === "center" ? 0.36 : 0.24);
      const nearbyParts = gap <= clusterMergeGap * 0.5 && combinedSpan <= Math.min(width, height) * 0.2;
      if (gap <= clusterMergeGap && (overlaps || nearbyParts || centroidDist < clusterMergeGap * 0.7)) {
        nearbyClusters.push(index);
        if (centroidDist < nearest) { target = index; nearest = centroidDist; }
      }
    }
    if (target >= 0) {
      const joined = clusters[target];
      joined.strokes.push(stroke);
      // A connecting stroke can complete several previously disconnected parts of one glyph.
      for (const index of nearbyClusters.reverse()) {
        const neighbour = clusters[index];
        if (neighbour === joined) continue;
        const bounds = strokeBounds({ points: [...joined.strokes, ...neighbour.strokes].flatMap(s => s.points) });
        if (Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) > Math.min(width, height) * (zone === "center" ? 0.36 : 0.24)) continue;
        joined.strokes.push(...neighbour.strokes);
        clusters.splice(index, 1);
      }
    } else clusters.push({ zone, strokes: [stroke] });
  }
  return clusters.map((cluster) => ({ zone: cluster.zone, strokeIds: cluster.strokes.map((item) => item.id) }));
}

/** Share of the other strokes' points that fall inside the given stroke's bounding box (±30px slack). */
export function enclosureRatio(stroke: InkStroke, others: InkStroke[]) {
  if (!others.length) return 1;
  const bounds = strokeBounds(stroke);
  const slack = 30;
  let inside = 0, total = 0;
  for (const other of others) for (const point of other.points) {
    total += 1;
    if (point.x >= bounds.minX - slack && point.x <= bounds.maxX + slack && point.y >= bounds.minY - slack && point.y <= bounds.maxY + slack) inside += 1;
  }
  return total ? inside / total : 1;
}

export type CircleMetrics = {
  span: number;
  closure: number;
  deviation: number;
  aspect: number;
};

/** Pure shape checks of a stroke as a circle candidate (span, closure, roundness). */
export function circleShapeMetrics(stroke: InkStroke): CircleMetrics {
  const points = stroke.points;
  if (points.length < 2) return { span: 0, closure: Infinity, deviation: Infinity, aspect: 0 };
  const minX = Math.min(...points.map((point) => point.x)), maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y)), maxY = Math.max(...points.map((point) => point.y));
  const boxWidth = maxX - minX, boxHeight = maxY - minY;
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const radius = (boxWidth + boxHeight) / 4;
  const radial = points.map((point) => distance(point, center));
  const mean = radial.reduce((sum, value) => sum + value, 0) / radial.length;
  const deviation = Math.sqrt(radial.reduce((sum, value) => sum + (value - mean) ** 2, 0) / radial.length) / Math.max(mean, 1);
  return {
    span: Math.max(boxWidth, boxHeight),
    closure: distance(points[0], points.at(-1)!),
    deviation,
    aspect: Math.min(boxWidth, boxHeight) / Math.max(boxWidth, boxHeight, 1),
  };
}

/** Thrown when none of the candidate symbols has a recorded reference sample yet. */
export class ReferenceLoadError extends Error {
  constructor() {
    super("Ни один эталон не записан.");
    this.name = "ReferenceLoadError";
  }
}

/** Sample the visible ink by arc length, never the gaps between pen lifts. */
function normalizeInk(strokes: InkPoint[][]): InkPoint[] {
  const points = strokes.flat();
  if (!points.length || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return [];
  const bounds = strokeBounds({ points });
  const scale = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  if (scale < 0.000001) return [];
  const cx = (bounds.minX + bounds.maxX) / 2, cy = (bounds.minY + bounds.maxY) / 2;
  const segments: { a: InkPoint; b: InkPoint; length: number }[] = [];
  let total = 0;
  for (const stroke of strokes) for (let i = 1; i < stroke.length; i++) {
    const length = distance(stroke[i - 1], stroke[i]);
    if (length > 0) { segments.push({ a: stroke[i - 1], b: stroke[i], length }); total += length; }
  }
  if (!total) return [];
  const cloud: InkPoint[] = [];
  let index = 0, before = 0;
  for (let i = 0; i < CLOUD_POINTS; i++) {
    const target = total * (i + 0.5) / CLOUD_POINTS;
    while (index < segments.length - 1 && before + segments[index].length < target) before += segments[index++].length;
    const { a, b, length } = segments[index];
    const t = (target - before) / length;
    cloud.push({ x: 2 * (a.x + (b.x - a.x) * t - cx) / scale, y: 2 * (a.y + (b.y - a.y) * t - cy) / scale });
  }
  return cloud;
}

/** Symmetric nearest-ink distances retain missing/extra branches without imposing stroke order. */
function compareInk(a: InkPoint[], b: InkPoint[]) {
  const nearestA = new Array<number>(a.length).fill(Infinity);
  const nearestB = new Array<number>(b.length).fill(Infinity);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const dx = a[i].x - b[j].x, dy = a[i].y - b[j].y;
    const d = dx * dx + dy * dy;
    if (d < nearestA[i]) nearestA[i] = d;
    if (d < nearestB[j]) nearestB[j] = d;
  }
  const error = (ds: number[]) => {
    const distances = ds.map(Math.sqrt).sort((x, y) => x - y);
    // The tail prevents a long shared stem from hiding a missing distinguishing branch.
    return 0.65 * distances.reduce((sum, d) => sum + d, 0) / distances.length + 0.35 * distances[Math.floor(distances.length * 0.9)];
  };
  const coverage = Math.min(nearestA.filter(d => d <= 0.22 ** 2).length / a.length, nearestB.filter(d => d <= 0.22 ** 2).length / b.length);
  return { score: Math.exp(-4 * (error(nearestA) + error(nearestB)) / 2), coverage };
}

type PreparedSample = { variants: InkPoint[][]; strokes: number };
// Key by the samples themselves so injected/reloaded references cannot reuse stale geometry.
const templateCache = new WeakMap<InkPoint[][][], PreparedSample[]>();
function templatesFor(symbolId: string): PreparedSample[] {
  const samples = samplesFor(symbolId);
  const cached = templateCache.get(samples);
  if (cached) return cached;
  const prepared = samples.flatMap(sample => {
    const cloud = normalizeInk(sample);
    if (!cloud.length) return [];
    return [{ strokes: sample.length, variants: [cloud, ...[-0.2, 0, 0.2].flatMap(stretch => ROTATION_VARIANTS.map(angle => {
      const radians = angle * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
      const rotated = cloud.map(p => {
        const x = p.x * (1 + Math.max(0, stretch)), y = p.y * (1 + Math.max(0, -stretch));
        return { x: x * cos - y * sin, y: x * sin + y * cos };
      });
      const bounds = strokeBounds({ points: rotated });
      const cx = (bounds.minX + bounds.maxX) / 2, cy = (bounds.minY + bounds.maxY) / 2;
      const scale = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2;
      return rotated.map(p => ({ x: (p.x - cx) / scale, y: (p.y - cy) / scale }));
    }))] }];
  });
  templateCache.set(samples, prepared);
  return prepared;
}

/** Match shape, not the author's pen movements. Orientation is retained for inverted signs. */
export async function recognizeSymbol(strokes: InkStroke[], candidates: SymbolDefinition[]): Promise<SymbolMatch | null> {
  if (!candidates.length) return null;
  const user = normalizeInk(strokes.map(stroke => stroke.points));
  if (!user.length) return null;
  await loadReferenceTemplates();
  const scored = candidates.flatMap(candidate => {
    let best = { score: -1, coverage: 0, templateStrokes: 0 };
    for (const sample of templatesFor(candidate.id)) for (const variant of sample.variants) {
      const match = compareInk(user, variant);
      if (match.score > best.score) best = { ...match, templateStrokes: sample.strokes };
    }
    return best.score < 0 ? [] : [{ candidate, ...best }];
  });
  if (!scored.length) throw new ReferenceLoadError();
  scored.sort((a, b) => b.score - a.score);
  const runnerUps = scored.slice(1, 3).map(({ candidate, score }) => ({ candidate, score }));
  return { ...scored[0], runnerUp: runnerUps[0] ?? null, runnerUps };
}

/**
 * Continuation hypothesis: a new stroke that failed to commit may be a deliberate second pass on an
 * already-sealed neighbour symbol (e.g. the second stroke of a two-stroke sign drawn next to the
 * committed first one). Merging the clusters must beat both standalone readings by a clear margin
 * (≥ +0.1) and clear the threshold — otherwise the sealed symbol stays untouched.
 */
export async function findContinuation(params: {
  strokes: InkStroke[];
  clusterIds: string[];
  zone: "center" | "ring";
  recognitions: Recognition[];
  width: number;
  height: number;
  candidates: SymbolDefinition[];
  /** Score of the new cluster's own (failed) reading — the bar the merge has to beat. */
  baseline: number;
  threshold: number;
  /** Minimal win over the baseline; the commit path demands more than the failure path. */
  minGain?: number;
}): Promise<{ recognition: Recognition; strokeCount: number } | null> {
  const { strokes, clusterIds, zone, recognitions, width, height, candidates, baseline, threshold, minGain = 0.1 } = params;
  const cluster = strokes.filter((stroke) => clusterIds.includes(stroke.id));
  if (!cluster.length) return null;
  const clusterBounds = cluster.reduce((acc, stroke) => {
    const b = strokeBounds(stroke);
    return { minX: Math.min(acc.minX, b.minX), minY: Math.min(acc.minY, b.minY), maxX: Math.max(acc.maxX, b.maxX), maxY: Math.max(acc.maxY, b.maxY) };
  }, { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY });
  const neighbourGap = Math.max(Math.min(width, height) * 0.28, 80);
  const neighbours = recognitions
    .filter((item) => item.zone === zone && !item.strokeIds.some((id) => clusterIds.includes(id)))
    .map((item) => {
      const memberStrokes = strokes.filter((stroke) => item.strokeIds.includes(stroke.id));
      const bounds = memberStrokes.reduce((acc, stroke) => {
        const b = strokeBounds(stroke);
        return { minX: Math.min(acc.minX, b.minX), minY: Math.min(acc.minY, b.minY), maxX: Math.max(acc.maxX, b.maxX), maxY: Math.max(acc.maxY, b.maxY) };
      }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
      const latest = memberStrokes.length ? Math.max(...memberStrokes.map((stroke) => stroke.finishedAt)) : 0;
      return { item, memberStrokes, gap: boundsGap(clusterBounds, bounds), latest };
    })
    .filter((entry) => entry.memberStrokes.length > 0 && entry.gap <= neighbourGap && Date.now() - entry.latest <= (zone === "center" ? 60000 : 15000))
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 3);
  for (const neighbour of neighbours) {
    const mergedIds = Array.from(new Set([...clusterIds, ...neighbour.item.strokeIds]));
    const merged = strokes.filter((stroke) => mergedIds.includes(stroke.id));
    const mergedResult = await recognizeSymbol(merged, candidates);
    if (!mergedResult) continue;
    // The merge reinterprets the neighbour's strokes too, so the neighbour's own score is not the
    // bar — the bar is the new stroke's failed standalone reading (+margin). The small discount
    // only guards against destroying an excellent committed symbol for a marginal merge.
    if (mergedResult.score >= threshold && mergedResult.score >= baseline + minGain && mergedResult.score >= neighbour.item.score - 0.05) {
      return {
        recognition: { symbolId: mergedResult.candidate.id, score: mergedResult.score, strokeIds: mergedIds, zone },
        strokeCount: merged.length,
      };
    }
  }
  return null;
}

/**
 * Radius of the centre («ядро») zone in canvas pixels. Must mirror the CSS: .central-zone is
 * `min(31% width, 200px)` in diameter, i.e. at most a 100px radius. A small buffer absorbs hand
 * variance for sigils traced right up to the dashed border; marks (guides sit at 26% of the stage)
 * start well beyond it, so they can no longer be misread as centre-zone sigils.
 */
export function centerZoneRadius(width: number, height: number): number {
  return Math.min(width * 0.155, 100) + 12;
}

export function zoneFor(stroke: InkStroke, width: number, height: number) {
  const center = { x: width / 2, y: height / 2 };
  const bounds = strokeBounds(stroke);
  const centroid = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  return distance(centroid, center) < centerZoneRadius(width, height) ? "center" as const : "ring" as const;
}

export function detectCircle(stroke: InkStroke, otherStrokes: InkStroke[], canvasWidth: number, canvasHeight: number) {
  if (stroke.points.length < 16 || !otherStrokes.length) return { isCircle: false, confidence: 0, center: { x: 0, y: 0 }, radius: 0, metrics: null };
  const metrics = circleShapeMetrics(stroke);
  const points = stroke.points;
  const minX = Math.min(...points.map((point) => point.x)), maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y)), maxY = Math.max(...points.map((point) => point.y));
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const radius = metrics.span / 2;
  const all = otherStrokes.flatMap((item) => item.points);
  const contained = all.length && Math.min(...all.map((point) => point.x)) >= minX - 18 && Math.max(...all.map((point) => point.x)) <= maxX + 18 && Math.min(...all.map((point) => point.y)) >= minY - 18 && Math.max(...all.map((point) => point.y)) <= maxY + 18;
  const closureScore = Math.max(0, 1 - metrics.closure / Math.max(radius * 0.52, 1));
  const shapeScore = Math.max(0, 1 - metrics.deviation / 0.36) * metrics.aspect;
  const confidence = (closureScore * 0.45 + shapeScore * 0.55) * (contained ? 1 : 0.25);
  // The span guard keeps a small mark-circle (e.g. the circle part of «Сфера») from ever being
  // mistaken for the closing circle, even if it happens to surround the strokes drawn so far.
  const bigEnough = metrics.span >= Math.min(canvasWidth, canvasHeight) * 0.34;
  const isCircle = bigEnough && contained && closureScore > 0.42 && metrics.aspect > 0.56 && metrics.deviation < 0.33;
  return { isCircle, confidence, center, radius, metrics };
}
