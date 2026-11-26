/**
 * Design system: «Обсерватория линий» — the activation overlay. It lifts the drawn circle off the
 * page, tilts it down into a 3D "floor" (CSS perspective, so the sigil and marks stay legible), and
 * plays authored WebGL effects (or procedural particles) above the resolved spell.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { byId, type SpellRecipe } from "@/data/spellbook";
import type { InkStroke } from "@/lib/recognizer";
import { SPELL_PLANE } from "@/lib/spell-projection";
import { getSpellFx } from "@/lib/spell-fx";
import SpellEffects from "./SpellEffects";

type Props = {
  recipe: SpellRecipe;
  sigilId: string;
  strokes: InkStroke[];
  size: { width: number; height: number };
  onDone: () => void;
};

const INK = "#e8e0bc";

/** Renders the user's ink + a parchment disc + an activation ring into a square texture. */
function renderCircleTexture(strokes: InkStroke[], size: Props["size"]) {
  const minSide = Math.max(1, Math.min(size.width, size.height));
  const textureSize = Math.min(1024, Math.max(320, Math.round(minSide * 1.6)));
  const canvas = document.createElement("canvas");
  canvas.width = textureSize;
  canvas.height = textureSize;
  const context = canvas.getContext("2d");
  if (!context) return "";

  const toTexture = (point: InkStroke["points"][number]) => ({
    x: (0.5 + (point.x - size.width / 2) / minSide) * textureSize,
    y: (0.5 + (point.y - size.height / 2) / minSide) * textureSize,
  });

  const radius = textureSize / 2;

  // Parchment disc.
  context.save();
  context.beginPath();
  context.arc(radius, radius, radius, 0, Math.PI * 2);
  context.clip();
  const parchment = context.createRadialGradient(radius, radius, radius * 0.2, radius, radius, radius);
  parchment.addColorStop(0, "rgba(40, 68, 54, 0.96)");
  parchment.addColorStop(0.72, "rgba(26, 48, 38, 0.94)");
  parchment.addColorStop(1, "rgba(16, 32, 26, 0.98)");
  context.fillStyle = parchment;
  context.fillRect(0, 0, textureSize, textureSize);

  // User's ink.
  const lineWidth = Math.max(2, textureSize * 0.006);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = INK;
  context.shadowColor = "rgba(202, 223, 169, 0.4)";
  context.shadowBlur = textureSize * 0.012;
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    const first = toTexture(stroke.points[0]);
    context.lineWidth = lineWidth;
    context.beginPath();
    context.moveTo(first.x, first.y);
    stroke.points.slice(1).forEach((point) => {
      const p = toTexture(point);
      context.lineTo(p.x, p.y);
    });
    context.stroke();
  }
  context.shadowBlur = 0;

  // Activation ring.
  context.strokeStyle = "rgba(242, 184, 75, 0.95)";
  context.shadowColor = "rgba(242, 184, 75, 0.9)";
  context.shadowBlur = textureSize * 0.02;
  context.lineWidth = Math.max(3, textureSize * 0.008);
  context.beginPath();
  context.arc(radius, radius, radius - lineWidth * 3, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  return canvas.toDataURL("image/png");
}

export default function SpellAnimator({ recipe, sigilId, strokes, size, onDone }: Props) {
  const sigil = byId(sigilId);
  const fx = useMemo(() => (sigil ? getSpellFx(recipe, sigil) : null), [recipe, sigil]);
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const isPaused = useCallback(() => pausedRef.current, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const texture = useMemo(() => renderCircleTexture(strokes, size), [strokes, size]);

  return (
    <div
      className="spell-fx"
      data-paused={paused}
      role="dialog"
      aria-label={`Заклинание «${recipe.name}» активировано`}
      style={{ "--fx-glow": fx?.glow ?? "#f2b84b", "--fx-plane-y": `${SPELL_PLANE.y * 100}%`, "--fx-plane-size": `${SPELL_PLANE.diameter * 100}%`, "--fx-plane-tilt": `${SPELL_PLANE.tilt}deg` } as CSSProperties}
    >
      <div className="fx-scene">
        <div className="fx-floor" aria-hidden="true" />
        <div className="fx-circle">
          <img
            className="fx-circle-plane"
            src={texture}
            alt=""
            aria-hidden="true"
            style={reduced ? { animation: "none", transform: "rotateX(var(--fx-plane-tilt))" } : undefined}
          />
        </div>
        {fx && <SpellEffects fx={fx} reduced={reduced} isPaused={isPaused} />}
        <div className="fx-caption">
          <span><Sparkles size={14} /> Активировано</span>
          <strong>{recipe.name}</strong>
          {sigil && <em>{sigil.name}</em>}
        </div>
      </div>
      {!reduced && <button type="button" className="fx-pause" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? "Продолжить" : "Пауза"}</button>}
      <button type="button" className="fx-done" onClick={onDone}><RotateCcw size={16} /> Нарисовать снова</button>
    </div>
  );
}
