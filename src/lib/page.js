import { parseUsername } from './core.js';

export function profileFromPath(pathname) {
  const parts=pathname.split('/').filter(Boolean);
  if(parts.length!==1)return null;
  try{return parseUsername(parts[0]);}catch{return null;}
}

export function readProfilePostCount(document){
  const header=document.querySelector('main header,[role="main"] header');
  if(!header)return null;
  const text=(header.innerText||header.textContent||'').replace(/\s+/g,' ').trim();
  const match=text.match(/(?:^|\s)게시물\s*([0-9][0-9,]*)(?=\s|$)/)||text.match(/(?:^|\s)([0-9][0-9,]*)\s+posts?(?=\s|$)/i);
  if(!match||!(/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(match[1])))return null;
  const count=Number(match[1].replaceAll(',',''));
  return Number.isSafeInteger(count)?count:null;
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
