/**
 * Regression tests for the two-phase commit around sealed clusters:
 *   1. the first stroke of a multi-stroke symbol must NOT commit on its own;
 *   2. findContinuation must merge the second stroke into the sealed first one;
 *   3. a strong standalone second stroke commits separately (drift premise);
 *   4. direct synthesis sanity: both strokes together read as the symbol.
 * Run: node_modules/.bin/tsx tests/diag-cluster-continuation.ts
 *
 * Uses the real mark_column references from client/public/reference-templates.json.
 */
import { readFileSync } from "node:fs";
import { findContinuation, recognizeSymbol, type InkStroke } from "../client/src/lib/recognizer";
import type { SymbolDefinition } from "../client/src/data/spellbook";
import { setReferenceTemplatesForTests } from "../client/src/data/reference-templates";

type Candidate = SymbolDefinition;

const templates = JSON.parse(readFileSync("client/public/reference-templates.json", "utf8")) as Record<string, unknown[][][]>;
// Node has no Vite base URL: inject the raw templates instead of the fetch loader.
setReferenceTemplatesForTests(templates as never);

// Minimal SymbolDefinition stubs: recognizeSymbol only reads candidate.id.
const marks: Candidate[] = Object.keys(templates)
  .filter((id) => id.startsWith("mark_") && Array.isArray(templates[id]) && templates[id].length)
  .map((id) => ({ id }) as unknown as Candidate);

const columnSample = templates["mark_column"][0] as { x: number; y: number }[][];
if (columnSample.length < 2) {
  console.error("mark_column sample 0 должен содержать минимум 2 штриха");
  process.exit(1);
}
const [strokeA, strokeB] = columnSample;

let failures = 0;
function check(name: string, condition: boolean, detail?: string) {
  if (condition) console.log(`  ok  ${name}`);
  else { failures += 1; console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}

const NOW = Date.now();
const asStroke = (points: { x: number; y: number }[], id: string, finishedAt = NOW): InkStroke => ({
  id,
  points: points.map((point) => ({ ...point })),
  finishedAt,
});
const t = (ratio: number) => Math.round(ratio * 100) / 100;

const s1 = asStroke(strokeA, "s1", NOW - 2000);
const s2 = asStroke(strokeB, "s2", NOW);
const both = [s1, s2];

// --- real numbers first, assertions below ---
const soloA = await recognizeSymbol([s1], marks);
const soloB = await recognizeSymbol([s2], marks);
const merged = await recognizeSymbol(both, marks);
console.log(`  …  stroke A alone:  ${soloA ? `${soloA.candidate.id} ${t(soloA.score)} (templateStrokes=${soloA.templateStrokes})` : "null"}`);
console.log(`  …  stroke B alone:  ${soloB ? `${soloB.candidate.id} ${t(soloB.score)} (templateStrokes=${soloB.templateStrokes})` : "null"}`);
console.log(`  …  A+B together:    ${merged ? `${merged.candidate.id} ${t(merged.score)}` : "null"}`);

const RING_THRESHOLD = 0.47;

// 1. Mid-assembly gate: stroke A alone must not reach a confident commit.
{
  check("эталон column — двухштриховый", columnSample.length === 2, `штрихов: ${columnSample.length}`);
  const wouldCommit = (result: NonNullable<typeof soloA>) => result.score >= 0.66 && result.coverage >= 0.86 && (!result.runnerUp || result.score - result.runnerUp.score >= 0.08);
  check("первый штрих не принимается без уточнения", soloA !== null && !wouldCommit(soloA));
  check("второй штрих отдельно не даёт уверенного column", !(soloB && wouldCommit(soloB) && soloB.candidate.id === "mark_column"));
}

// 2. Continuation: second stroke merges into the sealed first one (as if stroke A had committed earlier).
{
  const sealedFirst = { symbolId: "mark_column", score: RING_THRESHOLD + 0.05, strokeIds: ["s1"], zone: "ring" as const };
  const continuation = await findContinuation({
    strokes: both,
    clusterIds: ["s2"],
    zone: "ring",
    recognitions: [sealedFirst],
    width: 720,
    height: 720,
    candidates: marks,
    baseline: soloB?.score ?? 0,
    threshold: RING_THRESHOLD,
  });
  check("второй штрих доливает в запечатанный первый (mark_column)", continuation?.recognition.symbolId === "mark_column", JSON.stringify(continuation?.recognition));
  check("слитое распознавание уверенное", (continuation?.recognition.score ?? 0) >= RING_THRESHOLD + 0.1, `score=${continuation && t(continuation.recognition.score)}`);
  check("слитый кластер держит оба штриха", JSON.stringify([...(continuation?.recognition.strokeIds ?? [])].sort()) === '["s1","s2"]');
}

// 3. Drift premise: a strong standalone second stroke takes the commit path (flow returns before continuation).
{
  check("второй штрих отдельно набирает порог кольца", (soloB?.score ?? 0) >= RING_THRESHOLD, `score=${soloB && t(soloB.score)} (${soloB?.candidate.id})`);
  const neighbourDiscountOk = merged === null || (merged.score >= (soloB?.score ?? 0) - 0.05);
  check("слияние не хуже отдельного чтения второго штриха", neighbourDiscountOk, `merged=${merged && t(merged.score)} soloB=${soloB && t(soloB.score)}`);
}

// 4. Direct synthesis: both strokes together read as the symbol with a high score.
{
  check("A+B вместе распознаются как mark_column", merged?.candidate.id === "mark_column", merged?.candidate.id);
  check("A+B вместе дают уверенный score", (merged?.score ?? 0) >= 0.85, `score=${merged && t(merged.score)}`);
}

if (failures) {
  console.error(`\n${failures} проверок провалено`);
  process.exit(1);
}
console.log("\nВсе проверки двухфазного коммита пройдены.");
