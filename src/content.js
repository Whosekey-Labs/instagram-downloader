(() => {
  const APP_ID = '936619743392459';
  let active = null;
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('app.html'))) return false;
    if (message?.type === 'OPEN_MEDIA_PING') { reply({ ok: true }); return false; }
    if (message?.type === 'OPEN_MEDIA_CANCEL') { active?.abort(); reply({ ok: true }); return false; }
    if (message?.type !== 'OPEN_MEDIA_REQUEST') return false;
    if (active) { reply({ error: '조회가 진행 중입니다. 완료 후 다시 시도해 주세요.' }); return false; }
    let path;
    if (message.action === 'profile' && /^[a-zA-Z0-9_.]{1,30}$/.test(message.username)) {
      path = `/api/v1/users/web_profile_info/?username=${encodeURIComponent(message.username)}`;
    } else if (message.action === 'feed' && /^\d{1,30}$/.test(message.userId) && (!message.cursor || (typeof message.cursor === 'string' && message.cursor.length <= 1024))) {
      const count = Number.isInteger(message.count) && message.count >= 1 && message.count <= 12 ? message.count : 12;
      const params = new URLSearchParams({ count: String(count) });
      if (message.cursor) params.set('max_id', message.cursor);
      path = `/api/v1/feed/user/${message.userId}/?${params}`;
    } else { reply({ error: '잘못된 조회 요청입니다.' }); return false; }
    const controller = new AbortController();
    active = controller;
    const timer = setTimeout(() => controller.abort(), 25000);
    (async () => {
      try {
        const response = await fetch(path, { credentials: 'same-origin', headers: { 'X-IG-App-ID': APP_ID }, signal: controller.signal });
        if (response.redirected || /\/accounts\/login|\/challenge\//.test(response.url)) {
          reply({ status: 401, data: { message: 'login_required' } }); return;
        }
        if (!response.headers.get('content-type')?.includes('application/json')) {
          reply({ status: response.ok ? 401 : response.status, data: {} }); return;
        }
        reply({ status: response.status, data: await response.json() });
      } catch (error) {
        reply({ error: error.name === 'AbortError' ? '조회가 중단되었거나 응답 시간이 초과되었습니다.' : 'Instagram에 연결할 수 없습니다. 탭과 네트워크를 확인해 주세요.' });
      } finally { clearTimeout(timer); active = null; }
    })();
    return true;
  });
})();
