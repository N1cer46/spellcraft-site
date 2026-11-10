/**
 * Regression tests for clusterStrokes isolation:
 *   1. a recognized (locked) cluster is sealed — a fresh mark next to it cannot glue onto it;
 *   2. the ring time window is short (4s), so a late mark stays separate;
 *   3. legit multi-stroke symbols still merge (ring, and the slow center).
 * Run: node_modules/.bin/tsx tests/diag-cluster-lock.ts
 */
import { clusterStrokes, type InkStroke } from "../client/src/lib/recognizer";

const SIZE = 720;
const t0 = 1_000_000;

const line = (id: string, x1: number, y1: number, x2: number, y2: number, finishedAt: number): InkStroke => ({
  id,
  points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
  finishedAt,
});

let failures = 0;
function check(name: string, condition: boolean, detail?: string) {
  if (condition) console.log(`  ok  ${name}`);
  else { failures += 1; console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}
const groups = (clusters: { strokeIds: string[] }[]) =>
  clusters.map((cluster) => [...cluster.strokeIds].sort().join("+")).sort();

// 1. Seal: A recognized (locked), B drawn 1s later 30px away (inside the 0.08 ring merge gap).
{
  const a = line("a", 100, 700, 100, 760, t0);
  const b = line("b", 130, 700, 130, 760, t0 + 1000);
  const unlocked = groups(clusterStrokes([a, b], SIZE, SIZE, t0 + 1000));
  check("без замка близкие штрихи склеиваются (санити)", unlocked.length === 1, JSON.stringify(unlocked));
  const locked = groups(clusterStrokes([a, b], SIZE, SIZE, t0 + 1000, new Set(["a"])));
  check("подтверждённый кластер запечатан: новый штрих рядом остаётся отдельным", locked.length === 2, JSON.stringify(locked));
  const far = line("f", 320, 700, 320, 760, t0 + 1000);
  check("кольцо: штрих в 190px от соседа не склеивается (новый gap 0.08)", groups(clusterStrokes([a, far], SIZE, SIZE, t0 + 1000)).length === 2);
}

// 2. Ring time window (10s): same spot, 12s apart -> separate; 1s apart -> together.
{
  const a = line("a", 100, 700, 100, 760, t0);
  const late = line("b", 100, 700, 100, 760, t0 + 12000);
  check("кольцо: штрих через 12с не приклеивается к соседнему", groups(clusterStrokes([a, late], SIZE, SIZE, t0 + 12000)).length === 2);
  const soon = line("c", 100, 700, 100, 760, t0 + 1000);
  check("кольцо: штрих через 1с по-прежнему склеивается (многоштриховый знак)", groups(clusterStrokes([a, soon], SIZE, SIZE, t0 + 1000)).length === 1);
  const pause = line("d", 100, 700, 100, 760, t0 + 5000);
  check("кольцо: штрих через 5с склеивается (окно расширено до 10с)", groups(clusterStrokes([a, pause], SIZE, SIZE, t0 + 5000)).length === 1);
}

// 3. Center zone unchanged: a slow multi-part sigil still assembles over 20s.
{
  const part1 = line("p1", 340, 340, 380, 380, t0);
  const part2 = line("p2", 300, 300, 300, 360, t0 + 20000);
  check("центр: сигил собирается даже через 20с", groups(clusterStrokes([part1, part2], SIZE, SIZE, t0 + 20000)).length === 1);
  const ringFar = line("p3", 100, 700, 140, 760, t0);
  const ringLate = line("p4", 60, 660, 60, 720, t0 + 20000);
  check("кольцо при том же интервале остаётся раздельным", groups(clusterStrokes([ringFar, ringLate], SIZE, SIZE, t0 + 20000)).length === 2);
}

// 4. Partial lock: only the committed stroke is sealed, the pending one stays open for merges.
{
  const a = line("a", 100, 700, 100, 760, t0);        // recognized
  const b = line("b", 130, 700, 130, 760, t0 + 1000); // pending (e.g. ambiguous, not committed)
  const c = line("c", 152, 700, 152, 760, t0 + 2000); // fresh mark
  const withLock = groups(clusterStrokes([a, b, c], SIZE, SIZE, t0 + 2000, new Set(["a"])));
  check("частичный замок: запечатан только подтверждённый штрих", withLock.length === 2 && withLock.includes("a") && withLock.includes("b+c"), JSON.stringify(withLock));
  const noLock = groups(clusterStrokes([a, b, c], SIZE, SIZE, t0 + 2000));
  check("без замка все три склеились бы (санити)", noLock.length === 1, JSON.stringify(noLock));
}

if (failures) {
  console.error(`\n${failures} проверок провалено`);
  process.exit(1);
}
console.log("\nВсе проверки кластеризации пройдены.");
