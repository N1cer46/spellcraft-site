import {byId, spellRecipes} from '../data/spellbook';
export const PROGRESS_KEY='spellcraft.learning.v1';
export const lessons=[
 {id:'i-fire',stage:1,title:'Первый сигил',symbolId:'sigil_fire'},
 {id:'i-light',stage:1,title:'Начертание света',symbolId:'sigil_light'},
 {id:'i-column',stage:1,title:'Первый знак',symbolId:'mark_column'},
 {id:'ii-orb',stage:2,title:'Сферическая форма',symbolId:'mark_orb'},
 {id:'ii-coil',stage:2,title:'Спираль и движение',symbolId:'mark_coil'},
 {id:'ii-focus',stage:2,title:'Точность фокуса',symbolId:'mark_focus'},
 {id:'iii-fire',stage:3,title:'Четыре стороны огня',recipeId:'fire-column'},
 {id:'iii-water',stage:3,title:'Устойчивая вода',recipeId:'water-orb'},
 {id:'iii-wind',stage:3,title:'Составная печать ветра',recipeId:'cyclone'},
] as const;
export type Progress={completed:string[]; symbols:Record<string,{attempts:number;success:number;score:number}>;materials:Record<string,number>;days:string[];casts:number};
export const emptyProgress=():Progress=>({completed:[],symbols:{},materials:{},days:[],casts:0});
export const dayKey=(date=new Date())=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
const dayNumber=(key:string)=>Date.parse(key+'T00:00:00Z')/86400000;
export function dailyRecipe(key:string){return spellRecipes[((Math.floor(dayNumber(key))%spellRecipes.length)+spellRecipes.length)%spellRecipes.length];}
export function streak(days:string[],today:string){const set=new Set(days);let n=dayNumber(today);if(!set.has(today))n--;let count=0;while(set.has(new Date(n*86400000).toISOString().slice(0,10))){count++;n--;}return count;}
export function recordAttempt(p:Progress,id:string,score:number|null):Progress{
 const old=p.symbols[id]??{attempts:0,success:0,score:0};
 return {...p,symbols:{...p.symbols,[id]:{attempts:old.attempts+1,success:old.success+(score===null?0:1),score:old.score+(score??0)}}};
}
export function loadProgress(storage:Pick<Storage,'getItem'>):Progress{
 const raw=storage.getItem(PROGRESS_KEY);if(!raw)return emptyProgress();
 const p=JSON.parse(raw);
 const count=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
 if(!p||!Array.isArray(p.completed)||!p.completed.every((id:unknown)=>lessons.some(l=>l.id===id))||!Array.isArray(p.days)||!p.days.every((d:unknown)=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(dayNumber(d))&&new Date(dayNumber(d)*86400000).toISOString().slice(0,10)===d)||!count(p.casts)||!p.symbols||typeof p.symbols!=='object'||Array.isArray(p.symbols)||!p.materials||typeof p.materials!=='object'||Array.isArray(p.materials))throw new Error('Некорректный прогресс');
 for(const [id,s] of Object.entries(p.symbols) as [string,any][])if(!byId(id)||!s||!count(s.attempts)||!count(s.success)||s.success>s.attempts||!Number.isFinite(s.score)||s.score<0||s.score>s.success)throw new Error('Некорректная статистика');
 for(const [id,n] of Object.entries(p.materials))if(byId(id)?.kind!=='sigil'||!count(n))throw new Error('Некорректный материал');
 return p;
}
