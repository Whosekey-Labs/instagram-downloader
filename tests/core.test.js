import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUsername, normalizePage, mediaFilename, validateMediaUrl, classifyResponse } from '../src/lib/core.js';

const image = (id, extra = {}) => ({ id, code: 'Ab_c123', media_type: 1, taken_at: 1700000000,
  image_versions2: { candidates: [
    { url: 'https://s.cdninstagram.com/small.jpg?sig=keep', width: 320, height: 320 },
    { url: 'https://s.cdninstagram.com/large.jpg?sig=keep', width: 1080, height: 1080 }
  ] }, ...extra });

test('계정명과 Instagram 프로필 URL을 정규화한다', () => {
  assert.equal(parseUsername(' @Meta '), 'meta');
  assert.equal(parseUsername('https://www.instagram.com/meta/?hl=ko'), 'meta');
  for (const bad of ['https://evil.com/meta', 'https://instagram.com@evil.com/meta', '../secret', 'a/b', 'https://instagram.com/p/abc', '', 'a..b']) {
    assert.throws(() => parseUsername(bad));
  }
});
test('서명은 보존하고 HTTPS Instagram CDN만 허용한다', () => {
  assert.equal(validateMediaUrl('https://s.cdninstagram.com/a.jpg?sig=123'), 'https://s.cdninstagram.com/a.jpg?sig=123');
  for (const bad of ['http://s.cdninstagram.com/a', 'https://cdninstagram.com.evil.test/a', 'https://evil.test/a', 'file:///a', 'https://u:p@s.fbcdn.net/a']) assert.throws(() => validateMediaUrl(bad));
});
test('사진은 가장 큰 후보를 선택하고 캐러셀의 영상은 영상으로 저장한다', () => {
  const page = normalizePage({ items: [image('123', {carousel_media: [image('a'), image('b', { media_type: 2, video_versions: [{url:'https://v.fbcdn.net/b.mp4',width:1080}] })]})], more_available:true, next_max_id:'next' }, 'meta');
  assert.equal(page.media.length, 2);
  assert.equal(page.media[0].url, 'https://s.cdninstagram.com/large.jpg?sig=keep');
  assert.equal(page.media[1].type, 'video');
  assert.equal(page.media[1].url, 'https://v.fbcdn.net/b.mp4');
  assert.equal(page.cursor, 'next');
  assert.equal(page.postCount, 1);
  assert.equal(mediaFilename(page.media[1]), 'OpenMedia/meta/meta_Ab_c123_02.mp4');
});
test('영상 URL이 없으면 썸네일을 영상 대신 저장하지 않는다', () => {
  const page = normalizePage({items:[image('1', {media_type:2})],more_available:false}, 'meta');
  assert.equal(page.media.length,0);
  assert.equal(page.unavailable,1);
});
test('빈 계정과 응답 형식 변경을 구분한다', () => {
  assert.deepEqual(normalizePage({items:[],more_available:false}, 'meta'), {media:[],cursor:null,postCount:0,unavailable:0});
  assert.throws(() => normalizePage({hello:'world'}, 'meta'), /응답/);
  assert.throws(() => normalizePage({items:[],more_available:true}, 'meta'), /페이지/);
});
test('요청 제한 및 인증 실패를 자동 재시도 없는 오류로 분류한다', () => {
  assert.throws(() => classifyResponse(429, {}), /요청/);
  assert.throws(() => classifyResponse(200, {challenge_required:true}), /인증/);
  assert.throws(() => classifyResponse(200, {status:'fail',message:'login_required'}), /로그인/);
  assert.throws(() => classifyResponse(403, {}), /접근/);
  assert.equal(classifyResponse(200, {status:'ok'}), undefined);
});
