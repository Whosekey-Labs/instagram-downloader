import {waitFor} from './async.js';

// 확장 메시지 통신과 다운로드 완료 확인을 담당하는 저장 어댑터.
export async function saveMediaThroughExtension({message,item,token,signal,onPending,wait=waitFor}){
  signal.throwIfAborted();
  const started=await message({type:'OM_START',token,item});
  if(started.skipped)return {skipped:true};
  const began=Date.now();
  while(true){
    signal.throwIfAborted();
    const result=await message({type:'OM_STATUS',token,id:started.id});
    if(result.state==='complete')return {skipped:false,warning:result.warning};
    if(result.state==='interrupted')throw new Error(result.error);
    if(Date.now()-began>180000){await message({type:'OM_CANCEL',token});throw new Error('파일 저장 시간이 초과되어 중단했습니다.');}
    onPending();
    await wait(700,signal);
  }
}
