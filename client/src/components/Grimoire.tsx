/**
 * Design system: a green-bound grimoire with paper reference notes.
 */
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import {
  allSymbols,
  spellRecipes,
  symbolImage,
  type SpellRecipe,
  type SymbolDefinition,
} from "@/data/spellbook";

import { loadReferenceTemplates } from "@/data/reference-templates";

type Props = {
  compact?: boolean;
  readingSidebar?: boolean;
  collectionOnly?: boolean;
  onDeleteRecipe?: (id: string) => void;
  personalSpells?: SpellRecipe[];
  libraryError?: string;
  selectedSymbol: SymbolDefinition | null;
  selectedRecipe: SpellRecipe | null;
  onPlaceRecipe: (recipe: SpellRecipe) => void;
  onSelectSymbol: (symbol: SymbolDefinition | null) => void;
  onSelectRecipe: (recipe: SpellRecipe | null) => void;
};

export default function Grimoire({
  selectedSymbol,
  selectedRecipe,
  onSelectSymbol,
  onSelectRecipe,
  onPlaceRecipe,
  personalSpells = [],
  libraryError,
  onDeleteRecipe,
  collectionOnly = false,
  compact = false,
  readingSidebar = false,
}: Props) {
  const allRecipes = collectionOnly
    ? personalSpells
    : [...spellRecipes, ...personalSpells];
  const [available, setAvailable] = useState<Set<string> | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadReferenceTemplates()
      .then(data => {
        if (!cancelled)
          setAvailable(
            new Set(Object.keys(data).filter(id => data[id].length))
          );
      })
      .catch(() => {});
  return () => {
      cancelled = true;
    };
  }, []);
  const [mode, setMode] = useState<"symbols" | "spells">("symbols");
  useEffect(() => {
    if (collectionOnly) setMode("spells");
  }, [collectionOnly]);
  const [kind, setKind] = useState<"all" | "sigil" | "mark">("all");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [material, setMaterial] = useState("");
  const [complexity, setComplexity] = useState("");
  useEffect(() => {
    try {
      const data = JSON.parse(
        localStorage.getItem("spellcraft.favorites") ?? "[]"
      );
      if (Array.isArray(data))
        setFavorites(data.filter(x => typeof x === "string"));
    } catch {}
  }, []);
  const favorite = (id: string) => {
    const next = favorites.includes(id)
      ? favorites.filter(x => x !== id)
      : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem("spellcraft.favorites", JSON.stringify(next));
    } catch {}
  };
  const recipes = allRecipes.filter(
    r =>
      (!onlyFavorites || favorites.includes(r.id)) &&
      (!material || r.sigilId === material) &&
      (!complexity ||
        (complexity === "basic"
          ? r.requiredMarkIds.length <= 4
          : r.requiredMarkIds.length > 4)) &&
      (r.name + " " + r.description)
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase())
  );
  const symbols = useMemo(
    () =>
      allSymbols.filter(
        symbol =>
          (!onlyFavorites || favorites.includes(symbol.id)) &&
          (kind === "all" || symbol.kind === kind) &&
          `${symbol.name} ${symbol.group} ${symbol.description}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase())
      ),
    [kind, search, onlyFavorites, favorites]
  );
  const showSymbol = (symbol: SymbolDefinition) => {
    onSelectRecipe(null);
    onSelectSymbol(symbol);
  };
  const showRecipe = (recipe: SpellRecipe) => {
    onSelectSymbol(null);
    onSelectRecipe(recipe);
  };

  return (
    <aside className="grimoire-panel" data-compact={compact} data-reading-sidebar={readingSidebar}>
      <div className="grimoire-heading">
        <div>
          <p className="eyebrow">Картотека</p>
          <h2>Гримуар</h2>
        </div>
        <BookOpen size={20} aria-hidden="true" />
      </div>
      {libraryError && (
        <p role="alert" className="empty-reading">
          {libraryError}
        </p>
      )}
      <div className="catalog-toolbar">
      <div className="mode-switch" hidden={collectionOnly}>
        <button
          type="button"
          onClick={() => setMode("symbols")}
          data-active={mode === "symbols"}
        >
          Символы <span>{allSymbols.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("spells")}
          data-active={mode === "spells"}
        >
          Заклинания <span>{recipes.length}</span>
        </button>
      </div>
      <label className="search-box">
        <Search size={18} aria-hidden="true" />
        <input
          aria-label="Поиск по гримуару"
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Название или эффект"
        />
      </label>
      </div>
      <label className="favorites-filter">
        <input
          type="checkbox"
          checked={onlyFavorites}
          onChange={e => setOnlyFavorites(e.target.checked)}
        />{" "}
        Только избранное
      </label>
      {(mode === "spells" || collectionOnly) && (
        <div className="filter-row">
          <select
            aria-label="Материал"
            value={material}
            onChange={e => setMaterial(e.target.value)}
          >
            <option value="">Все материалы</option>
            {allSymbols
              .filter(s => s.kind === "sigil")
              .map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <select
            aria-label="Сложность"
            value={complexity}
            onChange={e => setComplexity(e.target.value)}
          >
            <option value="">Любая сложность</option>
            <option value="basic">До четырёх знаков</option>
            <option value="advanced">Больше четырёх</option>
          </select>
        </div>
      )}
      {mode === "symbols" && !collectionOnly ? (
        <>
          <div className="filter-row">
            <button
              type="button"
              onClick={() => setKind("all")}
              data-active={kind === "all"}
            >
              Все
            </button>
            <button
              type="button"
              onClick={() => setKind("sigil")}
              data-active={kind === "sigil"}
            >
              Сигилы
            </button>
            <button
              type="button"
              onClick={() => setKind("mark")}
              data-active={kind === "mark"}
            >
              Знаки
            </button>
          </div>
          <div className="symbol-list">
            {!symbols.length && (
              <p className="empty-reading" role="status">
                Символы не найдены. Попробуйте другое название или фильтр.
              </p>
            )}
            {symbols.map(symbol => (
              <div
                className="symbol-card"
                data-active={selectedSymbol?.id === symbol.id}
                key={symbol.id}
              >
                {compact ? (
                  <button
                    type="button"
                    className="catalog-summary"
                    onClick={() => showSymbol(symbol)}
                  >
                    {readingSidebar && <span className="symbol-thumb"><img src={symbolImage(symbol)} alt="" /></span>}
                    <span className="catalog-symbol-copy">
                      <strong>{symbol.name}</strong>
                      <small>{readingSidebar ? symbol.group : symbol.description}</small>
                    </span>
                  </button>
                ) : (
                  <>
                    <span className="symbol-thumb">
                      <img src={symbolImage(symbol)} alt="" />
                    </span>
                    <span>
                      <strong>{symbol.name}</strong>
                      <small>
                        {symbol.group}
                        {available && !available.has(symbol.id)
                          ? " · нет образцов"
                          : ""}
                      </small>
                    </span>
                  </>
                )}
                <div
                  className="catalog-actions"
                  hidden={compact && !readingSidebar && selectedSymbol?.id !== symbol.id}
                >
                  <button
                    className="favorite-star"
                    aria-label={`${favorites.includes(symbol.id) ? "Убрать из избранного" : "В избранное"}: ${symbol.name}`}
                    title={
                      favorites.includes(symbol.id)
                        ? "Убрать из избранного"
                        : "В избранное"
                    }
                    aria-pressed={favorites.includes(symbol.id)}
                    onClick={() => favorite(symbol.id)}
                  >
                    {favorites.includes(symbol.id) ? "★" : "☆"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="spell-list">
          {!recipes.length && (
            <p className="empty-reading">
              {collectionOnly && !personalSpells.length
                ? "Пока нет сохранённых заклинаний."
                : "Заклинания не найдены. Попробуйте другое название или фильтр."}
            </p>
          )}
          {recipes.map(recipe => (
            <div
              className="recipe-card"
              data-active={selectedRecipe?.id === recipe.id}
              key={recipe.id}
            >
              {compact ? (
                <button
                  type="button"
                  className="catalog-summary"
                  onClick={() => showRecipe(recipe)}
                >
                  <strong>{recipe.name}</strong>
                  <small>
                    {recipe.custom
                      ? `Личная формула · ${recipe.description.split(". ")[0]}.`
                      : recipe.description}
                  </small>
                </button>
              ) : (
                <>

                  <span>
                    <strong>{recipe.name}</strong>
                    <small>
                      {recipe.custom
                        ? "Личная формула · сохранена на этом устройстве"
                        : recipe.description}
                    </small>
                  </span>
                </>
              )}
              <div
                className="catalog-actions"
                hidden={compact && selectedRecipe?.id !== recipe.id}
              >
                <button
                  type="button"
                  className="place-template"
                  onClick={() => onPlaceRecipe(recipe)}
                  aria-label={`Разместить шаблон: ${recipe.name}`}
                >
                  Разместить шаблон
                </button>
                <button
                  className="favorite-star"
                  aria-label={`${favorites.includes(recipe.id) ? "Убрать из избранного" : "В избранное"}: ${recipe.name}`}
                  title={
                    favorites.includes(recipe.id)
                      ? "Убрать из избранного"
                      : "В избранное"
                  }
                  aria-pressed={favorites.includes(recipe.id)}
                  onClick={() => favorite(recipe.id)}
                >
                  {favorites.includes(recipe.id) ? "★" : "☆"}
                </button>
                {recipe.custom && compact && (
                  <button
                    type="button"
                    className="delete-recipe"
                    onClick={() => onDeleteRecipe?.(recipe.id)}
                    aria-label={`Удалить заклинание: ${recipe.name}`}
                  >
                    Удалить из гримуара
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
