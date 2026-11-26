import { useEffect, useRef, useState } from "react";
import { startEffekseer } from "@/lib/effekseer-player";
import { startSpellFx, type SpellFx } from "@/lib/spell-fx";
import { getSpellVfxPreset } from "@/lib/spell-vfx-presets";

export default function SpellEffects({
  fx,
  reduced,
  isPaused,
}: {
  fx: SpellFx;
  reduced: boolean;
  isPaused: () => boolean;
}) {
  const fallbackRef = useRef<HTMLCanvasElement>(null);
  const webglRef = useRef<HTMLCanvasElement>(null);
  const [renderer, setRenderer] = useState("canvas");
  const preset = getSpellVfxPreset(fx);

  useEffect(() => {
    const fallback = fallbackRef.current!,
      webgl = webglRef.current!;
    let stopFallback = startSpellFx(fallback, fx, reduced, isPaused);
    let alive = true;
    setRenderer("canvas");
    const preset = getSpellVfxPreset(fx);
    const stopWebgl = preset
      ? startEffekseer(webgl, preset, {
          reduced,
          isPaused,
          onReady: () => {
            if (alive) {
              stopFallback();
              setRenderer("effekseer");
            }
          },
          onError: error => {
            if (!alive) return;
            console.warn("Spell VFX: using procedural fallback", error);
            stopFallback();
            stopFallback = startSpellFx(fallback, fx, reduced, isPaused);
            setRenderer("canvas");
          },
        })
      : () => {};
    return () => {
      alive = false;
      stopFallback();
      stopWebgl();
    };
  }, [fx, reduced, isPaused]);

  return (
    <div className="fx-renderer" data-renderer={renderer} aria-hidden="true">
      <canvas className="fx-particles fx-fallback" ref={fallbackRef} />
      <canvas
        key={`${fx.id}:${reduced}`}
        className="fx-particles fx-webgl"
        ref={webglRef}
        style={{ filter: preset?.filter }}
      />
    </div>
  );
}
