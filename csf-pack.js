// csf-pack.js — CSF 打包脚本（随 knowledge/skills/csf-打包.md 分发，供 skill 调用）
//
// 运行位置：项目根目录（cwd = 项目根，csf-lite/ 在其下）。零依赖，需要 node + PowerShell（Windows）。
//
// 用法：
//   node csf-pack.js build            阶段1：建临时目录 + 复制 + 清运行时 + 哨兵清洗 + 断言
//   node csf-pack.js diff <prevZip>   阶段2a：与上一版 ZIP 全库 diff（无基线可跳过）
//   node csf-pack.js zip <version>    阶段3：打 ZIP + 包内验收
//
// 环境识别：
//   dev/resources/template/ 存在 = 母仓 → ZIP 输出到 dev/resources/template/
//   否则 = 用户项目 → ZIP 输出到项目根 _outputs/（与 csf-lite 同级）
//   diff 基线仅母仓有（上一版 ZIP）；用户项目不与自己既往包对比（Owner 裁定 2026-08-25）。

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const CSF = path.join(ROOT, 'csf-lite');
const TMP = path.join(os.tmpdir(), 'csf-zip-build');
const PREV = path.join(os.tmpdir(), 'csf-zip-prev');
const SLOT = '- 编号: 0 | 写入者: 模板分发 | 环境: — | 时间: —';

// ── 骨架（PROJECT 区重置文本；修改时同步 skill 清洗规则表）──
// 注意：写入时必须 CRLF（与 v3.1 已发布基线字节一致，保证版本间 diff 无换行噪音）
const CRLF = s => s.replace(/\n/g, '\r\n');
const SK_P2_COS = `<!-- @TEMPLATE:PROJECT -->
## §B 任务窗口

### 全景图

<!-- Token 极简速查: 🔴焦点 🟡活跃(非焦点) ⬜计划 ✅完 ⛔废 🧩散，并行前缀‼️ -->

\`\`\`mermaid
GP: <!-- 项目名 — 总目标 -->

└─ ⬜ 待立项
\`\`\`

### 三元组指针

> 活跃三元组：
> - （暂无——项目初始化时建立第一个三元组）
>
> 每次会话开局由参谋长基于 §D 方向 + [[csf-lite/triplets/_index|_index]] 提议本次使用的三元组，Owner 确认后可调整。
> 三元组文件（\`triplets/\` 目录下）包含：目的 + 方法 + 资源 + 进度表 + 活跃防御 + 备忘。
> 一个项目可有多个三元组并行存活。

### 通用资源（每次会话必读）

1. cos-context.md（本文件）
2. \`{WORKSPACE}/csf-lite/triplets/\` — 当前活跃三元组文件（DO 分支 L2 精读）
3. 项目文档（按需）

<!-- @/SECTION:B -->

---

<!-- @SECTION:C -->
## §C 上次会话

**（无）**

<!-- @SECTION:D -->
## §D 下次会话

**方向**：项目初始化 — 建立第一个三元组 + 填写全景图。

<!-- @SECTION:INBOX -->
## §收件箱

> 本段 = 开发者→参谋长的异步消息。
>
<!-- 哨兵格式：每条用 <!-- @MSG:N -->...<!-- @/MSG:N --> 包围 -->

<!-- @/SECTION:INBOX -->
<!-- @/TEMPLATE:PROJECT -->
`;

const SK_P1_DEV = `<!-- @TEMPLATE:PROJECT -->
<!-- 快速状态栏（开发者每次收尾时维护此段） -->
> **【当前状态速查】**
> 活跃任务：无（项目初始化）
> 收件箱：无
> 备忘区：无
> 下一步：等待参谋长下发第一个任务
> 上次：（无）
<!-- @/TEMPLATE:PROJECT -->
`;

