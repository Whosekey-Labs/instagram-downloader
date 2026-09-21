import {profileFromPath,readPosts,collectAll,waitFor} from './lib/page.js';
import {InstagramClient} from './lib/instagram.js';
import {panelStyle} from './panel-style.js';

export function mountInline({window,api,client=new InstagramClient()}) {
  const {document}=window;
  let view=null,disposed=false,refreshTimer;
  const read=visibleOnly=>readPosts(document,{visibleOnly,width:window.innerWidth,height:window.innerHeight});
  const message=async value=>{
    let result;
    try{result=await api.runtime.sendMessage(value);}catch{throw new Error('확장 연결이 끊어졌습니다. 이 Instagram 탭을 새로고침해 주세요.');}
    if(result?.error)throw new Error(result.error);
    if(!result)throw new Error('확장 프로그램에서 응답을 받지 못했습니다.');
    return result;
  };
  function create(username) {
    const host=document.createElement('div');host.id='open-media-inline';
    const root=host.attachShadow({mode:'open'});
    root.addEventListener('click',event=>event.stopPropagation());
    root.innerHTML=`<style>${panelStyle}</style><button class="chip" aria-label="미디어 다운로드 안내 열기"><span>↓</span> <b>미디어 저장</b></button><section class="panel" hidden aria-label="Open Media Downloader"><header><strong>미디어 저장</strong><button id="minimize" aria-label="안내 접기">−</button><button id="close" aria-label="안내 닫기">×</button></header><div class="body"><p class="account"></p><p class="status" role="status" aria-live="polite"></p><button class="primary" id="visible">현재 화면 다운로드 ↓</button><button class="secondary" id="partial" hidden>모인 게시물 저장</button><button class="secondary stop" id="stop" hidden>작업 중단</button><progress hidden value="0" max="1" aria-label="진행률"></progress><details><summary>전체 다운로드 옵션</summary><p class="hint">페이지 처음부터 끝까지 자동 스크롤해 게시물을 모은 뒤 다운로드합니다.</p><button class="secondary" id="all">전체 모은 뒤 다운로드</button><button class="link" id="clear">이 계정의 저장 기록 지우기</button></details><p class="foot">무료 · 내 기기에 저장 · 저장 권한이 있는 콘텐츠에 사용</p></div></section>`;
    document.documentElement.append(host);
    const $=selector=>root.querySelector(selector);
    const state={username,host,root,busy:false,controller:null,token:null,partial:[],closed:false,destroyed:false,ready:true};
    $('.account').textContent=`@${username} · Open Media Downloader`;
    const status=(text,error=false)=>{if(state.destroyed)return;$('.status').textContent=text;$('.status').classList.toggle('error',error);};
    const controls=()=>{
      for(const selector of ['#visible','#all','#clear'])$(selector).disabled=state.busy;
      $('#stop').hidden=!state.busy;$('#partial').hidden=state.busy||!state.partial.length;
      $('#close').setAttribute('aria-label',state.busy?'작업 중단하고 안내 닫기':'안내 닫기');
    };
    state.count=()=>{
      if(state.busy)return;
      const count=read(true).length;
      $('.chip b').textContent=`미디어 저장${count?` · ${count}개 게시물`:''}`;
      if(state.ready)status(count?`현재 화면의 ${count}개 게시물을 저장할 수 있어요.`:'게시물 그리드가 화면에 보이면 다운로드할 수 있어요.');
      $('#visible').disabled=!count;
    };
    state.toggle=()=>{const opening=state.closed||$('.panel').hidden;state.closed=false;host.hidden=false;$('.panel').hidden=!opening;$('.chip').hidden=opening;state.count();};
    const cancel=()=>{
      state.controller?.abort();
      if(state.token)message({type:'OM_CANCEL',token:state.token}).catch(()=>{});
    };
    state.destroy=()=>{state.destroyed=true;cancel();host.remove();};
    $('.chip').onclick=state.toggle;
    $('#minimize').onclick=()=>{$('.panel').hidden=true;$('.chip').hidden=false;};
    $('#close').onclick=()=>{cancel();host.hidden=true;state.closed=true;};
    $('#stop').onclick=()=>{cancel();status('작업을 중단하고 있습니다…');};
    async function run(work) {
      if(state.busy)return;
      state.busy=true;state.ready=false;state.controller=new AbortController();state.token=crypto.randomUUID();
      const {signal}=state.controller;controls();
      try{await work(signal);}
      catch(error){
        if(signal.aborted)status('작업을 중단했습니다. 이미 저장된 파일은 유지됩니다.');
        else status(error.message||'작업을 완료하지 못했습니다.',true);
      }finally{
        // 시작 메시지와 취소 메시지의 경합 시에도 대기 중 파일을 정리한다.
        if(signal.aborted)await message({type:'OM_CANCEL',token:state.token}).catch(()=>{});
        state.busy=false;state.controller=null;controls();
      }
    }
    async function download(posts,signal) {
      if(!posts.length)throw new Error('현재 화면에서 다운로드할 게시물을 찾지 못했습니다. 게시물 그리드로 이동해 주세요.');
      state.partial=[];controls();
      let saved=0,skipped=0,warning='';
      const progress=$('progress');progress.hidden=false;progress.max=posts.length;progress.value=0;
      for(let index=0;index<posts.length;index++) {
        signal.throwIfAborted();
        if(profileFromPath(window.location.pathname)!==username)throw new Error('다른 페이지로 이동해 다운로드를 중단했습니다.');
        status(`게시물 ${index+1}/${posts.length} 확인 중 · 저장 ${saved}개 · 중복 ${skipped}개`);
        const media=await client.media(posts[index],username,signal);
        for(const item of media) {
          signal.throwIfAborted();
          const started=await message({type:'OM_START',token:state.token,item});
          if(started.skipped){skipped++;continue;}
          const began=Date.now();
          while(true){
            signal.throwIfAborted();
            const result=await message({type:'OM_STATUS',token:state.token,id:started.id});
            if(result.state==='complete'){saved++;warning=result.warning||warning;break;}
            if(result.state==='interrupted')throw new Error(`${result.error} (저장 ${saved}개, 중복 ${skipped}개)`);
            if(Date.now()-began>180000){await message({type:'OM_CANCEL',token:state.token});throw new Error('파일 저장 시간이 초과되어 중단했습니다.');}
            status(`파일 저장 중 · 게시물 ${index+1}/${posts.length} · 저장 ${saved}개 · 중복 ${skipped}개`);
            await waitFor(700,signal);
          }
        }
        progress.value=index+1;
        if(index<posts.length-1)await waitFor(1000,signal);
      }
      status(`저장 완료 · ${saved}개 저장, ${skipped}개 중복 건너뜀.${warning?` ${warning}`:''}`);
    }
    $('#visible').onclick=()=>{const posts=read(true);run(signal=>download(posts,signal));};
    $('#all').onclick=()=>run(async signal=>{
      state.partial=[];$('progress').hidden=true;status('전체 게시물 수를 확인하고 있습니다…');
      const expected=await client.count(username,signal);
      if(expected===0){status('이 계정에 게시물이 없습니다.');return;}
      window.scrollTo({top:0,behavior:'instant'});
      await waitFor(1000,signal);
      const result=await collectAll({
        read:()=>read(false),signal,expected,
        scroll:()=>window.scrollBy({top:Math.max(300,window.innerHeight*.75),behavior:'instant'}),
        atBottom:()=>window.scrollY+window.innerHeight>=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)-5,
        blocked:()=>profileFromPath(window.location.pathname)!==username||Boolean(document.querySelector('[role="dialog"] input[name="username"],[role="dialog"] a[href*="/accounts/login"]')),
        onProgress:count=>status(`스크롤하며 게시물 수집 중 · ${count}${expected!==null?`/${expected}`:''}개`)
      });
      signal.throwIfAborted();
      if(!result.complete){
        state.partial=result.posts;
        $('#partial').textContent=`모인 ${result.posts.length}개 게시물만 저장`;
        status(`${result.posts.length}개 게시물을 모았지만 전체 수집은 확인되지 않았습니다. ${result.reason==='limit'?'수집 시간 한도에 도달했습니다.':'추가 로딩이 멈췄습니다.'} 모인 항목만 저장할 수 있어요.`,true);return;
      }
      status(`전체 ${result.posts.length}개 게시물 수집 완료. 다운로드를 시작합니다.`);
      await download(result.posts,signal);
    });
    $('#partial').onclick=()=>{const posts=[...state.partial];run(signal=>download(posts,signal));};
    $('#clear').onclick=()=>run(async()=>{await message({type:'OM_CLEAR'});status('이 계정의 저장 기록을 지웠습니다. 실제 파일은 유지됩니다.');});
    state.count();return state;
  }
  function refresh(){
    if(disposed)return;
    const username=profileFromPath(window.location.pathname);
    if(username!==view?.username){view?.destroy();view=username?create(username):null;}
    view?.count();
  }
  const schedule=()=>{if(!refreshTimer)refreshTimer=window.setTimeout(()=>{refreshTimer=null;refresh();},200);};
  const observer=new window.MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);window.addEventListener('popstate',schedule);
  const interval=window.setInterval(refresh,1000);
  const toggle=(message,sender,reply)=>{
    if(message?.type==='OM_TOGGLE'&&sender.id===api.runtime.id){refresh();view?.toggle();reply({ok:Boolean(view)});}
    return false;
  };
  api.runtime.onMessage.addListener(toggle);refresh();
  return {
    dispose(){disposed=true;view?.destroy();observer.disconnect();window.clearInterval(interval);window.clearTimeout(refreshTimer);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);window.removeEventListener('popstate',schedule);api.runtime.onMessage.removeListener?.(toggle);},
    toggle(){refresh();view?.toggle();}
  };
}
