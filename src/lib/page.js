import { parseUsername } from './core.js';
import {parseDownloadCount} from './preferences.js';

export function profileFromPath(pathname) {
  const parts=pathname.split('/').filter(Boolean);
  if(parts.length!==1)return null;
  try{return parseUsername(parts[0]);}catch{return null;}
}

export function shortcodeToId(code) {
  if(!/^[A-Za-z0-9_-]{1,32}$/.test(code))throw new Error('잘못된 게시물 코드입니다.');
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id=0n;
  for(const character of code)id=id*64n+BigInt(alphabet.indexOf(character));
  return id.toString();
}

export function readPosts(document,{visibleOnly=true,width=Infinity,height=Infinity}={}) {
  const main=document.querySelector('main') || document.querySelector('[role="main"]');
  if(!main)return [];
  const posts=new Map();
  for(const link of main.querySelectorAll('a[href]')) {
    if(link.closest('header,aside,[role="dialog"]') || !link.querySelector('img,video'))continue;
    let url;
    try{url=new URL(link.getAttribute('href'),'https://www.instagram.com');}catch{continue;}
    if(url.origin!=='https://www.instagram.com')continue;
    const match=url.pathname.match(/^\/(?:[A-Za-z0-9_.]+\/)?(p|reel)\/([A-Za-z0-9_-]+)\/?$/);
    if(!match)continue;
    const rect=link.getBoundingClientRect();
    if(rect.width<=0 || rect.height<=0)continue;
    if(visibleOnly){
      const visibleHeight=Math.min(rect.bottom,height)-Math.max(rect.top,0);
      const visibleWidth=Math.min(rect.right,width)-Math.max(rect.left,0);
      if(visibleHeight<Math.min(rect.height*.25,100)||visibleWidth<Math.min(rect.width*.25,100))continue;
    }
    if(!posts.has(match[2]))posts.set(match[2],{code:match[2],kind:match[1],url:url.href});
  }
  return [...posts.values()];
}

export function waitFor(ms,signal) {
  return new Promise((resolve,reject)=>{
    signal.throwIfAborted();
    const abort=()=>{clearTimeout(timer);reject(signal.reason);};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
    signal.addEventListener('abort',abort,{once:true});
  });
}

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
