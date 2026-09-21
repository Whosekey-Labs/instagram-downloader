import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let body;
    if(pathname==='/preview-client.js') body=await readFile('scripts/preview-client.js');
    else if(pathname==='/lib/preview-core.js') body=`export * from './core.js'; import {normalizePage as normalize} from './core.js'; export function normalizePage(data,name){const page=normalize(data,name);return {...page,media:page.media.map((item,i)=>({...item,thumbnail:'/fixture/'+(i%4)+'.svg'}))};}`;
    else if(/^\/fixture\/[0-3]\.svg$/.test(pathname)) {
      const n=Number(pathname.split('/').pop()[0]);
      const colors=['#b9d4eb','#b9c2a2','#e5b18f','#d9c5df'];
      body=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800"><rect width="640" height="800" fill="${colors[n]}"/><circle cx="320" cy="350" r="190" fill="#ffffff" opacity=".45"/><path d="M100 660L320 250L540 660Z" fill="#26322c" opacity=".7"/><text x="40" y="65" font-family="sans-serif" font-size="22" fill="#26322c">SAMPLE MEDIA / 0${n+1}</text><text x="40" y="750" font-family="sans-serif" font-size="16" fill="#26322c">LOCAL UI TEST · NO INSTAGRAM CONTENT</text></svg>`;
    } else {
      const target=path.resolve(root,'.'+(pathname==='/'?'/app.html':pathname));
      if(!target.startsWith(root+path.sep)||!(await stat(target)).isFile()) throw new Error('not found');
      body=await readFile(target);
      if(target.endsWith('/app.html')) body=body.toString().replace('<body>','<body><div class="preview-notice">화면 테스트 · 예시 미디어 / 실제 Instagram 요청·파일 저장 없음</div>').replace('<script type="module" src="app.js"></script>','<script type="module" src="preview-client.js"></script>');
      if(target.endsWith('/app.js')) body=body.toString().replace("from './lib/core.js'","from './lib/preview-core.js'");
    }
    res.writeHead(200,{'Content-Type':types[path.extname(pathname)]||'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(body);
  } catch {res.writeHead(404);res.end('파일을 찾을 수 없습니다.');}
}).listen(4173,'127.0.0.1',()=>console.log('로컬 UI 테스트: http://127.0.0.1:4173 (실제 Instagram 다운로드와 구별되는 개발 전용 화면)'));
