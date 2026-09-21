export async function runQueue(items, { completed, signal, download, remember, onProgress }) {
  const state = { saved: 0, skipped: 0, failed: [], warnings: [], cancelled: false, total: items.length };
  const seen = new Set(completed);
  for (const item of items) {
    if (signal.aborted) { state.cancelled = true; break; }
    if (seen.has(item.id)) {
      state.skipped++;
    } else {
      try {
        await download(item, signal);
        if (signal.aborted) { state.cancelled = true; break; }
        state.saved++;
        seen.add(item.id);
        try { await remember(item); }
        catch { state.warnings.push('파일은 저장했지만 중복 방지 기록을 보관하지 못했습니다.'); }
      } catch (error) {
        if (signal.aborted || error.name === 'AbortError') { state.cancelled = true; break; }
        state.failed.push({ id: item.id, message: error.message });
      }
    }
    onProgress({ ...state, current: item.id });
  }
  onProgress({ ...state });
  return state;
}
