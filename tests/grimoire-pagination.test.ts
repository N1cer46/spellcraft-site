import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {grimoireFieldNotes,grimoireLore} from '../client/src/data/grimoire-lore';
import * as spellbook from '../client/src/data/spellbook';

test('entry pagination stays in its category, stops at boundaries and has only one return button',()=>{
 const jsx=(type:unknown,props:any)=>({type,props});
 const modules:any={
  react:{useState:(value:unknown)=>[value,()=>{}],useRef:()=>({current:null}),useEffect:()=>{}},
  'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':{},
  '@/data/spellbook':{...spellbook,symbolImage:()=>'/symbol.svg'},
  '@/data/reference-templates':{},
  '@/data/grimoire-lore':{grimoireFieldNotes,grimoireLore},
 };
 const source=ts.transpileModule(readFileSync('client/src/components/GrimoireEntry.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{} as any};
 new Function('require','module','exports',source)((id:string)=>modules[id],module,module.exports);
 const nodes=(tree:any):any[]=>!tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];
 for(const [category,entries] of [['sigils',spellbook.sigils],['marks',spellbook.marks],['recipes',spellbook.spellRecipes]] as const){
  let chosen:any;
  let backCount=0;
  const render=(index:number)=>module.exports.default({
   symbol:category==='recipes'?null:entries[index],
   recipe:category==='recipes'?entries[index]:null,
   onBack:()=>backCount++,
   onSymbol:(symbol:any)=>{assert.notEqual(category,'recipes');chosen=symbol;},
   onRecipe:(recipe:any)=>{assert.equal(category,'recipes');chosen=recipe;},
  });
  for(const index of [0,1,entries.length-1]){
   const tree=render(index);
   const all=nodes(tree);
   const back=all.filter(n=>n.props?.className==='entry-back');
   assert.equal(back.length,1);
   back[0].props.onClick();
   const nav=all.find(n=>n.type==='nav');
   const buttons=nodes(nav).filter(n=>n.type==='button');
   assert.equal(buttons[0].props.disabled,index===0);
   assert.equal(buttons[1].props.disabled,index===entries.length-1);
   if(index>0){buttons[0].props.onClick();assert.equal(chosen.id,entries[index-1].id);}
   if(index<entries.length-1){buttons[1].props.onClick();assert.equal(chosen.id,entries[index+1].id);}
  }
  assert.equal(backCount,3);
 }
});

test('each catalogue entry has its own lore',()=>{
 const ids=[...spellbook.allSymbols,...spellbook.spellRecipes].map(entry=>entry.id);
 assert.deepEqual(Object.keys(grimoireLore).sort(),ids.sort());
 assert.equal(new Set(Object.values(grimoireLore)).size,ids.length);
 assert.deepEqual(Object.keys(grimoireFieldNotes).sort(),ids);
 assert.ok(Object.values(grimoireFieldNotes).every(notes=>notes?.length===2 && notes.every(note=>note.trim())));
});
