// 개발 서버에서만 로드하는 Chrome API 대역. 배포 ZIP에는 포함되지 않는다.
const saved={};let id=0;
globalThis.chrome={
  runtime:{id:'development-preview'},
  storage:{local:{get:async()=>structuredClone(saved),set:async data=>Object.assign(saved,structuredClone(data)),remove:async key=>delete saved[key]}},
  tabs:{
    query:async()=>[{id:1}],create:async()=>({id:1}),update:async()=>{},
    sendMessage:async(_,message)=>{
      if(message.type!=='OPEN_MEDIA_REQUEST')return {ok:true};
      await new Promise(resolve=>setTimeout(resolve,250));
      if(message.action==='profile')return {status:200,data:{data:{user:{username:message.username,id:'12345'}}}};
      const page=message.cursor?1:0;
      const items=Array.from({length:4},(_,i)=>({
        id:`${page*4+i+1}`,code:`Sample${page*4+i+1}`,media_type:i%2===0?1:2,taken_at:1789500000-i*86400,
        caption:{text:['기억하고 싶은 장면','느긋한 오후의 기록','새로운 시선으로','오래 간직할 순간'][i]},
        image_versions2:{candidates:[{url:`https://preview.cdninstagram.com/${i}.jpg`,width:1080,height:1350}]},
        ...(i%2?{video_versions:[{url:`https://preview.cdninstagram.com/${i}.mp4`,width:1080,height:1350}]}:{})
      }));
      return {status:200,data:{items,more_available:page===0,next_max_id:page===0?'second':undefined}};
    }
  },
  downloads:{download:async()=>++id,search:async()=>[{state:'complete',mime:'image/jpeg'}],cancel:async()=>{}}
};
await import('./app.js');
