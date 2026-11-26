/**
 * Design system: a green-bound grimoire with paper reference notes.
 */
import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, BookOpen, Bookmark, Pencil, Search, Star } from "lucide-react";
import {
  allSymbols,
  byId,
  spellRecipes,
  symbolImage,
  type SpellRecipe,
  type SymbolDefinition,
} from "@/data/spellbook";

import { loadReferenceTemplates } from "@/data/reference-templates";

const collator = new Intl.Collator("ru", { sensitivity: "base" });
const normalizeSearch = (value: string) => value.toLocaleLowerCase("ru").replaceAll("ё", "е").trim();

type Props = {
  compact?: boolean;
  readingSidebar?: boolean;
  collectionOnly?: boolean;
  onDeleteRecipe?: (id: string) => void;
  onRenameRecipe?: (id: string, name: string) => void;
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
  onRenameRecipe,
  collectionOnly = false,
  compact = false,
  readingSidebar = false,
}: Props) {
  const catalogue = compact && !readingSidebar;
  const panel = useRef<HTMLElement>(null);
  const lastOpened = useRef<string | null>(null);
  const editTrigger = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [renameError, setRenameError] = useState("");
  const rename = (recipe: SpellRecipe, trigger: HTMLButtonElement) => {
    editTrigger.current = trigger;
    setRenameError("");
    setEditing({ id: recipe.id, name: recipe.name });
  };
  useEffect(() => {
    if (!catalogue || !lastOpened.current) return;
    const button = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("[data-catalogue-entry]") ?? [])
      .find(item => item.dataset.catalogueEntry === lastOpened.current);
    lastOpened.current = null;
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: "nearest" });
  }, [catalogue]);
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
  const [kind, setKind] = useState<"all" | "sigil" | "mark">("all");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [material, setMaterial] = useState("");
  const [complexity, setComplexity] = useState("");
  const [group, setGroup] = useState("");
  const [drawableOnly, setDrawableOnly] = useState(false);
  const [alphabetical, setAlphabetical] = useState(false);
  const showSpells = collectionOnly || mode === "spells";
  const searchWords = normalizeSearch(search).split(/\s+/).filter(Boolean);
  const matches = (text: string) => {
    const normalized = normalizeSearch(text);
    return searchWords.every(word => normalized.includes(word));
  };
  const isDrawable = (entry: SymbolDefinition | SpellRecipe) => available
    ? ("kind" in entry ? available.has(entry.id) : [entry.sigilId, ...entry.requiredMarkIds].every(id => available.has(id)))
    : null;
  const resetFilters = () => {
    setSearch("");
    setOnlyFavorites(false);
    setMaterial("");
    setComplexity("");
    setGroup("");
    setDrawableOnly(false);
  };
  const scope = collectionOnly ? "collection" : compact ? "grimoire" : "practice";
  useEffect(resetFilters, [scope]);
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
      (catalogue || !complexity ||
        (complexity === "basic"
          ? r.requiredMarkIds.length <= 4
          : r.requiredMarkIds.length > 4)) &&
      (!catalogue || !drawableOnly || isDrawable(r)) &&
      matches([r.name, r.description, ...[r.sigilId, ...r.requiredMarkIds, ...(r.optionalMarkIds ?? [])].map(id => byId(id)?.name)].join(" "))
  );
  const symbols = allSymbols.filter(symbol =>
    (!onlyFavorites || favorites.includes(symbol.id)) &&
    (kind === "all" ? !catalogue || symbol.kind === "sigil" : symbol.kind === kind) &&
    (!catalogue || !group || symbol.group === group) &&
    (!catalogue || !drawableOnly || isDrawable(symbol)) &&
    matches(`${symbol.name} ${symbol.group} ${symbol.description}`)
  );
  const showSymbol = (symbol: SymbolDefinition) => {
    onSelectRecipe(null);
    onSelectSymbol(symbol);
  };
  const showRecipe = (recipe: SpellRecipe) => {
    onSelectSymbol(null);
    onSelectRecipe(recipe);
  };

  if (catalogue) {
    const results: (SymbolDefinition | SpellRecipe)[] = showSpells ? recipes : symbols;
    if (alphabetical) results.sort((a, b) => collator.compare(a.name, b.name));
    else if (collectionOnly) results.reverse();
    const availableGroups = Array.from(new Set(allSymbols
      .filter(symbol => symbol.kind === (kind === "all" ? "sigil" : kind))
      .map(symbol => symbol.group)));
    const materials = Array.from(new Set(allRecipes.map(recipe => recipe.sigilId)))
      .map(byId)
      .filter((symbol): symbol is SymbolDefinition => Boolean(symbol))
      .sort((a, b) => collator.compare(a.name, b.name));
    const selectSection = (section: "sigil" | "mark" | "spells") => {
      setMode(section === "spells" ? "spells" : "symbols");
      if (section !== "spells") setKind(section);
      setGroup("");
      setMaterial("");
      setComplexity("");
    };
    const activeSection = showSpells ? "spells" : kind;
    const hasFilters = Boolean(search || onlyFavorites || (showSpells ? material : group) || drawableOnly);

    return (
      <section ref={panel} className="grimoire-panel grimoire-catalogue" data-collection={collectionOnly} data-compact="true" aria-labelledby="catalogue-title">
        <header className="catalogue-header">
          <div>
            <h2 id="catalogue-title">{collectionOnly ? "Моя коллекция" : "Гримуар"}</h2>
            <p>{collectionOnly ? "Авторские печати, которые вы сохранили после активации." : "Истории глифов, свойства указателей и готовые сигилы для листа практики."}</p>
          </div>
          {collectionOnly ? <Bookmark size={30} aria-hidden="true" /> : <BookOpen size={32} aria-hidden="true" />}
        </header>
        {libraryError && <p role="alert">{libraryError}</p>}
        {!collectionOnly && (
          <div className="catalogue-sections" role="group" aria-label="Разделы гримуара">
            {(["sigil", "mark", "spells"] as const).map(section => (
              <button key={section} type="button"
                aria-pressed={(activeSection === "all" ? "sigil" : activeSection) === section}
                onClick={() => selectSection(section)}>
                {section === "sigil" ? "Глифы" : section === "mark" ? "Указатели" : "Сигилы"}
                <span>{section === "spells" ? allRecipes.length : allSymbols.filter(symbol => symbol.kind === section).length}</span>
              </button>
            ))}
          </div>
        )}
        {collectionOnly && personalSpells.length > 0 && (
          <dl className="collection-totals">
            <div><dt>Формул сохранено</dt><dd>{personalSpells.length}</dd></div>
            <div><dt>В избранном</dt><dd>{personalSpells.filter(recipe => favorites.includes(recipe.id)).length}</dd></div>
          </dl>
        )}
        {(!collectionOnly || personalSpells.length > 0) && <>
        <div className="catalogue-controls">
          <label className="search-box">
            <Search size={18} aria-hidden="true" />
            <input aria-label="Поиск по гримуару" type="search" value={search}
              placeholder={showSpells ? "Название, эффект или символ" : "Название, группа или свойство"}
              onChange={event => setSearch(event.target.value)} />
          </label>
          <div className="catalogue-selects">
            {showSpells ? (
              <select aria-label="Материал" value={material} onChange={event => setMaterial(event.target.value)}>
                <option value="">Все материалы</option>
                {materials.map(symbol => <option key={symbol.id} value={symbol.id}>{symbol.name}</option>)}
              </select>
            ) : (
              <select aria-label="Группа символов" value={group} onChange={event => setGroup(event.target.value)}>
                <option value="">Все группы</option>
                {availableGroups.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            )}
            <select aria-label="Сортировка" value={alphabetical ? "name" : "catalogue"} onChange={event => setAlphabetical(event.target.value === "name")}>
              <option value="catalogue">{collectionOnly ? "Сначала недавние" : "По порядку в гримуаре"}</option>
              <option value="name">По алфавиту</option>
            </select>
          </div>
          <div className="catalogue-filters">
            <label><input type="checkbox" checked={onlyFavorites} onChange={event => setOnlyFavorites(event.target.checked)} /> Избранное</label>
            <label><input type="checkbox" checked={drawableOnly} disabled={!available} onChange={event => setDrawableOnly(event.target.checked)} /> С образцами распознавания</label>
            {hasFilters && <button className="catalogue-reset" type="button" onClick={resetFilters}>Сбросить фильтры</button>}
          </div>
        </div>
        <p className="catalogue-count" role="status">Найдено записей: {results.length}</p>
        </>}
        {results.length ? (
          <ul className="catalogue-grid">
            {results.map(entry => {
              const symbol = "kind" in entry ? entry : byId(entry.sigilId);
              const recipe = "sigilId" in entry ? entry : null;
              const saved = favorites.includes(entry.id);
              const drawable = isDrawable(entry);
              return (
                <li className="catalogue-card" key={entry.id}>
                  <button type="button" className="catalogue-open" data-catalogue-entry={entry.id}
                    onClick={() => {
                      lastOpened.current = entry.id;
                      if ("kind" in entry) showSymbol(entry);
                      else showRecipe(entry);
                    }}>
                    {symbol && <span className="catalogue-seal"><img src={symbolImage(symbol)} alt="" loading="lazy" /></span>}
                    <span className="catalogue-copy">
                      <span className="catalogue-category">{recipe ? (recipe.custom && !collectionOnly ? "Личная формула" : symbol?.name) : symbol?.group}</span>
                      <strong>{entry.name}</strong>
                      <span>{recipe?.custom ? entry.description.split(". ").slice(0, collectionOnly ? 2 : 1).join(". ") : entry.description}</span>
                      {recipe && <span className="catalogue-ingredients">
                        {recipe.requiredMarkIds.map(id => byId(id)?.name).join(" · ")}
                      </span>}
                    </span>
                    <ArrowUpRight aria-hidden="true" size={16} className="catalogue-open-icon" />
                  </button>
                  {collectionOnly && recipe && (
                    <div className="collection-marks" aria-hidden="true">
                      {recipe.requiredMarkIds.slice(0, 5).map(id => {
                        const mark = byId(id);
                        return mark && <span key={id} title={mark.name}><img src={symbolImage(mark)} alt="" loading="lazy" /></span>;
                      })}
                      {recipe.requiredMarkIds.length > 5 && <span>+{recipe.requiredMarkIds.length - 5}</span>}
                    </div>
                  )}
                  <div className="catalogue-card-foot">
                    <div>
                      {recipe && <span>Указателей: {recipe.requiredMarkIds.length}</span>}
                      {drawable === false && <span>Нет образцов</span>}
                      {recipe && drawable !== false && (
                        <button type="button" className="catalogue-template" aria-label={`Разместить шаблон: ${recipe.name}`}
                          onClick={() => onPlaceRecipe(recipe)}>На лист практики</button>
                      )}
                    </div>
                    {collectionOnly && recipe && onRenameRecipe && (
                      <button type="button" className="collection-edit" title="Переименовать"
                        aria-label={`Переименовать: ${entry.name}`}
                        onClick={event => rename(recipe, event.currentTarget)}>
                        <Pencil size={17} aria-hidden="true" />
                      </button>
                    )}
                    <button type="button" className="catalogue-favorite" aria-pressed={saved}
                      aria-label={`${saved ? "Убрать из избранного" : "В избранное"}: ${entry.name}`}
                      onClick={() => favorite(entry.id)}>
                      <Star size={19} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="catalogue-empty">
            <h3>{collectionOnly && !personalSpells.length ? "Коллекция пока пуста" : "Подходящих записей нет"}</h3>
            <p>{collectionOnly && !personalSpells.length
              ? "Создайте свою формулу на листе практики и сохраните её после активации."
              : "Попробуйте другой запрос или снимите фильтры."}</p>
            {collectionOnly && !personalSpells.length && (
              <ol className="collection-steps">
                <li>Нарисуйте глиф в центре и указатели на четырёх сторонах.</li>
                <li>Обведите символы замкнутым кругом, чтобы завершить сигил и активировать заклинание.</li>
                <li>Дайте ей имя и сохраните в личный гримуар.</li>
              </ol>
            )}
            {collectionOnly && !personalSpells.length && <a className="collection-start" href="#/practice">Открыть лист практики</a>}
          </div>
        )}
        <Dialog.Root open={Boolean(editing)} onOpenChange={open => { if (!open) setEditing(null); }}>
          <Dialog.Portal>
            <Dialog.Overlay className="atelier-profile-overlay" />
            <Dialog.Content className="atelier-profile-dialog" onCloseAutoFocus={event => {
              event.preventDefault();
              editTrigger.current?.focus();
            }}>
              <Dialog.Title>Название формулы</Dialog.Title>
              <Dialog.Description>Изменится имя записи. Состав печати останется прежним.</Dialog.Description>
              <form onSubmit={event => {
                event.preventDefault();
                if (!editing) return;
                try {
                  onRenameRecipe?.(editing.id, editing.name);
                  setEditing(null);
                } catch (error) {
                  setRenameError(error instanceof Error ? error.message : "Не удалось переименовать формулу.");
                }
              }}>
                <label className="atelier-profile-name">
                  Название
                  <input required maxLength={80} value={editing?.name ?? ""}
                    onChange={event => { if (editing) setEditing({ ...editing, name: event.target.value }); }} />
                </label>
                {renameError && <p role="alert">{renameError}</p>}
                <div className="atelier-profile-actions">
                  <Dialog.Close type="button">Отмена</Dialog.Close>
                  <button type="submit" disabled={!editing?.name.trim()}>Сохранить имя</button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </section>
    );
  }

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
          Сигилы <span>{recipes.length}</span>
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
            <option value="basic">До четырёх указателей</option>
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
              Глифы
            </button>
            <button
              type="button"
              onClick={() => setKind("mark")}
              data-active={kind === "mark"}
            >
              Указатели
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
                : "Сигилы не найдены. Попробуйте другое название или фильтр."}
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
