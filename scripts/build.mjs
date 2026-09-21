import { mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

await rm('dist', {recursive:true, force:true});
await mkdir('dist/icons', {recursive:true});
await cp('src', 'dist', {recursive:true});
await cp('manifest.json', 'dist/manifest.json');
await cp('LICENSE', 'dist/LICENSE');
await cp('THIRD_PARTY_NOTICES.md', 'dist/THIRD_PARTY_NOTICES.md');

// 외부 이미지와 폰트 없이 직접 그리는 단색 화살표 아이콘.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
}
function chunk(type, bytes) {
  const name = Buffer.from(type); const size=Buffer.alloc(4); size.writeUInt32BE(bytes.length);
  const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([name,bytes])));
  return Buffer.concat([size,name,bytes,crc]);
}
function icon(size) {
  const pixels=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const margin=size===128?16:0;
    const px=(x-margin)/(size-2*margin),py=(y-margin)/(size-2*margin);
    const arrow=(Math.abs(px-.5)<.055&&py>.20&&py<.64)||
      (Math.abs(py-(px+.13))<.065&&px>.27&&px<.5)||
      (Math.abs(py-(-px+1.13))<.065&&px>=.5&&px<.73)||
      (py>.76&&py<.81&&px>.25&&px<.75);
    const index=y*(size*4+1)+1+x*4;
    const rgb=arrow?[247,247,242]:[36,84,237];
    pixels.set([...rgb,px<0||px>=1||py<0||py>=1?0:255],index);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
for(const size of [16,48,128]) await writeFile(`dist/icons/${size}.png`,icon(size));
await mkdir('store/assets',{recursive:true});
await writeFile('store/assets/icon128.png',icon(128));
const version=JSON.parse(await readFile('manifest.json','utf8')).version;
console.log(`확장 ${version} 빌드 완료: dist/`);
