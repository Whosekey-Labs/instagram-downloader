import {parseDownloadCount} from './preferences.js';
import {waitFor} from './async.js';

export async function collectAll({read,scroll,atBottom,blocked,wait=waitFor,signal,expected,onProgress,maxSteps=1800,limit=null}) {
  const target=limit===null?null:parseDownloadCount(limit);
  const posts=new Map();let idle=0;
  for(let step=0;step<maxSteps;step++) {
    signal.throwIfAborted();
    if(blocked())throw new Error('Instagram 로그인 또는 접근 확인 화면이 나타나 전체 수집을 중단했습니다.');
    const before=posts.size;
    for(const post of read()){
      posts.set(post.code,post);
      if(target!==null&&posts.size>=target)break;
    }
    onProgress(posts.size);
    if(target!==null&&posts.size>=target)return {posts:[...posts.values()],complete:true,reason:'requested'};
    if(Number.isInteger(expected)&&expected>=0&&posts.size>=expected&&(expected===0||atBottom()))return {posts:[...posts.values()],complete:true,reason:'count'};
    if(posts.size===before&&atBottom())idle++;else idle=0;
    if(idle>=6)return {posts:[...posts.values()],complete:false,reason:'stalled'};
    scroll();
    await wait(1000,signal);
  }
  return {posts:[...posts.values()],complete:false,reason:'limit'};
}
