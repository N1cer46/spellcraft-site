import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as spellbook from "../client/src/data/spellbook";

test("grimoire replaces both working panels and returns without unmounting the drawing", () => {
  const hooks: any[] = [];
  let cursor = 0;
  const react = {
    useEffect: () => {},
    useState(initial: unknown) {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = initial;
      return [
        hooks[i],
        (v: unknown) => {
          hooks[i] = typeof v === "function" ? v(hooks[i]) : v;
        },
      ];
    },
    useRef(initial: unknown) {
      const i = cursor++;
      return (hooks[i] ??= { current: initial });
    },
  };
  const Learning = () => null;
  const Canvas = () => null,
    Grimoire = () => null,
    Entry = () => null;
  const jsx = (type: unknown, props: any) => ({ type, props });
  const modules: any = {
    "@/components/LearningPanel": { default: Learning },
    "@/lib/personal-grimoire": {},
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": {},
    "@/components/SpellCanvas": { default: Canvas },
    "@/components/Grimoire": { default: Grimoire },
    "@/components/GrimoireEntry": { default: Entry },
    "@/data/spellbook": { ...spellbook, symbolImage: () => "/symbol.svg" },
  };
  const source = ts.transpileModule(
    readFileSync("client/src/pages/Home.tsx", "utf8").replaceAll(
      "import.meta.env.BASE_URL",
      '"/"'
    ),
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
  const render = () => {
    cursor = 0;
    return module.exports.default();
  };
  const find = (tree: any, predicate: (n: any) => boolean): any => {
    if (!tree || typeof tree !== "object") return;
    if (predicate(tree)) return tree;
    return [tree.props?.children]
      .flat(Infinity)
      .map(n => find(n, predicate))
      .find(Boolean);
  };
  const get = (tree: any, type: any) => find(tree, n => n.type === type);
  const oldLocation = globalThis.location;
  globalThis.location = { hash: "" } as any;
  const oldRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  try {
    let tree = render();
    const daily = spellbook.spellRecipes[0];
    get(tree, Learning).props.onStart(daily, "daily");
    tree = render();
    assert.equal(get(tree, Canvas).props.learningTask, "daily");
    get(tree, Canvas).props.onSpellCast(spellbook.spellRecipes[1]);
    tree = render();
    assert.equal(get(tree, Canvas).props.learningTask, "daily", "wrong spell keeps task pending");
    get(tree, Canvas).props.onSpellCast(daily);
    tree = render();
    assert.equal(get(tree, Canvas).props.learningTask, null);
    assert.ok(get(tree, Canvas).props.practiceKey > 0, "reset counter does not control task link");
    get(tree, Learning).props.onStart(null);
    tree = render();
    assert.equal(get(tree, Canvas).props.learningTask, "lesson");
    get(tree, Learning).props.onAttemptFinished();
    tree = render();
    assert.equal(get(tree, Canvas).props.learningTask, null);
    get(tree, Grimoire).props.onPlaceRecipe(null);
    tree = render();
    get(tree, Canvas).props.onRecognitionChange([
      {
        symbolId: "sigil_fire",
        score: 0.9,
        strokeIds: ["kept"],
        zone: "center",
      },
    ]);
    get(tree, Grimoire).props.onSelectSymbol(spellbook.sigils[0]);
    tree = render();
    assert.equal(get(tree, "aside").props.hidden, true);
    assert.equal(
      find(tree, n => n.props?.className === "practice-sheet").props.hidden,
      true
    );
    assert.ok(get(tree, Canvas), "canvas must stay mounted");
    assert.equal(get(tree, Entry).props.symbol.id, "sigil_fire");
    get(tree, Entry).props.onRecipe(spellbook.spellRecipes[0]);
    tree = render();
    assert.equal(get(tree, Entry).props.symbol, null);
    assert.equal(
      get(tree, Entry).props.recipe.id,
      spellbook.spellRecipes[0].id
    );
    get(tree, Entry).props.onBack();
    tree = render();
    assert.equal(get(tree, Entry), undefined);
    assert.equal(get(tree, "aside").props.hidden, false);
    assert.equal(
      find(tree, n => n.props?.className === "practice-sheet").props.hidden,
      false
    );
    assert.equal(
      get(tree, Canvas).props.selectedRecipe,
      null,
      "reading a recipe must not place its guide"
    );
    assert.equal(
      get(tree, Canvas).props.selectedSymbol,
      undefined,
      "individual symbol guides are not supported"
    );
    get(tree, Grimoire).props.onPlaceRecipe(spellbook.spellRecipes[0]);
    tree = render();
    assert.equal(
      get(tree, Canvas).props.selectedRecipe.id,
      spellbook.spellRecipes[0].id
    );
    assert.equal(get(tree, Entry), undefined);
    get(tree, Grimoire).props.onSelectSymbol(spellbook.sigils[0]);
    tree = render();
    get(tree, Entry).props.onBack();
    tree = render();
    assert.equal(
      get(tree, Canvas).props.selectedRecipe.id,
      spellbook.spellRecipes[0].id,
      "reading symbols preserves the explicitly placed recipe"
    );
    assert.ok(
      find(tree, n => n.type === "small" && n.props?.children?.[0] === 90),
      "recognized readings survive navigation"
    );
    for (const [page, label] of [["grimoire", "К гримуару"], ["collection", "К моей коллекции"]]) {
      hooks[0] = page;
      globalThis.location.hash = "/" + page;
      tree = render();
      get(tree, Grimoire).props.onSelectRecipe(spellbook.spellRecipes[0]);
      tree = render();
      assert.equal(get(tree, Entry).props.backLabel, label);
      get(tree, Entry).props.onBack();
      tree = render();
      assert.equal(get(tree, Entry), undefined);
      assert.equal(hooks[0], page);
      assert.equal(globalThis.location.hash, "/" + page);
    }
  } finally {
    globalThis.requestAnimationFrame = oldRaf;
    globalThis.location = oldLocation;
  }
});