const SK_P2_DEV = `<!-- @TEMPLATE:PROJECT -->
## §B 任务窗口

<!--
  本段由参谋长维护。结构：进度表 + 通用资源 + 防御 + 备忘。
  开发者不改 §B（备忘区除外）。开发者做完任务 → 标 🟡 → 参谋长验收后标 ✅。
-->

### 定位

- **产品**：<!-- 填入：产品名称 + 一句话描述 -->
- **当前阶段**：项目初始化
- **取活规则**：取第一个「设计 ✅ + 开发 ⬜ + 阻塞列无未完成项」的行。

### 进度表（即时全景 · 唯一权威）

| 任务 | 类型 | 设计 | 开发 | 阻塞 | 备注 |
|---|---|---|---|---|---|
| ⬜ 待参谋长立项 | — | ⬜ | ⬜ | — | 等待初始化 |

### 通用资源（每次会话必读）

1. dev-context.md（本文件）
2. \`dev/\` — 源码
3. \`dev/README.md\` — 工程惯例（环境/版本号/构建/测试/RELEASE_NOTES 约定）

**参考（不改）**：
- \`plans/DEVNOTES.md\` — 设计决策
- \`doc/architecture/\` — 上游设计基线（仅当 STB 引用时通过 STB 间接读）
- \`dev/RELEASE_NOTES.txt\` — 项目变更看板（每次改动后追加一行）

### 活跃防御

（暂无——随项目推进由参谋长维护）

### 备忘（跨会话持久 / 只能显式关闭）

（暂无）

---

## §C 上次会话

（无）

---

## §D 下次

等待参谋长下发第一个任务。

---

## §收件箱（参谋长→开发者）

<!-- 哨兵格式：每条用 <!-- @MSG:N -->...<!-- @/MSG:N --> 包围 -->

> 暂无消息。参谋长将在项目初始化后通过此处下发任务。

<!-- @/TEMPLATE:PROJECT -->
`;

const SK_P_PAN = `<!-- @TEMPLATE:PROJECT -->
\`\`\`
GP: <!-- 项目名 — 总目标 -->

└─ ⬜ 待立项
\`\`\`
<!-- @/TEMPLATE:PROJECT -->
`;

const SK_P_TRIP = `<!-- @TEMPLATE:PROJECT -->
## 活跃三元组

| 文件 | 目的 | 状态 |
|---|---|---|
| （暂无——项目初始化时建立第一个三元组） | — | — |

<!-- @/TEMPLATE:PROJECT -->
`;

// ── 基础工具 ──
function rm(p) {
  if (!fs.existsSync(p)) return;
  const st = fs.lstatSync(p);
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(p)) rm(path.join(p, e));
    fs.rmdirSync(p);
  } else fs.unlinkSync(p);
}
function cp(src, dst) {
  const st = fs.lstatSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src)) cp(path.join(src, e), path.join(dst, e));
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}
function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { fs.writeFileSync(p, s, 'utf8'); }
function walk(dir, cb, rel) {
  rel = rel || '';
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? path.join(rel, e.name) : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), cb, r);
    else cb(path.join(dir, e.name), r);
  }
}
function pair(t, open, close, from) {
  const i = t.indexOf(open, from);
  if (i < 0) throw new Error('标记缺失: ' + open);
  const j = t.indexOf(close, i + open.length);
  if (j < 0) throw new Error('闭合标记缺失: ' + close);
  return [i, j + close.length];
}

// ── 环境识别 ──
function isMotherRepo() { return fs.existsSync(path.join(ROOT, 'dev', 'resources', 'template')); }

