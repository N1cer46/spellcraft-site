import { composeSpell } from './spell-composer';
import type { SpellRecipe } from '../data/spellbook';

const KEY='spellcraft.personal-grimoire.v1';
export const PERSONAL_LIMIT=200;
export function spellName(value:string):string {
 const name=value.trim();
 if(!name||name.length>80)throw new Error('Название должно содержать от 1 до 80 символов.');
 return name;
}
type StorageAccess=Pick<Storage,'getItem'|'setItem'>;
export function loadPersonalSpells(storage:StorageAccess):SpellRecipe[]{
 const text=storage.getItem(KEY);
 if(!text)return [];
 const data:unknown=JSON.parse(text);
 if(!Array.isArray(data)||data.length>PERSONAL_LIMIT)throw new Error('Некорректный формат личного гримуара.');
 const result:SpellRecipe[]=[];
 for(const row of data){
  if(!row||typeof row.sigilId!=='string'||!Array.isArray(row.markIds)||row.markIds.some((id:unknown)=>typeof id!=='string'))throw new Error('Повреждена запись личного гримуара.');
  const recipe=composeSpell(row.sigilId,row.markIds);
  if(recipe&&row.name!==undefined){if(typeof row.name!=='string')throw new Error('Некорректное название.');recipe.name=spellName(row.name);}
  if(!recipe)throw new Error('В личном гримуаре есть неизвестные символы.');
  if(!result.some(item=>item.id===recipe.id))result.push(recipe);
 }
 return result;
}
export function savePersonalSpell(storage:StorageAccess,recipe:SpellRecipe):SpellRecipe[]{
 const canonical=composeSpell(recipe.sigilId,recipe.requiredMarkIds);
 if(!recipe.custom||!canonical)throw new Error('Можно сохранить только составленную формулу.');
 canonical.name=spellName(recipe.name);
 const current=loadPersonalSpells(storage);
 if(current.some(item=>item.id===canonical.id))return current;
 if(current.length>=PERSONAL_LIMIT)throw new Error('Личный гримуар заполнен (200 формул).');
 const next=[...current,canonical];
 storage.setItem(KEY,JSON.stringify(next.map(item=>({sigilId:item.sigilId,markIds:item.requiredMarkIds,name:item.name}))));
 return next;
}

export function deletePersonalSpell(storage:StorageAccess,id:string):SpellRecipe[]{
 const next=loadPersonalSpells(storage).filter(recipe=>recipe.id!==id);
 storage.setItem(KEY,JSON.stringify(next.map(item=>({sigilId:item.sigilId,markIds:item.requiredMarkIds,name:item.name}))));
 return next;
}
