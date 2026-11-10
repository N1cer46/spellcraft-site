import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Feather } from 'lucide-react';
import { byId, sigils, marks, spellRecipes, symbolImage, type SpellRecipe, type SymbolDefinition } from '@/data/spellbook';
import { loadReferenceTemplates } from '@/data/reference-templates';

type Props = { personalSpells?: SpellRecipe[]; symbol: SymbolDefinition | null; recipe: SpellRecipe | null; onBack: () => void; onSymbol: (symbol: SymbolDefinition) => void; onRecipe: (recipe: SpellRecipe) => void };
const groupNotes: Record<string,string> = {
  'Стихии':'Стихия задаёт материал будущего проявления. Его направление и форму определяют знаки вокруг ядра.',
  'Существа':'Образ существа служит ядром композиции. В этом гримуаре такие формы трактуются как магические проявления, а не как создание живого существа.',
  'Растения и предметы':'Эти сигилы задают образ или назначение магии. Сначала сохраните узнаваемый силуэт, затем добавляйте модификаторы.',
  'Масштаб и форма':'Знаки этой группы отвечают за очертания проявления. Сравнивайте пропорции и расположение деталей с эталоном.',
  'Направление и движение':'Этот знак уточняет, куда и как движется проявление. Не поворачивайте эталон случайно: ориентация входит в рисунок символа.',
  'Связывание и структура':'Такие знаки организуют проявление: соединяют, закручивают или закрепляют его части.',
  'Область и повтор':'Эта группа задаёт распределение действия. Оставляйте расстояние между отдельными знаками, чтобы они не слились в один рисунок.',
  'Восприятие':'Знаки восприятия определяют способ наблюдения или направления внимания. Смысл раскрывается в сочетании с центральным сигилом.',
  'Интенсивность и состояние':'Эта группа меняет характер проявления: его концентрацию, устойчивость или состояние.',
  'Удар и разрушение':'Эти знаки описывают характер силового воздействия. Сам знак не выбирает стихию — её задаёт сигил.',
  'Разное':'Дополнительный модификатор уточняет основное действие. Его роль зависит от выбранной формулы.',
};
const spellNotes: Record<string,string> = {
 'fire-lance':'Направление и фокус собирают огонь в узкий поток. В анимации он вытягивается вверх с небольшим отклонением от центра.',
 'fire-column':'Колонна задаёт вертикальную форму, а усиление подчёркивает её мощность. Огонь непрерывно поднимается над центром печати.',
 'water-orb':'Сфера задаёт замкнутую форму воды, стабильность удерживает её. Над печатью появляется парящая водяная масса с движущимися бликами.',
 rainfield:'Дождь дробит воду на капли, область ограничивает их распределение. Капли падают к плоскости круга и оставляют небольшие всплески.',
 'crystal-spire':'Ромб задаёт грани, схождение собирает минеральное проявление к оси. В сцене поднимаются полупрозрачные кристаллические частицы.',
 'light-window':'Окно задаёт форму, видение — назначение. Свет проявляется как непрерывная завеса тонких светящихся следов.',
 'wind-step':'Левитация задаёт подъём, знак ветра поддерживает воздушное движение. Над печатью закручиваются восходящие струи.',
 cyclone:'Скручивание создаёт спираль, рассеивание раскрывает её наружу. Воздушные следы образуют расширяющийся вихрь.',
 'winged-choir':'Связывание объединяет крылатые формы, марионетка задаёт совместное движение. Светлые птицы кружат над печатью.',
 'guiding-thread':'Глаз и фокус превращают направляющий свет в точную линию. Её изгиб непрерывно меняется над кругом.',
 'sealed-barrier':'Область задаёт границы, отверждение закрепляет защитную структуру. Мерцающие ячейки складываются в купол над печатью.',
 bloom:'Увеличение и радиальное распространение раскрывают растительный образ. Лепестки поднимаются и расходятся вокруг центра.',
};
export default function GrimoireEntry({symbol,recipe,onBack,onSymbol,onRecipe,personalSpells=[]}:Props) {
 const ref=useRef<HTMLElement>(null);
 const [available,setAvailable]=useState<Set<string>|null>(null);
 const [loadFailed,setLoadFailed]=useState(false);
 useEffect(()=>{let alive=true;loadReferenceTemplates().then(data=>{if(alive)setAvailable(new Set(Object.keys(data).filter(id=>data[id].length)));}).catch(()=>{if(alive)setLoadFailed(true);});return()=>{alive=false;};},[]);
 useEffect(()=>{ref.current?.focus({preventScroll:true});ref.current?.scrollIntoView({block:'start',behavior:'instant'});},[symbol?.id,recipe?.id]);
 const entry=symbol??recipe;
 if(!entry)return null;
 const recipes=[...spellRecipes,...personalSpells];
 const entries=recipe?recipes:symbol?.kind==='sigil'?sigils:marks;
 const index=entries.findIndex(item=>item.id===entry.id);
 const previous=entries[index-1];
 const next=entries[index+1];
 const turnPage=(offset:number)=>{
  if(recipe){const target=recipes[index+offset];if(target)onRecipe(target);}
  else {const target=(symbol?.kind==='sigil'?sigils:marks)[index+offset];if(target)onSymbol(target);}
 };
 const parts=recipe?[byId(recipe.sigilId)!,...recipe.requiredMarkIds.map(id=>byId(id)!)]:[symbol!];
 const related=symbol?recipes.filter(r=>r.sigilId===symbol.id||r.requiredMarkIds.includes(symbol.id)||r.optionalMarkIds?.includes(symbol.id)):[];
 const missing=available?parts.filter(p=>!available.has(p.id)):[];
 return <article className="grimoire-entry" ref={ref} tabIndex={-1} aria-labelledby="entry-title">
  <header className="entry-toolbar"><span className="eyebrow">Гримуар / {recipe?'Заклинания':symbol?.kind==='sigil'?'Сигилы':'Знаки'}</span><button type="button" className="entry-back" onClick={onBack}><ArrowLeft size={16}/>К рисованию</button></header>
  <div className="entry-opening"><div className="entry-plate"><img src={symbolImage(parts[0])} alt={parts[0].name}/><span>{recipe?'Печать начинается с сигила':symbol?.kind==='sigil'?'Ядро композиции':'Модификатор в кольце'}</span></div><div><p className="eyebrow">{symbol?.group??'Собрание формул'}</p><h2 id="entry-title">{entry.name}</h2><p className="entry-lead">{entry.description}</p><p>{recipe?(recipe.custom?'Авторская формула. Анимация условно передаёт материал, основную форму и движение; значения остальных знаков приведены в описании.':spellNotes[recipe.id]):groupNotes[symbol!.group]}</p></div></div>
  <div className="entry-columns"><section><h3>{recipe?'Как составить печать':'Как начертить'}</h3><ol>{recipe?<><li>Нарисуйте «{parts[0].name}» в центре листа.</li><li>{parts.length===1?"Это старая формула без знаков. Для активации добавьте минимум четыре знака — получится новое сочетание.":"Расположите вокруг него знаки: "}{parts.slice(1).map(p=>`«${p.name}»`).join(', ')}</li><li>Расположите минимум четыре знака: сверху, справа, снизу и слева от сигила. Если в составе меньше четырёх знаков, повторите их на свободных сторонах. Дождитесь их распознавания и замкните общий круг.</li></>:<><li>{symbol!.kind==='sigil'?'Разместите символ в центральной части листа.':'Расположите знак сверху, справа, снизу или слева от сигила. Перед активацией все четыре стороны должны быть заполнены.'}</li><li>Сохраняйте пропорции и ориентацию эталона. Сложную форму можно рисовать несколькими штрихами.</li><li>Детали одного символа располагайте близко, а между разными символами оставляйте промежутки.</li></>}</ol></section><section className="entry-margin"><Feather size={20}/><h3>Заметка ученику</h3><p>{recipe?'Если печать не активируется, проверьте все обязательные знаки и убедитесь, что внешний круг охватывает их целиком.':'Не пытайтесь провести весь рисунок одним движением. Отрывать перо можно: близкие штрихи собираются в один символ.'}</p><p className="entry-status" role="status">{loadFailed?'Не удалось проверить образцы распознавания. Изображения и советы доступны.':!available?'Проверяем образцы распознавания…':missing.length?`Пока нет образцов для: ${missing.map(p=>p.name).join(', ')}. Можно изучить форму по изображению; распознавание этой ${recipe?'формулы':'формы'} пока недоступно.`:'Образцы распознавания доступны. Изучите форму и попробуйте нарисовать её на листе практики.'}</p></section></div>
  {recipe&&<section className="entry-related"><h3>Из чего состоит заклинание</h3><div className="entry-formula">{parts.map((p,i)=><button type="button" key={p.id} onClick={()=>onSymbol(p)}><img src={symbolImage(p)} alt=""/><span><small>{i===0?'Сигил':'Обязательный знак'}</small><strong>{p.name}</strong><span>{p.description}</span></span></button>)}</div>{Boolean(recipe.optionalMarkIds?.length)&&<p>Дополнительные знаки: {recipe.optionalMarkIds!.map(id=><button className="entry-inline" type="button" key={id} onClick={()=>onSymbol(byId(id)!)}>{byId(id)!.name}</button>)}</p>}</section>}
  {symbol&&<section className="entry-related"><h3>Встречается в формулах</h3>{related.length?<div className="entry-recipes">{related.map(r=><button type="button" key={r.id} onClick={()=>onRecipe(r)}><strong>{r.name}</strong><span>{r.description}</span>{r.optionalMarkIds?.includes(symbol.id)&&<small>Дополнительный знак</small>}</button>)}</div>:<p>В текущем собрании нет готовой формулы с этим символом. Его можно изучать и отрабатывать отдельно.</p>}</section>}
  <nav className="entry-pagination" aria-label="Перелистывание гримуара">
   <button type="button" disabled={!previous} onClick={()=>turnPage(-1)} aria-label={previous?`Предыдущая запись: ${previous.name}`:'Предыдущая запись'}><ArrowLeft size={16}/><span><small>Предыдущая</small><strong>{previous?.name??'Начало раздела'}</strong></span></button>
   <span className="entry-page-number">{index+1} / {entries.length}</span>
   <button type="button" disabled={!next} onClick={()=>turnPage(1)} aria-label={next?`Следующая запись: ${next.name}`:'Следующая запись'}><span><small>Следующая</small><strong>{next?.name??'Конец раздела'}</strong></span><ArrowRight size={16}/></button>
  </nav>
  <footer className="entry-footer"><span>Толкования и советы относятся к этому симулятору.</span></footer>
 </article>;
}
