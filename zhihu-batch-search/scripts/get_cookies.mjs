// 通过 CDP 提取知乎 Cookie
const CDP_HTTP = 'http://127.0.0.1:9222';

async function main() {
  // 1. 列出所有 target，找知乎页面
  const res = await fetch(`${CDP_HTTP}/json`);
  const targets = await res.json();
  const zhihuPage = targets.find(t => t.type === 'page' && t.url.includes('zhihu.com'));
  if (!zhihuPage) {
    console.error('未找到知乎页面 target');
    process.exit(1);
  }
  console.error(`[目标页面] ${zhihuPage.title} | ${zhihuPage.url}`);

  // 2. WebSocket 连接页面 target
  const ws = new WebSocket(zhihuPage.webSocketDebuggerUrl);
  const pending = new Map();
  let msgId = 0;

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };

  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await new Promise(r => ws.onopen = r);

  // 3. 获取全部 cookie（含 httpOnly）
  const cookieResp = await send('Network.getAllCookies');
  const allCookies = cookieResp.result?.cookies || [];
  const zhihuCookies = allCookies.filter(c => c.domain.includes('zhihu.com'));

  console.error(`[共取到 cookie] ${allCookies.length} 条，其中知乎 ${zhihuCookies.length} 条`);

  // 4. 输出：cookie 键值对（Python requests 风格）
  const kv = zhihuCookies.map(c => `${c.name}=${c.value}`).join('; ');

  // 5. 落盘 cookie.txt（供 zhihu_batch_search.mjs 使用）
  const { writeFileSync } = await import('node:fs');
  const cookieFile = new URL('./cookie.txt', import.meta.url);
  writeFileSync(cookieFile, kv, 'utf8');
  console.error(`[已写入] ${cookieFile.pathname}`);
  console.error(`[含 z_c0 登录凭证] ${zhihuCookies.some(c => c.name === 'z_c0') ? '是 ✓' : '否 ⚠️ 可能未登录'}`);

  ws.close();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
