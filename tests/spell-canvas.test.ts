import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as recognizer from "../client/src/lib/recognizer";
import * as spellbook from "../client/src/data/spellbook";
import * as masteryRewards from "../client/src/lib/mastery-rewards";
import * as engine from "../client/src/lib/spell-engine";
import { setReferenceTemplatesForTests } from "../client/src/data/reference-templates";

// Execute the real component handlers with a small hook/DOM harness; no duplicate recognition logic.
function canvasHarness(
  recognize = recognizer.recognizeSymbol,
  extraProps: Record<string, unknown> = {}
) {
  const hooks: any[] = [];
  let cursor = 0;
  const react = {
    useRef: (initial: unknown) => {
      const i = cursor++;
      return (hooks[i] ??= { current: initial });
    },
    useState: (initial: unknown) => {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = initial;
      return [
        hooks[i],
        (value: any) => {
          hooks[i] = typeof value === "function" ? value(hooks[i]) : value;
        },
      ];
    },
    useCallback: (fn: unknown) => fn,
    useMemo: (fn: () => unknown) => fn(),
    useEffect: () => {},
  };
  const jsx = (type: any, props: any) => ({ type, props });
  const modules: Record<string, any> = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": {},
    "@/data/spellbook": spellbook,
    "@/lib/recognizer": { ...recognizer, recognizeSymbol: recognize },
    "@/lib/spell-engine": engine,
    "@/lib/mastery-rewards": masteryRewards,
    "./SpellAnimator": { default: () => null },
  };
  const source = ts.transpileModule(
    readFileSync("client/src/components/SpellCanvas.tsx", "utf8"),
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
  let readings: recognizer.Recognition[] = [];
  let tree: any;
  function render() {
    cursor = 0;
    tree = module.exports.default({
      ...extraProps,
      selectedRecipe: null,
      onRecognitionChange: (r: recognizer.Recognition[]) => {
        readings = r;
      },
    });
  }
  function find(type: string, node = tree): any {
    if (!node || typeof node !== "object") return undefined;
    if (node.type === type) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const hit = find(type, child ?? null);
      if (hit) return hit;
    }
  }
  const rect = { left: 0, top: 0, width: 720, height: 720 };
  const target = {
    getBoundingClientRect: () => rect,
    setPointerCapture: () => {},
    hasPointerCapture: () => true,
  };
  function event(point: { x: number; y: number }, pointerId = 1) {
    return {
      clientX: point.x,
      clientY: point.y,
      pointerType: "mouse",
      pointerId,
      button: 0,
      buttons: 1,
      currentTarget: target,
    };
  }
  async function draw(points: { x: number; y: number }[]) {
    render();
    const props = find("canvas").props;
    props.onPointerDown(event(points[0]));
    points.slice(1, -1).forEach(p => props.onPointerMove(event(p)));
    await props.onPointerUp({ ...event(points.at(-1)!), buttons: 0 });
    render();
  }
  function buttons(node = tree): any[] {
    if (!node || typeof node !== "object") return [];
    return [
      ...(node.type === "button" ? [node] : []),
      ...[node.props?.children].flat(Infinity).flatMap(n => buttons(n ?? null)),
    ];
  }
  render();
  return {
    draw,
    render,
    find,
    resize(width: number) {
      rect.width = width;
      rect.height = width;
    },
    get choices() {
      return buttons()
        .filter(b => b.props.className === "choice-chip")
        .map(b => b.props.children);
    },
    get readings() {
      return readings;
    },
    click(label: string) {
      render();
      const button = buttons().find(b =>
        [b.props.children]
          .flat(Infinity)
          .some(
            c =>
              (typeof c === "string" ? c.trim() : c?.props?.children) === label
          )
      );
      assert.ok(button);
      button.props.onClick();
      render();
    },
  };
}
globalThis.requestAnimationFrame = (() => 1) as any;
globalThis.cancelAnimationFrame = () => {};
const templates = JSON.parse(
  readFileSync("client/public/reference-templates.json", "utf8")
);
const placed = (
  sample: { x: number; y: number }[][],
  cx: number,
  cy: number,
  size = 100
) => {
  const all = sample.flat();
  const minX = Math.min(...all.map(p => p.x)),
    minY = Math.min(...all.map(p => p.y));
  const w = Math.max(...all.map(p => p.x)) - minX,
    h = Math.max(...all.map(p => p.y)) - minY;
  return sample.map(s =>
    s.map(p => ({
      x: cx + ((p.x - minX - w / 2) * size) / Math.max(w, h),
      y: cy + ((p.y - minY - h / 2) * size) / Math.max(w, h),
    }))
  );
};

