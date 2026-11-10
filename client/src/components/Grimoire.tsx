/**
 * Design system: a green-bound grimoire with paper reference notes.
 */
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { allSymbols, spellRecipes, symbolImage, type SpellRecipe, type SymbolDefinition } from "@/data/spellbook";

import { loadReferenceTemplates } from "@/data/reference-templates";

type Props = {
  onDeleteRecipe?: (id:string)=>void;
  personalSpells?: SpellRecipe[];
  libraryError?: string;
  selectedSymbol: SymbolDefinition | null;
  selectedRecipe: SpellRecipe | null;
  onPlaceRecipe: (recipe: SpellRecipe) => void;
  onSelectSymbol: (symbol: SymbolDefinition | null) => void;
  onSelectRecipe: (recipe: SpellRecipe | null) => void;
};

export default function Grimoire({ selectedSymbol, selectedRecipe, onSelectSymbol, onSelectRecipe, onPlaceRecipe, personalSpells = [], libraryError, onDeleteRecipe }: Props) {
  const recipes=[...spellRecipes,...personalSpells];
  const [available, setAvailable] = useState<Set<string> | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadReferenceTemplates().then(data => {
      if (!cancelled) setAvailable(new Set(Object.keys(data).filter(id => data[id].length)));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const [mode, setMode] = useState<"symbols" | "spells">("symbols");
  const [kind, setKind] = useState<"all" | "sigil" | "mark">("all");
  const [search, setSearch] = useState("");
  const symbols = useMemo(() => allSymbols.filter((symbol) => (kind === "all" || symbol.kind === kind) && `${symbol.name} ${symbol.group} ${symbol.description}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [kind, search]);
  const showSymbol = (symbol: SymbolDefinition) => { onSelectRecipe(null); onSelectSymbol(symbol); };
  const showRecipe = (recipe: SpellRecipe) => { onSelectSymbol(null); onSelectRecipe(recipe); };

  return (
    <aside className="grimoire-panel">
      <div className="grimoire-heading">
        <div><p className="eyebrow">Картотека</p><h2>Гримуар</h2></div>
        <BookOpen size={20} aria-hidden="true" />
      </div>
      {libraryError && <p role="alert" className="empty-reading">{libraryError}</p>}
      <div className="mode-switch">
        <button type="button" onClick={() => setMode("symbols")} data-active={mode === "symbols"}>Символы <span>{allSymbols.length}</span></button>
        <button type="button" onClick={() => setMode("spells")} data-active={mode === "spells"}>Заклинания <span>{recipes.length}</span></button>
      </div>
      {mode === "symbols" ? <>
        <label className="search-box"><Search size={15} /><input aria-label="Поиск символа по названию или эффекту" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Название или эффект" /></label>
        <div className="filter-row"><button type="button" onClick={() => setKind("all")} data-active={kind === "all"}>Все</button><button type="button" onClick={() => setKind("sigil")} data-active={kind === "sigil"}>Сигилы</button><button type="button" onClick={() => setKind("mark")} data-active={kind === "mark"}>Знаки</button></div>
        <div className="symbol-list">
          {!symbols.length && <p className="empty-reading" role="status">Символы не найдены. Попробуйте другое название или фильтр.</p>}
          {symbols.map((symbol) => <div className="symbol-card" data-active={selectedSymbol?.id === symbol.id} key={symbol.id}>
            <span className="symbol-thumb"><img src={symbolImage(symbol)} alt="" /></span><span><strong>{symbol.name}</strong><small>{symbol.group}{available && !available.has(symbol.id) ? " · нет образцов" : ""}</small></span><div className="catalog-actions"><button type="button" onClick={() => showSymbol(symbol)} aria-label={`Посмотреть информацию: ${symbol.name}`}>Посмотреть информацию</button></div>
          </div>)}
        </div>
      </> : <div className="spell-list">{recipes.map((recipe) => <div className="recipe-card" data-active={selectedRecipe?.id === recipe.id} key={recipe.id}><span className="recipe-index">{String(recipes.indexOf(recipe) + 1).padStart(2, "0")}</span><span><strong>{recipe.name}</strong><small>{recipe.custom?"Личная формула · сохранена на этом устройстве":recipe.description}</small></span><div className="catalog-actions"><button type="button" onClick={() => showRecipe(recipe)} aria-label={`Посмотреть информацию: ${recipe.name}`}>Посмотреть информацию</button><button type="button" className="place-template" onClick={() => onPlaceRecipe(recipe)} aria-label={`Разместить шаблон: ${recipe.name}`}>Разместить шаблон</button>{recipe.custom&&<button type="button" className="delete-recipe" onClick={()=>onDeleteRecipe?.(recipe.id)} aria-label={`Удалить заклинание: ${recipe.name}`}>Удалить из гримуара</button>}</div></div>)}</div>}
    </aside>
  );
}
