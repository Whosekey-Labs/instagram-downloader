import test from 'node:test';
import assert from 'node:assert/strict';
import {DownloadService} from '../src/lib/download-service.js';
const sender={id:'ext',frameId:0,url:'https://www.instagram.com/meta/',tab:{id:7},documentId:'doc'};
const item={id:'meta:BA:1',username:'meta',code:'BA',index:1,type:'image',url:'https://s.cdninstagram.com/a.jpg'};
const token='job-123456789';
function setup(){
  const local={},session={};let state='in_progress',cancelled=0,started=0;
  const area=store=>({get:async key=>({[key]:structuredClone(store[key])}),set:async value=>Object.assign(store,structuredClone(value))});
  const api={runtime:{id:'ext'},storage:{local:area(local),session:area(session)},downloads:{download:async()=>++started,search:async()=>[{state,mime:'image/jpeg'}],cancel:async()=>cancelled++}};
  return {service:new DownloadService(api),api,local,session,setState:value=>state=value,counts:()=>({cancelled,started})};
}
test('다운로드 시작과 실제 완료를 구분하고 워커 재시작 후 기록을 복원한다',async()=>{
  const s=setup();const start=await s.service.handle({type:'OM_START',token,item},sender);
  assert.equal(start.id,1);assert.equal(s.local.completed,undefined);
  s.setState('complete');
  const restarted=new DownloadService(s.api);
  const result=await restarted.handle({type:'OM_STATUS',token,id:1},sender);
  assert.equal(result.state,'complete');assert.ok(s.local.completed[item.id]);
  assert.equal((await restarted.handle({type:'OM_START',token,item},sender)).skipped,true);
});
test('다른 탭의 다운로드 조회나 취소를 허용하지 않는다',async()=>{
  const s=setup();await s.service.handle({type:'OM_START',token,item},sender);
  await assert.rejects(s.service.handle({type:'OM_STATUS',token,id:1},{...sender,tab:{id:8}}),/권한/);
  await s.service.handle({type:'OM_CANCEL',token},{...sender,tab:{id:8}});
  assert.equal(s.counts().cancelled,0);
});
test('외부 발신자·다른 계정·임의 도메인 파일을 거절한다',async()=>{
  const s=setup();
  await assert.rejects(s.service.handle({type:'OM_START',token,item},{...sender,id:'evil'}));
  await assert.rejects(s.service.handle({type:'OM_START',token,item:{...item,username:'other'}},sender));
  await assert.rejects(s.service.handle({type:'OM_START',token,item:{...item,url:'https://evil.test/a'}},sender));
  assert.equal(s.counts().started,0);
});
test('중단 이벤트는 완료 기록을 만들지 않으며 해당 작업만 취소한다',async()=>{
  const s=setup();await s.service.handle({type:'OM_START',token,item},sender);
  await s.service.handle({type:'OM_CANCEL',token},sender);
  assert.equal(s.counts().cancelled,1);assert.equal(s.local.completed,undefined);
});
test('SPA로 게시물 화면에 이동한 뒤에도 기존 작업을 취소할 수 있다',async()=>{
  const s=setup();await s.service.handle({type:'OM_START',token,item},sender);
  await s.service.handle({type:'OM_CANCEL',token},{...sender,url:'https://www.instagram.com/p/BA/'});
  assert.equal(s.counts().cancelled,1);
});
test('완료 이벤트보다 다음 시작 요청이 먼저 와도 같은 파일을 다시 저장하지 않는다',async()=>{
  const s=setup();await s.service.handle({type:'OM_START',token,item},sender);s.setState('complete');
  const result=await s.service.handle({type:'OM_START',token,item},sender);
  assert.equal(result.skipped,true);assert.equal(s.counts().started,1);
});
