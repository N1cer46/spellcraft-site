import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  byId,
  sigils,
  marks,
  spellRecipes,
  symbolImage,
  type SpellRecipe,
  type SymbolDefinition,
} from "@/data/spellbook";
import { grimoireFieldNotes, grimoireLore } from "@/data/grimoire-lore";
import { loadReferenceTemplates } from "@/data/reference-templates";

type Props = {
  backLabel?: string;
  personalSpells?: SpellRecipe[];
  collectionOnly?: boolean;
  symbol: SymbolDefinition | null;
  recipe: SpellRecipe | null;
  onBack: () => void;
  onSymbol: (symbol: SymbolDefinition) => void;
  onRecipe: (recipe: SpellRecipe) => void;
};
export default function GrimoireEntry({
  symbol,
  recipe,
  onBack,
  onSymbol,
  onRecipe,
  personalSpells = [],
  collectionOnly = false,
  backLabel = "К рисованию",
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const [available, setAvailable] = useState<Set<string> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    loadReferenceTemplates()
      .then(data => {
        if (alive)
          setAvailable(
            new Set(Object.keys(data).filter(id => data[id].length))
          );
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [symbol?.id, recipe?.id]);
  const entry = symbol ?? recipe;
  if (!entry) return null;
  const recipes = collectionOnly ? [...personalSpells].reverse() : [...spellRecipes, ...personalSpells];
  const entries = recipe ? recipes : symbol?.kind === "sigil" ? sigils : marks;
  const index = entries.findIndex(item => item.id === entry.id);
  const previous = entries[index - 1];
  const next = entries[index + 1];
  const turnPage = (offset: number) => {
    if (recipe) {
      const target = recipes[index + offset];
      if (target) onRecipe(target);
    } else {
      const target = (symbol?.kind === "sigil" ? sigils : marks)[
        index + offset
      ];
      if (target) onSymbol(target);
    }
  };
  const parts = recipe
    ? [byId(recipe.sigilId)!, ...recipe.requiredMarkIds.map(id => byId(id)!)]
    : [symbol!];
  const related = symbol
    ? recipes.filter(
        r =>
          r.sigilId === symbol.id ||
          r.requiredMarkIds.includes(symbol.id) ||
          r.optionalMarkIds?.includes(symbol.id)
      )
    : [];
  const fieldNotes = grimoireFieldNotes[entry.id];
  const missing = available ? parts.filter(p => !available.has(p.id)) : [];
  return (
    <article
      className="grimoire-entry"
      ref={ref}
      tabIndex={-1}
      aria-labelledby="entry-title"
    >
      <header className="entry-toolbar">
        <span className="eyebrow">
          Гримуар /{" "}
          {recipe
            ? "Сигилы"
            : symbol?.kind === "sigil"
              ? "Глифы"
              : "Указатели"}
        </span>
        <button type="button" className="entry-back" onClick={onBack}>
          <ArrowLeft size={16} />
          {backLabel}
        </button>
      </header>
      <div className="entry-opening">
        <div className="entry-plate">
          <img src={symbolImage(parts[0])} alt={parts[0].name} />
          <span>
            {recipe
              ? "Центральный глиф сигила"
              : symbol?.kind === "sigil"
                ? "Глиф · центральный символ"
                : "Указатель · символ вокруг глифа"}
          </span>
        </div>
        <div>
          <p className="eyebrow">{symbol?.group ?? "Собрание формул"}</p>
          <h2 id="entry-title">{entry.name}</h2>
          {!recipe?.custom && <p className="entry-lead">{entry.description}</p>}
        </div>
      </div>
      <section className="entry-related" aria-labelledby="entry-lore-title">
        <h3 id="entry-lore-title">{recipe?.custom ? "Запись из личного гримуара" : "Из летописей ателье"}</h3>
        <p className="entry-lead">
          {recipe?.custom
            ? <>В центре этого авторского сигила — глиф «{parts[0].name}». {parts[0].description}</>
            : grimoireLore[entry.id] ?? entry.description}
        </p>
        {recipe?.custom && parts.length > 1 && (
          <p>Характер заклинания определяют указатели {parts.slice(1).map(part => `«${part.name}»`).join(", ")}.</p>
        )}
      </section>
      {fieldNotes && (
        <div className="entry-columns">
          <section>
            <h3>Где встречается</h3>
            <p>{fieldNotes[0]}</p>
          </section>
          <section className="entry-margin">
            <h3>Заметка мастера</h3>
            <p>{fieldNotes[1]}</p>
          </section>
        </div>
      )}
      {recipe && (
        <section className="entry-related">
          <h3>Из чего состоит сигил</h3>
          <div className="entry-formula">
            {parts.map((p, i) => (
              <button type="button" key={p.id} onClick={() => onSymbol(p)}>
                <img src={symbolImage(p)} alt="" />
                <span>
                  <small>{i === 0 ? "Глиф" : "Обязательный указатель"}</small>
                  <strong>{p.name}</strong>
                  <span>{p.description}</span>
                </span>
              </button>
            ))}
          </div>
          {Boolean(recipe.optionalMarkIds?.length) && (
            <p>
              Дополнительные указатели:{" "}
              {recipe.optionalMarkIds!.map(id => (
                <button
                  className="entry-inline"
                  type="button"
                  key={id}
                  onClick={() => onSymbol(byId(id)!)}
                >
                  {byId(id)!.name}
                </button>
              ))}
            </p>
          )}
        </section>
      )}
      {symbol && (
        <section className="entry-related">
          <h3>Встречается в формулах</h3>
          {related.length ? (
            <div className="entry-recipes">
              {related.map(r => (
                <button type="button" key={r.id} onClick={() => onRecipe(r)}>
                  <strong>{r.name}</strong>
                  <span>{r.description}</span>
                  {r.optionalMarkIds?.includes(symbol.id) && (
                    <small>Дополнительный указатель</small>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p>
              В текущем собрании нет готовой формулы с этим символом. Его можно
              изучать и отрабатывать отдельно.
            </p>
          )}
        </section>
      )}
      <details className="entry-related" key={entry.id}>
        <summary>Справка по рисованию</summary>
        <p>
          {recipe
            ? "Поместите глиф в центр, добавьте указатели на четырёх сторонах и дождитесь распознавания. Обведите все символы одним замкнутым кругом, чтобы завершить сигил."
            : symbol?.kind === "sigil"
              ? "Рисуйте глиф в центре листа, сохраняя пропорции и ориентацию изображения."
              : "Рисуйте указатель с одной из четырёх сторон глифа. Сохраняйте ориентацию изображения и оставляйте промежуток между символами."}
        </p>
        {recipe?.custom && <p>{recipe.description}</p>}
        <p className="entry-status" role="status">
          {loadFailed
            ? "Не удалось проверить наличие образцов."
            : !available
              ? "Проверяем наличие образцов…"
              : missing.length
                ? `Нет образцов распознавания для: ${missing.map(part => part.name).join(", ")}.`
                : "Образцы распознавания доступны."}
        </p>
      </details>
      <nav className="entry-pagination" aria-label="Перелистывание гримуара">
        <button
          type="button"
          disabled={!previous}
          onClick={() => turnPage(-1)}
          aria-label={
            previous
              ? `Предыдущая запись: ${previous.name}`
              : "Предыдущая запись"
          }
        >
          <ArrowLeft size={16} />
          <span>
            <small>Предыдущая</small>
            <strong>{previous?.name ?? "Начало раздела"}</strong>
          </span>
        </button>
        <span className="entry-page-number">
          {index + 1} / {entries.length}
        </span>
        <button
          type="button"
          disabled={!next}
          onClick={() => turnPage(1)}
          aria-label={
            next ? `Следующая запись: ${next.name}` : "Следующая запись"
          }
        >
          <span>
            <small>Следующая</small>
            <strong>{next?.name ?? "Конец раздела"}</strong>
          </span>
          <ArrowRight size={16} />
        </button>
      </nav>
      <footer className="entry-footer">
        <span>Летописи ателье — авторский лор SpellCraft.</span>
      </footer>
    </article>
  );
}
