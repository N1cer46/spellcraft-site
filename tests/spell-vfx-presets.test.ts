import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spellRecipes, byId } from "../client/src/data/spellbook";
import { composeSpell } from "../client/src/lib/spell-composer";
import { getSpellFx } from "../client/src/lib/spell-fx";
import { getSpellVfxPreset } from "../client/src/lib/spell-vfx-presets";

test("authored VFX recipes ship their effect files and every referenced texture", () => {
  const supported = ["water-orb", "sealed-barrier"];
  for (const recipe of spellRecipes) {
    const preset = getSpellVfxPreset(getSpellFx(recipe, byId(recipe.sigilId)!));
    assert.equal(!!preset, supported.includes(recipe.id), recipe.id);
    if (!preset) continue;
    const file = `client/public/vfx/effects/${preset.file}`;
    const bytes = readFileSync(file);
    assert.equal(bytes.subarray(0, 4).toString(), "EFKE");
    // INFO/BIN chunks contain UTF-16 resource paths, sometimes at odd offsets.
    const paths = new Set<string>();
    for (const offset of [0, 1]) {
      const text = bytes.subarray(offset).toString("utf16le");
      for (const match of text.matchAll(/Textures?\/[\w_]+\.png/g))
        paths.add(match[0]);
    }
    assert.ok(paths.size > 0, recipe.id);
    for (const path of paths)
      assert.ok(existsSync(join(dirname(file), path)), path);
    assert.ok(preset.scale.every(value => value > 0 && Number.isFinite(value)));
  }
});

test("user-composed fire, water and barriers keep their modifier-driven renderer", () => {
  for (const sigilId of ["sigil_fire", "sigil_water", "sigil_stop"]) {
    const recipe = composeSpell(sigilId, [
      "mark_orb",
      "mark_collection",
      "mark_float",
      "mark_enlarge",
    ]);
    assert.ok(recipe);
    assert.equal(getSpellVfxPreset(getSpellFx(recipe, byId(sigilId)!)), null);
  }
});
