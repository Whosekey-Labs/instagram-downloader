// 개발 테스트 전용 대역. 배포 패키지에는 포함되지 않는다.
const colors=['#a7bdce','#b6c1a3','#dfb59c','#c8bbd2','#c4cca7','#b7cec9','#d6c6a8','#b4c4de','#d5bfc2'];
let saved=new Set(),records=new Map(),id=0;
let defaultCount=Number(localStorage.getItem('fixture-default-count'))||20;
const profileName=location.pathname.split('/').filter(Boolean)[0];
document.querySelector('h1').textContent=profileName;
for(let i=0;i<9;i++){
 const a=document.createElement('a');a.href=`/${profileName}/p/${['BA','BB','BC','BD','BE','BF','BG','BH','BI'][i]}/`;
 const img=document.createElement('img');img.alt='예시 미디어';img.src='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520"><rect width="400" height="520" fill="${colors[i]}"/><circle cx="200" cy="220" r="110" fill="white" opacity=".4"/><path d="M70 420L200 140L330 420Z" fill="#37443b" opacity=".7"/><text x="24" y="44" font-family="sans-serif" font-size="18" fill="#39433a">SAMPLE ${i+1}</text></svg>`);a.append(img);document.getElementById('posts').append(a);
}
globalThis.chrome={runtime:{id:'fixture',onMessage:{addListener:()=>{},removeListener:()=>{}},sendMessage:async m=>{
 if(m.type==='OM_GET_SETTINGS')return {downloadCount:defaultCount};
 if(m.type==='OM_SAVE_SETTINGS'){defaultCount=m.downloadCount;localStorage.setItem('fixture-default-count',String(defaultCount));return {downloadCount:defaultCount};}
 if(m.type==='OM_START'){if(saved.has(m.item.id))return {skipped:true};records.set(++id,m.item.id);return {id};}
 if(m.type==='OM_STATUS'){saved.add(records.get(m.id));return {state:'complete'};}
 if(m.type==='OM_CLEAR')saved.clear();return {ok:true};
}}};
const originalFetch=globalThis.fetch;
globalThis.fetch=async(path,options)=>{
 if(String(path).includes('web_profile_info'))throw new Error('회귀: 프로필 개수 API 호출');
 if(!String(path).startsWith('/api/v1/'))return originalFetch(path,options);
 const code='B'+'ABCDEFGHI'[Number(String(path).match(/media\/(\d+)/)?.[1]||64)-64];
 const data={items:[{code,media_type:1,image_versions2:{candidates:[{url:'https://fixture.cdninstagram.com/photo.jpg',width:1080,height:1350}]}}]};
 return {ok:true,status:200,redirected:false,url:'https://www.instagram.com/api/',headers:new Headers({'content-type':'application/json'}),json:async()=>data};
};
