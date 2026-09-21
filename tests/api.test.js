import test from 'node:test';
import assert from 'node:assert/strict';
import { InstagramClient } from '../src/lib/instagram.js';
const response=data=>({status:200,ok:true,redirected:false,url:'https://www.instagram.com/api/',headers:new Headers({'content-type':'application/json'}),json:async()=>data});
test('보이는 게시물의 ID만 조회하고 다른 게시물을 반환하면 거절한다',async()=>{
  let requested;
  const client=new InstagramClient(async(path)=>{requested=path;return response({items:[{code:'Other'}]});});
  await assert.rejects(client.media({code:'BA'},'meta',new AbortController().signal),/일치/);
  assert.equal(requested,'/api/v1/media/64/info/');
});
test('요청 제한은 재시도하지 않는다',async()=>{
  let count=0;const client=new InstagramClient(async()=>{count++;return {...response({}),status:429,ok:false};});
  await assert.rejects(client.media({code:'BA'},'meta',new AbortController().signal),/요청/);assert.equal(count,1);
});
