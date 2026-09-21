import { mediaFilename, validateMediaUrl } from './core.js';

export async function downloadFile(item, signal, api = chrome.downloads, { pollMs = 600, timeoutMs = 180000 } = {}) {
  signal.throwIfAborted();
  const id = await api.download({ url: validateMediaUrl(item.url), filename: mediaFilename(item), conflictAction: 'uniquify', saveAs: false });
  const cancel = () => api.cancel(id).catch(() => {});
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const start = Date.now();
    while (true) {
      if (signal.aborted) { await cancel(); signal.throwIfAborted(); }
      const [state] = await api.search({ id });
      if (!state) throw new Error('다운로드 기록을 확인할 수 없습니다.');
      if (state.state === 'interrupted') throw new Error(`파일 저장 실패: ${state.error || '연결 중단'}`);
      if (state.state === 'complete') {
        if (state.mime && !/^(image|video)\//.test(state.mime) && state.mime !== 'application/octet-stream') throw new Error('미디어 대신 오류 문서가 내려와 완료로 기록하지 않았습니다.');
        return id;
      }
      if (Date.now() - start > timeoutMs) { await cancel(); throw new Error('파일 저장 시간이 초과되었습니다.'); }
      await new Promise(resolve => setTimeout(resolve, pollMs));
    }
  } finally { signal.removeEventListener('abort', cancel); }
}
