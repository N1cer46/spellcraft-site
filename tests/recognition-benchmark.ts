import { readFileSync } from 'node:fs';
import { recognizeSymbol, type InkStroke } from '../client/src/lib/recognizer';
import { setReferenceTemplatesForTests, type ReferenceTemplates, type ReferenceSample } from '../client/src/data/reference-templates';
import { allSymbols } from '../client/src/data/spellbook';
const templates: ReferenceTemplates = JSON.parse(readFileSync('client/public/reference-templates.json', 'utf8'));
const mode = process.argv[2] ?? 'split';
// Sample zero is held out for every class, including its transformed variants.
setReferenceTemplatesForTests(Object.fromEntries(Object.entries(templates).map(([id, samples]) => [id, samples.slice(1)])));
let correct = 0, top3 = 0, total = 0, accepted = 0;
const started = performance.now();
for (const [id, samples] of Object.entries(templates)) {
  let sample: ReferenceSample = structuredClone(samples[0]);
  if (mode === 'reverse') sample = sample.reverse().map(s => s.reverse());
  if (mode === 'split') sample = sample.flatMap(s => { const k = Math.floor(s.length / 2); return [s.slice(0, k + 1), s.slice(k)]; }).reverse();
  if (mode === 'freehand') {
    const all = sample.flat();
    const cx = (Math.min(...all.map(p=>p.x)) + Math.max(...all.map(p=>p.x))) / 2;
    const cy = (Math.min(...all.map(p=>p.y)) + Math.max(...all.map(p=>p.y))) / 2;
    const span = Math.max(...all.map(p=>p.x)) - Math.min(...all.map(p=>p.x));
    sample = sample.map((s, j) => s.map(p => {
      const x = (p.x-cx)*1.15, y = (p.y-cy)*0.9;
      return {x: 300 + x*Math.cos(.15)-y*Math.sin(.15) + span*.025*Math.sin(9*(p.y-cy)/Math.max(span,1)+j), y: 300 + x*Math.sin(.15)+y*Math.cos(.15)};
    }).reverse());
  }
  const strokes: InkStroke[] = sample.map((points,i) => ({id:String(i),points,finishedAt:0}));
  const candidates = allSymbols.filter(c => c.kind === allSymbols.find(c=>c.id===id)?.kind);
  const result = await recognizeSymbol(strokes, candidates);
  total++;
  if (result && result.score >= (id.startsWith("sigil_") ? .68 : .66) && result.coverage >= .86) accepted++;
  if (result?.candidate.id === id) correct++;
  else console.log(`${id} -> ${result?.candidate.id} (${result?.score.toFixed(3)})`);
  if (result && [result.candidate, ...result.runnerUps.map(r=>r.candidate)].some(c=>c.id===id)) top3++;
}
console.log(JSON.stringify({mode, correct, top3, total, accepted, ms:Math.round(performance.now()-started)}));
