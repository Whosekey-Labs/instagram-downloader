const RESERVED = new Set(['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'direct', 'tv']);

export function parseUsername(input) {
  let value = String(input ?? '').trim().replace(/^@/, '');
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (!['instagram.com', 'www.instagram.com'].includes(url.hostname) || url.username || url.password) throw new Error('Instagram 프로필 주소를 입력해 주세요.');
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 1) throw new Error('게시물 주소 대신 계정 프로필 주소를 입력해 주세요.');
    value = parts[0];
  }
  if (!/^[a-zA-Z0-9_](?:[a-zA-Z0-9_.]{0,28}[a-zA-Z0-9_])?$/.test(value) || value.includes('..') || RESERVED.has(value.toLowerCase())) {
    throw new Error('올바른 Instagram 계정명 또는 프로필 주소를 입력해 주세요.');
  }
  return value.toLowerCase();
}

export function validateMediaUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !['cdninstagram.com', 'fbcdn.net'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    throw new Error('허용되지 않은 미디어 주소입니다.');
  }
  return url.href;
}

// SocialSnag의 MIT 미디어 후보 선택 방식을 참고. 고지는 THIRD_PARTY_NOTICES.md에 포함한다.
export function bestCandidate(candidates) {
  return (candidates || []).filter(item => {
    try { validateMediaUrl(item.url); return true; } catch { return false; }
  }).sort((a, b) => ((b.width || 0) * (b.height || 1)) - ((a.width || 0) * (a.height || 1)))[0]?.url || null;
}

export function classifyResponse(status, data) {
  const message = String(data?.message || '');
  if (status === 429 || /feedback_required|please.wait|rate.limit/i.test(message)) throw new Error('Instagram이 요청을 제한했습니다. 자동 재시도를 중단했습니다. Instagram에서 계정 상태를 확인한 뒤 나중에 다시 시도해 주세요.');
  if (data?.challenge || data?.challenge_required || data?.checkpoint_url || /challenge|checkpoint/i.test(message)) throw new Error('Instagram에서 추가 인증이 필요합니다. Instagram 탭에서 직접 확인해 주세요.');
  if (status === 401 || /login_required|not logged/i.test(message)) throw new Error('Instagram 로그인이 필요합니다. Instagram 탭에서 로그인한 뒤 다시 조회해 주세요.');
  if (status === 403) throw new Error('Instagram에서 접근을 허용하지 않았습니다. 로그인과 계정 상태를 확인해 주세요.');
  if (status === 404) throw new Error('계정을 찾을 수 없거나 현재 접근할 수 없습니다.');
  if (status < 200 || status >= 300 || data?.status === 'fail') throw new Error('Instagram 조회에 실패했습니다. 잠시 후 직접 다시 시도해 주세요.');
}

export function normalizePage(data, username) {
  classifyResponse(200, data);
  if (!Array.isArray(data?.items)) throw new Error('Instagram 응답 형식이 변경되어 목록을 읽을 수 없습니다.');
  if (data.more_available && !data.next_max_id) throw new Error('다음 페이지 정보가 없어 수집을 중단했습니다.');
  const media = [];
  let unavailable = 0;
  for (const post of data.items) {
    const code = String(post.code || post.id || post.pk || '');
    if (!/^[A-Za-z0-9_-]+$/.test(code)) { unavailable++; continue; }
    const nodes = post.carousel_media?.length ? post.carousel_media : [post];
    nodes.forEach((node, index) => {
      const type = node.media_type === 2 || node.video_versions?.length ? 'video' : 'image';
      const url = bestCandidate(type === 'video' ? node.video_versions : node.image_versions2?.candidates);
      if (!url) { unavailable++; return; }
      media.push({
        id: `${username}:${code}:${index + 1}`, username, code, index: index + 1,
        type, url, thumbnail: bestCandidate(node.image_versions2?.candidates),
        timestamp: Number(post.taken_at) || 0,
        caption: String(post.caption?.text || '').slice(0, 1000),
        permalink: `https://www.instagram.com/p/${encodeURIComponent(code)}/`
      });
    });
  }
  return { media, cursor: data.more_available ? String(data.next_max_id) : null, postCount: data.items.length, unavailable };
}

export function mediaFilename(item) {
  const username = parseUsername(item.username);
  const code = String(item.code).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
  const extension = item.type === 'video' ? 'mp4' : (new URL(item.url).pathname.match(/\.(png|webp|jpeg|jpg)$/i)?.[1]?.toLowerCase() || 'jpg');
  return `OpenMedia/${username}/${username}_${code}_${String(item.index).padStart(2, '0')}.${extension}`;
}
