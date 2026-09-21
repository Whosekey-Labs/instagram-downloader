import {DownloadService} from './lib/download-service.js';
const service=new DownloadService(chrome);
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(!['OM_START','OM_STATUS','OM_CANCEL','OM_CLEAR','OM_GET_SETTINGS','OM_SAVE_SETTINGS'].includes(message?.type))return false;
  service.handle(message,sender).then(reply,error=>reply({error:error.message||'다운로드 요청을 처리하지 못했습니다.'}));
  return true;
});
chrome.downloads.onChanged.addListener(delta=>{if(delta.state)service.changed(delta.id).catch(()=>{});});
chrome.action.onClicked.addListener(async tab=>{
  if(tab.url?.startsWith('https://www.instagram.com/')){
    try{
      const result=await chrome.tabs.sendMessage(tab.id,{type:'OM_TOGGLE'});
      await chrome.action.setBadgeText({tabId:tab.id,text:result?.ok?'':'IG'});
      await chrome.action.setTitle({tabId:tab.id,title:result?.ok?'Instagram 미디어 저장 안내 열기 / 접기':'계정 프로필의 게시물 탭에서 사용해 주세요.'});
    }
    catch{await chrome.action.setBadgeText({tabId:tab.id,text:'↻'});await chrome.action.setTitle({tabId:tab.id,title:'Instagram 탭을 새로고침해 주세요.'});}
  }else await chrome.tabs.create({url:'https://www.instagram.com/'});
});
