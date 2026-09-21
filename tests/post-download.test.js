import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadPosts} from '../src/lib/post-download.js';
import {saveMediaThroughExtension} from '../src/lib/browser-download.js';

test('공통 다운로드는 모든 게시물에 동일한 조회·저장 의존성을 사용한다',async()=>{
  const resolved=[],saved=[];
  const result=await downloadPosts({posts:[{code:'A'},{code:'B'}],signal:new AbortController().signal,isCurrentProfile:()=>true,
    resolveMedia:async post=>{resolved.push(post.code);return [{id:post.code+'1'},{id:post.code+'2'}];},
    saveMedia:async item=>{saved.push(item.id);return {skipped:item.id==='A1'};},onProgress:()=>{},wait:async()=>{}});
  assert.deepEqual(resolved,['A','B']);assert.deepEqual(saved,['A1','A2','B1','B2']);
  assert.deepEqual(result,{saved:3,skipped:1,warning:''});
});
test('미디어 조회가 제한되면 공통 다운로드가 다음 게시물로 진행하지 않는다',async()=>{
  let requests=0;
  await assert.rejects(downloadPosts({posts:[{code:'A'},{code:'B'}],signal:new AbortController().signal,isCurrentProfile:()=>true,
    resolveMedia:async()=>{requests++;throw new Error('429 요청 제한');},saveMedia:async()=>assert.fail(),onProgress:()=>{},wait:async()=>{}}),/429/);
  assert.equal(requests,1);
});
test('파일 저장 어댑터는 시작 응답 대신 실제 완료 상태까지 기다린다',async()=>{
  const types=[];let polls=0;
  const result=await saveMediaThroughExtension({item:{id:'A'},token:'job',signal:new AbortController().signal,
    message:async m=>{types.push(m.type);return m.type==='OM_START'?{id:4}:{state:++polls===2?'complete':'in_progress'};},onPending:()=>{},wait:async()=>{}});
  assert.deepEqual(types,['OM_START','OM_STATUS','OM_STATUS']);assert.equal(result.skipped,false);
});