test("canvas assembles column strokes and keeps the completed symbol editable", async () => {
  setReferenceTemplatesForTests(templates);
  const harness = canvasHarness();
  const sample = placed(templates.mark_column[0], 360, 160);
  for (const stroke of sample) await harness.draw(stroke);
  assert.equal(harness.readings.length, 1);
  assert.equal(harness.readings[0].symbolId, "mark_column");
  assert.equal(harness.readings[0].strokeIds.length, 2);
  harness.click("Отменить");
  assert.equal(harness.readings.length, 0);
});

test("reset discards recognition already waiting for templates", async () => {
  setReferenceTemplatesForTests(templates);
  let release!: () => void;
  const wait = new Promise<void>(resolve => {
    release = resolve;
  });
  const harness = canvasHarness(async (...args) => {
    await wait;
    return recognizer.recognizeSymbol(...args);
  });
  const drawing = harness.draw(placed(templates.mark_project[0], 360, 160)[0]);
  harness.click("Стереть всё");
  release();
  await drawing;
  assert.deepEqual(harness.readings, []);
});

test("the second pointer cannot end the primary pointer stroke; release endpoint is recorded", async () => {
  let seen: recognizer.InkStroke[] = [];
  const harness = canvasHarness(async strokes => {
    seen = strokes;
    return null;
  });
  const props = harness.find("canvas").props;
  const target = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 720, height: 720 }),
    setPointerCapture: () => {},
  };
  const down = {
    clientX: 100,
    clientY: 100,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
    currentTarget: target,
  };
  props.onPointerDown(down);
  await props.onPointerUp({ ...down, clientX: 200, pointerId: 2, buttons: 0 });
  assert.equal(seen.length, 0);
  await props.onPointerUp({ ...down, clientX: 200, buttons: 0 });
  assert.deepEqual(
    seen[0].points.map(({ x, y }) => ({ x, y })),
    [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]
  );
});

test("two symbols drawn while references load both receive a reading", async () => {
  setReferenceTemplatesForTests(templates);
  let release!: () => void;
  const wait = new Promise<void>(resolve => {
    release = resolve;
  });
  const harness = canvasHarness(async (...args) => {
    await wait;
    return recognizer.recognizeSymbol(...args);
  });
  const first = harness.draw(placed(templates.mark_project[0], 360, 160)[0]);
  const second = harness.draw(
    placed(templates.mark_collection[0], 560, 360)[0]
  );
  release();
  await Promise.all([first, second]);
  assert.deepEqual(harness.readings.map(r => r.symbolId).sort(), [
    "mark_collection",
    "mark_project",
  ]);
});

test("complete fire spell assembles through the actual canvas handlers and activates on a circle", async () => {
  setReferenceTemplatesForTests(templates);
  const harness = canvasHarness();
  for (const [id, cx, cy] of [
    ["sigil_fire", 360, 360],
    ["mark_column", 360, 160],
    ["mark_empower", 560, 360],
    ["mark_enlarge", 360, 560],
    ["mark_stability", 160, 360],
  ] as const) {
    for (const stroke of placed(templates[id][0], cx, cy))
      await harness.draw(stroke);
    assert.ok(
      harness.readings.some(r => r.symbolId === id),
      `${id}: ${harness.readings.map(r => r.symbolId)}`
    );
  }
  const circle = Array.from({ length: 100 }, (_, i) => ({
    x: 360 + 280 * Math.cos((i * 2 * Math.PI) / 99),
    y: 360 + 280 * Math.sin((i * 2 * Math.PI) / 99),
  }));
  await harness.draw(circle);
  // SpellAnimator is stubbed as a component type, but its real props carry the resolved recipe.
  function recipe(node: any): any {
    if (!node || typeof node !== "object") return null;
    if (node.props?.recipe) return node.props.recipe;
    return [node.props?.children].flat(Infinity).map(recipe).find(Boolean);
  }
  assert.equal(recipe(harness.find("section"))?.id, "fire-column");
  assert.equal(harness.find("canvas").props.style.visibility, "hidden");
  harness.click("Стереть всё");
  assert.equal(harness.find("canvas").props.style.visibility, "visible");
});

