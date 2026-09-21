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