// ── 阶段1：build ──
function build() {
  if (!fs.existsSync(CSF)) { console.error('未找到 csf-lite/（请在项目根目录运行）'); process.exit(1); }
  rm(TMP);
  fs.mkdirSync(TMP, { recursive: true });
  cp(CSF, path.join(TMP, 'csf-lite'));
  const base = path.join(TMP, 'csf-lite');

  // 清运行时数据（保留空目录）
  for (const d of ['sessions', 'staging', 'plans', 'attachments']) {
    const p = path.join(base, d);
    if (fs.existsSync(p)) { for (const e of fs.readdirSync(p)) rm(path.join(p, e)); }
  }
  // triplets 仅留 _TEMPLATE + _index
  const tp = path.join(base, 'triplets');
  for (const e of fs.readdirSync(tp)) {
    if (e !== '_TEMPLATE.md' && e !== '_index.md') rm(path.join(tp, e));
  }

  // 账本槽重置
  const sc = path.join(base, 'session-counter.md');
  write(sc, read(sc).split('\n').map(l => l.startsWith('- 编号:') ? SLOT : l).join('\n'));

  // 项目名（用于 PROJECT 区行过滤与断言）
  const fm = read(path.join(base, 'cos-context.md')).split('\n');
  const projLine = fm.find(l => l.startsWith('项目:'));
  let projName = '';
  if (projLine) {
    const v = projLine.replace(/^项目:\s*/, '').split(/[—|]/)[0].trim();
    if (/^[\x00-\x7F]{2,}$/.test(v)) projName = v;
  }

  // cos-context：P1 行过滤（clarity / 项目名），P2 骨架替换
  {
    const p = path.join(base, 'cos-context.md');
    let t = read(p);
    const O = '<!-- @TEMPLATE:PROJECT -->', C = '<!-- @/TEMPLATE:PROJECT -->';
    const a = pair(t, O, C, 0);
    const kept = t.slice(a[0], a[1]).split('\n').filter(line => {
      const l = line.toLowerCase();
      if (l.includes('clarity')) return false;
      if (projName && l.includes(projName.toLowerCase())) return false;
      return true;
    }).join('\n');
    t = t.slice(0, a[0]) + kept + t.slice(a[1]);
    const b = pair(t, O, C, a[0] + kept.length);
    t = t.slice(0, b[0]) + CRLF(SK_P2_COS) + t.slice(b[1]);
    // frontmatter + §A 项目行 → 占位符
    t = t.split('\n').map(l => {
      if (l.startsWith('项目:')) return '项目: |\n  <!-- 填入：项目名称 + 一句话描述 -->';
      if (l.startsWith('**项目**：')) return '**项目**：<!-- 填入：项目名称 + 一句话描述 -->';
      return l;
    }).join('\n');
    write(p, t);
  }
  // dev-context：P1/P2 骨架替换 + frontmatter
  {
    const p = path.join(base, 'dev-context.md');
    let t = read(p);
    const O = '<!-- @TEMPLATE:PROJECT -->', C = '<!-- @/TEMPLATE:PROJECT -->';
    const a = pair(t, O, C, 0);
    t = t.slice(0, a[0]) + CRLF(SK_P1_DEV) + t.slice(a[1]);
    const b = pair(t, O, C, a[0] + CRLF(SK_P1_DEV).length);
    t = t.slice(0, b[0]) + CRLF(SK_P2_DEV) + t.slice(b[1]);
    t = t.split('\n').map(l => l.startsWith('项目:') ? '项目: <!-- 填入：项目名称 -->' : l).join('\n');
    write(p, t);
  }
  // 全景图 / triplets：PROJECT 骨架替换 + frontmatter
  for (const [name, sk, fmLine] of [['全景图.md', SK_P_PAN, '项目: <!-- 项目名 -->'], ['triplets/_index.md', SK_P_TRIP, null]]) {
    const p = path.join(base, name);
    let t = read(p);
    const O = '<!-- @TEMPLATE:PROJECT -->', C = '<!-- @/TEMPLATE:PROJECT -->';
    const a = pair(t, O, C, 0);
    t = t.slice(0, a[0]) + CRLF(sk) + t.slice(a[1]);
    if (fmLine) t = t.split('\n').map(l => l.startsWith('项目:') ? fmLine : l).join('\n');
    write(p, t);
  }

  // ── 断言 ──
  const ctxNames = ['cos-context.md', 'dev-context.md', '全景图.md', 'triplets/_index.md'];
  const ctxFiles = [];
  walk(base, (f, r) => { if (ctxNames.includes(path.basename(r))) ctxFiles.push(f); });
  let fail = 0;
  const pats = [
    ['devlog-\\d', '四 context 无 devlog-N 引用'],
    ['coslog-\\d', '四 context 无 coslog-N 引用'],
    ['@MSG:\\d', '四 context 无 @MSG:N 条目'],
    ['triplet-\\d', '四 context 无 triplet-N 引用']
  ];
  for (const [re, label] of pats) {
    for (const f of ctxFiles) {
      const hits = (read(f).match(new RegExp(re, 'g')) || []).length;
      if (hits > 0) { console.error('FAIL: ' + label + ' → ' + path.basename(f) + ' ×' + hits); fail++; }
    }
    console.log('PASS: ' + label);
  }
  // 项目全名残留
  if (projName) {
    let h = 0;
    for (const f of ctxFiles) h += (read(f).match(new RegExp(projName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
    if (h > 0) { console.error('FAIL: 项目全名残留 ×' + h); fail++; }
    else console.log('PASS: 项目全名（' + projName + '）零残留');
  }
  // clarity 路径形（例外：knowledge/ 案例、Staging-处理协议、RELEASE_NOTES 自述）
  let ch = 0;
  walk(base, (f, r) => {
    if (!r.endsWith('.md')) return;
    if (r.includes(path.join('knowledge', '')) || path.basename(r) === 'Staging-处理协议.md' || path.basename(r) === 'RELEASE_NOTES.md') return;
    ch += (read(f).match(/clarity\/|clarity-dev|clarity-doc|csf-clarity/g) || []).length;
  });
  if (ch > 0) { console.error('FAIL: clarity 路径形残留 ×' + ch); fail++; }
  else console.log('PASS: clarity 路径形零残留（例外已声明）');
  // 哨兵配对
  for (const f of ctxFiles) {
    const t = read(f);
    const o = (t.match(/<!-- @TEMPLATE:(?:FIXED|PROJECT) -->/g) || []).length;
    const c = (t.match(/<!-- @\/TEMPLATE:(?:FIXED|PROJECT) -->/g) || []).length;
    if (o !== c) { console.error('FAIL: 哨兵不配对 → ' + path.basename(f) + ' open=' + o + ' close=' + c); fail++; }
  }
  console.log('PASS: 哨兵配对（四文件）');
  // 槽行
  const slotOk = read(sc).split('\n').some(l => l.startsWith('- 编号: 0'));
  if (!slotOk) { console.error('FAIL: 账本槽行'); fail++; } else console.log('PASS: 账本槽 0');

  console.log(fail === 0 ? '==== 断言全绿，临时构建目录：' + base : '==== 断言失败 ' + fail + ' 项');
  process.exit(fail === 0 ? 0 : 1);
}

// ── 阶段2a：diff（仅母仓）──
function diff(prevZip) {
  const pz = path.resolve(prevZip);
  if (!fs.existsSync(pz)) { console.error('上一版 ZIP 不存在: ' + pz); process.exit(1); }
  rm(PREV);
  fs.mkdirSync(PREV, { recursive: true });
  execSync('powershell -NoProfile -Command "Expand-Archive -LiteralPath \'' + pz + '\' -DestinationPath \'' + PREV + '\' -Force"', { stdio: 'inherit' });
  const oldBase = path.join(PREV, 'csf-lite');
  const newBase = path.join(TMP, 'csf-lite');
  if (!fs.existsSync(oldBase)) { console.error('ZIP 内无 csf-lite/'); process.exit(1); }
  const of = new Set(), nf = new Set();
  walk(oldBase, (f, r) => of.add(r));
  walk(newBase, (f, r) => nf.add(r));
  const out = [];
  out.push('=== 文件级 diff（<= 上一版有当前无；=> 新增） ===');
  for (const r of [...of].filter(x => !nf.has(x)).sort()) out.push('<= ' + r);
  for (const r of [...nf].filter(x => !of.has(x)).sort()) out.push('=> ' + r);
  out.push('');
  out.push('=== 变化文件（行数级） ===');
  for (const r of [...nf].filter(x => of.has(x)).sort()) {
    try {
      const a = read(path.join(oldBase, r)).split('\n');
      const b = read(path.join(newBase, r)).split('\n');
      if (a.join('\n') !== b.join('\n')) {
        const add = b.length - a.length;
        out.push(r + '  +' + Math.max(add, 0) + '/-' + Math.max(-add, 0));
      }
    } catch (_) { /* 二进制跳过 */ }
  }
  const report = path.join(TMP, '_diff.txt');
  write(report, out.join('\n'));
  console.log('diff 报告：' + report);
  console.log('删 ' + [...of].filter(x => !nf.has(x)).length + ' / 增 ' + [...nf].filter(x => !of.has(x)).length + ' / 变化 ' + out.length);
}

// ── 阶段3：zip + 验收 ──
function zip(version) {
  const src = TMP;
  const outDir = isMotherRepo() ? path.join(ROOT, 'dev', 'resources', 'template') : path.join(ROOT, '_outputs');
  fs.mkdirSync(outDir, { recursive: true });
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ts = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  const zipName = 'CSF-v' + version + '-' + ts + '.zip';
  const zipPath = path.join(outDir, zipName);
  execSync('powershell -NoProfile -Command "Compress-Archive -Path \'' + path.join(src, '*') + '\' -DestinationPath \'' + zipPath + '\' -Force"', { stdio: 'inherit' });
  // 包内验收（落盘 ps1 再执行，避开命令行引号嵌套）
  const ps1 = path.join(TMP, '_verify.ps1');
  write(ps1, [
    'param($zipPath)',
    'Add-Type -AssemblyName System.IO.Compression.FileSystem',
    '$z=[IO.Compression.ZipFile]::OpenRead($zipPath)',
    '$c=($z.Entries | Where-Object { $_.FullName -like \'*clarity*\' }).Count',
    '$t=($z.Entries | Where-Object { $_.FullName -like \'*context-templates*\' }).Count',
    '$s=[bool]($z.Entries | Where-Object { $_.FullName -like \'*session-counter*\' })',
    '$r=[bool]($z.Entries | Where-Object { $_.FullName -like \'*RELEASE_NOTES*\' })',
    'Write-Output ("clarity=" + $c + " contextTemplates=" + $t + " sessionCounter=" + $s + " releaseNotes=" + $r)',
    '$z.Dispose()'
  ].join('\n'));
  const res = execSync('powershell -NoProfile -ExecutionPolicy Bypass -File "' + ps1 + '" -zipPath "' + zipPath + '"').toString();
  console.log('打包完成: ' + zipPath);
  console.log('包内验收: ' + res.trim());
}

const cmd = process.argv[2];
if (cmd === 'build') build();
else if (cmd === 'diff') diff(process.argv[3]);
else if (cmd === 'zip') zip(process.argv[3]);
else { console.log('用法: node csf-pack.js build | diff <prevZip> | zip <version>'); process.exit(1); }
