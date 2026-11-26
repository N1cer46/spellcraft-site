import type { SpellFx } from "./spell-fx";

export type SpellVfxPreset = {
  file: string;
  scale: [number, number, number];
  location: [number, number, number];
  rotation: [number, number, number];
  warmup: number;
  speed: number;
  filter: string;
  mirrorBelow?: boolean;
};

// Only authored recipes use prefabs. Composed spells retain their visual grammar.
export function getSpellVfxPreset(fx: SpellFx): SpellVfxPreset | null {
  if (fx.composed) return null;
  switch (fx.id) {
    case "water-orb":
      return {
        file: "Barrior02.efkefc",
        scale: [1, 1, 1],
        location: [0, 7, 0],
        rotation: [0, 0, 0],
        warmup: 90,
        speed: 0.65,
        filter: "hue-rotate(185deg) saturate(2) brightness(1.8)",
        mirrorBelow: true,
      };
    case "sealed-barrier":
      return {
        file: "Barrior01.efkefc",
        scale: [1.65, 1.65, 1.65],
        location: [0, 0, 0],
        rotation: [0, 0, 0],
        warmup: 90,
        speed: 0.75,
        filter: "none",
      };
    default:
      return null;
  }
}
