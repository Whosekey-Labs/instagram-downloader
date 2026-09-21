import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountInline} from '../src/inline.js';

const waitUntil=async(predicate)=>{for(let i=0;i<60;i++){if(predicate())return;await new Promise(r=>setTimeout(r,25));}assert.fail('예상 화면 상태에 도달하지 못함');};
function setup(){
  const dom=new JSDOM('<main><header>Meta</header><a href="/meta/p/BA/"><img></a><a href="/meta/p/BB/"><img></a></main>',{url:'https://www.instagram.com/meta/'});
  const {window}=dom;let scrolls=0,countCalls=0;const resolved=[],messages=[];
  window.scrollTo=()=>scrolls++;window.scrollBy=()=>scrolls++;
  window.document.querySelectorAll('a').forEach((a,i)=>{a.getBoundingClientRect=()=>({top:i?1800:100,bottom:i?2000:300,left:0,right:200,width:200,height:200});});
  const api={runtime:{id:'ext',onMessage:{addListener:()=>{},removeListener:()=>{}},sendMessage:async message=>{
    messages.push(message);return message.type==='OM_START'?{id:1}:message.type==='OM_STATUS'?{state:'complete'}:{ok:true};
  }}};
  const client={count:async()=>{countCalls++;return 2;},media:async post=>{resolved.push(post.code);return [{id:`meta:${post.code}:1`,username:'meta',code:post.code,index:1,type:'image',url:'https://s.cdninstagram.com/a.jpg'}];}};
  const mounted=mountInline({window,api,client});
  return {window,mounted,resolved,messages,stats:()=>({scrolls,countCalls}),root:()=>window.document.querySelector('#open-media-inline')?.shadowRoot,close:()=>{mounted.dispose();window.close();}};
}
test('처음에는 작은 안내만 보이며 사용자 클릭 전 다운로드하지 않는다',()=>{
  const s=setup();try{assert.equal(s.root().querySelector('.panel').hidden,true);assert.equal(s.messages.length,0);assert.match(s.root().textContent,/1개 게시물/);}finally{s.close();}
});
test('현재 화면 다운로드는 스크롤하거나 전체 계정을 조회하지 않는다',async()=>{
  const s=setup();try{
    s.root().querySelector('.chip').click();s.root().querySelector('#visible').click();
    await waitUntil(()=>s.root().querySelector('.status').textContent.includes('저장 완료'));
    assert.deepEqual(s.resolved,['BA']);assert.deepEqual(s.stats(),{scrolls:0,countCalls:0});
    assert.equal(s.messages.filter(m=>m.type==='OM_START').length,1);
  }finally{s.close();}
});
test('닫은 안내는 같은 계정에서 다시 나타나지 않고 확장 아이콘으로 다시 연다',()=>{
  const s=setup();try{
    s.root().querySelector('.chip').click();s.root().querySelector('#close').click();
    assert.equal(s.window.document.querySelector('#open-media-inline').hidden,true);
    s.mounted.toggle();assert.equal(s.window.document.querySelector('#open-media-inline').hidden,false);
    assert.equal(s.root().querySelector('.panel').hidden,false);
  }finally{s.close();}
});
test('다른 계정으로 이동하면 이전 안내를 제거하고 계정을 갱신한다',async()=>{
  const s=setup();try{
    s.window.history.pushState({},'', '/other/');s.window.dispatchEvent(new s.window.PopStateEvent('popstate'));
    await waitUntil(()=>s.root().querySelector('.account').textContent.includes('@other'));
    assert.equal(s.window.document.querySelectorAll('#open-media-inline').length,1);
  }finally{s.close();}
});
