import {readFile, readdir, stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
const manifest=JSON.parse(await readFile('dist/manifest.json','utf8'));
assert.equal(manifest.manifest_version,3);
assert.deepEqual(manifest.permissions,['downloads','storage']);
assert.deepEqual(manifest.host_permissions,['https://www.instagram.com/*']);
for(const file of [manifest.background.service_worker,...Object.values(manifest.icons),...manifest.content_scripts.flatMap(item=>item.js),'privacy.html','LICENSE','THIRD_PARTY_NOTICES.md']) await stat(path.join('dist',file));
assert.ok(!(await readdir('dist')).includes('app.html'),'이전 별도 작업 화면이 포함됨');
async function check(dir) {
  for(const file of await readdir(dir,{withFileTypes:true})) {
    const name=path.join(dir,file.name);
    if(file.isDirectory()) await check(name);
    else if(file.name.endsWith('.js')) {
      execFileSync(process.execPath,['--check',name]);
      const text=await readFile(name,'utf8');
      if(name.startsWith('dist'+path.sep))assert.ok(!text.includes('web_profile_info'),'금지된 프로필 개수 조회가 배포 파일에 포함됨');
      assert.ok(!/\beval\(|new Function\(/.test(text),name);
    }
  }
}
await check('dist');
await check('src');
await check('scripts');
await check('tests');
for(const file of ['post-collection.js','post-download.js']){
  const source=await readFile(path.join('src/lib',file),'utf8');
  assert.ok(!/\b(?:window|document|chrome|fetch|XMLHttpRequest)\b/.test(source),`${file}: 공통 실행 모듈에 브라우저 의존성이 포함됨`);
}
assert.ok(!/\bfetch\s*\(|new\s+XMLHttpRequest/.test(await readFile('src/inline.js','utf8')),'UI에서 직접 네트워크를 요청함');
console.log('Manifest V3, 최소 권한, 파일 누락, JavaScript 문법 검사 통과');
