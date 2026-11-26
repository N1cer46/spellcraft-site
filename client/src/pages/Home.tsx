import { gsap } from "gsap";
/**
 * Design system: an apprentice’s illustrated grimoire, paper and forest-green binding.
 */
import { useEffect, useRef, useState } from "react";
import { Feather, Info, Sparkles } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import AtelierProfile from "@/components/AtelierProfile";
import type { DrawingPreferences } from "@/lib/mastery-rewards";
import LearningPanel from "@/components/LearningPanel";
import GrimoireEntry from "@/components/GrimoireEntry";
import Grimoire from "@/components/Grimoire";
import SpellCanvas from "@/components/SpellCanvas";
import {
  byId,
  symbolImage,
  type SpellRecipe,
  type SymbolDefinition,
} from "@/data/spellbook";
import {
  loadPersonalSpells,
  savePersonalSpell,
  deletePersonalSpell,
  renamePersonalSpell,
} from "@/lib/personal-grimoire";
import type { Progress } from "@/lib/learning";
import type { Recognition } from "@/lib/recognizer";

export default function Home() {
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap.from(".atelier-intro > div", { y: 10, duration: .32, stagger: .06, ease: "power3.out" });
        gsap.set(".atelier-illustration svg > path:nth-of-type(4)", { strokeDasharray: 600 });
        gsap.from(".atelier-illustration svg > path:nth-of-type(4)", { strokeDashoffset: 600, duration: .38, ease: "power3.out" });
      });
      return () => context.revert();
    });
    return () => media.revert();
  }, []);
  const [page, setPage] = useState("practice");
  useEffect(() => {
    const sync = () => {
      setEntryOpen(false);
      const key = location.hash.replace(/^#\//, "");
      setPage(
        ["practice", "grimoire", "learning", "collection"].includes(key)
          ? key
          : "practice"
      );
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    if (page !== "learning") return;
    document.getElementById("learning-title")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [page]);
  const navigate = (key: string) => {
    setPage(key);
    location.hash = "/" + key;
  };
  const [learningProgress, setLearningProgress] = useState<Progress>();
  const [drawingPreferences, setDrawingPreferences] = useState<DrawingPreferences>();
  const [practiceKey, setPracticeKey] = useState(0);
  const [learningTask, setLearningTask] = useState<{ kind: "lesson" | "daily"; recipeId?: string; symbol?: SymbolDefinition } | null>(null);
  const [lastCast, setLastCast] = useState<{
    recipe: SpellRecipe;
    at: number;
    serial: number;
  } | null>(null);
  const castSerial = useRef(0);
  const [personalSpells, setPersonalSpells] = useState<SpellRecipe[]>([]);
  const [libraryError, setLibraryError] = useState("");
  useEffect(() => {
    const refresh = () => {
      try {
        setPersonalSpells(loadPersonalSpells(window.localStorage));
        setLibraryError("");
      } catch {
        setLibraryError(
          "Не удалось прочитать личный гримуар. Сохранённые данные не изменены."
        );
      }
    };
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  const saveSpell = (recipe: SpellRecipe) => {
    try {
      setPersonalSpells(savePersonalSpell(window.localStorage, recipe));
      setLibraryError("");
    } catch (error) {
      throw new Error(
        "Не удалось сохранить заклинание. Проверьте доступ к хранилищу браузера. " +
          (error instanceof Error ? error.message : "")
      );
    }
  };
  const deleteSpell = (id: string) => {
    try {
      setPersonalSpells(deletePersonalSpell(window.localStorage, id));
      if (selectedRecipe?.id === id) {
        setEntryOpen(false);
        setSelectedRecipe(null);
      }
      if (practiceRecipe?.id === id) setPracticeRecipe(null);
      setLibraryError("");
    } catch {
      setLibraryError("Не удалось удалить формулу. Коллекция не изменена.");
    }
  };
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolDefinition | null>(
    null
  );
  const [selectedRecipe, setSelectedRecipe] = useState<SpellRecipe | null>(
    null
  );
  const [practiceRecipe, setPracticeRecipe] = useState<SpellRecipe | null>(
    null
  );
  const [entryOpen, setEntryOpen] = useState(false);
  const deskRef = useRef<HTMLElement>(null);
  const openSymbol = (symbol: SymbolDefinition | null) => {
    setSelectedSymbol(symbol);
    if (symbol) {
      setSelectedRecipe(null);
      setEntryOpen(true);
    }
  };
  const openRecipe = (recipe: SpellRecipe | null) => {
    setSelectedRecipe(recipe);
    if (recipe) {
      setSelectedSymbol(null);
      setEntryOpen(true);
    }
  };
  const backToDrawing = () => {
    navigate("practice");
    setEntryOpen(false);
    requestAnimationFrame(() => {
      const canvas =
        deskRef.current?.querySelector<HTMLCanvasElement>(".drawing-canvas");
      const target =
        canvas?.getAttribute("aria-hidden") === "true"
          ? deskRef.current?.querySelector<HTMLButtonElement>(".fx-done")
          : canvas;
      target?.focus({ preventScroll: true });
      deskRef.current
        ?.querySelector(".canvas-shell")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  };
  const [active, setActive] = useState(false);
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const recognizedSymbols = recognitions
    .map(recognition => ({ recognition, symbol: byId(recognition.symbolId) }))
    .filter(item => item.symbol);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img src={`${import.meta.env.BASE_URL}atelier-emblem.svg`} alt="" />
          <div>
            <span>SpellCraft</span>
            <small>ателье рисованной магии</small>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="topbar-note">
            <Feather size={15} /> Перо · чернила · немного волшебства
          </div>
          <ThemeToggle />
          <AtelierProfile onApply={setDrawingPreferences} progress={learningProgress} />
        </div>
      </header>
      <nav className="site-tabs" aria-label="Разделы сайта">
        {[
          ["practice", "Практика"],
          ["grimoire", "Гримуар"],
          ["learning", "Обучение"],
          ["collection", "Моя коллекция"],
        ].map(([key, label]) => (
          <a
            key={key}
            href={"#/" + key}
            aria-current={page === key ? "page" : undefined}
          >
            {label}
          </a>
        ))}
      </nav>
      <section
        hidden={page !== "practice"}
        className="atelier-intro"
        aria-labelledby="atelier-title"
      >
        <div>
          <p className="eyebrow">Вдохновлено «Ателье колдовских колпаков»</p>
          <h1 id="atelier-title">
            Волшебство начинается
            <br />с <em>одной линии.</em>
          </h1>
          <p className="intro-copy">
            Откройте гримуар. Выберите глиф и указатели. Замкните круг —
            <br className="desktop-break" /> и позвольте чернилам ожить.
          </p>
        </div>
        <div className="atelier-illustration" aria-hidden="true">
          <svg viewBox="0 20 380 180" fill="none">
            <circle cx="200" cy="110" r="85" />
            <circle cx="200" cy="110" r="72" strokeDasharray="2 7" />
            <path
              d="M48 161Q117 132 192 158Q267 131 335 155L330 186Q266 164 192 187Q115 163 50 188Z"
              fill="#ece2c9"
            />
            <path d="M192 158V187M60 157Q120 137 180 158M205 158Q268 141 322 156M63 168Q120 151 178 169M208 169Q262 155 317 169" />
            <path
              d="M185 162Q210 95 292 24Q293 80 228 121L213 123 210 139Z"
              fill="#31584a"
            />
            <path
              d="M185 162 277 44M218 116 253 106M232 97 263 84M244 80 271 64"
              stroke="#e9dfbf"
            />
            <path d="M110 147V123L117 114H143L150 123V147Z" fill="#31584a" />
            <path d="M120 110V101H140V110M119 131H142" />
            <path d="M63 130Q35 100 55 63M53 111Q23 106 32 88Q50 90 53 111M50 93Q72 80 70 63Q47 67 50 93M55 73Q38 57 47 43M322 134Q349 109 338 79M339 113Q366 106 359 88Q339 94 339 113M341 95Q320 91 319 73Q339 77 341 95" />
            <path d="m110 43 4 11 11 4-11 4-4 11-4-11-11-4 11-4ZM314 43v14m-7-7h14M78 143v10m-5-5h10" />
          </svg>
          <span>ARS MAGICA · STUDIUM I</span>
        </div>
      </section>
      <main
        hidden={page === "learning"}
        data-page={page}
        className="desk-layout"
        ref={deskRef}
        data-reading={entryOpen}
      >
        <aside
          className="ritual-sidebar"
          hidden={entryOpen || page !== "practice"}
        >
          <div className="sidebar-title">

            <p className="eyebrow">Путь ученика</p>
          </div>
          <div className="progress-steps">
            <div
              data-done={recognizedSymbols.some(
                item => item.recognition.zone === "center"
              )}
            >
              <i>1</i>
              <span>
                <strong>Глиф</strong>
                <small>ядро в центре</small>
              </span>
            </div>
            <div
              data-done={recognizedSymbols.some(
                item => item.recognition.zone === "ring"
              )}
            >
              <i>2</i>
              <span>
                <strong>Указатели</strong>
                <small>4 стороны глифа</small>
              </span>
            </div>
            <div data-done={active}>
              <i>3</i>
              <span>
                <strong>Сигил</strong>
                <small>замкните круг</small>
              </span>
            </div>
          </div>
          <div className="reading-card">
            <Info size={16} />
            <p>
              Рисуйте форму в удобном порядке, отрывая руку сколько нужно.
              Близкие штрихи собираются в один символ. Если подходят несколько
              символов, выберите нужный вариант.
            </p>
          </div>
          <div className="identified-list">
            <p className="eyebrow">Прочитано · {recognizedSymbols.length}</p>
            {recognizedSymbols.length ? (
              recognizedSymbols.map(({ recognition, symbol }) => (
                <div
                  key={`${recognition.symbolId}-${recognition.strokeIds.join("-")}`}
                >
                  <img src={symbolImage(symbol!)} alt="" />
                  <span>
                    {symbol!.name}
                    <small>
                      {Math.round(recognition.score * 100)}% сходства
                    </small>
                  </span>
                </div>
              ))
            ) : (
              <p className="empty-reading">
                Здесь останутся заметки о прочитанных символах.
              </p>
            )}
          </div>
        </aside>
        {entryOpen && (
          <GrimoireEntry
            personalSpells={personalSpells}
            collectionOnly={page === "collection"}
            symbol={selectedSymbol}
            recipe={selectedRecipe}
            backLabel={
              page === "collection"
                ? "К моей коллекции"
                : page === "grimoire"
                  ? "К гримуару"
                  : "К рисованию"
            }
            onBack={() => {
              if (page === "practice") backToDrawing();
              else setEntryOpen(false);
            }}
            onSymbol={openSymbol}
            onRecipe={openRecipe}
          />
        )}
        <div
          className="practice-sheet"
          hidden={entryOpen || page !== "practice"}
        >
          <SpellCanvas
            drawingPreferences={drawingPreferences}
            practiceKey={practiceKey}
            learningTask={learningTask?.kind ?? null}
            learningSymbol={learningTask?.symbol}
            onSpellCast={recipe => {
              if (learningTask?.kind === "daily" && learningTask.recipeId === recipe.id) setLearningTask(null);
              setLastCast({
                recipe,
                at: Date.now(),
                serial: ++castSerial.current,
              });
            }}
            savedSpells={personalSpells}
            onSaveSpell={saveSpell}
            savedSpellIds={personalSpells.map(r => r.id)}
            selectedRecipe={practiceRecipe}
            onRecognitionChange={setRecognitions}
            onActivationChange={setActive}
          />
        </div>
        <Grimoire
          compact={page !== "practice"}
          readingSidebar={page !== "practice" && entryOpen}
          collectionOnly={page === "collection"}
          onDeleteRecipe={deleteSpell}
          onRenameRecipe={(id, name) => {
            const updated = renamePersonalSpell(window.localStorage, id, name);
            setPersonalSpells(updated);
            setSelectedRecipe(current => current?.id === id ? updated.find(recipe => recipe.id === id) ?? current : current);
            setPracticeRecipe(current => current?.id === id ? updated.find(recipe => recipe.id === id) ?? current : current);
            setLibraryError("");
          }}
          personalSpells={personalSpells}
          libraryError={libraryError}
          selectedSymbol={selectedSymbol}
          selectedRecipe={selectedRecipe}
          onSelectSymbol={openSymbol}
          onSelectRecipe={openRecipe}
          onPlaceRecipe={recipe => {
            setLearningTask(null);
            setPracticeRecipe(recipe);
            backToDrawing();
          }}
        />
      </main>
      <div hidden={page !== "learning"}>
        <LearningPanel
          readings={recognitions}
          cast={lastCast}
          taskKind={learningTask?.kind ?? null}
          onResume={backToDrawing}
          onProgressChange={setLearningProgress}
          onAttemptFinished={() => setLearningTask(null)}
          onStart={(recipe, kind = "lesson", symbol) => {
            setLearningTask({ kind, recipeId: recipe?.id, symbol });
            setPracticeRecipe(recipe);
            setPracticeKey(key => key + 1);
            backToDrawing();
          }}
        />
      </div>
      <footer className="site-footer">
        <span>
          <Sparkles size={14} /> Рисуйте один символ за раз. Сложные глифы и
          указатели можно составлять несколькими близкими штрихами.
        </span>
        <span>
          Поместите глиф в центр, добавьте минимум четыре указателя вокруг него и
          обведите их кругом. Получившийся сигил активирует заклинание. · Неофициальный фан-проект
        </span>
      </footer>
    </div>
  );
}
