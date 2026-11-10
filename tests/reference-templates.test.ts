import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadReferenceTemplates} from '../client/src/data/reference-templates';

test('loading validates points and retries transient failures without caching an empty database',async()=>{
  const original=globalThis.fetch;
  let attempts=0;
  globalThis.fetch=(async()=>{
    attempts++;
    if(attempts===1) return {ok:false,status:503};
    if(attempts===2) return {ok:true,json:async()=>({bad:[[[{x:'not a number',y:0}]]]})};
    return {ok:true,json:async()=>({good:[[[{x:0,y:0},{x:10,y:20}]]]})};
  }) as typeof fetch;
  try {
    await assert.rejects(loadReferenceTemplates(),/503/);
    await assert.rejects(loadReferenceTemplates(),/формат/);
    const [a,b]=await Promise.all([loadReferenceTemplates(),loadReferenceTemplates()]);
    assert.equal(attempts,3);
    assert.equal(a,b);
    assert.equal(a.good.length,1);
  } finally {globalThis.fetch=original;}
});
