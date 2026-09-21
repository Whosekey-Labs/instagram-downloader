import http from 'node:http';
import {readFile} from 'node:fs/promises';
const routes={'/another.creator/':['tests/fixtures/profile.html','text/html; charset=utf-8'],'/sample.creator/':['tests/fixtures/profile.html','text/html; charset=utf-8'],'/fixture.js':['tests/fixtures/browser.js','text/javascript'],'/content.js':['dist/content.js','text/javascript']};
http.createServer(async(req,res)=>{
 const route=routes[new URL(req.url,'http://localhost').pathname];
 if(!route){res.writeHead(404);res.end('독립 작업 화면은 제거되었습니다. 확장을 설치하고 Instagram 프로필에서 사용하세요.');return;}
 try{res.writeHead(200,{'Content-Type':route[1],'Cache-Control':'no-store'});res.end(await readFile(route[0]));}catch{res.writeHead(500);res.end('먼저 확장을 빌드하세요.');}
}).listen(4174,'127.0.0.1',()=>console.log('개발자 UI 검증 전용: http://127.0.0.1:4174/sample.creator/ (실제 확장 설치를 대체하지 않음)'));
