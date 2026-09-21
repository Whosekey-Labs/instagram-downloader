export const DEFAULT_DOWNLOAD_COUNT=20;
export const MAX_DOWNLOAD_COUNT=5000;

export function parseDownloadCount(value){
  const number=(typeof value==='number'||typeof value==='string'&&value.trim()!=='')?Number(value):NaN;
  if(!Number.isInteger(number)||number<1||number>MAX_DOWNLOAD_COUNT)throw new Error('게시물 수는 1~5000 사이의 정수로 입력해 주세요.');
  return number;
}