test("all recorded multipart symbols survive assembly on the canvas", async () => {
  setReferenceTemplatesForTests(templates);
  const failures: string[] = [];
  for (const [id, samples] of Object.entries(templates) as [
    string,
    { x: number; y: number }[][][],
  ][]) {
    const harness = canvasHarness();
    const split = samples[0]
      .flatMap(s => {
        const cut = Math.floor(s.length / 2);
        return [s.slice(0, cut + 1), s.slice(cut)];
      })
      .reverse();
    for (const stroke of placed(
      split,
      360,
      id.startsWith("sigil_") ? 360 : 160
    ))
      await harness.draw(stroke);
    const name = spellbook.byId(id)?.name;
    if (
      !harness.readings.some(r => r.symbolId === id) &&
      !harness.choices.flat(Infinity).includes(name)
    )
      failures.push(
        `${id} -> ${harness.readings.map(r => r.symbolId)} choices=${harness.choices}`
      );
  }
  assert.deepEqual(failures, []);
});

test("mobile pointer coordinates and ink survive viewport resizing", async () => {
  let seen: recognizer.InkStroke[] = [];
  const harness = canvasHarness(async strokes => {
    seen = strokes;
    return null;
  });
  harness.resize(360);
  await harness.draw([
    { x: 25, y: 25 },
    { x: 75, y: 25 },
  ]);
  assert.deepEqual(
    seen[0].points.map(({ x, y }) => ({ x, y })),
    [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
    ]
  );
  harness.resize(720);
  await harness.draw([
    { x: 100, y: 50 },
    { x: 100, y: 100 },
  ]);
  assert.equal(seen.length, 2);
  assert.deepEqual(
    seen[0].points.map(({ x, y }) => ({ x, y })),
    [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
    ]
  );
  assert.deepEqual(
    seen[1].points.map(({ x, y }) => ({ x, y })),
    [
      { x: 100, y: 50 },
      { x: 100, y: 100 },
    ]
  );
});

test("touch ink survives zero-button moves, release, cancellation and lost capture", async () => {
  for (const end of [
    "onPointerUp",
    "onPointerCancel",
    "onLostPointerCapture",
  ]) {
    let seen: recognizer.InkStroke[] = [];
    const harness = canvasHarness(async strokes => {
      seen = strokes;
      return null;
    });
    const props = harness.find("canvas").props;
    const target = {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 360,
        height: 360,
      }),
      setPointerCapture: () => {},
    };
    const event = {
      clientX: 50,
      clientY: 50,
      pointerId: 11,
      pointerType: "touch",
      button: 0,
      buttons: 0,
      currentTarget: target,
    };
    props.onPointerDown(event);
    props.onPointerMove({ ...event, clientX: 70 });
    await props.onPointerCancel({ ...event, pointerId: 12 });
    props.onPointerMove({ ...event, clientX: 90 });
    await props[end]({ ...event, clientX: 100 });
    assert.equal(seen.length, 1, end);
    assert.deepEqual(
      seen[0].points.slice(0, 3).map(p => p.x),
      [100, 140, 180],
      end
    );
    // A late lost-capture event must neither remove nor duplicate the committed line.
    await props.onLostPointerCapture(event);
    harness.render();
    assert.equal(seen.length, 1, end);
    harness.click("Стереть всё");
    await harness.draw([
      { x: 200, y: 50 },
      { x: 210, y: 50 },
    ]);
    assert.equal(seen.length, 1, "explicit reset still clears previous ink");
  }
});

test("drawing over plain HTTP without crypto.randomUUID retains strokes and supports undo", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {},
  });
  try {
    let seen: recognizer.InkStroke[] = [];
    const harness = canvasHarness(async strokes => {
      seen = strokes;
      return null;
    });
    await harness.draw([
      { x: 50, y: 50 },
      { x: 70, y: 50 },
    ]);
    await harness.draw([
      { x: 70, y: 50 },
      { x: 70, y: 70 },
    ]);
    assert.equal(seen.length, 2, "both finished strokes must be retained");
    assert.notEqual(seen[0].id, seen[1].id);
    const previousIds = seen.map(s => s.id);
    harness.click("Отменить");
    await harness.draw([
      { x: 70, y: 50 },
      { x: 90, y: 50 },
    ]);
    assert.equal(seen.length, 2);
    assert.equal(seen[0].id, previousIds[0]);
    assert.ok(!previousIds.includes(seen[1].id), "undo must not recycle an ID");
    harness.click("Стереть всё");
    await harness.draw([
      { x: 50, y: 50 },
      { x: 70, y: 50 },
    ]);
    assert.equal(seen.length, 1);
    assert.ok(!previousIds.includes(seen[0].id));
  } finally {
    if (original) Object.defineProperty(globalThis, "crypto", original);
    else Reflect.deleteProperty(globalThis, "crypto");
  }
});

