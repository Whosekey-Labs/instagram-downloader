import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountInline} from '../src/inline.js';
import {DownloadService} from '../src/lib/download-service.js';
import {normalizePage} from '../src/lib/core.js';

const waitUntil=async predicate=>{
  for(let i=0;i<120;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,50));}
  assert.fail('계정 이동 다운로드가 예상 상태에 도달하지 못했습니다.');
};

test('계정 이동 뒤 50개 요청 시 실제 2개 게시물의 파일 3개를 새 계정 폴더에 저장한다',async()=>{
  const dom=new JSDOM('<main><header>게시물 2</header><a href="/p/C-P29ESSYN3/"><img></a><a href="/p/BA/"><img></a></main>',{url:'https://www.instagram.com/meta/'});
  const {window}=dom;
  window.scrollTo=()=>{};window.scrollBy=()=>{};
  window.document.querySelectorAll('a').forEach(a=>{a.getBoundingClientRect=()=>({top:100,bottom:300,left:0,right:200,width:200,height:200});});
  const local={preferences:{downloadCount:50}},session={},downloads=[];
  const area=store=>({get:async key=>({[key]:structuredClone(store[key])}),set:async values=>Object.assign(store,structuredClone(values))});
  const native={
    runtime:{id:'test'},tabs:{get:async id=>({id,url:window.location.href})},
    storage:{local:area(local),session:area(session)},
    downloads:{download:async options=>{downloads.push(options);return downloads.length;},search:async()=>[{state:'complete',mime:'image/jpeg'}],cancel:async()=>{}}
  };
  const service=new DownloadService(native);
  // 메시지의 문서 URL은 최초 계정으로 고정하고 현재 탭 URL만 SPA 이동을 반영한다.
  const sender={id:'test',frameId:0,url:'https://www.instagram.com/meta/',tab:{id:9},documentId:'same-document'};
  const api={runtime:{id:'test',onMessage:{addListener:()=>{},removeListener:()=>{}},sendMessage:async message=>{
    try{return await service.handle(message,sender);}catch(error){return {error:error.message};}
  }}};
  const photo=index=>({media_type:1,image_versions2:{candidates:[{url:`https://s.cdninstagram.com/photo-${index}.jpg`,width:1080,height:1350}]}});
  const resolved=[];
  const client={media:async(post,username)=>{
    resolved.push(post.code);
    // 첨부 응답의 코드와 캐러셀 구조만 재현한다. 원본 URL·추적 정보는 포함하지 않는다.
    const item=post.code==='C-P29ESSYN3'?{code:post.code,media_type:8,carousel_media:[photo(1),photo(2)]}:{...photo(3),code:post.code};
    return normalizePage({items:[item],more_available:false},username).media;
  }};
  const ui=mountInline({window,api,client});
  const root=()=>window.document.querySelector('#open-media-inline')?.shadowRoot;
  try{
    window.history.pushState({},'','/yoon_forest_fruit/');
    window.dispatchEvent(new window.PopStateEvent('popstate'));
    await waitUntil(()=>root()?.querySelector('.account').textContent.includes('@yoon_forest_fruit')&&!root().querySelector('#post-count').disabled);
    assert.equal(root().querySelector('#post-count').value,'50');
    root().querySelector('#limited').click();
    await waitUntil(()=>!root().querySelector('#limited').disabled);
    assert.match(root().querySelector('.status').textContent,/저장 완료 · 3개 저장/);
    assert.deepEqual(resolved,['C-P29ESSYN3','BA']);
    assert.equal(downloads.length,3);
    assert.ok(downloads.every(file=>file.filename.startsWith('OpenMedia/yoon_forest_fruit/yoon_forest_fruit_')));
    assert.equal(Object.keys(local.completed).length,3);
  }finally{ui.dispose();window.close();}
});
