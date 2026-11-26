import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getSpellFx,
  startSpellFx,
  sampleSpellParticle,
} from "../client/src/lib/spell-fx";
import { byId, spellRecipes } from "../client/src/data/spellbook";

test("all spells stay visible across cycles with a fixed, bounded particle budget", () => {
  for (const recipe of spellRecipes) {
    const fx = getSpellFx(recipe, byId(recipe.sigilId)!);
    assert.ok(fx.count <= 180);
    for (const time of [0, 0.1, 2, 5.4, 10, 60, 600, 3600]) {
      let visible = 0;
      for (let i = 0; i < fx.count; i++) {
        const p = sampleSpellParticle(fx, i, time);
        for (const n of Object.values(p))
          assert.ok(Number.isFinite(n), recipe.id);
        assert.ok(p.radius > 0 && p.alpha >= 0 && p.alpha <= 1);
        assert.ok(
          p.x > 0 && p.x < 1 && p.y > 0 && p.y < 0.8,
          `${recipe.id}: particle outside the scene`
        );
        if (p.alpha > 0.1) visible++;
      }
      assert.ok(
        visible > fx.count * 0.4,
        `${recipe.id}: blank cycle at ${time}s`
      );
    }
  }
});

test("animation continues until cancelled, reduced motion is still, and resizing updates the buffer", () => {
  const originals = {
    window: globalThis.window,
    document: globalThis.document,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  const queue = new Map<number, FrameRequestCallback>();
  let id = 0,
    draws = 0;
  let paused = false;
  let trace: unknown[] = [];
  const gradient = { addColorStop() {} };
  const context = new Proxy(
    {},
    {
      get:
        (_, key) =>
        (...args: unknown[]) => {
          trace.push([key, ...args.filter(arg => typeof arg === "number")]);
          for (const arg of args)
            if (typeof arg === "number")
              assert.ok(Number.isFinite(arg), String(key));
          if (key === "drawImage" || key === "stroke" || key === "fill")
            draws++;
          if (key === "createRadialGradient" || key === "createLinearGradient") return gradient;
        },
      set: () => true,
    }
  );
  const makeCanvas = () => ({
    width: 300,
    height: 300,
    clientWidth: 300,
    clientHeight: 300,
    getContext: () => context,
  });
  globalThis.window = { devicePixelRatio: 2 } as Window & typeof globalThis;
  globalThis.document = { createElement: makeCanvas } as unknown as Document;
  globalThis.requestAnimationFrame = callback => {
    queue.set(++id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = id => {
    queue.delete(id);
  };
  try {
    for (const recipe of spellRecipes)
      for (const reduced of [false, true]) {
        const canvas = makeCanvas(),
          fx = getSpellFx(recipe, byId(recipe.sigilId)!);
        draws = 0;
        const stop = startSpellFx(
          canvas as unknown as HTMLCanvasElement,
          fx,
          reduced,
          () => paused
        );
        if (reduced) {
          assert.equal(queue.size, 0);
          assert.ok(draws > 0);
        } else {
          for (let frame = 0; frame < 260; frame++) {
            assert.equal(
              queue.size,
              1,
              `${recipe.id}: stopped before cancellation`
            );
            const [key, callback] = queue.entries().next().value!;
            queue.delete(key);
            draws = 0;
            callback(frame * 50);
            assert.ok(draws > 0);
            if (frame === 150) {
              canvas.clientWidth = 420;
              canvas.clientHeight = 420;
            }
          }
          paused = true;
          const pausedFrames: string[] = [];
          for (const time of [14000, 15000]) {
            const [key, callback] = queue.entries().next().value!;
            queue.delete(key);
            trace = [];
            callback(time);
            pausedFrames.push(JSON.stringify(trace));
          }
          assert.equal(pausedFrames[0], pausedFrames[1], "paused scene must stay still");
          paused = false;
          assert.equal(canvas.width, 840);
          assert.equal(canvas.height, 840);
          assert.equal(queue.size, 1);
        }
        stop();
        assert.equal(queue.size, 0);
      }
  } finally {
    Object.assign(globalThis, originals);
  }
});

test('effects and ink circle use the same ground plane and perpendicular height',async()=>{
  const {SPELL_PLANE,projectSpellPoint}=await import('../client/src/lib/spell-projection');
  const origin=projectSpellPoint(0,0,0);
  assert.deepEqual(origin,{x:SPELL_PLANE.x,y:SPELL_PLANE.y});
  const r=SPELL_PLANE.diameter/2;
  const front=projectSpellPoint(0,0,r),back=projectSpellPoint(0,0,-r);
  assert.ok(Math.abs(front.y-back.y-SPELL_PLANE.diameter*Math.cos(SPELL_PLANE.tilt*Math.PI/180))<1e-12);
  const up=projectSpellPoint(0,.3,0);
  assert.equal(up.x,origin.x);
  assert.ok(up.y<back.y,'vertical effects rise above the back edge of the circle');
});


test("eight added recipes have drawable ingredients and distinct composed scenes", () => {
  const ids = ["wind-channel", "clear-breeze", "ice-glaives", "tidal-gather", "stone-heart", "light-beacon", "petal-vortex", "prism-mirror"];
  const templates = JSON.parse(readFileSync("client/public/reference-templates.json", "utf8"));
  const scenes = new Set<string>();
  for (const id of ids) {
    const recipe = spellRecipes.find(recipe => recipe.id === id)!;
    assert.ok(recipe, id);
    assert.equal(recipe.custom, undefined);
    assert.equal(new Set(recipe.requiredMarkIds).size, 4);
    for (const symbolId of [recipe.sigilId, ...recipe.requiredMarkIds]) {
      assert.ok(templates[symbolId]?.length, `${id}: missing drawings for ${symbolId}`);
    }
    const fx = getSpellFx(recipe, byId(recipe.sigilId)!);
    assert.ok(fx.composed, `${id}: generic fallback scene`);
    scenes.add(JSON.stringify([0, 0.5, 2].map(time =>
      Array.from({length: 12}, (_, i) => sampleSpellParticle(fx, i, time)))));
  }
  assert.equal(scenes.size, ids.length, "new scenes must differ in motion and geometry");
});
