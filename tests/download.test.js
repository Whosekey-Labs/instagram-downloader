import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadFile } from '../src/lib/download.js';

const item = {username:'meta', code:'Abc', index:1, type:'image', url:'https://s.cdninstagram.com/a.jpg'};
test('Chrome의 실제 완료 상태를 기다린 후 성공한다', async () => {
  let checks=0;
  const api = {download:async()=>1, search:async()=>[{state:++checks<2?'in_progress':'complete',mime:'image/jpeg'}],cancel:async()=>assert.fail()};
  await downloadFile(item, new AbortController().signal, api, {pollMs:1});
  assert.equal(checks,2);
});
test('다운로드 중단과 HTML 오류 페이지를 성공으로 처리하지 않는다', async () => {
  for(const state of [{state:'interrupted',error:'SERVER_FORBIDDEN'},{state:'complete',mime:'text/html'}]) {
    await assert.rejects(downloadFile(item,new AbortController().signal,{download:async()=>1,search:async()=>[state],cancel:async()=>{}},{pollMs:1}));
  }
});
test('취소하면 시작된 Chrome 다운로드도 취소한다', async () => {
  const controller=new AbortController(); let cancelled=false;
  const api={download:async()=>{controller.abort();return 9;},search:async()=>[],cancel:async id=>{assert.equal(id,9);cancelled=true;}};
  await assert.rejects(downloadFile(item,controller.signal,api),{name:'AbortError'});
  assert.equal(cancelled,true);
});
