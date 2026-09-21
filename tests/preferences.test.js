import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDownloadCount,DEFAULT_DOWNLOAD_COUNT} from '../src/lib/preferences.js';

test('저장할 개수는 1~5000 사이의 정수만 허용한다',()=>{
  assert.equal(DEFAULT_DOWNLOAD_COUNT,20);
  assert.equal(parseDownloadCount('12'),12);
  assert.equal(parseDownloadCount(1),1);
  assert.equal(parseDownloadCount(5000),5000);
  for(const value of ['',null,undefined,true,0,-1,1.5,'abc',5001,Infinity])assert.throws(()=>parseDownloadCount(value),/1~5000/);
});
