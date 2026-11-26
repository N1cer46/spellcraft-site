import type * as Effekseer from "effekseer";
import { SPELL_PLANE } from "./spell-projection";
import type { SpellVfxPreset } from "./spell-vfx-presets";

type Runtime = typeof Effekseer;
declare global {
  interface Window {
    effekseer?: Runtime;
  }
}

const asset = (path: string) => `${import.meta.env.BASE_URL}vfx/${path}`;
let runtimePromise: Promise<Runtime> | undefined;

function loadRuntime(): Promise<Runtime> {
  return (runtimePromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(
      () => reject(new Error("VFX runtime timed out")),
      15000
    );
    const fail = () => {
      clearTimeout(timeout);
      reject(new Error("VFX runtime unavailable"));
    };
    script.src = asset("effekseer/effekseer.js");
    script.async = true;
    script.onerror = fail;
    script.onload = () => {
      const runtime = window.effekseer;
      if (!runtime) return fail();
      runtime.initRuntime(
        asset("effekseer/effekseer.wasm"),
        () => {
          clearTimeout(timeout);
          resolve(runtime);
        },
        fail
      );
    };
    document.head.appendChild(script);
  }));
}

type Options = {
  reduced: boolean;
  isPaused: () => boolean;
  onReady: () => void;
  onError: (error: unknown) => void;
};

/** Owns one activation scene; safe to dispose while the engine or textures load. */
export function startEffekseer(
  canvas: HTMLCanvasElement,
  preset: SpellVfxPreset,
  { reduced, isPaused, onReady, onError }: Options
): () => void {
  let disposed = false;
  let runtime: Runtime | undefined;
  let context: Effekseer.EffekseerContext | undefined;
  let effect: Effekseer.EffekseerEffect | undefined;
  let handles: Effekseer.EffekseerHandle[] = [];
  let gl: WebGLRenderingContext | null = null;
  let frame = 0;
  let last: number | undefined;
  let observer: ResizeObserver | undefined;
  let timeout: number | undefined;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(timeout);
    cancelAnimationFrame(frame);
    observer?.disconnect();
    canvas.removeEventListener("webglcontextlost", lost);
    handles.forEach(handle => handle.stop());
    if (context && runtime) {
      if (effect) context.releaseEffect(effect);
      runtime.releaseContext(context);
    }
  };
  const fail = (error: unknown) => {
    if (disposed) return;
    dispose();
    onError(error);
  };
  const lost = () => {
    fail(new Error("WebGL context lost"));
  };
  canvas.addEventListener("webglcontextlost", lost);

  const render = () => {
    if (!gl || !context) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const side = Math.min(w, h);
    gl.viewport(
      Math.round((w - side) / 2),
      Math.round((h - side) / 2),
      side,
      side
    );
    context.draw();
  };
  const play = () => {
    handles.forEach(handle => handle.stop());
    handles = Array.from({ length: preset.mirrorBelow ? 2 : 1 }, (_, index) => {
      const handle = context!.play(effect!, ...preset.location);
      handle.setScale(...preset.scale);
      handle.setRotation(
        preset.rotation[0] + index * Math.PI,
        preset.rotation[1],
        preset.rotation[2]
      );
      handle.setSpeed(preset.speed);
      // Start at a developed frame: the first visible frame already contains magic.
      handle.setFrame(preset.warmup);
      return handle;
    });
  };

  // The runtime can report an effect loaded even when its draw is empty.
  // Only hand off from Canvas after the first frame produces visible pixels.
  const hasVisibleFrame = () => {
    if (!gl || gl.isContextLost()) return false;
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
    const size = Math.min(width, height);
    const left = Math.floor((width - size) / 2);
    const bottom = Math.floor((height - size) / 2);
    const pixels = new Uint8Array(size * size * 4);
    gl.readPixels(left, bottom, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    // Additive emitters can contribute RGB without writing alpha.
    return pixels.some(value => value > 8);
  };
  const tick = (now: number) => {
    if (disposed) return;
    try {
      if (!isPaused() && !document.hidden) {
        if (!handles.some(handle => handle.exists)) play();
        if (last !== undefined)
          context!.update(Math.min((now - last) / 1000, 0.05) * 60);
      }
      last = now;
      render();
      frame = requestAnimationFrame(tick);
    } catch (error) {
      fail(error);
    }
  };

  void (async () => {
    try {
      runtime = await loadRuntime();
      if (disposed) return;
      gl = canvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: true,
        antialias: true,
      });
      if (!gl) throw new Error("WebGL unavailable");
      context = runtime.createContext();
      context.init(gl, {
        instanceMaxCount: 2000,
        squareMaxCount: 4000,
        enablePremultipliedAlpha: true,
      });
      // Match the orthographic camera used by the ink circle and procedural effects.
      const tilt = (SPELL_PLANE.tilt * Math.PI) / 180;
      context.setCameraLookAt(
        0,
        Math.cos(tilt) * 100,
        Math.sin(tilt) * 100,
        0,
        0,
        0,
        0,
        1,
        0
      );
      const span = 30;
      context.setProjectionMatrix(
        new Float32Array([
          2 / span,
          0,
          0,
          0,
          0,
          2 / span,
          0,
          0,
          0,
          0,
          -2 / 200,
          0,
          0,
          1 - 2 * SPELL_PLANE.y,
          0,
          1,
        ])
      );
      timeout = window.setTimeout(
        () => fail(new Error("VFX effect timed out")),
        12000
      );
      effect = context.loadEffect(
        asset(`effects/${preset.file}`),
        1,
        () => {
          // loadEffect can complete synchronously if it has no external resources.
          queueMicrotask(() => {
            if (disposed) return;
            try {
              clearTimeout(timeout);
              play();
              // Seeking sets the simulation time, but the first update is
              // needed to build draw data for the particles at that time.
              let visible = false;
              for (let i = 0; i < 4 && !visible; i++) {
                context!.update(1);
                render();
                visible = hasVisibleFrame();
              }
              if (!visible)
                throw new Error("WebGL produced an empty effect frame");
              observer = new ResizeObserver(() => {
                if (!disposed) render();
              });
              observer.observe(canvas);
              onReady();
              if (!reduced) frame = requestAnimationFrame(tick);
            } catch (error) {
              fail(error);
            }
          });
        },
        (reason, path) => fail(new Error(`${reason}: ${path}`))
      );
    } catch (error) {
      fail(error);
    }
  })();
  return dispose;
}
