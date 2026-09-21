import {classifyResponse,normalizePage,parseUsername} from './core.js';
import {shortcodeToId} from './page.js';

export class InstagramClient {
  constructor(fetcher=globalThis.fetch.bind(globalThis)){this.fetcher=fetcher;}
  async json(path,signal) {
    signal.throwIfAborted();
    const timeout=new AbortController();
    const abort=()=>timeout.abort();signal.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(()=>timeout.abort(),25000);
    try {
      const response=await this.fetcher(path,{credentials:'same-origin',headers:{'X-IG-App-ID':'936619743392459'},signal:timeout.signal});
      signal.throwIfAborted();
      if(response.redirected||/\/accounts\/login|\/challenge\//.test(response.url))throw new Error('Instagram 로그인이 필요합니다. 현재 탭에서 로그인한 뒤 다시 시도해 주세요.');
      classifyResponse(response.status,{});
      if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Instagram 로그인 또는 추가 인증이 필요합니다.');
      const data=await response.json();classifyResponse(response.status,data);return data;
    }catch(error){
      signal.throwIfAborted();
      if(error.name==='AbortError')throw new Error('Instagram 응답 시간이 초과되었습니다. 자동 재시도하지 않았습니다.');
      throw error;
    }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
  }
  async count(username,signal) {
    const name=parseUsername(username);
    const result=await this.json(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(name)}`,signal);
    const user=result?.data?.user;
    if(String(user?.username).toLowerCase()!==name)throw new Error('현재 프로필과 응답 계정이 일치하지 않습니다.');
    const count=user.edge_owner_to_timeline_media?.count ?? user.media_count;
    return Number.isInteger(count)&&count>=0?count:null;
  }
  async media(post,username,signal) {
    const data=await this.json(`/api/v1/media/${shortcodeToId(post.code)}/info/`,signal);
    if(data?.items?.length!==1 || data.items[0].code!==post.code)throw new Error('선택한 게시물과 Instagram 응답이 일치하지 않습니다.');
    const page=normalizePage({...data,more_available:false},username);
    if(page.unavailable||!page.media.length)throw new Error('게시물의 일부 미디어 주소를 확인할 수 없어 저장을 중단했습니다.');
    return page.media;
  }
}
