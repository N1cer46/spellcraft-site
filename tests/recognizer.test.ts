import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { recognizeSymbol, clusterStrokes, detectCircle, findContinuation, type InkStroke } from '../client/src/lib/recognizer';
import { setReferenceTemplatesForTests, type ReferenceTemplates, type ReferenceSample } from '../client/src/data/reference-templates';
import { allSymbols, marks, type SymbolDefinition } from '../client/src/data/spellbook';
const templates: ReferenceTemplates = JSON.parse(readFileSync('client/public/reference-templates.json', 'utf8'));
const ink = (sample: ReferenceSample): InkStroke[] => sample.map((points, i) => ({id: String(i), points, finishedAt: Date.now()}));

test('all recorded symbols tolerate pen reversal, reordered strokes and extra pen lifts', async () => {
  setReferenceTemplatesForTests(templates);
  for (const [id, samples] of Object.entries(templates)) {
    const candidates = allSymbols.filter(c => c.kind === allSymbols.find(c => c.id === id)?.kind);
    const sample = samples[0];
    const variants = [sample, [...sample].reverse().map(s => [...s].reverse()), sample.flatMap(s => {
      const cut = Math.floor(s.length / 2);
      return [s.slice(0, cut + 1), s.slice(cut)];
    }).reverse()];
    for (const variant of variants) {
      const result = await recognizeSymbol(ink(variant), candidates);
      assert.equal(result?.candidate.id, id);
      assert.ok(result.score >= (id.startsWith("sigil_") ? .68 : .66), `${id}: ${result.score}`);
      assert.ok(result.coverage >= .86, `${id}: ${result.coverage}`);
    }
  }
});

test('held-out drawings with tilt, proportion changes and smooth distortions', async () => {
  setReferenceTemplatesForTests(Object.fromEntries(Object.entries(templates).map(([id, samples]) => [id, samples.slice(1)])));
  let correct = 0;
  for (const [id, samples] of Object.entries(templates)) {
    const all = samples[0].flat();
    const minX = Math.min(...all.map(p=>p.x)), minY = Math.min(...all.map(p=>p.y));
    const span = Math.max(...all.map(p=>p.x)) - minX;
    const sample = samples[0].map((s,j) => s.map(p => {
      const x = (p.x-minX)*1.15, y = (p.y-minY)*.9;
      return {x: 270+x*Math.cos(.15)-y*Math.sin(.15)+span*.025*Math.sin(9*(p.y-minY)/Math.max(span,1)+j), y: 160+x*Math.sin(.15)+y*Math.cos(.15)};
    }).reverse());
    const candidates = allSymbols.filter(c => c.kind === allSymbols.find(c=>c.id===id)?.kind);
    const result = await recognizeSymbol(ink(sample), candidates);
    if (result?.candidate.id === id) correct++;
  }
  assert.ok(correct >= 23, `${correct}/24 held-out synthetic drawings`);
});

test('pen direction is independent of the orientation of the actual shape', async () => {
  const up = [[{x:0,y:100},{x:50,y:0},{x:100,y:100}]];
  const down = up.map(s => s.map(p => ({x:p.x, y:100-p.y})));
  setReferenceTemplatesForTests({ up:[up], down:[down] });
  const candidates = [{id:'up'}, {id:'down'}] as SymbolDefinition[];
  assert.equal((await recognizeSymbol(ink(up.map(s=>[...s].reverse())),candidates))?.candidate.id,'up');
  assert.equal((await recognizeSymbol(ink(down),candidates))?.candidate.id,'down');
  // Replacing the dataset must invalidate prepared geometry for the same ID.
  setReferenceTemplatesForTests({up:[down],down:[up]});
  assert.equal((await recognizeSymbol(ink(up),candidates))?.candidate.id,'down');
});

test('reject degenerate inputs and avoid confident matches for missing ink or scribbles', async () => {
  setReferenceTemplatesForTests(templates);
  for (const sample of [[], [[]], [[{x:1,y:1},{x:1,y:1}]], [[{x:NaN,y:0},{x:10,y:20}]]]) {
    assert.equal(await recognizeSymbol(ink(sample),marks), null);
  }
  const partial = await recognizeSymbol(ink(templates.mark_column[0].slice(0,1)), marks);
  assert.ok(partial && (partial.score < .66 || partial.coverage < .86 || (partial.runnerUp && partial.score - partial.runnerUp.score < .08)));
  for (const sample of [ [[{x:0,y:0},{x:100,y:0}]], [[{x:0,y:0},{x:100,y:100},{x:0,y:100},{x:100,y:0}]] ]) {
    const result = await recognizeSymbol(ink(sample),marks);
    assert.ok(result && result.score < .66);
  }
});

test('slowly drawn multipart symbols stay editable; distant ring symbols remain separate', () => {
  const sample = ink([[{x:80,y:40},{x:160,y:40},{x:160,y:120},{x:80,y:120},{x:80,y:40}], [{x:120,y:120},{x:120,y:180}]]);
  assert.deepEqual(clusterStrokes(sample,720,720).map(g=>g.strokeIds), [['0','1']]);
  const far = {id:'far',points:[{x:500,y:30},{x:500,y:100}],finishedAt:Date.now()};
  assert.equal(clusterStrokes([...sample,far],720,720).length,2);
});

test('continuation cannot consume a distant recognized symbol', async () => {
  setReferenceTemplatesForTests(templates);
  const sample = ink(templates.mark_column[0]);
  sample[0].points = sample[0].points.map(p=>({x:p.x+2000,y:p.y}));
  const merged = await findContinuation({strokes:sample,clusterIds:['1'],zone:'ring',recognitions:[{symbolId:'mark_column',score:.5,strokeIds:['0'],zone:'ring'}],width:720,height:720,candidates:marks,baseline:0,threshold:0});
  assert.equal(merged,null);
});

test('closing circle requires other ink and encloses the composition', () => {
  const points = Array.from({length:100},(_,i)=>({x:360+280*Math.cos(i*2*Math.PI/99), y:360+280*Math.sin(i*2*Math.PI/99)}));
  const circle = ink([points])[0];
  assert.equal(detectCircle(circle,[],720,720).isCircle,false);
  assert.equal(detectCircle(circle,ink([[{x:340,y:340},{x:380,y:380}]]),720,720).isCircle,true);
  assert.equal(detectCircle(circle,ink([[{x:700,y:700},{x:710,y:710}]]),720,720).isCircle,false);
});

test('an independently constructed T is recognized without tracing a recorded sample',async()=>{
  setReferenceTemplatesForTests(templates);
  const result=await recognizeSymbol(ink([[{x:0,y:0},{x:100,y:0}],[{x:50,y:0},{x:50,y:100}]]),marks);
  assert.equal(result?.candidate.id,'mark_column');
  assert.ok(result.score>.8 && result.coverage>.9);
});
