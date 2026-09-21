import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../src/content.js',import.meta.url),'utf8');
function setup(fetcher) {
  let listener;
  const context=vm.createContext({chrome:{runtime:{id:'test',getURL:file=>`chrome-extension://test/${file}`,onMessage:{addListener:fn=>listener=fn}}},fetch:fetcher,AbortController,setTimeout,clearTimeout,URLSearchParams});
  vm.runInContext(code,context);
  const sender={id:'test',url:'chrome-extension://test/app.html'};
  return {listener,call:message=>new Promise(resolve=>listener(message,sender,resolve))};
}
test('다른 발신자와 임의 URL 요청을 차단한다',async()=>{
  let calls=0;const {listener,call}=setup(async()=>{calls++;});
  assert.equal(listener({type:'OPEN_MEDIA_REQUEST'},{id:'foreign'},()=>assert.fail()),false);
  const result=await call({type:'OPEN_MEDIA_REQUEST',action:'feed',userId:'../../secrets'});
  assert.match(result.error,/잘못된/);assert.equal(calls,0);
});
test('프로필 조회는 고정된 동일 출처 경로와 기존 세션을 사용한다',async()=>{
  let observed;
  const {call}=setup(async(path,options)=>{observed={path,options};return {status:200,ok:true,url:'https://www.instagram.com/api/',headers:new Headers({'content-type':'application/json'}),json:async()=>({data:{user:{id:'1'}}})};});
  const result=await call({type:'OPEN_MEDIA_REQUEST',action:'profile',username:'meta'});
  assert.equal(observed.path,'/api/v1/users/web_profile_info/?username=meta');
  assert.equal(observed.options.credentials,'same-origin');
  assert.equal(result.data.data.user.id,'1');
});
test('로그인 리다이렉트는 JSON 성공으로 처리하지 않는다',async()=>{
  const {call}=setup(async()=>({redirected:true,url:'https://www.instagram.com/accounts/login/'}));
  const result=await call({type:'OPEN_MEDIA_REQUEST',action:'profile',username:'meta'});
  assert.equal(result.status,401);
});
test('429 요청 제한을 그대로 반환하고 다시 요청하지 않는다',async()=>{
  let calls=0;
  const {call}=setup(async()=>{calls++;return {status:429,ok:false,url:'https://www.instagram.com/api/',headers:new Headers({'content-type':'text/html'})};});
  const result=await call({type:'OPEN_MEDIA_REQUEST',action:'feed',userId:'123',cursor:'cursor&x=1',count:6});
  assert.equal(result.status,429);assert.equal(calls,1);
});
