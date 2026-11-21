/**
 * Design system: «Обсерватория линий» — canvas is the quiet ritual centre; ink is the primary UI.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { Check, CircleDot, Eraser, Undo2, Maximize2, Minimize2 } from "lucide-react";
import {
  byId,
  marks,
  sigils,
  symbolImage,
  type SpellRecipe,
  type SymbolDefinition,
} from "@/data/spellbook";
import {
  clusterStrokes,
  detectCircle,
  enclosureRatio,
  recognizeSymbol,
  ReferenceLoadError,
  zoneFor,
  type InkPoint,
  type InkStroke,
  type Recognition,
} from "@/lib/recognizer";
import { resolveSpell } from "@/lib/spell-engine";
import SpellAnimator from "./SpellAnimator";

type Props = {
  practiceKey?: number;
  learningTask?: "lesson" | "daily" | null;
  onSpellCast?: (recipe: SpellRecipe) => void;
  onSaveSpell?: (recipe: SpellRecipe) => void;
  savedSpellIds?: string[];
  savedSpells?: SpellRecipe[];
  selectedRecipe: SpellRecipe | null;
  onRecognitionChange: (recognitions: Recognition[]) => void;
  onActivationChange?: (active: boolean) => void;
};

// Keep ink coordinates stable when the viewport rotates or the browser UI resizes.
const size = { width: 720, height: 720 };

export default function SpellCanvas({
  selectedRecipe,
  onRecognitionChange,
  onActivationChange,
  onSaveSpell,
  savedSpellIds = [],
  savedSpells = [],
  practiceKey = 0,
  learningTask = null,
  onSpellCast,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [expandedTools, setExpandedTools] = useState(false);
  const shellRef = useRef<HTMLElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!expanded || !shell) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Isolate the sheet without moving/remounting the canvas or its ink.
    const background: { element: HTMLElement; inert: boolean }[] = [];
    for (let node: HTMLElement | null = shell; node?.parentElement; node = node.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling !== node && sibling instanceof HTMLElement) {
          background.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      if (node.parentElement === document.body) break;
    }
    const header = shell.querySelector<HTMLElement>(".canvas-head")!;
    const footer = shell.querySelector<HTMLElement>(".canvas-foot")!;
    const fitSheet = () => {
      const style = getComputedStyle(shell);
      const available = shell.clientHeight
        - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      shell.style.setProperty("--expanded-sheet-size", `${Math.max(160, available)}px`);
    };
    const observer = new ResizeObserver(fitSheet);
    [shell, header, footer].forEach(element => observer.observe(element));
    fitSheet();
    expandButtonRef.current?.focus({ preventScroll: true });
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setExpanded(false);
      } else if (event.key === "Tab") {
        const controls = Array.from(shell.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]'
        )).filter(element => element.getClientRects().length && !element.closest('[inert], [hidden]'));
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      background.forEach(({ element, inert }) => { element.inert = inert; });
      shell.style.removeProperty("--expanded-sheet-size");
      expandButtonRef.current?.focus({ preventScroll: true });
    };
  }, [expanded]);

  const [penWidth, setPenWidth] = useState(3);
  const widthRef = useRef(3);
  widthRef.current = penWidth;
  const [eraser, setEraser] = useState(false);
  const [volume, setVolume] = useState(0);
  const volumeRef = useRef(0);
  volumeRef.current = volume;
  const audioRef = useRef<AudioContext | null>(null);
  const redoRef = useRef<
    { strokes: InkStroke[]; readings: Recognition[]; circles: string[] }[]
  >([]);
  const sound = (activation = false, material = "") => {
    if (!volumeRef.current) return;
    try {
      const audio = audioRef.current ?? (audioRef.current = new AudioContext());
      void audio.resume();
      const oscillator = audio.createOscillator(),
        gain = audio.createGain();
      const pitch = material.includes("fire")
        ? 110
        : material.includes("water")
          ? 420
          : material.includes("wind")
            ? 720
            : material.includes("earth")
              ? 80
              : material.includes("flower")
                ? 550
                : 330;
      oscillator.type = activation
        ? material.includes("fire")
          ? "sawtooth"
          : material.includes("earth")
            ? "triangle"
            : "sine"
        : "triangle";
      oscillator.frequency.setValueAtTime(
        activation ? pitch : 1800,
        audio.currentTime
      );
      oscillator.frequency.exponentialRampToValueAtTime(
        activation ? pitch * 1.5 : 700,
        audio.currentTime + 0.15
      );
      gain.gain.setValueAtTime(
        volumeRef.current * (activation ? 0.15 : 0.025),
        audio.currentTime
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audio.currentTime + (activation ? 0.8 : 0.12)
      );
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 1);
    } catch {}
  };
  useEffect(
    () => () => {
      void audioRef.current?.close();
    },
    []
  );
  const castCallback = useRef(onSpellCast);
  castCallback.current = onSpellCast;
  const savedSpellsRef = useRef(savedSpells);
  savedSpellsRef.current = savedSpells;
  const [customName, setCustomName] = useState("");
  const [saveError, setSaveError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  // Synchronous mirrors of the pointer/stroke state: the pointer handlers must never rely on
  // React state (stale closures + a pending rAF are exactly what let a stroke keep drawing
  // after the mouse button has been released).
  const activeRef = useRef<InkPoint[]>([]);
  const strokesRef = useRef<InkStroke[]>([]);
  const recognitionsRef = useRef<Recognition[]>([]);
  const revisionRef = useRef(0);
  const recognitionTaskRef = useRef<Promise<void>>(Promise.resolve());
  const circleIdsRef = useRef(new Set<string>());
  const touchIdRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  // IDs only identify strokes on this canvas; plain-HTTP LAN previews have no randomUUID.
  const strokeSequenceRef = useRef(0);
  const onRecognitionChangeRef = useRef(onRecognitionChange);
  const finalizeRef = useRef<() => void>(() => {});
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [activePoints, setActivePoints] = useState<InkPoint[]>([]);
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [message, setMessage] = useState("Впишите сигил в центральное поле.");
  const [isProcessing, setIsProcessing] = useState(false);
  const [spellResult, setSpellResult] = useState<{
    recipe: SpellRecipe | null;
    sigilId?: string;
  } | null>(null);
  const [pendingChoice, setPendingChoice] = useState<{
    zone: "center" | "ring";
    clusterIds: string[];
    choices: { candidate: SymbolDefinition; score: number }[];
  } | null>(null);

  useEffect(() => {
    onActivationChange?.(Boolean(spellResult?.recipe));
  }, [spellResult, onActivationChange]);

  const visualState = useMemo(() => {
    if (spellResult?.recipe)
      return { label: "Заклинание активно", tone: "active" };
    if (recognitions.some(recognition => recognition.zone === "center"))
      return { label: "Добавьте знаки", tone: "ready" };
    return { label: "Рисуется сигил", tone: "idle" };
  }, [recognitions, spellResult]);

  const redraw = useCallback(
    (completed: InkStroke[], current: InkPoint[] = []) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      context.setTransform(
        canvas.width / size.width,
        0,
        0,
        canvas.height / size.height,
        0,
        0
      );
      context.clearRect(0, 0, size.width, size.height);
      const drawPath = (points: InkPoint[], active = false) => {
        if (points.length < 2) return;
        context.beginPath();
        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = active ? "#234f43" : "#293e34";
        context.shadowColor = active ? "rgba(52, 82, 57, .15)" : "transparent";
        context.shadowBlur = active ? 2 : 0;
        context.lineWidth = widthRef.current;
        context.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(point => context.lineTo(point.x, point.y));
        context.stroke();
      };
      completed.forEach(stroke => drawPath(stroke.points));
      drawPath(current, true);
    },
    []
  );

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);
  useEffect(() => {
    recognitionsRef.current = recognitions;
  }, [recognitions]);
  useEffect(() => {
    onRecognitionChangeRef.current = onRecognitionChange;
  });

  useEffect(() => {
    redraw(strokes, activePoints);
  }, [activePoints, redraw, strokes, penWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() =>
      redraw(strokesRef.current, activeRef.current)
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  const updateStrokes = (next: InkStroke[]) => {
    strokesRef.current = next;
    setStrokes(next);
  };
  const updateRecognitions = (next: Recognition[]) => {
    recognitionsRef.current = next;
    setRecognitions(next);
    onRecognitionChangeRef.current(next);
  };

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * size.width) / rect.width,
      y: ((event.clientY - rect.top) * size.height) / rect.height,
      t: performance.now(),
    };
  };

  /** Ends the current stroke and runs recognition. Safe to call from any path (canvas pointerup, a
   *  pointermove with the button already released, leaving the canvas without capture, window-level
   *  pointerup/blur) — it reads only synchronous refs, never React state. */
  const finalizeStroke = useCallback(async () => {
    const points = activeRef.current;
    activeRef.current = [];
    touchIdRef.current = null;
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (pointerIdRef.current !== null) {
      try {
        canvasRef.current?.releasePointerCapture(pointerIdRef.current);
      } catch {
        /* capture was lost or synthetic pointer */
      }
      pointerIdRef.current = null;
    }
    setActivePoints([]);
    if (points.length < 2) return;

    const completed: InkStroke = {
      id: `stroke-${++strokeSequenceRef.current}`,
      points,
      finishedAt: Date.now(),
    };
    const currentStrokes = [...strokesRef.current, completed];
    updateStrokes(currentStrokes);

    const { width, height } = size;
    const otherInk = currentStrokes.filter(
      stroke =>
        stroke.id !== completed.id && !circleIdsRef.current.has(stroke.id)
    );
    const circle = detectCircle(completed, otherInk, width, height);
    if (circle.isCircle) {
      circleIdsRef.current.add(completed.id);
      const revision = revisionRef.current;
      await recognitionTaskRef.current;
      if (revision !== revisionRef.current) return;
      const resolution = resolveSpell(recognitionsRef.current, currentStrokes);
      if (resolution.recipe) {
        resolution.recipe =
          savedSpellsRef.current.find(
            recipe => recipe.id === resolution.recipe!.id
          ) ?? resolution.recipe;
        sound(true, resolution.recipe.sigilId);
        castCallback.current?.(resolution.recipe);
        setCustomName(resolution.recipe.name);
        setSpellResult({
          recipe: resolution.recipe,
          sigilId: resolution.sigilId,
        });
        setMessage(`Контур замкнут. «${resolution.recipe.name}» активировано.`);
      } else {
        setMessage(
          resolution.error ??
            "Контур замкнут, но сигил не распознан. Нарисуйте узнаваемый сигил в центре."
        );
      }
      return;
    }

    // A big round loop that failed the circle test is a closing attempt: tell the user and don't
    // commit it, so the failed loop can't pollute the composition or future circle checks.
    const minDim = Math.min(width, height);
    const closingAttempt =
      otherInk.length > 0 &&
      circle.metrics !== null &&
      circle.metrics.span >= minDim * 0.34 &&
      ((circle.metrics.deviation < 0.4 && circle.metrics.aspect > 0.5) ||
        enclosureRatio(completed, otherInk) >= 0.8);
    if (closingAttempt) {
      circleIdsRef.current.add(completed.id);
      const revision = revisionRef.current;
      await recognitionTaskRef.current;
      if (revision !== revisionRef.current) return;
      setIsProcessing(false);
      setMessage(
        "Круг не замкнут: обведите композицию плавным кругом, охватывающим сигил и знаки целиком."
      );
      return;
    }

    const revision = revisionRef.current;
    setIsProcessing(true);
    const task = recognitionTaskRef.current.then(async () => {
      if (revision !== revisionRef.current) return;
      try {
        const zone = zoneFor(completed, width, height);
        const candidates = zone === "center" ? sigils : marks;
        const threshold = zone === "center" ? 0.68 : 0.66;
        // Readings stay provisional: nearby strokes can complete a symbol after an early match.
        const symbolStrokes = currentStrokes.filter(
          stroke => !circleIdsRef.current.has(stroke.id)
        );
        const clusterIds = clusterStrokes(symbolStrokes, width, height).find(
          group => group.strokeIds.includes(completed.id)
        )?.strokeIds ?? [completed.id];
        const cluster = currentStrokes.filter(stroke =>
          clusterIds.includes(stroke.id)
        );
        const result = await recognizeSymbol(cluster, candidates);
        if (revision !== revisionRef.current || !result) return;
        const symbol = result.candidate;

        const dropStale = () => {
          const next = recognitionsRef.current.filter(
            item => !item.strokeIds.some(id => clusterIds.includes(id))
          );
          if (next.length !== recognitionsRef.current.length)
            updateRecognitions(next);
        };

        const midAssembly = result.coverage < 0.86;

        if (result.score >= threshold && !midAssembly) {
          // Ambiguity check over the top-3: every candidate scoring above the threshold and close
          // to the leader (≤ 0.08) becomes a chip — after the template set grew, near-ties can be
          // three-way (arrow-mark families), not just pairwise.
          const contenders = [
            { candidate: symbol, score: result.score },
            ...result.runnerUps,
          ].filter(
            entry =>
              entry.score >= threshold && result.score - entry.score < 0.08
          );
          if (contenders.length > 1) {
            // The cluster's strokes changed, so any previously recognized symbol built from them is stale.
            dropStale();
            setPendingChoice({ zone, clusterIds, choices: contenders });
            setMessage(
              contenders.length > 2
                ? "Символ неоднозначен — выберите верный эталон:"
                : "Символ двоится — выберите верный эталон:"
            );
            return;
          }
          setPendingChoice(null);
          const recognition: Recognition = {
            symbolId: symbol.id,
            score: result.score,
            strokeIds: clusterIds,
            zone,
          };
          updateRecognitions([
            ...recognitionsRef.current.filter(
              item => !item.strokeIds.some(id => clusterIds.includes(id))
            ),
            recognition,
          ]);
          const parts = cluster.length > 1 ? ` (${cluster.length} штриха)` : "";
          setMessage(
            `${zone === "center" ? "Сигил" : "Знак"} распознан${parts}: ${symbol.name} — ${Math.round(result.score * 100)}%.`
          );
          return;
        }

        dropStale();
        setPendingChoice(null);
        setMessage(
          result.score >= threshold
            ? `Форма пока неполная: ближе всего «${symbol.name}». Дорисуйте недостающие части.`
            : `Ближе всего: «${symbol.name}» — ${Math.round(result.score * 100)}%. Уточните форму: сличите с изображением в гримуаре или дорисуйте символ несколькими штрихами.`
        );
      } catch (error) {
        if (revision !== revisionRef.current) return;
        setMessage(
          error instanceof ReferenceLoadError
            ? "Эталоны не записаны: набор эталонов пуст."
            : "Сверка не удалась. Попробуйте нарисовать символ ещё раз."
        );
      } finally {
        if (
          revision === revisionRef.current &&
          recognitionTaskRef.current === task
        )
          setIsProcessing(false);
      }
    });
    recognitionTaskRef.current = task;
    await task;
  }, []);

  useEffect(() => {
    finalizeRef.current = () => {
      finalizeStroke();
    };
    // Safety net: if the pointerup is never delivered to the canvas (pointer left the window,
    // capture was lost, alt-tab while dragging), end the stroke at the window level so it can't
    // keep drawing on later moves. No-op whenever no stroke is in flight.
    const onWindowRelease = (event: Event) => {
      if ("pointerId" in event && event.pointerId !== pointerIdRef.current)
        return;
      if (touchIdRef.current !== null && (event.type === "pointerup" || event.type === "pointercancel")) return;
      finalizeRef.current();
    };
    window.addEventListener("pointerup", onWindowRelease);
    window.addEventListener("pointercancel", onWindowRelease);
    window.addEventListener("blur", onWindowRelease);
    return () => {
      revisionRef.current += 1;
      window.removeEventListener("pointerup", onWindowRelease);
      window.removeEventListener("pointercancel", onWindowRelease);
      window.removeEventListener("blur", onWindowRelease);
    };
  }, [finalizeStroke]);

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (spellResult?.recipe || pointerIdRef.current !== null) return;
    // Only the primary button starts a stroke; right-click must not draw.
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (eraser) {
      const point = pointFromEvent(event);
      const hit = strokesRef.current
        .slice()
        .reverse()
        .find(stroke =>
          stroke.points.some(p => Math.hypot(p.x - point.x, p.y - point.y) < 18)
        );
      if (hit) {
        redoRef.current.push({
          strokes: [...strokesRef.current],
          readings: [...recognitionsRef.current],
          circles: Array.from(circleIdsRef.current),
        });
        revisionRef.current++;
        setIsProcessing(false);
        setPendingChoice(null);
        circleIdsRef.current.delete(hit.id);
        updateStrokes(strokesRef.current.filter(s => s.id !== hit.id));
        updateRecognitions(
          recognitionsRef.current.filter(r => !r.strokeIds.includes(hit.id))
        );
      }
      return;
    }
    redoRef.current = [];
    sound();
    // A fresh stroke invalidates any pending «which of the two» choice from an earlier drawing.
    if (pendingChoice) setPendingChoice(null);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* unsupported in synthetic events */
    }
    pointerIdRef.current = event.pointerId;
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    activeRef.current = [pointFromEvent(event)];
    setActivePoints(activeRef.current);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (touchIdRef.current !== null) return;
    if (!activeRef.current.length || event.pointerId !== pointerIdRef.current)
      return;
    // This move can arrive after the button was already released (release outside the window,
    // or a stale queued move). Drawing must stop the moment the primary button is up.
    if (event.pointerType === "mouse" && (event.buttons & 1) === 0) {
      finalizeStroke();
      return;
    }
    activeRef.current = [...activeRef.current, pointFromEvent(event)];
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setActivePoints([...activeRef.current]);
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (touchIdRef.current !== null) return;
    if (event.pointerId !== pointerIdRef.current) return;
    // Touch release coordinates may be extrapolated by the device after contact ends.
    // Commit the last contact sample instead of drawing a synthetic release tail.
    if (event.pointerType === "mouse") {
      activeRef.current = [...activeRef.current, pointFromEvent(event)];
    }
    return finalizeStroke();
  };

  // Use contact coordinates on touch screens, not the OS-smoothed pointer stream.
  const onTouchStart = (event: ReactTouchEvent<HTMLCanvasElement>) => {
    if (eraser || spellResult?.recipe || touchIdRef.current !== null) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    touchIdRef.current = touch.identifier;
    const point = pointFromEvent({ clientX: touch.clientX, clientY: touch.clientY, currentTarget: event.currentTarget } as ReactPointerEvent<HTMLCanvasElement>);
    activeRef.current = [point];
    setActivePoints([point]);
  };
  const onTouchMove = (event: ReactTouchEvent<HTMLCanvasElement>) => {
    const touch = Array.from(event.changedTouches).find(t => t.identifier === touchIdRef.current);
    if (!touch) return;
    activeRef.current = [...activeRef.current, pointFromEvent({ clientX: touch.clientX, clientY: touch.clientY, currentTarget: event.currentTarget } as ReactPointerEvent<HTMLCanvasElement>)];
    if (!frameRef.current) frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setActivePoints([...activeRef.current]);
    });
  };
  const onTouchEnd = (event: ReactTouchEvent<HTMLCanvasElement>) => {
    if (!Array.from(event.changedTouches).some(t => t.identifier === touchIdRef.current)) return;
    touchIdRef.current = null;
    return finalizeStroke();
  };

  const onPointerLeave = () => {
    if (touchIdRef.current !== null) return;
    if (!activeRef.current.length) return;
    // With capture in place pointerleave is suppressed until release; it firing with an active
    // stroke means capture was lost — commit the drag instead of leaving a ghost stroke.
    let captured = false;
    try {
      captured =
        pointerIdRef.current !== null &&
        Boolean(canvasRef.current?.hasPointerCapture(pointerIdRef.current));
    } catch {
      /* noop */
    }
    if (!captured) finalizeStroke();
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (touchIdRef.current !== null) return;
    if (event.pointerId !== pointerIdRef.current) return;
    return finalizeStroke();
  };

  // Explicit undo/reset may discard ink; browser cancellation must preserve it.
  const discardActiveStroke = () => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    activeRef.current = [];
    pointerIdRef.current = null;
    setActivePoints([]);
  };

  const commitChoice = (candidate: SymbolDefinition, score: number) => {
    if (!pendingChoice) return;
    const recognition: Recognition = {
      symbolId: candidate.id,
      score,
      strokeIds: pendingChoice.clusterIds,
      zone: pendingChoice.zone,
    };
    updateRecognitions([
      ...recognitionsRef.current.filter(
        item =>
          !item.strokeIds.some(id => pendingChoice.clusterIds.includes(id))
      ),
      recognition,
    ]);
    setPendingChoice(null);
    setMessage(
      `${pendingChoice.zone === "center" ? "Сигил" : "Знак"} подтверждён: ${candidate.name} — ${Math.round(score * 100)}%.`
    );
  };

  const undo = () => {
    revisionRef.current += 1;
    setIsProcessing(false);
    discardActiveStroke();
    const removed = strokesRef.current.at(-1);
    if (!removed) return;
    redoRef.current.push({
      strokes: [...strokesRef.current],
      readings: [...recognitionsRef.current],
      circles: Array.from(circleIdsRef.current),
    });
    circleIdsRef.current.delete(removed.id);
    updateStrokes(strokesRef.current.slice(0, -1));
    updateRecognitions(
      recognitionsRef.current.filter(
        item => !item.strokeIds.includes(removed.id)
      )
    );
    setPendingChoice(null);
    setSpellResult(null);
    setSaveError("");
    setMessage("Последний штрих снят с листа.");
  };

  const redo = () => {
    const snapshot = redoRef.current.pop();
    if (!snapshot) return;
    revisionRef.current++;
    discardActiveStroke();
    setIsProcessing(false);
    setPendingChoice(null);
    circleIdsRef.current = new Set(snapshot.circles);
    updateStrokes(snapshot.strokes);
    updateRecognitions(snapshot.readings);
    setSpellResult(null);
  };
  const reset = () => {
    redoRef.current = [];
    revisionRef.current += 1;
    circleIdsRef.current.clear();
    setIsProcessing(false);
    updateStrokes([]);
    discardActiveStroke();
    updateRecognitions([]);
    setSpellResult(null);
    setSaveError("");
    setPendingChoice(null);
    setMessage("Чистый лист готов. Начните с сигила в центре.");
  };

  useEffect(() => {
    if (practiceKey) reset();
  }, [practiceKey]);

  /** Guides drawn under the user's ink: the full formula of a picked spell (sigil in the centre, required marks distributed around the ring). */
  const guides = useMemo(() => {
    if (spellResult?.recipe) return [];
    if (selectedRecipe) {
      const guideIds = [...selectedRecipe.requiredMarkIds];
      while (guideIds.length > 0 && guideIds.length < 4)
        guideIds.push(
          guideIds[guideIds.length % selectedRecipe.requiredMarkIds.length]
        );
      const markSymbols = guideIds
        .map(byId)
        .filter((symbol): symbol is SymbolDefinition => Boolean(symbol));
      const sigilSymbol = byId(selectedRecipe.sigilId);
      const formula: { symbol: SymbolDefinition; angle: number }[] = [];
      if (sigilSymbol) formula.push({ symbol: sigilSymbol, angle: 0 });
      markSymbols.forEach((symbol, index) =>
        formula.push({
          symbol,
          angle:
            index < 4
              ? -90 + 90 * index
              : -45 + (360 * (index - 4)) / Math.max(1, markSymbols.length - 4),
        })
      );
      return formula;
    }
    return [];
  }, [selectedRecipe, spellResult]);
  return (
    <section ref={shellRef} className="canvas-shell" data-expanded={expanded} data-tools-open={expandedTools}
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded ? true : undefined}
      aria-label={expanded ? "Лист практики на весь экран" : undefined}>
      <div className="canvas-head">
        <div>
          <p className="eyebrow">
            <span className={`state-dot ${visualState.tone}`} /> Лист практики
          </p>
          <h1>{visualState.label}</h1>
        </div>
        <div className="canvas-tools" aria-label="Действия с холстом">
          <button ref={expandButtonRef} type="button" className="tool-button canvas-expand"
            aria-pressed={expanded}
            aria-label={expanded ? "Свернуть лист" : "Развернуть лист на весь экран"}
            title={expanded ? "Свернуть лист (Escape)" : "Развернуть лист на весь экран"}
            onClick={() => { setExpanded(value => !value); setExpandedTools(false); }}>
            {expanded ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
            <span>{expanded ? "Свернуть" : "На весь экран"}</span>
          </button>
{expanded && <>
            <button type="button" className="tool-button" onClick={undo}
              disabled={!strokes.length} aria-label="Отменить последний штрих" title="Отменить последний штрих">
              <Undo2 size={16} aria-hidden="true" />
            </button>
            <button type="button" className="tool-button" aria-expanded={expandedTools}
              onClick={() => setExpandedTools(value => !value)}>
              {expandedTools ? "Скрыть инструменты" : "Инструменты"}
            </button>
          </>}
<div className="tool-group" role="group" aria-label="История рисунка">          <button
            type="button"
            onClick={undo}
            aria-label="Отменить последний штрих"
            title="Отменить последний штрих"
            className="tool-button"
            disabled={!strokes.length}
          >
            <Undo2 size={16} />
            <span className="tool-label">Отменить</span>
          </button>
          <button
            className="tool-button"
            onClick={redo}
            disabled={!redoRef.current.length}
          >
            Вернуть
          </button>
</div><div className="tool-group" role="group" aria-label="Перо и ластик">          <button
            className="tool-button"
            aria-pressed={eraser}
            onClick={() => setEraser(!eraser)}
          >
            {eraser ? "Включить перо" : "Ластик штриха"}
          </button>
          <label>
            Толщина {penWidth}{" "}
            <input
              aria-label="Толщина пера"
              type="range"
              min="1"
              max="7"
              value={penWidth}
              onChange={e => setPenWidth(Number(e.target.value))}
            />
          </label>
          </div><div className="tool-group">
          <label>
            Громкость {Math.round(volume * 100)}%{" "}
            <input
              aria-label="Громкость"
              type="range"
              min="0"
              max="1"
              step=".05"
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            onClick={reset}
            aria-label="Стереть всё"
            title="Стереть всё"
            className="tool-button"
          >
            <Eraser size={16} />
            <span className="tool-label">Стереть всё</span>
          </button>
        </div></div>
      </div>
      <div className="canvas-stage" data-active={Boolean(spellResult?.recipe)}>
        <div className="orbital-grid" aria-hidden="true" />
        <div className="axis axis-x" aria-hidden="true" />
        <div className="axis axis-y" aria-hidden="true" />
        <div className="central-zone" aria-hidden="true">
          <span>ядро</span>
        </div>
        {guides.map(({ symbol, angle }, guideIndex) =>
          symbol.kind === "sigil" ? (
            <img
              key={symbol.id + guideIndex}
              className="guide-symbol"
              src={symbolImage(symbol)}
              alt=""
              aria-hidden="true"
            />
          ) : (
            <img
              key={symbol.id + guideIndex}
              className="guide-symbol mark"
              src={symbolImage(symbol)}
              alt=""
              aria-hidden="true"
              style={{
                left: `${50 + 26 * Math.cos((angle * Math.PI) / 180)}%`,
                top: `${50 + 26 * Math.sin((angle * Math.PI) / 180)}%`,
              }}
            />
          )
        )}
        {spellResult?.recipe && (
          <SpellAnimator
            recipe={spellResult.recipe}
            sigilId={spellResult.sigilId ?? spellResult.recipe.sigilId}
            strokes={strokes}
            size={size}
            onDone={reset}
          />
        )}
        <canvas
          tabIndex={-1}
          className="drawing-canvas"
          style={{ visibility: spellResult?.recipe ? "hidden" : "visible" }}
          aria-hidden={Boolean(spellResult?.recipe)}
          ref={canvasRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={onPointerCancel}
          aria-label="Холст для рисования заклинания"
        />
        <div className="stage-caption left">
          <CircleDot size={14} /> Центр: сигил
        </div>
        <div className="stage-caption right">
          Кольцо: знаки <Check size={14} />
        </div>
      </div>
      {spellResult?.recipe?.custom && (
        <div className="fx-discovery">
          <strong>Новая формула</strong>
          <p>{spellResult.recipe.description}</p>
          <label className="spell-name-label">
            Название заклинания
            <input
              maxLength={80}
              value={customName}
              disabled={savedSpellIds.includes(spellResult.recipe.id)}
              onChange={event => setCustomName(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={
              !customName.trim() ||
              savedSpellIds.includes(spellResult.recipe.id) ||
              !onSaveSpell
            }
            onClick={() => {
              try {
                onSaveSpell?.({ ...spellResult.recipe!, name: customName });
                setSaveError("");
              } catch (error) {
                setSaveError(
                  error instanceof Error
                    ? error.message
                    : "Не удалось сохранить. Попробуйте ещё раз."
                );
              }
            }}
          >
            {savedSpellIds.includes(spellResult.recipe.id)
              ? "Сохранено в гримуаре"
              : "Сохранить в личный гримуар"}
          </button>
          <small>
            Только в этом браузере. Очистка данных сайта удалит коллекцию.
          </small>
          {saveError && <p role="alert">{saveError}</p>}
        </div>
      )}
      <div className="canvas-foot">
        {learningTask && (
          <a className="learning-return" href="#/learning">
            {learningTask === "daily" ? "Вернуться к заданию дня" : "Вернуться к заданию и проверить попытку ↓"}
          </a>
        )}
        <div className="message-line" role="status" aria-live="polite">
          <span className={isProcessing ? "loading-pulse" : "message-sigil"} />
          {isProcessing ? "Сверяю геометрию штриха…" : message}
          {pendingChoice && (
            <span className="choice-row">
              {pendingChoice.choices.map(({ candidate, score }) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="choice-chip"
                  onClick={() => commitChoice(candidate, score)}
                >
                  {candidate.name} · {Math.round(score * 100)}%
                </button>
              ))}
            </span>
          )}
        </div>
        <div className="guide-line">
          {guides.length ? (
            <>
              Подложка:{" "}
              {guides.map(({ symbol }, index) => (
                <span key={symbol.id + index}>
                  {index > 0 && " · "}
                  <strong>{symbol.name}</strong>
                </span>
              ))}
            </>
          ) : (
            "Нажмите «Разместить шаблон» у заклинания в гримуаре."
          )}
        </div>
      </div>
    </section>
  );
}
