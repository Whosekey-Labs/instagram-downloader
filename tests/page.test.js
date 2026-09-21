import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { profileFromPath, readPosts, shortcodeToId, collectAll } from '../src/lib/page.js';

test('프로필 게시물 탭에서만 계정을 인식한다',()=>{
  assert.equal(profileFromPath('/meta/'),'meta');
  for(const path of ['/','/p/ABC/','/accounts/login/','/meta/tagged/','/meta/reels/','/explore/']) assert.equal(profileFromPath(path),null);
});
test('현재 화면의 게시물만 선택하고 추천·아바타·중복 링크를 제외한다',()=>{
  const dom=new JSDOM('<main><header><a href="/p/Avatar/"><img></a></header><a href="/meta/p/Abc/"><img></a><a href="/other/reel/Def/"><img></a><a href="/p/Abc/"><img></a><a href="/p/Below/"><img></a></main><aside><a href="/p/Aside/"><img></a></aside>',{url:'https://www.instagram.com/meta/'});
  dom.window.document.querySelectorAll('a').forEach(a=>{a.getBoundingClientRect=()=>({top:a.href.includes('Below')?1200:100,bottom:a.href.includes('Below')?1400:300,left:0,right:200,width:200,height:200});});
  assert.deepEqual(readPosts(dom.window.document,{visibleOnly:true,width:1000,height:800}).map(p=>p.code),['Abc','Def']);
  assert.equal(readPosts(dom.window.document,{visibleOnly:false}).length,3);
});
test('숏코드를 정밀도 손실 없이 게시물 ID로 변환한다',()=>{
  assert.equal(shortcodeToId('BA'),'64');assert.equal(shortcodeToId('_'),'63');
  assert.throws(()=>shortcodeToId('../'));
});
test('화면 가장자리에 일부만 걸친 다음 행은 현재 화면에서 제외한다',()=>{
  const dom=new JSDOM('<main><a href="/p/BA/"><img></a></main>');
  dom.window.document.querySelector('a').getBoundingClientRect=()=>({top:790,bottom:1190,left:0,right:300,width:300,height:400});
  assert.equal(readPosts(dom.window.document,{visibleOnly:true,width:1000,height:800}).length,0);
  assert.equal(readPosts(dom.window.document,{visibleOnly:false}).length,1);
});
test('스크롤 수집 중에는 저장하지 않고 전체 개수에 도달하면 완료한다',async()=>{
  let step=0;
  const result=await collectAll({read:()=>Array.from({length:step+1},(_,i)=>({code:String(i)})),scroll:()=>step++,atBottom:()=>step>=2,blocked:()=>false,wait:async()=>{},signal:new AbortController().signal,expected:3,onProgress:()=>{}});
  assert.equal(result.complete,true);assert.equal(result.posts.length,3);
});
test('전체 링크가 이미 로드됐어도 끝까지 스크롤한 뒤 완료한다',async()=>{
  let scrolls=0;
  const result=await collectAll({read:()=>[{code:'A'},{code:'B'}],scroll:()=>scrolls++,atBottom:()=>scrolls>=3,blocked:()=>false,wait:async()=>{},signal:new AbortController().signal,expected:2,onProgress:()=>{}});
  assert.equal(scrolls,3);assert.equal(result.complete,true);
});
test('더 로드되지 않아도 기대 개수보다 적으면 전체 완료로 표시하지 않는다',async()=>{
  const result=await collectAll({read:()=>[{code:'A'}],scroll:()=>{},atBottom:()=>true,blocked:()=>false,wait:async()=>{},signal:new AbortController().signal,expected:20,onProgress:()=>{}});
  assert.equal(result.complete,false);assert.equal(result.reason,'stalled');
});
test('전체 개수를 모르면 끝으로 보이더라도 확인되지 않은 상태를 반환한다',async()=>{
  const result=await collectAll({read:()=>[{code:'A'}],scroll:()=>{},atBottom:()=>true,blocked:()=>false,wait:async()=>{},signal:new AbortController().signal,expected:null,onProgress:()=>{}});
  assert.equal(result.complete,false);
});
test('로그인 차단이나 취소 시 전체 수집을 중단한다',async()=>{
  const opts={read:()=>[],scroll:()=>{},atBottom:()=>false,blocked:()=>true,wait:async()=>{},signal:new AbortController().signal,expected:3,onProgress:()=>{}};
  await assert.rejects(collectAll(opts),/로그인|접근/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(collectAll({...opts,signal:controller.signal}),{name:'AbortError'});
});

test('요청한 게시물 수에 도달하면 화면 밖까지 계속 스크롤하지 않는다',async()=>{
  let scrolls=0;
  const result=await collectAll({read:()=>[{code:'A'},{code:'B'},{code:'C'}],scroll:()=>scrolls++,atBottom:()=>false,blocked:()=>false,wait:async()=>{},signal:new AbortController().signal,expected:100,limit:2,onProgress:()=>{}});
  assert.deepEqual(result.posts.map(p=>p.code),['A','B']);assert.equal(result.complete,true);assert.equal(scrolls,0);
});
test('개수 지정 시 추가 스크롤 결과를 합쳐도 지정 개수를 넘지 않는다',async()=>{
  let scrolls=0;
  const result=await collectAll({read:()=>scrolls?[{code:'B'},{code:'C'},{code:'D'}]:[{code:'A'}],scroll:()=>scrolls++,atBottom:()=>false,blocked:()=>false,wait:async()=>{},signal:new AbortController().signal,expected:100,limit:3,onProgress:()=>{}});
  assert.deepEqual(result.posts.map(p=>p.code),['A','B','C']);assert.equal(scrolls,1);
});
test('계정 게시물이 지정 개수보다 적으면 확인된 전체만 저장 대상으로 반환한다',async()=>{
  const result=await collectAll({read:()=>[{code:'A'},{code:'B'}],scroll:()=>assert.fail(),atBottom:()=>true,blocked:()=>false,wait:async()=>{},signal:new AbortController().signal,expected:2,limit:20,onProgress:()=>{}});
  assert.equal(result.posts.length,2);assert.equal(result.complete,true);
});
