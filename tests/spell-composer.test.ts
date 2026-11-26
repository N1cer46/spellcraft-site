import { test } from "node:test";
import assert from "node:assert/strict";
import { composeSpell } from "../client/src/lib/spell-composer";
import { resolveSpell as resolvePositionedSpell } from "../client/src/lib/spell-engine";
import {
  loadPersonalSpells,
  savePersonalSpell,
  deletePersonalSpell,
  renamePersonalSpell,
} from "../client/src/lib/personal-grimoire";
import {
  byId,
  sigils,
  marks,
  spellRecipes,
} from "../client/src/data/spellbook";
import { getSpellFx, sampleSpellParticle } from "../client/src/lib/spell-fx";
import type { Recognition } from "../client/src/lib/recognizer";

const readings = (sigil: string, ids: string[]) =>
  [sigil, ...ids].map((symbolId, i) => ({
    symbolId,
    zone: i ? "ring" : "center",
    score: 0.95,
    strokeIds: [String(i)],
  })) as Recognition[];
const resolveSpell = (rs: Recognition[]) =>
  resolvePositionedSpell(
    rs,
    rs.map((r, i) => ({
      id: String(i),
      finishedAt: 0,
      points: [
        {
          x: i ? 360 + 200 * Math.cos(((i - 1) * Math.PI) / 2) : 360,
          y: i ? 360 + 200 * Math.sin(((i - 1) * Math.PI) / 2) : 360,
        },
      ],
    }))
  );
test("known formulas remain known; extra marks and unknown combinations are composed without dropping signs", () => {
  for (const recipe of spellRecipes)
    assert.equal(
      resolveSpell(readings(recipe.sigilId, recipe.requiredMarkIds)).recipe?.id,
      recipe.id
    );
  const base = spellRecipes[0];
  const custom = resolveSpell(
    readings(base.sigilId, [...base.requiredMarkIds, "mark_orb"])
  ).recipe!;
  assert.equal(custom.custom, true);
  assert.deepEqual(
    custom.requiredMarkIds,
    [...base.requiredMarkIds, "mark_orb"].sort()
  );
  assert.equal(resolveSpell([]).recipe, null);
  assert.equal(composeSpell("nope", []), null);
  assert.equal(composeSpell("sigil_fire", ["sigil_water"]), null);
  assert.equal(composeSpell("sigil_fire", ["unknown"]), null);
  const a = composeSpell("sigil_water", ["mark_coil", "mark_enlarge"])!;
  const b = composeSpell("sigil_water", [
    "mark_enlarge",
    "mark_coil",
    "mark_coil",
  ])!;
  assert.deepEqual(a, b);
  assert.match(a.description, /Скрутить/);
  assert.equal(a.effect?.shape, "spiral");
});
test("every sigil/mark combination and the maximal formula produce bounded looping particles", () => {
  for (const sigil of sigils) {
    for (const ids of [[], ...marks.map(m => [m.id]), marks.map(m => m.id)]) {
      const recipe = composeSpell(sigil.id, ids)!;
      assert.ok(recipe.name && recipe.description);
      const fx = getSpellFx(recipe, sigil);
      assert.ok(fx.count <= 180);
      for (const t of [0, 4, 60, 3600]) {
        let visible = 0;
        for (let i = 0; i < fx.count; i++) {
          const p = sampleSpellParticle(fx, i, t);
          assert.ok(Object.values(p).every(Number.isFinite));
          assert.ok(p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1);
          assert.ok(p.alpha >= 0 && p.alpha <= 1 && p.radius > 0);
          if (p.alpha > 0.01) visible++;
        }
        assert.ok(visible > fx.count * 0.3);
      }
    }
  }
  const fire = composeSpell("sigil_fire", ["mark_orb"])!;
  assert.notDeepEqual(
    sampleSpellParticle(getSpellFx(fire, byId(fire.sigilId)!), 10, 1),
    sampleSpellParticle(
      getSpellFx(
        composeSpell("sigil_fire", ["mark_column"])!,
        byId(fire.sigilId)!
      ),
      10,
      1
    )
  );
});
test("personal collection survives reload, deduplicates formulas and preserves unreadable data", () => {
  let text: string | null = null;
  const storage = {
    getItem: () => text,
    setItem: (_key: string, value: string) => {
      text = value;
    },
  };
  const recipe = composeSpell("sigil_water", ["mark_coil"])!;
  assert.deepEqual(loadPersonalSpells(storage), []);
  assert.equal(savePersonalSpell(storage, recipe).length, 1);
  assert.deepEqual(loadPersonalSpells(storage), [recipe]);
  assert.equal(savePersonalSpell(storage, recipe).length, 1);
  text = "broken";
  assert.throws(() => savePersonalSpell(storage, recipe));
  assert.equal(text, "broken");
  text = JSON.stringify([{ sigilId: "sigil_water", markIds: ["unknown"] }]);
  assert.throws(() => loadPersonalSpells(storage));
  assert.throws(
    () =>
      savePersonalSpell(
        {
          getItem: () => null,
          setItem: () => {
            throw new Error("quota");
          },
        },
        recipe
      ),
    /quota/
  );
});

