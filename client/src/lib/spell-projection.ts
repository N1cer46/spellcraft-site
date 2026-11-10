// The CSS ink plane and canvas particles share one orthographic camera.
export const SPELL_PLANE = { x: .5, y: .61, diameter: .76, tilt: 72 };
const tilt = SPELL_PLANE.tilt * Math.PI / 180;
export const projectSpellPoint = (x: number, height: number, depth: number) => ({
  x: SPELL_PLANE.x + x,
  y: SPELL_PLANE.y - height * Math.sin(tilt) + depth * Math.cos(tilt),
});
