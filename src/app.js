import { parseUsername, normalizePage } from './lib/core.js';
import { InstagramBridge } from './lib/bridge.js';
import { downloadFile } from './lib/download.js';
import { runQueue } from './lib/queue.js';

const $ = id => document.getElementById(id);
const bridge = new InstagramBridge();
let media = [], selected = new Set(), history = {}, filter = 'all';
let username = '', userId = '', cursor = null, posts = 0, unavailable = 0;
let busy = false, controller = null, seenCursors = new Set();
const extensionAvailable = Boolean(globalThis.chrome?.runtime?.id);

function setStatus(message, kind = '') {
  $('status').textContent = message;
  $('status-dot').className = `status-dot ${kind}`;
}
function visibleMedia() { return media.filter(item => filter === 'all' || item.type === filter); }
function updateControls() {
  for (const id of ['lookup', 'account', 'load-more', 'collect', 'limit', 'clear-history']) $(id).disabled = busy || !extensionAvailable;
  $('load-more').disabled ||= !cursor;
  $('collect').disabled ||= !cursor;
  $('download').disabled = busy || selected.size === 0 || !extensionAvailable;
  $('stop').hidden = !busy;
  $('selected-count').textContent = `${selected.size.toLocaleString()}개 선택됨`;
  const visible = visibleMedia();
  $('select-all').checked = visible.length > 0 && visible.every(item => selected.has(item.id));
  $('select-all').indeterminate = visible.some(item => selected.has(item.id)) && !$('select-all').checked;
  $('collection-info').textContent = `${posts.toLocaleString()}개 게시물 확인${unavailable ? ` · 파일 정보 없음 ${unavailable}개` : ''}`;
  $('media-count').textContent = media.length.toLocaleString();
  $('end-note').hidden = Boolean(cursor) || !userId;
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function render() {
  $('collection').hidden = !userId;
  $('empty').hidden = media.length > 0;
  $('profile-name').textContent = username ? `@${username.toUpperCase()}` : 'COLLECTION';
  const fragment = document.createDocumentFragment();
  for (const item of visibleMedia()) {
    const card = element('article', `card${selected.has(item.id) ? ' selected' : ''}`);
    const label = element('label', 'card-media');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = selected.has(item.id);
    checkbox.setAttribute('aria-label', `${item.code} ${item.index}번째 ${item.type === 'video' ? '동영상' : '사진'} 선택`);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selected.add(item.id); else selected.delete(item.id);
      card.classList.toggle('selected', checkbox.checked); updateControls();
    });
    label.append(checkbox);
    if (item.thumbnail) {
      const img = document.createElement('img');
      img.src = item.thumbnail; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => { img.hidden = true; });
      label.append(img);
    }
    label.append(element('span', 'type-label', item.type === 'video' ? '▶ 동영상' : '사진'));
    if (history[item.id]) label.append(element('span', 'saved-label', '저장 기록 있음'));
    const info = element('div', 'card-info');
    info.append(element('p', '', item.caption || `${item.code} · ${item.index}`));
    const link = element('a'); link.href = item.permalink; link.target = '_blank'; link.rel = 'noopener noreferrer';
    const date = item.timestamp ? new Date(item.timestamp * 1000).toLocaleDateString('ko-KR') : '게시물 보기';
    link.append(element('span', '', date), element('span', '', '원본 ↗'));
    info.append(link); card.append(label, info); fragment.append(card);
  }
  $('grid').replaceChildren(fragment); updateControls();
}
async function runOperation(action) {
  if (busy) return;
  busy = true; controller = new AbortController(); updateControls();
  try { await action(controller.signal); }
  catch (error) {
    if (controller.signal.aborted || error.name === 'AbortError') setStatus('작업을 중단했습니다. 가져온 목록은 유지됩니다.');
    else setStatus(error.message || '작업을 완료하지 못했습니다.', 'error');
  } finally { busy = false; controller = null; updateControls(); }
}
async function loadPage(signal, count = 12) {
  setStatus(`@${username}의 미디어를 가져오는 중입니다… (${posts}개 게시물 확인)`, 'busy');
  const data = await bridge.request('feed', { userId, cursor, count }, signal);
  const page = normalizePage(data, username);
  if (page.cursor && seenCursors.has(page.cursor)) throw new Error('Instagram이 같은 페이지를 반환하여 수집을 중단했습니다.');
  if (page.cursor) seenCursors.add(page.cursor);
  const known = new Set(media.map(item => item.id));
  for (const item of page.media) {
    if (!known.has(item.id)) { media.push(item); known.add(item.id); }
  }
  posts += page.postCount; unavailable += page.unavailable; cursor = page.cursor;
  render();
  setStatus(`${media.length}개 파일을 찾았습니다.${cursor ? ' 더 가져오거나 필요한 파일을 선택하세요.' : ' 계정의 마지막 페이지까지 확인했습니다.'}`);
}
$('profile-form').addEventListener('submit', event => {
  event.preventDefault();
  let name;
  try { name = parseUsername($('account').value); }
  catch (error) { setStatus(error.message, 'error'); return; }
  runOperation(async signal => {
    username = name; userId = ''; media = []; selected.clear(); cursor = null; posts = 0; unavailable = 0; seenCursors.clear(); render();
    $('progress').hidden = true; $('progress-text').textContent = '필요한 파일만 골라 저장하세요.';
    setStatus(`@${name} 프로필을 확인하는 중입니다…`, 'busy');
    await bridge.connect(name, signal);
    const profile = await bridge.request('profile', {username:name}, signal);
    const user = profile?.data?.user;
    if (!user || String(user.username).toLowerCase() !== name || !/^\d+$/.test(String(user.id))) throw new Error('계정 정보를 확인하지 못했습니다. 프로필 주소와 Instagram 로그인 상태를 확인해 주세요.');
    userId = String(user.id);
    await loadPage(signal);
  });
});
$('load-more').addEventListener('click', () => runOperation(signal => loadPage(signal)));
$('collect').addEventListener('click', () => runOperation(async signal => {
  const limit = Number($('limit').value);
  if (!Number.isInteger(limit) || limit < 12 || limit > 5000) throw new Error('수집할 게시물 수는 12~5000 사이의 정수로 입력해 주세요.');
  while (cursor && posts < limit) {
    signal.throwIfAborted();
    await new Promise(resolve => setTimeout(resolve, 2000));
    signal.throwIfAborted();
    await loadPage(signal, Math.min(12, limit - posts));
  }
  setStatus(`${posts}개 게시물에서 ${media.length}개 파일을 가져왔습니다.${cursor ? ' 지정한 수에 도달했습니다. 계속 가져올 수 있습니다.' : ' 마지막 페이지까지 확인했습니다.'}`);
}));
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  render();
}));
$('select-all').addEventListener('change', () => {
  for (const item of visibleMedia()) {
    if ($('select-all').checked) selected.add(item.id); else selected.delete(item.id);
  }
  render();
});
$('stop').addEventListener('click', () => { controller?.abort(); bridge.cancel(); setStatus('진행 중인 작업을 중단하고 있습니다…'); });
$('instagram').addEventListener('click', () => bridge.show().catch(error => setStatus(error.message, 'error')));
$('clear-history').addEventListener('click', async () => {
  try {
    await chrome.storage.local.remove('completed'); history = {}; render();
    setStatus('저장 기록을 지웠습니다. 내려받은 파일은 그대로 유지됩니다.');
  } catch { setStatus('저장 기록을 지우지 못했습니다.', 'error'); }
});
$('download').addEventListener('click', () => runOperation(async signal => {
  const items = media.filter(item => selected.has(item.id));
  await navigator.locks.request('open-media-download', {ifAvailable:true}, async lock => {
    if (!lock) throw new Error('다른 확장 탭에서 다운로드 중입니다. 해당 작업을 먼저 완료해 주세요.');
    history = (await chrome.storage.local.get('completed')).completed || {};
    $('progress').hidden = false; $('progress').max = items.length; $('progress').value = 0;
    setStatus(`${items.length}개 파일을 순서대로 저장합니다. 이 작업 탭을 열어 두세요.`, 'busy');
    const result = await runQueue(items, {
      completed: new Set(Object.keys(history)), signal, download: downloadFile,
      remember: async item => {
        history[item.id] = Date.now();
        const keys = Object.keys(history);
        if (keys.length > 20000) for (const key of keys.sort((a,b) => history[a]-history[b]).slice(0,keys.length-20000)) delete history[key];
        await chrome.storage.local.set({completed:history});
      },
      onProgress: state => {
        $('progress').value = state.saved + state.skipped + state.failed.length;
        $('progress-text').textContent = `저장 ${state.saved} · 중복 ${state.skipped} · 실패 ${state.failed.length} / ${state.total}`;
      }
    });
    render();
    const summary = `저장 ${result.saved}개, 중복 건너뜀 ${result.skipped}개, 실패 ${result.failed.length}개.`;
    setStatus(`${result.cancelled ? '다운로드를 중단했습니다.' : '다운로드 작업이 끝났습니다.'} ${summary}${result.failed[0] ? ` ${result.failed[0].message}` : ''}${result.warnings[0] ? ` ${result.warnings[0]}` : ''}`, result.failed.length || result.warnings.length ? 'error' : '');
  });
}));

if (extensionAvailable) {
  chrome.storage.local.get('completed').then(data => { history = data.completed || {}; render(); }).catch(() => setStatus('저장 기록을 읽지 못했습니다.', 'error'));
} else {
  setStatus('확장 프로그램으로 설치한 뒤 도구 모음의 아이콘을 눌러 열어 주세요.', 'error');
  updateControls();
}