test("custom names persist, old collections still load, and deletion preserves other entries", () => {
  let text: string | null = null;
  const storage = {
    getItem: () => text,
    setItem: (_key: string, value: string) => {
      text = value;
    },
  };
  const first = {
    ...composeSpell("sigil_fire", ["mark_orb"])!,
    name: "  Маленькое солнце  ",
  };
  const second = {
    ...composeSpell("sigil_water", ["mark_column"])!,
    name: "Фонтан",
  };
  savePersonalSpell(storage, first);
  savePersonalSpell(storage, second);
  assert.equal(loadPersonalSpells(storage)[0].name, "Маленькое солнце");
  renamePersonalSpell(storage, first.id, "  Тихое солнце  ");
  const renamed = loadPersonalSpells(storage);
  assert.equal(renamed[0].name, "Тихое солнце");
  assert.equal(renamed[0].id, first.id);
  assert.deepEqual(renamed[0].requiredMarkIds, first.requiredMarkIds);
  assert.equal(renamed[1].name, "Фонтан");
  assert.throws(() => renamePersonalSpell(storage, first.id, "  "));
  assert.throws(() => renamePersonalSpell(storage, "missing", "Формула"));
  assert.deepEqual(loadPersonalSpells(storage), renamed);
  assert.deepEqual(
    deletePersonalSpell(storage, first.id).map(r => r.name),
    ["Фонтан"]
  );
  assert.equal(loadPersonalSpells(storage).length, 1);
  assert.throws(() => savePersonalSpell(storage, { ...first, name: "   " }));
  assert.throws(() =>
    savePersonalSpell(storage, { ...first, name: "x".repeat(81) })
  );
  text = JSON.stringify([
    { sigilId: first.sigilId, markIds: first.requiredMarkIds },
  ]);
  assert.equal(
    loadPersonalSpells(storage)[0].name,
    composeSpell(first.sigilId, first.requiredMarkIds)!.name
  );
  const before = text;
  assert.throws(() =>
    deletePersonalSpell(
      {
        getItem: () => text,
        setItem: () => {
          throw new Error("quota");
        },
      },
      first.id
    )
  );
  assert.equal(text, before);
});
test("motion, multiplication and new shapes materially change particle trajectories", () => {
  const sample = (ids: string[], t = 1) => {
    const recipe = composeSpell("sigil_fire", ids)!;
    const fx = getSpellFx(recipe, byId(recipe.sigilId)!);
    return Array.from({ length: 40 }, (_, i) => sampleSpellParticle(fx, i, t));
  };
  const plain = sample(["mark_orb"]);
  for (const mark of [
    "mark_project",
    "mark_dispersion",
    "mark_gather",
    "mark_collection",
    "mark_coil",
  ]) {
    const changed = sample(["mark_orb", mark]);
    const distance =
      plain.reduce(
        (sum, p, i) => sum + Math.hypot(p.x - changed[i].x, p.y - changed[i].y),
        0
      ) / plain.length;
    assert.ok(distance > 0.015, mark + " should visibly change the geometry");
  }
  assert.notDeepEqual(sample(["mark_diamond"]), sample(["mark_orb"]));
  assert.notDeepEqual(sample(["mark_glaives"]), sample(["mark_column"]));
  assert.deepEqual(
    sample(["mark_stillness"], 1),
    sample(["mark_stillness"], 100)
  );
});

test("opposing modifiers produce explained combined effects", () => {
  const orbit = composeSpell("sigil_fire", ["mark_project", "mark_pull"])!;
  assert.equal(orbit.effect?.motion, "orbit");
  assert.match(orbit.description, /орбиту/);
  const pulse = composeSpell("sigil_water", [
    "mark_dispersion",
    "mark_gather",
  ])!;
  assert.equal(pulse.effect?.pulse, true);
  const balance = composeSpell("sigil_fire", ["mark_empower", "mark_cool"])!;
  assert.equal(balance.effect?.intensity, 1);
  assert.equal(balance.effect?.speed, 0.5);
});
