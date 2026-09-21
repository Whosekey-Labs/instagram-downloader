import {mediaFilename,validateMediaUrl} from './core.js';
import {profileFromPath} from './page.js';
import {parseDownloadCount,DEFAULT_DOWNLOAD_COUNT} from './preferences.js';

export class DownloadService {
  constructor(api){this.api=api;this.chain=Promise.resolve();}
  serial(work){const result=this.chain.then(work);this.chain=result.catch(()=>{});return result;}
  async jobs(){return (await this.api.storage.session.get('jobs')).jobs||{};}
  async save(jobs){
    const finished=Object.entries(jobs).filter(([,job])=>job.state!=='in_progress');
    for(const [id] of finished.slice(0,Math.max(0,finished.length-200)))delete jobs[id];
    await this.api.storage.session.set({jobs});
  }
  async owner(sender){
    let source;try{source=new URL(sender.url);}catch{throw new Error('허용되지 않은 요청입니다.');}
    if(sender.id!==this.api.runtime.id||sender.frameId!==0||!Number.isInteger(sender.tab?.id)||source.origin!=='https://www.instagram.com')throw new Error('Instagram에서만 작업할 수 있습니다.');
    let currentTab;
    try{currentTab=await this.api.tabs.get(sender.tab.id);}catch{throw new Error('현재 탭을 확인할 수 없습니다. 계정 페이지에서 다시 시작해 주세요.');}
    let url;try{url=new URL(currentTab.url);}catch{throw new Error('현재 탭 주소를 확인할 수 없습니다.');}
    if(url.origin!=='https://www.instagram.com')throw new Error('Instagram 계정 페이지에서 다시 시작해 주세요.');
    // SPA 이동 후에도 메시지의 이전 주소가 아닌 현재 탭 주소로 계정을 검증한다.
    const username=profileFromPath(url.pathname);
    return {tabId:sender.tab.id,documentId:sender.documentId||'',username};
  }
  matches(job,owner,token){return job.tabId===owner.tabId&&job.documentId===owner.documentId&&job.token===token;}
  async refresh(id,jobs){
    const job=jobs[id];if(!job||job.state!=='in_progress')return job;
    const [state]=await this.api.downloads.search({id:Number(id)});
    if(!state||state.state==='interrupted'){job.state='interrupted';job.error='파일 저장이 중단되었습니다. Instagram 링크 만료 또는 브라우저 다운로드 상태를 확인해 주세요.';}
    else if(state.state==='complete'){
      if(state.mime&&!/^(image|video)\//.test(state.mime)&&state.mime!=='application/octet-stream'){
        job.state='interrupted';job.error='미디어 대신 다른 문서가 내려와 완료로 기록하지 않았습니다.';
      }else{
        job.state='complete';
        try {
          const history=(await this.api.storage.local.get('completed')).completed||{};
          history[job.itemId]=Date.now();
          const keys=Object.keys(history).sort((a,b)=>history[a]-history[b]);
          for(const key of keys.slice(0,Math.max(0,keys.length-20000)))delete history[key];
          await this.api.storage.local.set({completed:history});
        }catch{job.warning='파일은 저장했지만 중복 방지 기록을 보관하지 못했습니다.';}
      }
    }
    await this.save(jobs);return job;
  }
  changed(id){return this.serial(async()=>{const jobs=await this.jobs();if(jobs[id])await this.refresh(id,jobs);});}
  handle(message,sender){return this.serial(async()=>{
    const owner=await this.owner(sender);
    if(message.type==='OM_GET_SETTINGS'){
      const {preferences}=await this.api.storage.local.get('preferences');
      let downloadCount=DEFAULT_DOWNLOAD_COUNT;
      try{downloadCount=parseDownloadCount(preferences?.downloadCount);}catch{ /* 미설정 또는 손상된 값은 초기값으로 복구한다. */ }
      return {downloadCount};
    }
    if(message.type==='OM_SAVE_SETTINGS'){
      if(!owner.username)throw new Error('계정 프로필에서 기본값을 저장해 주세요.');
      const downloadCount=parseDownloadCount(message.downloadCount);
      await this.api.storage.local.set({preferences:{downloadCount}});
      return {downloadCount};
    }
    if(message.type==='OM_CLEAR'){
      if(!owner.username)throw new Error('계정 프로필에서만 저장 기록을 지울 수 있습니다.');
      const history=(await this.api.storage.local.get('completed')).completed||{};
      for(const key of Object.keys(history))if(key.startsWith(owner.username+':'))delete history[key];
      await this.api.storage.local.set({completed:history});return {ok:true};
    }
    const {token}=message;
    if(typeof token!=='string'||!/^[A-Za-z0-9-]{8,80}$/.test(token))throw new Error('잘못된 작업 식별자입니다.');
    const jobs=await this.jobs();
    if(message.type==='OM_START'){
      if(!owner.username)throw new Error('계정 프로필에서만 다운로드를 시작할 수 있습니다.');
      const item=message.item;
      if(item?.username!==owner.username)throw new Error('현재 탭의 계정과 다운로드 대상이 다릅니다. 현재 계정에서 다시 시작해 주세요.');
      if(!item||!/^[A-Za-z0-9_-]{1,80}$/.test(item.code)||!Number.isInteger(item.index)||item.index<1||item.index>100||!['image','video'].includes(item.type)||item.id!==`${owner.username}:${item.code}:${item.index}`)throw new Error('다운로드 파일의 게시물 코드 또는 순번이 올바르지 않습니다.');
      validateMediaUrl(item.url);
      const history=(await this.api.storage.local.get('completed')).completed||{};
      if(history[item.id])return {skipped:true};
      for(const [id,job] of Object.entries(jobs)){
        if(job.state!=='in_progress')continue;
        await this.refresh(id,jobs);
        if(job.state==='complete'&&job.itemId===item.id)return {skipped:true};
        if(job.state==='in_progress'&&(job.tabId===owner.tabId||job.itemId===item.id)){
          if(this.matches(job,owner,token)&&job.itemId===item.id)return {id:Number(id)};
          throw new Error('이 파일 또는 탭의 다운로드가 이미 진행 중입니다.');
        }
      }
      const id=await this.api.downloads.download({url:item.url,filename:mediaFilename(item),conflictAction:'uniquify',saveAs:false});
      jobs[id]={...owner,token,itemId:item.id,state:'in_progress'};
      try{await this.save(jobs);}catch(error){await this.api.downloads.cancel(id).catch(()=>{});throw error;}
      return {id};
    }
    if(message.type==='OM_CANCEL'){
      for(const [id,job] of Object.entries(jobs))if(this.matches(job,owner,token)&&job.state==='in_progress'){
        await this.refresh(id,jobs);
        if(job.state==='in_progress'){
          await this.api.downloads.cancel(Number(id)).catch(()=>{});job.state='interrupted';job.error='사용자가 다운로드를 중단했습니다.';
        }
      }
      await this.save(jobs);return {ok:true};
    }
    if(message.type==='OM_STATUS'){
      const job=jobs[message.id];
      if(!job||!this.matches(job,owner,token))throw new Error('이 다운로드를 조회할 권한이 없거나 작업 기록이 만료되었습니다.');
      await this.refresh(message.id,jobs);return {state:job.state,error:job.error,warning:job.warning};
    }
    throw new Error('지원하지 않는 요청입니다.');
  });}
}
