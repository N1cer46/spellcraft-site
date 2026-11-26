import { toast } from "sonner";
import { masteryRewards } from "@/lib/mastery-rewards";
import StrokeDemo from "./StrokeDemo";
import { useEffect, useRef, useState } from "react";
import {
  byId,
  symbolImage,
  spellRecipes,
  type SpellRecipe,
  type SymbolDefinition,
} from "@/data/spellbook";
import type { Recognition } from "@/lib/recognizer";
import {
  PROGRESS_KEY,
  lessons,
  emptyProgress,
  loadProgress,
  recordAttempt,
  recordCastSymbols,
  masteryProgress,
  masteryRanks,
  dayKey,
  dailyRecipe,
  streak,
  type Progress,
} from "@/lib/learning";

type Cast = { recipe: SpellRecipe; at: number; serial: number };
type Props = {
  readings: Recognition[];
  cast: Cast | null;
  onStart: (recipe: SpellRecipe | null, kind?: "lesson" | "daily", symbol?: SymbolDefinition) => void;
  onResume?: () => void;
  taskKind?: "lesson" | "daily" | null;
  onAttemptFinished?: () => void;
  onProgressChange?: (progress: Progress) => void;
};
export default function LearningPanel({ readings, cast, onStart, onResume, taskKind, onAttemptFinished, onProgressChange }: Props) {
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const mastery = masteryProgress(progress);
  const previousLevel = useRef<number | null>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [active, setActive] = useState<string | null>(null),
    [message, setMessage] = useState("");
  const [today, setToday] = useState(dayKey);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (taskKind === null) setActive(null);
  }, [taskKind]);
  const startSerial = useRef(0),
    handled = useRef(0);
  const latest = useRef(progress);
  latest.current = progress;
  const writable = useRef(false);
  useEffect(() => {
    try {
      const p = loadProgress(localStorage);
      latest.current = p;
      setProgress(p);
      writable.current = true;
    } catch {
      setError(
        "Не удалось прочитать прогресс. Старые данные не изменены; статистика этой сессии не сохраняется."
      );
    }
    setReady(true);
    const refresh = () => setToday(dayKey());
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    if (ready) onProgressChange?.(progress);
  }, [ready, progress, onProgressChange]);

  const { level, title } = mastery;
  useEffect(() => {
    if (!ready) return;
    const previous = previousLevel.current;
    previousLevel.current = level;
    if (previous === null || level <= previous) return;
    const earned = masteryRewards.filter(reward => reward.level > previous && reward.level <= level);
    if (earned.length) {
      toast(`Новый ранг · ${title}`, {
        description: `Открыто в профиле: ${earned.map(reward => reward.label).join(", ")}.`,
      });
    }
  }, [ready, level, title]);

  const commit = (p: Progress) => {
    latest.current = p;
    setProgress(p);
    if (writable.current)
      try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
        setError("");
      } catch {
        setError(
          "Не удалось сохранить прогресс. В этой сессии он доступен, но после перезагрузки может потеряться."
        );
      }
  };
  useEffect(() => {
    if (!ready || !cast || cast.serial === handled.current) return;
    handled.current = cast.serial;
    const key = dayKey(new Date(cast.at)),
      p = recordCastSymbols(latest.current, readings, cast.recipe);
    commit({
      ...p,
      casts: p.casts + 1,
      materials: {
        ...p.materials,
        [cast.recipe.sigilId]: (p.materials[cast.recipe.sigilId] ?? 0) + 1,
      },
      days:
        cast.recipe.id === dailyRecipe(key).id
          ? Array.from(new Set([...p.days, key]))
          : p.days,
    });
  }, [cast, ready]);
  const nextLesson = lessons.find(lesson => !progress.completed.includes(lesson.id));
  const activeLesson = lessons.find(lesson => lesson.id === active);
  const selectedLesson = activeLesson ?? lessons.find(lesson => lesson.id === selected) ?? nextLesson;
  const reviewSymbol = active?.startsWith("review:") ? byId(active.slice(7)) : undefined;
  const displayedLesson = reviewSymbol ? undefined : selectedLesson;
  const focusSymbol = reviewSymbol ?? (displayedLesson && "symbolId" in displayedLesson ? byId(displayedLesson.symbolId) : undefined);
  const focusRecipe = displayedLesson && "recipeId" in displayedLesson
    ? spellRecipes.find(recipe => recipe.id === displayedLesson.recipeId)
    : undefined;
  const fromMemory = Boolean(displayedLesson && "exam" in displayedLesson);

  const begin = (lesson: NonNullable<typeof displayedLesson>) => {
    setActive(lesson.id);
    setSelected(lesson.id);
    setMessage("");
    startSerial.current = cast?.serial ?? 0;
    const recipe = "recipeId" in lesson ? spellRecipes.find(item => item.id === lesson.recipeId) ?? null : null;
    onStart("exam" in lesson ? null : recipe, "lesson", "symbolId" in lesson ? byId(lesson.symbolId) : undefined);
  };

  const finish = () => {
    setActive(null);
    onAttemptFinished?.();
  };

  const check = () => {
    if (!active) return;
    let updated = latest.current;
    if (focusSymbol) {
      const zone = focusSymbol.kind === "sigil" ? "center" : "ring";
      const candidates = readings.filter(reading => reading.symbolId === focusSymbol.id);
      const match = candidates.filter(reading => reading.zone === zone).sort((a, b) => b.score - a.score)[0];
      updated = recordAttempt(updated, focusSymbol.id, match?.score ?? null);
      if (match && activeLesson) {
        updated = { ...updated, completed: Array.from(new Set([...updated.completed, activeLesson.id])) };
        setSelected(null);
      }
      setMessage(match
        ? `«${focusSymbol.name}» распознан. ${activeLesson ? "Урок пройден." : "Повторение засчитано."}`
        : candidates.length
          ? `«${focusSymbol.name}» распознан в другой зоне. ${zone === "center" ? "Начертите его в центре." : "Начертите его на кольце вокруг центра."}`
          : `«${focusSymbol.name}» пока не распознан. Сверьте силуэт с образцом и попробуйте снова.`);
    } else if (focusRecipe && activeLesson) {
      const attemptCast = cast && cast.serial > startSerial.current ? cast : null;
      const success = attemptCast?.recipe.id === focusRecipe.id;
      const ingredients = [focusRecipe.sigilId, ...focusRecipe.requiredMarkIds];
      const missing = ingredients.filter(id => !readings.some(reading => reading.symbolId === id && reading.zone === (id === focusRecipe.sigilId ? "center" : "ring")));
      for (const id of ingredients) {
        const match = readings.find(reading => reading.symbolId === id && reading.zone === (id === focusRecipe.sigilId ? "center" : "ring"));
        updated = recordAttempt(updated, id, match?.score ?? null);
      }
      if (success) {
        updated = { ...updated, completed: Array.from(new Set([...updated.completed, activeLesson.id])) };
        setSelected(null);
        setMessage(`«${focusRecipe.name}» активировано. Урок пройден.`);
      } else if (attemptCast) {
        setMessage(`Активировано «${attemptCast.recipe.name}». В этом уроке нужна формула «${focusRecipe.name}».`);
      } else if (missing.length) {
        setMessage(fromMemory
          ? `Не распознано элементов формулы: ${missing.length}. Попробуйте восстановить состав по памяти.`
          : `Пока не распознаны в нужной зоне: ${missing.map(id => byId(id)?.name).join(", ")}.`);
      } else {
        setMessage("Все нужные символы распознаны. Проверьте, что указатели занимают четыре стороны глифа, и замкните круг сигила.");
      }
    }
    commit(updated);
    finish();
  };
  const groups = new Map<
    string,
    { attempts: number; success: number; score: number }
  >();
  for (const [id, s] of Object.entries(progress.symbols)) {
    const group = byId(id)!.group;
    const old = groups.get(group) ?? { attempts: 0, success: 0, score: 0 };
    groups.set(group, {
      attempts: old.attempts + s.attempts,
      success: old.success + s.success,
      score: old.score + s.score,
    });
  }
  const errors = Object.entries(progress.symbols)
    .filter(([, s]) => s.attempts > s.success)
    .sort(
      (a, b) => b[1].attempts - b[1].success - (a[1].attempts - a[1].success)
    );
  const favorite = Object.entries(progress.materials).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const daily = dailyRecipe(today);
  const stages = [
    { id: 1, title: "Первые штрихи" },
    { id: 2, title: "Форма и движение" },
    { id: 3, title: "Составные печати" },
  ];
  const dailyDone = progress.days.includes(today);
  const nextReward = masteryRewards.find(reward => reward.level > mastery.level);
  return (
    <section className="learning-panel" aria-labelledby="learning-title">
      <header className="learning-heading">
        <div>
          <h2 id="learning-title" tabIndex={-1}>Обучение в ателье</h2>
          <p>От первого глифа до сигила, начерченного по памяти.</p>
        </div>
        <a className="learning-text-link" href="#/practice">К свободному рисованию</a>
      </header>

      <div className="learning-workspace">
        <div className="learning-course">
          <section className="learning-current" aria-labelledby="learning-current-title">
            <p className="eyebrow">{reviewSymbol ? "Повторение символа" : active ? "Текущая попытка" : displayedLesson ? `Студия ${displayedLesson.stage} · ${progress.completed.includes(displayedLesson.id) ? "Повторение" : "Урок"}` : "Курс завершён"}</p>
            <h3 id="learning-current-title">{reviewSymbol?.name ?? displayedLesson?.title ?? "Все уроки пройдены"}</h3>
            {message && <p className="learning-feedback" role="status">{message}</p>}
            {focusSymbol && (
              <div className="learning-example">
                <img className="lesson-symbol" src={symbolImage(focusSymbol)} alt={focusSymbol.name} />
                <div>
                  <p><strong>{focusSymbol.name}</strong> · {focusSymbol.kind === "sigil" ? "глиф в центре листа" : "указатель над центром"}</p>
                  <p>Нарисуйте символ и дождитесь распознавания. Затем вернитесь сюда и проверьте попытку.</p>
                  <StrokeDemo id={focusSymbol.id} />
                </div>
              </div>
            )}
            {focusRecipe && (
              <>
                <p><strong>{focusRecipe.name}</strong> · {fromMemory
                  ? "Восстановите состав по памяти и активируйте печать без подложки."
                  : "Начертите глиф и четыре указателя по подложке, затем замкните круг сигила."}</p>
                {!fromMemory && (
                  <dl className="learning-recipe">
                    {[focusRecipe.sigilId, ...focusRecipe.requiredMarkIds].map((id, index) => (
                      <div key={`${index}-${id}`}><dt>{["Центр", "Сверху", "Справа", "Снизу", "Слева"][index]}</dt><dd>{byId(id)?.name}</dd></div>
                    ))}
                  </dl>
                )}
              </>
            )}
            {!active && displayedLesson && (
              <button disabled={!ready} type="button" onClick={() => begin(displayedLesson)}>
                {progress.completed.includes(displayedLesson.id) ? "Повторить урок" : "Начать урок"}
              </button>
            )}
            {active && (
              <div className="learning-actions">
                <button type="button" onClick={check}>Проверить попытку</button>
                <button type="button" className="learning-secondary" onClick={onResume}>Продолжить рисунок</button>
                <button type="button" className="learning-secondary" onClick={finish}>Отменить попытку</button>
              </div>
            )}
            {!active && !displayedLesson && <p>Выберите любой урок ниже, чтобы повторить его, или попробуйте формулу дня.</p>}
          </section>

          <section aria-labelledby="learning-route-title" className="learning-route">
            <h3 id="learning-route-title">Маршрут обучения</h3>
            {stages.map(stage => {
              const entries = lessons.filter(lesson => lesson.stage === stage.id);
              const complete = entries.filter(lesson => progress.completed.includes(lesson.id)).length;
              return (
                <section className="learning-stage" key={stage.id}>
                  <h4>{stage.title} <span>{complete} / {entries.length}</span></h4>
                  <ul>
                    {entries.map(lesson => {
                      const completed = progress.completed.includes(lesson.id);
                      const available = completed || nextLesson?.id === lesson.id;
                      const current = displayedLesson?.id === lesson.id;
                      return (
                        <li key={lesson.id}>
                          <button type="button" className="learning-route-item"
                            disabled={!ready || !available || Boolean(active)}
                            aria-current={current ? "step" : undefined}
                            onClick={() => { setSelected(lesson.id); setMessage(""); document.getElementById("learning-current-title")?.scrollIntoView({ block: "center" }); }}>
                            <span>{lesson.title}</span><span>{completed ? "Пройден" : available ? "Доступен" : "Закрыт"}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </section>
        </div>

        <aside className="learning-sidebar" aria-label="Задание дня и статистика">
          <section className="learning-side-card">
            <h3>Формула дня</h3>
            <p className="learning-daily-name">{daily.name}</p>
            <p>{dailyDone ? "Сегодня выполнено." : "Начертите сигил по шаблону, чтобы активировать заклинание."} Серия: {streak(progress.days, today)} дн.</p>
            <button type="button" disabled={!ready || Boolean(active)} onClick={() => {
              setMessage("");
              if (taskKind === "daily") onResume?.();
              else onStart(daily, "daily");
            }}>{taskKind === "daily" ? "Продолжить задание дня" : dailyDone ? "Повторить формулу дня" : "Начать задание дня"}</button>
          </section>
          <section className="learning-side-card" aria-labelledby="mastery-title">
            <p className="eyebrow">Уровень {mastery.level} из {masteryRanks.length}</p>
            <h3 id="mastery-title">{mastery.title}</h3>
            <div className="mastery-track" role="progressbar" aria-label="Прогресс уровня" aria-valuenow={Math.round(mastery.percent)}>
              <span style={{ transform: `scaleX(${mastery.percent / 100})` }} />
            </div>
            <dl className="learning-numbers">
              <div><dt>Изучено символов</dt><dd>{mastery.learned} / {mastery.total}</dd></div>
              <div><dt>Пройдено уроков</dt><dd>{progress.completed.length} / {lessons.length}</dd></div>
              <div><dt>Активаций</dt><dd>{progress.casts}</dd></div>
              <div><dt>Любимый материал</dt><dd>{favorite ? byId(favorite[0])?.name : "—"}</dd></div>
            </dl>
            <p>{mastery.next ? `До ранга «${mastery.next.title}» осталось символов: ${mastery.remaining}.` : "Высший ранг достигнут."}</p>
            {nextReward && (
              <p className="learning-next-reward"><strong>Следующая награда</strong><br />{nextReward.label} · уровень {nextReward.level}</p>
            )}
            <details>
              <summary>Ранги, награды и точность</summary>
              <p>Символ засчитывается один раз после проверки урока или успешной активации заклинания.</p>
              <ol className="mastery-ranks">
                {masteryRanks.map((rank, index) => {
                  const rankLevel = index + 1;
                  const reward = masteryRewards.find(item => item.level === rankLevel);
                  return (
                    <li key={rank.threshold} aria-current={rankLevel === mastery.level ? "step" : undefined}>
                      <span>{rank.title}</span><span>От {rank.threshold} символов</span>
                      {reward && (
                        <span className="learning-rank-reward">
                          {reward.label} · {rankLevel <= mastery.level ? "Открыто" : "Закрыто"}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p>Открытые чернила и бумагу можно выбрать в профиле.</p>
              {groups.size ? Array.from(groups, ([group, stats]) => (
                <p key={group}>{group}: {stats.success} из {stats.attempts} успешных попыток</p>
              )) : <p>Точность появится после первых попыток.</p>}
            </details>
          </section>
          <section className="learning-side-card">
            <h3>Что повторить</h3>
            {errors.length ? (
              <ul className="learning-review">
                {errors.slice(0, 5).map(([id, stats]) => <li key={id}>
                  <div><strong>{byId(id)?.name}</strong><p>Ошибок: {stats.attempts - stats.success} из {stats.attempts} попыток</p></div>
                  <button type="button" className="learning-secondary" aria-label={`Потренировать: ${byId(id)?.name}`} disabled={!ready || Boolean(active)} onClick={() => {
                    setActive(`review:${id}`);
                    setMessage("");
                    onStart(null, "lesson", byId(id));
                  }}>Потренировать</button>
                </li>)}
              </ul>
            ) : <p>Здесь появятся символы, которые не удалось распознать при проверке.</p>}
          </section>
        </aside>
      </div>
      {error && <p role="alert">{error}</p>}
      <small>Прогресс хранится в этом браузере.</small>
    </section>
  );
}
