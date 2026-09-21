import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readProfilePostCount} from '../src/lib/page.js';

test('프로필 화면에 표시된 정확한 게시물 수만 읽는다',()=>{
  for(const [text,count] of [['yoon_forest_\n게시물 919\n팔로워 8785',919],['게시물 1,234',1234],['1,234 posts',1234],['게시물 0',0]]){
    const document=new JSDOM(`<main><header>${text}</header></main>`).window.document;
    assert.equal(readProfilePostCount(document),count);
  }
});
test('축약된 수치나 캡션의 숫자를 전체 게시물 수로 추정하지 않는다',()=>{
  for(const html of ['<main><header>게시물 1.2만</header></main>','<main><header>1.2K posts</header></main>','<main><article>게시물 900</article></main>','<main><header>계정명</header><article>게시물 900</article></main>']){
    assert.equal(readProfilePostCount(new JSDOM(html).window.document),null);
  }
});
