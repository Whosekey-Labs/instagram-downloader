import { classifyResponse, parseUsername } from './core.js';

export class InstagramBridge {
  tabId = null;
  async connect(username, signal) {
    const name = parseUsername(username);
    const tabs = await chrome.tabs.query({ url: `https://www.instagram.com/${name}/*` });
    const tab = tabs[0] || await chrome.tabs.create({ url: `https://www.instagram.com/${name}/`, active: false });
    this.tabId = tab.id;
    for (let i = 0; i < 40; i++) {
      signal.throwIfAborted();
      try {
        if ((await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_MEDIA_PING' }))?.ok) return;
      } catch { /* 문서 로딩이 끝난 뒤 콘텐츠 스크립트에 연결한다. */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Instagram 탭에 연결하지 못했습니다. 열린 프로필을 새로고침한 뒤 다시 시도해 주세요.');
  }
  async request(action, params, signal) {
    signal.throwIfAborted();
    const cancel = () => this.cancel();
    signal.addEventListener('abort', cancel, { once: true });
    try {
      let result;
      try { result = await chrome.tabs.sendMessage(this.tabId, { type: 'OPEN_MEDIA_REQUEST', action, ...params }); }
      catch { throw new Error('Instagram 탭 연결이 끊어졌습니다. 프로필을 다시 조회해 주세요.'); }
      signal.throwIfAborted();
      if (result?.error) throw new Error(result.error);
      if (!result || !Number.isInteger(result.status)) throw new Error('Instagram 응답을 받지 못했습니다.');
      classifyResponse(result.status, result.data);
      return result.data;
    } finally { signal.removeEventListener('abort', cancel); }
  }
  async cancel() {
    if (this.tabId !== null) await chrome.tabs.sendMessage(this.tabId, { type: 'OPEN_MEDIA_CANCEL' }).catch(() => {});
  }
  async show() {
    if (this.tabId !== null) {
      try { await chrome.tabs.update(this.tabId, { active: true }); return; } catch { /* 닫힌 탭은 로그인 화면으로 대체한다. */ }
    }
    await chrome.tabs.create({ url: 'https://www.instagram.com/' });
  }
}
