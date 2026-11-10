// Regression test for the recording tool's stroke state machine.
//
// Catches the bug where `strokes.map(simplifyStroke)` passed the array INDEX into
// simplifyStroke's `count` parameter, so the first stroke was resampled to 0 points and
// saved as an empty stroke ([[[]]]). Mirrors tools/record-templates.html in a minimal DOM mock.
import { readFileSync } from "node:fs";

const html = readFileSync("tools/record-templates.html", "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const ctx = {
  beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, setTransform() {}, clearRect() {},
  set lineCap(v) {}, set lineJoin(v) {}, set strokeStyle(v) {}, set globalAlpha(v) {}, set lineWidth(v) {},
};

function makeElement(id) {
  return {
    id, textContent: "", className: "", innerHTML: "", disabled: false, src: "", style: {}, dataset: {},
    addEventListener(type, fn) { this["on" + type] = fn; },
  };
}

const canvas = makeElement("canvas");
canvas.getContext = () => ctx;
canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 500 });
canvas.width = 0;
canvas.height = 0;
canvas.setPointerCapture = () => {};
canvas.releasePointerCapture = () => {};
canvas.hasPointerCapture = () => true;

const elements = { canvas };
const document = { getElementById: (id) => (elements[id] ||= makeElement(id)), querySelectorAll: () => [] };

const windowListeners = {};
const windowObj = {
  addEventListener(type, fn) { (windowListeners[type] ||= []).push(fn); },
  removeEventListener() {},
  devicePixelRatio: 1,
  requestAnimationFrame: (fn) => { queueMicrotask(fn); },
  performance: { now: () => Date.now() },
};
const performance = { now: () => Date.now() };

const symbolsData = [{ id: "sigil_wind_clean", kind: "sigil", name: "W", assetKey: "Wind Clean", group: "Стихии", description: "", image: "/x.png" }];
let templatesData = {};

const fetchMock = async (url, opts) => {
  if (url === "/symbols.json") return { json: async () => symbolsData };
  if (url === "/templates" && (!opts || !opts.method || opts.method === "GET")) return { json: async () => structuredClone(templatesData) };
  if (url === "/templates" && opts.method === "POST") { templatesData = JSON.parse(opts.body); return { ok: true, status: 200 }; }
  throw new Error("unexpected fetch " + url);
};

const instrumented = script + "\n;globalThis.__simplify = simplifyStroke;";
const fn = new Function("document", "window", "performance", "fetch", "requestAnimationFrame", instrumented);
fn(document, windowObj, performance, fetchMock, (cb) => queueMicrotask(cb));
await new Promise((r) => setTimeout(r, 20));

function dispatch(type, props = {}) {
  const e = { pointerType: "mouse", button: 0, buttons: type === "pointerup" ? 0 : 1, pointerId: 1, clientX: 0, clientY: 0, preventDefault() {}, ...props };
  canvas["on" + type]?.(e);
  (windowListeners[type] || []).forEach((f) => f(e));
}

function drawStroke(points) {
  dispatch("pointerdown", { clientX: points[0][0], clientY: points[0][1] });
  for (let i = 1; i < points.length; i++) dispatch("pointermove", { clientX: points[i][0], clientY: points[i][1] });
  dispatch("pointerup", { clientX: points[points.length - 1][0], clientY: points[points.length - 1][1] });
}

const results = [];
const check = (name, ok) => { results.push([name, ok]); };

// 1. A drawn stroke must survive "В эталон" as 48 resampled points (not an empty stroke).
drawStroke([[100, 250], [110, 240], [120, 230], [130, 220], [140, 210], [150, 200]]);
await new Promise((r) => setTimeout(r, 5));
elements["add"].onclick?.();
await new Promise((r) => setTimeout(r, 20));
const saved = templatesData["sigil_wind_clean"];
check("sample saved", Array.isArray(saved) && saved.length === 1);
check("stroke has 48 points", saved?.[0]?.[0]?.length === 48);
check("first stroke not empty", (saved?.[0]?.[0]?.length ?? 0) > 0);

// 2. simplifyStroke must not be confused by a second numeric argument (the .map index).
const out = globalThis.__simplify([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }], 0);
check("simplifyStroke ignores index arg", out.length === 48);

let failed = 0;
for (const [name, ok] of results) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
