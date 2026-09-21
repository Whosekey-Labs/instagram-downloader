import {writeFile,mkdir} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
const width=440,height=280;
const data=Buffer.alloc((width*3+1)*height);
function rect(x,y,x1,y1,x2,y2){return x>=x1&&x<x2&&y>=y1&&y<y2;}
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  let rgb=[32,39,30];
  if(rect(x,y,38,52,166,209))rgb=[136,153,116];
  if(rect(x,y,51,65,179,222))rgb=[194,211,174];
  if(rect(x,y,64,78,192,235))rgb=[247,247,242];
  if(rect(x,y,73,88,183,208))rgb=[167,193,217];
  if((x-128)**2+(y-133)**2<24**2)rgb=[247,247,242];
  if(y>150&&y<199&&Math.abs(x-125)<(y-145)*.9)rgb=[63,84,68];
  if(rect(x,y,254,97,398,220)||rect(x,y,254,78,320,98))rgb=[36,84,237];
  if(rect(x,y,319,120,333,170)||(y>=153&&y<185&&Math.abs(x-326)<185-y))rgb=[247,247,242];
  if(rect(x,y,308,192,344,200))rgb=[247,247,242];
  if(rect(x,y,205,145,235,151)||(x>226&&x<241&&Math.abs(y-148)<241-x))rgb=[247,247,242];
  data.set(rgb,y*(width*3+1)+1+x*3);
}
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,bytes){const name=Buffer.from(type),len=Buffer.alloc(4),sum=Buffer.alloc(4);len.writeUInt32BE(bytes.length);sum.writeUInt32BE(crc(Buffer.concat([name,bytes])));return Buffer.concat([len,name,bytes,sum]);}
const head=Buffer.alloc(13);head.writeUInt32BE(width);head.writeUInt32BE(height,4);head[8]=8;head[9]=2;
await mkdir('store/assets',{recursive:true});
await writeFile('store/assets/promo440.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(data)),chunk('IEND',Buffer.alloc(0))]));
console.log('홍보 이미지 생성 완료: 440×280');
