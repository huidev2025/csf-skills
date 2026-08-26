// 知乎批量搜索（skill 版）：断点续传 + 失败分级 + 增量落盘
// 用法: node zhihu_batch_search.mjs "话题1" "话题2" ... [--limit 3] [--out result.json]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cookieFile = join(__dirname, 'cookie.txt');
if (!existsSync(cookieFile)) {
  console.error('❌ 未找到 cookie.txt。请先运行: node get_cookies.mjs');
  process.exit(1);
}
const cookie = readFileSync(cookieFile, 'utf8').trim();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

// ---- 参数解析 ----
const args = process.argv.slice(2);
const topics = [];
let limit = 3, outFile = 'batch_result.json';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit') limit = parseInt(args[++i], 10);
  else if (args[i] === '--out') outFile = args[++i];
  else topics.push(args[i]);
}
if (!topics.length) { console.error('用法: node zhihu_batch_search.mjs "话题1" "话题2" [--limit 3] [--out x.json]'); process.exit(1); }

const outPath = join(__dirname, outFile);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const stripHtml = html => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
const stripEm = t => t.replace(/<\/?em>/g, '');

// API URL → 网页 URL（实测规则，勿改）
function apiUrlToWeb(o) {
  const u = o.url || '';
  if (o.type === 'article') {
    const id = u.match(/articles\/(\d+)/)?.[1];
    return id ? `https://zhuanlan.zhihu.com/p/${id}` : u;
  }
  if (o.type === 'answer' && o.question?.id) {
    const aid = u.match(/answers\/(\d+)/)?.[1];
    return aid
      ? `https://www.zhihu.com/question/${o.question.id}/answer/${aid}`
      : `https://www.zhihu.com/question/${o.question.id}`;
  }
  if (o.type === 'question') {
    const id = u.match(/questions\/(\d+)/)?.[1];
    return id ? `https://www.zhihu.com/question/${id}` : u;
  }
  return u.replace('api.zhihu.com', 'www.zhihu.com');
}

// ---- 断点续传：读已有输出，跳过已完成话题 ----
const doneTopics = new Set();
if (existsSync(outPath)) {
  try {
    const prev = JSON.parse(readFileSync(outPath, 'utf8'));
    prev.forEach(r => { if (r.topic) doneTopics.add(r.topic); });
    console.log(`[续传] 检测到输出文件，已完成 ${doneTopics.size} 个话题，将跳过`);
  } catch { /* 文件损坏则重来 */ }
}

async function searchTopic(topic) {
  const q = encodeURIComponent(topic);
  const url = `https://www.zhihu.com/api/v4/search_v3?t=general&q=${q}&correction=1&offset=0&limit=${limit}&lc_idx=0&show_all_topics=0`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': UA, 'Cookie': cookie,
      'Referer': `https://www.zhihu.com/search?type=content&q=${q}`,
      'x-api-version': '3.0.91', 'x-requested-with': 'fetch'
    }
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const j = await resp.json();
  const items = (j.data || [])
    .filter(d => d.type === 'search_result' && d.object)
    .map(d => {
      const o = d.object;
      return {
        type: o.type,
        title: stripEm(d.highlight?.title || o.title || ''),
        excerpt: stripHtml(stripEm(o.excerpt || '')).slice(0, 200),
        url: apiUrlToWeb(o),
        voteup_count: o.voteup_count ?? null,
        comment_count: o.comment_count ?? null,
        favorites_count: o.favorites_count ?? null,
        created_time: o.created_time ?? null,
        content_text: stripHtml(o.content || '').slice(0, 600)
      };
    });
  return { topic, count: items.length, items };
}

// ---- 主流程：增量落盘 + 失败分级 ----
const CONSECUTIVE_FAIL_THRESHOLD = 5;
const results = existsSync(outPath)
  ? JSON.parse(readFileSync(outPath, 'utf8')) // 续传基座
  : [];
let consecutiveFails = 0;

console.log(`开始批量搜索: ${topics.join(' | ')}（每话题 ${limit} 条）\n`);
for (const t of topics) {
  if (doneTopics.has(t)) { console.log(`⏭️ 跳过（已完成）「${t}」`); continue; }
  try {
    const r = await searchTopic(t);
    results.push(r);
    consecutiveFails = 0;
    console.log(`✅ 「${t}」: ${r.count} 条`);
    for (const it of r.items) {
      console.log(`   - [${it.type}] ${it.title.slice(0, 40)} | 赞${it.voteup_count ?? '-'} 评${it.comment_count ?? '-'}`);
    }
  } catch (e) {
    consecutiveFails++;
    console.log(`❌ 「${t}」: ${e.message}（连续失败 ${consecutiveFails}/${CONSECUTIVE_FAIL_THRESHOLD}）`);
    results.push({ topic: t, count: 0, items: [], error: e.message });
  }
  // 每话题完成立即落盘（断点续传基础）
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  if (consecutiveFails >= CONSECUTIVE_FAIL_THRESHOLD) {
    console.error(`\n⚠️ 连续 ${CONSECUTIVE_FAIL_THRESHOLD} 次失败，疑似 Cookie 过期或限流。`);
    console.error('   建议：① 停 10 分钟再跑（限流）；② 重跑 node get_cookies.mjs 重新提取 Cookie。');
    break;
  }
  await sleep(1500); // 礼貌间隔，防风控（勿调小）
}

console.log(`\n结果已保存: scripts/${outFile}`);
