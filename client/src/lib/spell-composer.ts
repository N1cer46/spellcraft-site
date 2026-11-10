import { byId, type SpellRecipe } from '../data/spellbook';

export type ComposedEffect = {
 material: 'fire'|'water'|'crystal'|'light'|'wind'|'bird'|'thread'|'barrier'|'petal';
 shape: 'flow'|'orb'|'column'|'spiral'|'rain'|'dome'|'window'|'diamond'|'blades';
 motion:'natural'|'jet'|'burst'|'gather'|'orbit'; copies:number; twist:boolean; frozen:boolean;
 scale:number; speed:number; spread:number; lift:number; intensity:number;
 reverse:boolean; pulse:boolean; mirror:boolean; hidden:boolean; stretch:number; facets:boolean; linked:boolean; drift:number; clarity:number;
};
const shapes: [string,ComposedEffect['shape'],string][] = [
 ['mark_orb','orb','Сфера'],['mark_column','column','Колонна'],['mark_coil','spiral','Спираль'],
 ['mark_rain','rain','Дождь'],['mark_rain_inverted','rain','Дождь'],
 ['mark_envelop','dome','Купол'],['mark_window','window','Завеса'],
 ['mark_entwine','spiral','Спираль'],['mark_diamond','diamond','Кристалл'],['mark_glaives','blades','Клинки'],
];
export function composeSpell(sigilId:string, rawMarkIds:string[]):SpellRecipe|null {
 const sigil=byId(sigilId);
 if(sigil?.kind!=='sigil'||rawMarkIds.length>44||rawMarkIds.some(id=>byId(id)?.kind!=='mark'))return null;
 const ids=Array.from(new Set(rawMarkIds)).sort();
 const has=(...keys:string[])=>keys.some(id=>ids.includes(id));
 const material:ComposedEffect['material']=sigilId.includes('fire')||sigilId.includes('torchstag')?'fire':
 sigilId.includes('water')||sigilId.includes('fish')?'water':
 sigilId.includes('wind')||sigilId==='sigil_aeriforms'?'wind':
 sigilId==='sigil_earth'||sigilId==='sigil_sword'?'crystal':
 sigilId.includes('bird')?'bird':sigilId==='sigil_flower'?'petal':
 sigilId==='sigil_stop'?'barrier':sigilId==='sigil_guidance'?'thread':'light';
 const chosen=shapes.find(([id])=>has(id));
 const shape=chosen?.[1]??(material==='barrier'?'dome':material==='water'?'orb':'flow');
 const effect:ComposedEffect={
  material,shape,
  motion:has('mark_project','mark_bolt')?'jet':has('mark_radial','mark_dispersion','mark_billow')?'burst':has('mark_gather','mark_convergence','mark_pull','mark_rain_inverted')?'gather':has('mark_float','mark_puppet')?'orbit':'natural',
  copies:has('mark_collection','mark_repetition')?3:1,
  twist:has('mark_coil','mark_entwine'),frozen:has('mark_stillness'),
  scale:has('mark_enlarge')===has('mark_enlarge_inverted')?1:has('mark_enlarge')?1.3:.6,
  speed:has('mark_stillness')?.2:has('mark_stability','mark_cool','mark_solidify')?.6:has('mark_bolt')?1.6:1,
  spread:has('mark_focus','mark_convergence','mark_gather','mark_crush','mark_crosshair')?.3:has('mark_region','mark_radial','mark_dispersion','mark_billow','mark_vision')?1.25:1,
  lift:has('mark_float','mark_levitation')?.07:0,
  intensity:has('mark_empower','mark_collection')?1.25:1,
  reverse:has('mark_pull','mark_rain_inverted'),
  pulse:has('mark_repetition','mark_bolt')||sigilId==='sigil_repetition',
  mirror:has('mark_reflect'),hidden:has('mark_conceal'),
  stretch:has('mark_stretch')?1.12:1,
  facets:has('mark_diamond','mark_glaives','mark_solidify'),
  linked:has('mark_bind','mark_link','mark_puppet','mark_entwine'),
  drift:has('mark_project')?.13:has('mark_sign_of_wind','mark_aeriforms_defined')?.035:0,
  clarity:has('mark_purify','mark_eye')?1.2:1,
 };
 const form=chosen?.[2]??(shape==='dome'?'Купол':shape==='orb'?'Сфера':'Поток');
 const names=ids.map(id=>byId(id)!);
 const accent=names.find(s=>s.id!==chosen?.[0]);
 const motion=effect.reverse?'Движение направлено к печати.':shape==='rain'?'Частицы опускаются к кругу.':'Проявление движется над кругом.';
 return {
  id:`custom:${sigilId}:${ids.join('+')}`,
  name:`${form} «${sigil.name}»${accent?' · '+accent.name.toLocaleLowerCase():''}`,
  sigilId,requiredMarkIds:ids,custom:true,
  description:`Основа — ${sigil.name.toLocaleLowerCase()}. Форма проявления: ${form.toLocaleLowerCase()}. ${motion} ${names.length?names.map(s=>`«${s.name}»: ${s.description}`).join(' '):'Чистое проявление сигила без модификаторов.'}${shapes.filter(([id])=>has(id)).length>1?' При нескольких знаках формы основную геометрию задаёт первый по приоритету: сфера, колонна, спираль, дождь, купол, завеса, кристалл, клинки; движение и размножение применяются поверх формы.':''}`,
  effect,
 };
}
