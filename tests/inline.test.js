import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountInline} from '../src/inline.js';

const waitUntil=async(predicate)=>{for(let i=0;i<120;i++){if(predicate())return;await new Promise(r=>setTimeout(r,25));}assert.fail('예상 화면 상태에 도달하지 못함');};
function setup({defaultCount=20,mediaPerPost=1,rejectProfileCount=false}={}){
  const dom=new JSDOM('<main><header>Meta 게시물 2</header><a href="/meta/p/BA/"><img></a><a href="/meta/p/BB/"><img></a></main>',{url:'https://www.instagram.com/meta/'});
  const {window}=dom;let scrolls=0,countCalls=0;const resolved=[],messages=[],preferences={downloadCount:defaultCount};
  window.scrollTo=()=>scrolls++;window.scrollBy=()=>scrolls++;
  window.document.querySelectorAll('a').forEach((a,i)=>{a.getBoundingClientRect=()=>({top:i?1800:100,bottom:i?2000:300,left:0,right:200,width:200,height:200});});
  const api={runtime:{id:'ext',onMessage:{addListener:()=>{},removeListener:()=>{}},sendMessage:async message=>{
    messages.push(message);
    if(message.type==='OM_GET_SETTINGS')return {...preferences};
    if(message.type==='OM_SAVE_SETTINGS'){preferences.downloadCount=message.downloadCount;return {...preferences};}
    return message.type==='OM_START'?{id:1}:message.type==='OM_STATUS'?{state:'complete'}:{ok:true};
  }}};
  const client={count:async()=>{countCalls++;if(rejectProfileCount)throw new Error('429 프로필 개수 API는 호출하면 안 됩니다.');return 2;},media:async post=>{resolved.push(post.code);return Array.from({length:mediaPerPost},(_,i)=>({id:`meta:${post.code}:${i+1}`,username:'meta',code:post.code,index:i+1,type:'image',url:'https://s.cdninstagram.com/a.jpg'}));}};
  const mounted=mountInline({window,api,client});
  return {window,mounted,resolved,messages,preferences,stats:()=>({scrolls,countCalls}),root:()=>window.document.querySelector('#open-media-inline')?.shadowRoot,close:()=>{mounted.dispose();window.close();}};
}
test('처음에는 작은 안내만 보이며 사용자 클릭 전 다운로드하지 않는다',()=>{
  const s=setup();try{assert.equal(s.root().querySelector('.panel').hidden,true);assert.equal(s.messages.filter(m=>m.type==='OM_START').length,0);assert.match(s.root().textContent,/1개 게시물/);}finally{s.close();}
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

test('저장한 기본값은 다른 계정에서 적용되고 임시 수정은 보존하지 않는다',async()=>{
  const s=setup({defaultCount:12});try{
    await waitUntil(()=>s.root().querySelector('#post-count')?.value==='12');
    let input=s.root().querySelector('#post-count');input.value='7';input.dispatchEvent(new s.window.Event('input'));
    s.root().querySelector('#save-count').click();
    await waitUntil(()=>s.preferences.downloadCount===7);
    input.value='2';input.dispatchEvent(new s.window.Event('input'));
    s.window.history.pushState({},'', '/other/');s.window.dispatchEvent(new s.window.PopStateEvent('popstate'));
    await waitUntil(()=>s.root().querySelector('.account').textContent.includes('@other')&&s.root().querySelector('#post-count')?.value==='7');
    assert.equal(s.preferences.downloadCount,7);
  }finally{s.close();}
});
test('임시로 지정한 한 개 게시물만 다운로드하고 기본값은 바꾸지 않는다',async()=>{
  const s=setup({defaultCount:12});try{
    await waitUntil(()=>s.root().querySelector('#post-count')?.value==='12');
    const input=s.root().querySelector('#post-count');input.value='1';input.dispatchEvent(new s.window.Event('input'));
    s.root().querySelector('#limited').click();
    await waitUntil(()=>s.root().querySelector('.status').textContent.includes('저장 완료'));
    assert.deepEqual(s.resolved,['BA']);assert.equal(s.preferences.downloadCount,12);
  }finally{s.close();}
});
test('잘못된 개수는 조회나 스크롤을 시작하기 전에 안내한다',async()=>{
  const s=setup();try{
    await waitUntil(()=>s.root().querySelector('#post-count')?.disabled===false);
    const input=s.root().querySelector('#post-count');input.value='0';input.dispatchEvent(new s.window.Event('input'));
    s.root().querySelector('#limited').click();
    await waitUntil(()=>s.root().querySelector('.status').textContent.includes('1~5000'));
    assert.deepEqual(s.stats(),{scrolls:0,countCalls:0});assert.equal(s.resolved.length,0);
  }finally{s.close();}
});
test('게시물 한 개를 지정해도 묶음 게시물의 모든 파일을 저장한다',async()=>{
  const s=setup({defaultCount:1,mediaPerPost:3});try{
    await waitUntil(()=>s.root().querySelector('#post-count')?.disabled===false);
    s.root().querySelector('#limited').click();
    await waitUntil(()=>s.root().querySelector('.status').textContent.includes('저장 완료'));
    assert.deepEqual(s.resolved,['BA']);
    assert.equal(s.messages.filter(m=>m.type==='OM_START').length,3);
    assert.match(s.root().querySelector('.status').textContent,/3개 저장/);
  }finally{s.close();}
});

for(const [button,expected] of [['#visible',['BA']],['#limited',['BA']],['#all',['BA','BB']]]){
  test(`${button} 경로는 프로필 개수 API 없이 같은 미디어 조회와 저장을 사용한다`,async()=>{
    const s=setup({defaultCount:1,rejectProfileCount:true});try{
      await waitUntil(()=>s.root().querySelector('#post-count')?.disabled===false);
      s.root().querySelector(button).click();
      await waitUntil(()=>/저장 완료|429/.test(s.root().querySelector('.status').textContent));
      assert.match(s.root().querySelector('.status').textContent,/저장 완료/);
      assert.equal(s.stats().countCalls,0);
      assert.deepEqual(s.resolved,expected);
      assert.equal(s.messages.filter(m=>m.type==='OM_START').length,expected.length);
    }finally{s.close();}
  });
}

test('50개를 요청해도 게시물이 2개인 계정은 있는 2개만 공통 경로로 저장한다',async()=>{
  const s=setup({defaultCount:50,rejectProfileCount:true});try{
    await waitUntil(()=>s.root().querySelector('#post-count')?.disabled===false);
    s.root().querySelector('#limited').click();
    await waitUntil(()=>s.root().querySelector('.status').textContent.includes('저장 완료'));
    assert.deepEqual(s.resolved,['BA','BB']);
    assert.equal(s.messages.filter(m=>m.type==='OM_START').length,2);
    assert.equal(s.stats().countCalls,0);
  }finally{s.close();}
});
