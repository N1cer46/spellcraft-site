import { gsap } from "gsap";
import StrokeDemo from "./StrokeDemo";
import { useEffect, useRef, useState } from "react";
import {
  byId,
  symbolImage,
  spellRecipes,
  type SpellRecipe,
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
  onStart: (recipe: SpellRecipe | null, kind?: "lesson" | "daily") => void;
  onAttemptFinished?: () => void;
};
export default function LearningPanel({ readings, cast, onStart, onAttemptFinished }: Props) {
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [active, setActive] = useState<string | null>(null),
    [message, setMessage] = useState("");
  const [today, setToday] = useState(dayKey);
  const paperRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {}, paperRef);
      const observer = new IntersectionObserver(entries => {
        const visible = entries.filter(entry => entry.isIntersecting).slice(0, 6);
        context.add(() => {
          gsap.from(visible.map(entry => entry.target), { y: 8, opacity: .5, duration: .18, stagger: .04, ease: "power3.out" });
        });
        entries.filter(entry => entry.isIntersecting).forEach(entry => observer.unobserve(entry.target));
      });
      paperRef.current?.querySelectorAll(".lesson").forEach(lesson => observer.observe(lesson));
      return () => { observer.disconnect(); context.revert(); };
    });
    return () => media.revert();
  }, []);
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
  const begin = (id: string, recipe: SpellRecipe | null) => {
    setActive(id);
    setMessage(
      "Нарисуйте задание и нажмите «Проверить попытку», когда закончите."
    );
    startSerial.current = cast?.serial ?? 0;
    const lesson = lessons.find(l => l.id === id);
    onStart(lesson && "exam" in lesson ? null : recipe);
  };
  const check = () => {
    const lesson = lessons.find(l => l.id === active);
    if (!lesson) return;
    let p = latest.current;
    let success = false;
    if ("symbolId" in lesson) {
      const match = readings
        .filter(r => r.symbolId === lesson.symbolId)
        .sort((a, b) => b.score - a.score)[0];
      success = Boolean(match);
      p = recordAttempt(p, lesson.symbolId, match?.score ?? null);
    } else {
      const recipe = spellRecipes.find(r => r.id === lesson.recipeId)!;
      success = Boolean(
        cast &&
        cast.serial > startSerial.current &&
        cast.recipe.id === recipe.id
      );
      for (const id of [recipe.sigilId, ...recipe.requiredMarkIds]) {
        const found = readings.find(r => r.symbolId === id);
        p = recordAttempt(p, id, found?.score ?? null);
      }
    }
    if (success)
      p = { ...p, completed: Array.from(new Set([...p.completed, lesson.id])) };
    commit(p);
    setActive(null);
    onAttemptFinished?.();
    setMessage(
      success
        ? "Урок пройден. Следующий урок доступен."
        : "Попытка записана. Сравните рисунок с эталоном и начните урок ещё раз."
    );
  };
  const mastery = masteryProgress(progress);
  const learned = mastery.learned;
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
  return (
    <section ref={paperRef} className="learning-panel" aria-labelledby="learning-title">
      <header>
        <p className="eyebrow">ARS MAGICA · STUDIA I–III</p>
        <h2 id="learning-title">Обучение и прогресс</h2>
        <p>
          Уроки открываются по порядку. Кнопка начала задания очищает лист
          практики.
        </p>
      </header>
      <section className="mastery-card" aria-labelledby="mastery-title">
        <p className="eyebrow">Путь мастерства · уровень {mastery.level} из 7</p>
        <h3 id="mastery-title">{mastery.title}</h3>
        <p>Изучено {mastery.learned} из {mastery.total} символов.</p>
        <div className="mastery-track" role="progressbar" aria-label="Прогресс уровня"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(mastery.percent)}
          aria-valuetext={mastery.next ? `До ранга «${mastery.next.title}» осталось символов: ${mastery.remaining}` : "Высший ранг достигнут"}>
          <span style={{ transform: `scaleX(${mastery.percent / 100})` }} />
        </div>
        <p>{mastery.next ? `Следующий ранг — «${mastery.next.title}»: ещё ${mastery.remaining} символов.` : "Высший ранг достигнут. Продолжайте пополнять знания гримуара."}</p>
        <details>
          <summary>Ранги и правила прогресса</summary>
          <p>Изученным считается символ с успешной проверкой в уроке или распознанный в активированном заклинании. Каждый символ учитывается один раз. Прогресс сохраняется в этом браузере.</p>
          <ol className="mastery-ranks">
            {masteryRanks.map((rank, index) => <li key={rank.threshold} aria-current={index + 1 === mastery.level ? "step" : undefined}>
              <span>{index + 1}. {rank.title}</span><span>{rank.threshold} символов{mastery.learned >= rank.threshold ? " · достигнут" : ""}</span>
            </li>)}
          </ol>
        </details>
      </section>
      <div className="learning-summary">
        <span>
          <strong>{learned}</strong> изучено символов
        </span>
        <span>
          <strong>
            {progress.completed.length} / {lessons.length}
          </strong>{" "}
          уроков
        </span>
        <span>
          <strong>{progress.casts}</strong> активаций
        </span>
        <span>
          <strong>{favorite ? byId(favorite[0])?.name : "—"}</strong> любимый
          материал
        </span>
      </div>
      <div className="learning-studios">
        {[1, 2, 3].map(stage => (
          <section key={stage}>
            <h3>Студия {["I", "II", "III"][stage - 1]}</h3>
            {lessons
              .filter(l => l.stage === stage)
              .map(lesson => {
                const index = lessons.indexOf(lesson),
                  unlocked =
                    index === 0 ||
                    progress.completed.includes(lessons[index - 1].id);
                const recipe =
                  "recipeId" in lesson
                    ? spellRecipes.find(r => r.id === lesson.recipeId)!
                    : null;
                return (
                  <div className="lesson" key={lesson.id}>
                    <strong>{lesson.title}</strong>
                    {!("symbolId" in lesson) && !("exam" in lesson) && (
                      <ol>
                        {[recipe!.sigilId, ...recipe!.requiredMarkIds].map(
                          (id, i) => (
                            <li key={id}>
                              {i === 0
                                ? "Центр"
                                : ["Верх", "Право", "Низ", "Лево"][i - 1]}
                              : {byId(id)?.name}
                            </li>
                          )
                        )}
                      </ol>
                    )}
                    {"symbolId" in lesson && (
                      <img
                        className="lesson-symbol"
                        src={symbolImage(byId(lesson.symbolId)!)}
                        alt={byId(lesson.symbolId)!.name}
                      />
                    )}
                    <p>
                      {"symbolId" in lesson
                        ? byId(lesson.symbolId)?.name +
                          " — " +
                          (byId(lesson.symbolId)?.kind === "sigil"
                            ? "в центре листа"
                            : "в верхней части кольца")
                        : recipe?.name +
                          ("exam" in lesson
                            ? " — без подложки: восстановите состав по памяти"
                            : " — сигил, четыре знака и замкнутый круг")}
                    </p>
                    {"symbolId" in lesson && (
                      <StrokeDemo id={lesson.symbolId} />
                    )}
                    <button
                      disabled={!ready || !unlocked}
                      onClick={() => begin(lesson.id, recipe)}
                    >
                      {progress.completed.includes(lesson.id)
                        ? "Повторить урок"
                        : unlocked
                          ? "Начать урок"
                          : "Закрыто"}
                    </button>
                  </div>
                );
              })}
          </section>
        ))}
      </div>
      {active && (
        <div className="learning-attempt">
          <strong>{lessons.find(l => l.id === active)?.title}</strong>
          <button onClick={check}>Проверить попытку</button>
        </div>
      )}
      <p role="status">{message}</p>
      <div className="learning-details">
        <section>
          <h3>Формула дня</h3>
          <p>
            {today} · {daily.name}
          </p>
          <p>
            Серия: {streak(progress.days, today)} дн. · Выполнено дней:{" "}
            {progress.days.length}
          </p>
          <button
            disabled={!ready}
            onClick={() => {
              setActive(null);
              setMessage(
                "Для выполнения задания дня активируйте формулу, замкнув круг."
              );
              onStart(daily, "daily");
            }}
          >
            {progress.days.includes(today)
              ? "Выполнено · повторить"
              : "Начать задание дня"}
          </button>
          <p>
            День меняется в полночь по времени устройства. Повторы за один день
            не увеличивают серию.
          </p>
        </section>
        <section>
          <h3>Точность по группам</h3>
          {groups.size ? (
            Array.from(groups, ([group, s]) => (
              <p key={group}>
                {group}: {Math.round((s.success / s.attempts) * 100)}% успешных
                попыток · среднее сходство{" "}
                {s.success
                  ? Math.round((s.score / s.success) * 100) + "%"
                  : "—"}
              </p>
            ))
          ) : (
            <p>Пока нет проверенных попыток.</p>
          )}
          <p>
            Сходство — оценка распознавателя, а не вероятность правильного
            ответа.
          </p>
        </section>
        <section>
          <h3>Что потренировать</h3>
          {errors.length ? (
            errors.slice(0, 5).map(([id, s]) => (
              <p key={id}>
                {byId(id)?.name}: не распознано в {s.attempts - s.success} из{" "}
                {s.attempts} попыток
              </p>
            ))
          ) : (
            <p>В проверенных попытках ошибок пока нет.</p>
          )}
          <p>
            Ошибки считаются только после «Проверить попытку»: в уроке известен
            нужный символ. Незавершённые штрихи и свободные рисунки не
            записываются как ошибки.
          </p>
        </section>
      </div>
      {error && <p role="alert">{error}</p>}
      <small>
        Прогресс хранится в этом браузере. Очистка данных сайта удалит
        статистику.
      </small>
    </section>
  );
}
