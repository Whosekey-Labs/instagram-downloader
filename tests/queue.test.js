import test from 'node:test';
import assert from 'node:assert/strict';
import { runQueue } from '../src/lib/queue.js';

test('성공한 항목만 기록하고 기존 완료 항목은 건너뛴다', async () => {
  const recorded = [];
  const result = await runQueue([{id:'a'},{id:'b'},{id:'c'}], {
    completed:new Set(['a']), signal:new AbortController().signal,
    download: async item => { if(item.id==='c') throw new Error('저장 실패'); },
    remember:async item => recorded.push(item.id), onProgress:()=>{}
  });
  assert.deepEqual(recorded,['b']);
  assert.deepEqual([result.saved,result.skipped,result.failed.length],[1,1,1]);
});
test('중단한 파일과 이후 파일을 완료로 기록하지 않는다', async () => {
  const controller = new AbortController();
  let calls = 0;
  const result = await runQueue([{id:'a'},{id:'b'}], {
    completed:new Set(), signal:controller.signal,
    download:async () => { calls++; controller.abort(); throw new DOMException('중단','AbortError'); },
    remember:async () => assert.fail('취소된 파일을 기록함'),onProgress:()=>{}
  });
  assert.equal(calls,1);
  assert.equal(result.saved,0);
  assert.equal(result.cancelled,true);
});

test('파일은 저장됐지만 기록 저장이 실패하면 중복 집계하지 않는다',async()=>{
  const result=await runQueue([{id:'a'}],{completed:new Set(),signal:new AbortController().signal,download:async()=>{},remember:async()=>{throw new Error('저장소 용량 초과');},onProgress:()=>{}});
  assert.equal(result.saved,1);
  assert.equal(result.failed.length,0);
  assert.equal(result.warnings.length,1);
});