test("a new drawn formula activates, offers saving, and reports storage failure without losing ink", async () => {
  setReferenceTemplatesForTests(templates);
  let saved: any;
  const harness = canvasHarness(recognizer.recognizeSymbol, {
    onSaveSpell: (recipe: any) => {
      saved = recipe;
      throw new Error("Хранилище недоступно");
    },
  });
  for (const [id, cx, cy] of [
    ["sigil_fire", 360, 360],
    ["mark_orb", 360, 160],
    ["mark_float", 560, 360],
    ["mark_stability", 360, 560],
    ["mark_focus", 160, 360],
  ] as const) {
    for (const stroke of placed(templates[id][0], cx, cy))
      await harness.draw(stroke);
    assert.ok(harness.readings.some(r => r.symbolId === id));
  }
  await harness.draw(
    Array.from({ length: 100 }, (_, i) => ({
      x: 360 + 280 * Math.cos((i * 2 * Math.PI) / 99),
      y: 360 + 280 * Math.sin((i * 2 * Math.PI) / 99),
    }))
  );
  harness.click("Сохранить в личный гримуар");
  assert.equal(saved.custom, true);
  assert.deepEqual(saved.requiredMarkIds, [
    "mark_float",
    "mark_focus",
    "mark_orb",
    "mark_stability",
  ]);
  assert.equal(harness.find("canvas").props["aria-hidden"], true);
  assert.equal(harness.readings.length, 4 + 1);
});

test("redo restores removed ink and is cleared by a new stroke", async () => {
  const harness = canvasHarness(async () => null);
  await harness.draw([
    { x: 100, y: 100 },
    { x: 130, y: 130 },
  ]);
  harness.click("Отменить");
  harness.click("Вернуть");
  assert.equal(harness.find("canvas").props["aria-hidden"], false);
  harness.click("Отменить");
  await harness.draw([
    { x: 200, y: 100 },
    { x: 230, y: 130 },
  ]);
  harness.click("Стереть всё");
  assert.equal(harness.readings.length, 0);
});


test("touch and pen release cannot extend ink beyond the last contact sample", async () => {
  for (const pointerType of ["touch", "pen"]) {
    for (const releaseX of [91, 100, 180]) {
      let seen: recognizer.InkStroke[] = [];
      const harness = canvasHarness(async strokes => { seen = strokes; return null; });
      const props = harness.find("canvas").props;
      const currentTarget = {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 360 }),
        setPointerCapture() {},
      };
      const event = { pointerId: 1, pointerType, button: 0, buttons: 1, clientX: 50, clientY: 50, currentTarget };
      props.onPointerDown(event);
      props.onPointerMove({ ...event, clientX: 70 });
      props.onPointerMove({ ...event, clientX: 90 });
      await props.onPointerUp({ ...event, clientX: releaseX, buttons: 0 });
      props.onPointerMove({ ...event, clientX: 200, buttons: 0 });
      await props.onLostPointerCapture(event);
      assert.deepEqual(seen[0].points.map(p => p.x), [100, 140, 180]);
      assert.equal(seen.length, 1);
    }
  }
});


test("raw touch samples win over extrapolated pointer moves and release", async () => {
  for (const end of ["onTouchEnd", "onTouchCancel"]) {
    let seen: recognizer.InkStroke[] = [];
    const harness = canvasHarness(async strokes => { seen = strokes; return null; });
    const props = harness.find("canvas").props;
    const currentTarget = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 360 }),
      setPointerCapture() {},
    };
    const pointer = { pointerId: 1, pointerType: "touch", button: 0, buttons: 1, clientX: 50, clientY: 50, currentTarget };
    const touch = (x: number, identifier = 7) => ({ currentTarget, changedTouches: [{ identifier, clientX: x, clientY: 50 }] });
    props.onPointerDown(pointer);
    props.onTouchStart(touch(50));
    props.onPointerMove({ ...pointer, clientX: 120 });
    props.onTouchMove(touch(70));
    props.onTouchMove(touch(200, 8));
    props.onTouchMove(touch(90));
    await props.onPointerUp({ ...pointer, clientX: 180, buttons: 0 });
    await props.onLostPointerCapture(pointer);
    assert.equal(seen.length, 0, "only touch termination commits the stroke");
    await props[end](touch(180));
    props.onPointerMove({ ...pointer, clientX: 220, buttons: 0 });
    assert.deepEqual(seen[0].points.map(p => p.x), [100, 140, 180]);
    assert.equal(seen.length, 1);
  }
});

