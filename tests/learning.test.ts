import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as learning from "../client/src/lib/learning";
import * as spellbook from "../client/src/data/spellbook";

test("daily formula and streak use calendar days and tolerate repeated completions", () => {
  assert.equal(learning.dayKey(new Date(2026, 10, 10, 23, 59)), "2026-11-10");
  assert.equal(
    learning.dailyRecipe("2026-11-10").id,
    learning.dailyRecipe("2026-11-10").id
  );
  assert.notEqual(
    learning.dailyRecipe("2026-11-10").id,
    learning.dailyRecipe("2026-11-11").id
  );
  assert.equal(
    learning.streak(["2026-11-08", "2026-11-09", "2026-11-09"], "2026-11-10"),
    2
  );
  assert.equal(learning.streak(["2026-11-08"], "2026-11-10"), 0);
  assert.equal(learning.streak(["2026-10-31", "2026-11-01"], "2026-11-01"), 2);
  assert.equal(learning.streak([], "2026-11-10"), 0);
});
test("attempt statistics survive reload; malformed data is rejected without overwriting it", () => {
  let p = learning.recordAttempt(learning.emptyProgress(), "sigil_fire", null);
  p = learning.recordAttempt(p, "sigil_fire", 0.9);
  assert.deepEqual(p.symbols.sigil_fire, {
    attempts: 2,
    success: 1,
    score: 0.9,
  });
  assert.deepEqual(
    learning.loadProgress({ getItem: () => JSON.stringify(p) }),
    p
  );
  assert.throws(() => learning.loadProgress({ getItem: () => "{broken" }));
  assert.throws(() =>
    learning.loadProgress({
      getItem: () => JSON.stringify({ ...p, days: ["2026-02-31"] }),
    })
  );
  assert.throws(() =>
    learning.loadProgress({
      getItem: () => JSON.stringify({ ...p, completed: ["nonexistent"] }),
    })
  );
});

test("lessons unlock only after explicit successful checks; activations count daily completion once per date", () => {
  const hooks: any[] = [];
  let cursor = 0;
  let pending: (() => unknown)[] = [];
  const react = {
    useState(initial: any) {
      const i = cursor++;
      if (!(i in hooks))
        hooks[i] = typeof initial === "function" ? initial() : initial;
      return [
        hooks[i],
        (v: any) => {
          hooks[i] = typeof v === "function" ? v(hooks[i]) : v;
        },
      ];
    },
    useRef(initial: any) {
      const i = cursor++;
      return (hooks[i] ??= { current: initial });
    },
    useEffect(fn: () => unknown, deps: any[]) {
      const i = cursor++;
      if (!hooks[i] || deps.some((d, j) => d !== hooks[i][j])) {
        hooks[i] = deps;
        pending.push(fn);
      }
    },
  };
  const jsx = (type: any, props: any) => ({ type, props });
  const modules: any = {
    gsap: { gsap: { matchMedia: () => ({ add() {}, revert() {} }) } },
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/data/spellbook": { ...spellbook, symbolImage: () => "/test.svg" },
    "./StrokeDemo": { default: () => null },
    "@/lib/learning": learning,
  };
  const source = ts.transpileModule(
    readFileSync("client/src/components/LearningPanel.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }
  ).outputText;
  const module = { exports: {} as any };
  new Function("require", "module", "exports", source)(
    (id: string) => modules[id],
    module,
    module.exports
  );
  let stored: string | null = null,
    started = 0,
    readings: any[] = [],
    cast: any = null;
  const oldWindow = globalThis.window,
    oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => stored,
      setItem: (_k: string, v: string) => (stored = v),
    },
  });
  globalThis.window = {
    setInterval: () => 0,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as any;
  const walk = (n: any): any[] =>
    !n || typeof n !== "object"
      ? []
      : [n, ...[n.props?.children].flat(Infinity).flatMap(walk)];
  const render = () => {
    cursor = 0;
    const tree = module.exports.default({
      readings,
      cast,
      onStart: () => started++,
    });
    const work = pending;
    pending = [];
    work.forEach(fn => fn());
    return tree;
  };
  const button = (tree: any, label: string) =>
    walk(tree).find(n => n.type === "button" && n.props.children === label);
  try {
    render();
    let tree = render();
    assert.equal(
      walk(tree).filter(n => n.type === "button" && n.props.disabled).length,
      11
    );
    button(tree, "Начать урок").props.onClick();
    tree = render();
    assert.equal(started, 1);
    button(tree, "Проверить попытку").props.onClick();
    tree = render();
    assert.equal(learning.loadProgress(localStorage).completed.length, 0);
    button(tree, "Начать урок").props.onClick();
    tree = render();
    readings = [
      { symbolId: "sigil_fire", score: 0.95, strokeIds: ["a"], zone: "center" },
    ];
    tree = render();
    assert.equal(
      learning.loadProgress(localStorage).symbols.sigil_fire.attempts,
      1,
      "partial drawing must not record an attempt"
    );
    button(tree, "Проверить попытку").props.onClick();
    tree = render();
    assert.deepEqual(learning.loadProgress(localStorage).completed, ["i-fire"]);
    assert.equal(
      walk(tree).filter(n => n.type === "button" && n.props.disabled).length,
      10
    );
    const at = new Date(2026, 10, 10, 12).getTime();
    cast = { recipe: learning.dailyRecipe("2026-11-10"), serial: 1, at };
    render();
    render();
    cast = { ...cast, serial: 2 };
    render();
    const result = learning.loadProgress(localStorage);
    assert.equal(result.casts, 2);
    assert.deepEqual(result.days, ["2026-11-10"]);
  } finally {
    globalThis.window = oldWindow;
    if (oldStorage)
      Object.defineProperty(globalThis, "localStorage", oldStorage);
    else delete (globalThis as any).localStorage;
  }
});

test("mastery ranks follow unique studied symbols, including restored progress", () => {
  let progress = learning.emptyProgress();
  assert.equal(learning.masteryProgress(progress).level, 1);
  for (const [index, symbol] of spellbook.allSymbols.entries()) {
    progress = learning.recordAttempt(progress, symbol.id, 0.9);
    progress = learning.recordAttempt(progress, symbol.id, 0.95);
    const rank = learning.masteryProgress(progress);
    assert.equal(rank.learned, index + 1);
    assert.equal(rank.level, learning.masteryRanks.filter(r => r.threshold <= index + 1).length);
    assert.ok(rank.percent >= 0 && rank.percent <= 100);
  }
  const restored = learning.loadProgress({ getItem: () => JSON.stringify(progress) } as any);
  assert.equal(learning.masteryProgress(restored).level, 7);
  assert.equal(learning.masteryProgress(restored).remaining, 0);
});

test("successful casts credit only their recognised ingredients once", () => {
  const recipe = spellbook.spellRecipes[0];
  const readings = [recipe.sigilId, ...recipe.requiredMarkIds, "sigil_water"].map(symbolId => ({ symbolId, score: .9 }));
  const first = learning.recordCastSymbols(learning.emptyProgress(), readings, recipe);
  assert.equal(learning.masteryProgress(first).learned, 5);
  assert.equal(first.symbols.sigil_water, undefined);
  assert.deepEqual(learning.recordCastSymbols(first, readings, recipe), first);
});
