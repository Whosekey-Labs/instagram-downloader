import {waitFor} from './async.js';

// 범위 선택이나 브라우저 구현을 모르는 공통 다운로드 유스케이스.
export async function downloadPosts({posts,signal,isCurrentProfile,resolveMedia,saveMedia,onProgress,wait=waitFor}){
  if(!posts.length)throw new Error('현재 화면에서 다운로드할 게시물을 찾지 못했습니다. 게시물 그리드로 이동해 주세요.');
  let saved=0,skipped=0,warning='';
  for(let index=0;index<posts.length;index++){
    signal.throwIfAborted();
    if(!isCurrentProfile())throw new Error('다른 페이지로 이동해 다운로드를 중단했습니다.');
    const report=phase=>onProgress({phase,postIndex:index+1,postCount:posts.length,saved,skipped});
    report('resolving');
    const media=await resolveMedia(posts[index]);
    for(const item of media){
      signal.throwIfAborted();
      const result=await saveMedia(item,()=>report('saving'));
      if(result.skipped)skipped++;
      else{saved++;warning=result.warning||warning;}
    }
    report('saved');
    if(index<posts.length-1)await wait(1000,signal);
  }
  return {saved,skipped,warning};
}