test("expanding the sheet preserves ink and undo history across viewport changes", async () => {
  let seen: recognizer.InkStroke[] = [];
  const harness = canvasHarness(async strokes => { seen = strokes; return null; });
  await harness.draw([{ x: 300, y: 300 }, { x: 320, y: 320 }]);
  const original = JSON.parse(JSON.stringify(seen));
  harness.click("На весь экран");
  assert.equal(harness.find("section").props["aria-modal"], true);
  harness.resize(360);
  harness.click("Свернуть");
  assert.equal(harness.find("section").props["data-expanded"], false);
  harness.click("Отменить");
  harness.click("Вернуть");
  harness.resize(720);
  await harness.draw([{ x: 321, y: 321 }, { x: 330, y: 340 }]);
  assert.deepEqual(seen[0], original[0]);
});

test("touch lift trims a recent straight overshoot without shortening a bend or cancelled stroke", async () => {
  const cases = [
    { points: [[50, 60], [70, 60], [95, 60], [130, 60]], lift: [90, 61], expected: [[50, 60], [70, 60], [90, 60]] },
    { points: [[50, 60], [53, 60], [60, 60]], lift: [55, 60], expected: [[50, 60], [53, 60], [55, 60]] },
    { points: [[50, 60], [70, 60], [95, 60], [95, 80]], lift: [90, 61], expected: [[50, 60], [70, 60], [95, 60], [95, 80]] },
    { points: [[50, 60], [70, 60], [95, 60]], lift: [80, 60], cancelled: true, expected: [[50, 60], [70, 60], [95, 60]] },
    { points: [[50, 60], [70, 60], [95, 60]], lift: [70, 60], paused: true, expected: [[50, 60], [70, 60], [95, 60]] },
  ];
  for (const scenario of cases) {
    let seen: recognizer.InkStroke[] = [];
    const harness = canvasHarness(async strokes => { seen = strokes; return null; });
    const props = harness.find("canvas").props;
    const currentTarget = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 360 }),
    };
    const touch = ([clientX, clientY]: number[], timeStamp: number, type: string) => ({
      currentTarget, timeStamp, type,
      changedTouches: [{ identifier: 1, clientX, clientY }],
    });
    props.onTouchStart(touch(scenario.points[0], 100, "touchstart"));
    scenario.points.slice(1).forEach((point, index) => props.onTouchMove(touch(point, 110 + index * 10, "touchmove")));
    const type = scenario.cancelled ? "touchcancel" : "touchend";
    await props[scenario.cancelled ? "onTouchCancel" : "onTouchEnd"](touch(scenario.lift, scenario.paused ? 240 : 135, type));
    props.onTouchMove(touch([190, 60], 250, "touchmove"));
    assert.deepEqual(seen[0].points.map(point => [point.x / 2, point.y / 2]), scenario.expected, type);
    assert.equal(seen.length, 1);
  }
});

test("pen uses measured coalesced points instead of the shifted dispatched position", async () => {
  let seen: recognizer.InkStroke[] = [];
  const harness = canvasHarness(async strokes => { seen = strokes; return null; });
  const props = harness.find("canvas").props;
  const currentTarget = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 360 }),
    setPointerCapture() {},
  };
  const pen = { pointerId: 1, pointerType: "pen", button: 0, buttons: 1, pressure: .5, clientX: 50, clientY: 50, currentTarget, timeStamp: 100 };
  props.onPointerDown(pen);
  props.onPointerMove({
    ...pen, clientX: 130, timeStamp: 120,
    nativeEvent: { getCoalescedEvents: () => [
      { clientX: 70, clientY: 50, timeStamp: 110 },
      { clientX: 90, clientY: 50, timeStamp: 117 },
      { clientX: 150, clientY: 50, timeStamp: 125 },
    ] },
  });
  await props.onPointerUp({ ...pen, clientX: 150, timeStamp: 122, buttons: 0, pressure: 0 });
  assert.deepEqual(seen[0].points.map(point => point.x / 2), [50, 70, 90]);
});
