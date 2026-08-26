// 测试知乎 API：先 CDP 取 Cookie，再带 Cookie 调各 API
import { writeFileSync } from 'node:fs';

const CDP_HTTP = 'http://127.0.0.1:9222';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

async function getZhihuCookies() {
  const res = await fetch(`${CDP_HTTP}/json`);
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page' && t.url.includes('zhihu.com'));
  if (!page) throw new Error('未找到知乎页面 target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map(); let msgId = 0;
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise(r => { const id = ++msgId; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  await new Promise(r => ws.onopen = r);
  const resp = await send('Network.getAllCookies');
  ws.close();
  return resp.result.cookies.filter(c => c.domain.includes('zhihu.com')).map(c => `${c.name}=${c.value}`).join('; ');
}

const cookie = await getZhihuCookies();
writeFileSync(new URL('./cookie.txt', import.meta.url), cookie, 'utf8');
console.log('[Cookie 已保存到 cookie.txt]');

async function tryAPI(name, url, headers = {}) {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Cookie': cookie,
        'Referer': 'https://www.zhihu.com/',
        ...headers
      }
    });
    const text = await resp.text();
    let summary;
    try {
      const j = JSON.parse(text);
      summary = JSON.stringify(j).slice(0, 400);
    } catch { summary = text.slice(0, 400); }
    console.log(`\n=== ${name} ===`);
    console.log(`HTTP ${resp.status}`);
    console.log(summary);
  } catch (e) {
    console.log(`\n=== ${name} ===\nERROR: ${e.message}`);
  }
}

// 1. 新版搜索 API
await tryAPI('搜索 search_v3 (www)',
  'https://www.zhihu.com/api/v4/search_v3?t=general&q=%E7%9D%A1%E7%9C%A0&correction=1&offset=0&limit=3&lc_idx=0&show_all_topics=0',
  { 'x-api-version': '3.0.91', 'x-requested-with': 'fetch', 'Accept': 'application/json' });

// 2. 老搜索 API (api.zhihu.com)
await tryAPI('搜索 search_v3 (api.zhihu.com)',
  'https://api.zhihu.com/search_v3?t=general&q=%E7%9D%A1%E7%9C%A0&correction=1&offset=0&limit=3',
  { 'x-api-version': '3.0.91', 'x-requested-with': 'fetch' });

// 3. 问题详情 API
await tryAPI('问题详情 /api/v4/questions/21367788',
  'https://www.zhihu.com/api/v4/questions/21367788?include=detail,excerpt',
  { 'x-api-version': '3.0.91' });

// 4. 首页推荐流（验证登录态）
await tryAPI('推荐流 /topstory/recommend',
  'https://www.zhihu.com/api/v3/feed/topstory/recommend?session_token=&desktop=true&page_number=1&limit=3&action=down&after_id=0',
  { 'x-api-version': '3.0.91' });
