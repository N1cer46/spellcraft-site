import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveSpell} from '../client/src/lib/spell-engine';
import {spellRecipes} from '../client/src/data/spellbook';
import type {Recognition,InkStroke} from '../client/src/lib/recognizer';

test('activation requires recognised marks in all four cardinal sectors for built-in and custom formulas',()=>{
 for(const ids of [spellRecipes[0].requiredMarkIds,Array(4).fill('mark_orb')]){
  const readings:Recognition[]=['sigil_fire',...ids].map((symbolId,i)=>({symbolId,zone:i?'ring':'center',strokeIds:[String(i)],score:1}));
  const points=[[360,360],[360,160],[560,360],[360,560],[160,360]];
  const strokes:InkStroke[]=points.map(([x,y],i)=>({id:String(i),finishedAt:0,points:[{x,y}]}));
  assert.ok(resolveSpell(readings,strokes).recipe);
  assert.equal(resolveSpell(readings.slice(0,4),strokes).recipe,null);
  assert.match(resolveSpell(readings.slice(0,4),strokes).error!,/слева/);
  strokes[4].points=[{x:560,y:360}];
  assert.equal(resolveSpell(readings,strokes).recipe,null,'four marks on three sides must fail');
  strokes[4].points=[{x:160,y:160}];
  assert.equal(resolveSpell(readings,strokes).recipe,null,'diagonal must not substitute the left side');
  assert.equal(resolveSpell(readings,[]).recipe,null);
 }
 assert.ok(spellRecipes.every(r=>r.requiredMarkIds.length===4));
});
