---
type: skill
name: zhihu-batch-search
title: 知乎批量搜索与内容获取
description: 登录态知乎批量搜索话题并获取全文：CDP 自动提取 Cookie + search_v3 API，一次登录长期复用，多话题批量搜索输出结构化结果
triggers: [知乎, zhihu, 知乎搜索, 搜知乎, 知乎话题, 知乎文章, 知乎回答, 知乎内容获取, 知乎批量, 知乎全文]
version: "1.0"
last_updated: 2026-08-30
---
# 知乎批量搜索与内容获取

## 概述

知乎对未登录机器请求封锁极严（直接抓取 403），但**登录后可通过官方 API 批量搜索话题并直接拿到全文**。本 skill 封装这套已验证流程（2026-08-30 实测打通）：

- **搜索即得全文**：`search_v3` API 返回结果中自带完整正文（HTML）、点赞数、评论数、时间——无需再逐条打开详情页（详情 API 有签名校验，已绕开）
- **Cookie 零重登录成本**：从已登录的浏览器直接通过 CDP 调试端口提取 Cookie（含 httpOnly 的 z_c0），不用装扩展、不用手动复制
- **多话题批量**：一条命令搜多个话题，输出结构化 JSON，带请求间隔防风控

## 核心原理

```
浏览器已登录知乎（z_c0 存在浏览器里）
   │
   ▼
CDP 端口 9222 ──Network.getAllCookies──▶ Cookie 文件（cookie.txt）
   │
   ▼
Node 脚本带 Cookie 调 https://www.zhihu.com/api/v4/search_v3
   │
   ▼
结构化 JSON：标题 / 摘要 / 完整正文 / 赞数 / 评论数 / 正确网页链接
```

关键 header：`x-api-version: 3.0.91`、`x-requested-with: fetch`、浏览器 UA、`Referer: https://www.zhihu.com/search?type=content&q=<关键词>`。

## 前置条件

| 项 | 要求 |
|---|---|
| Node | ≥ 18（原生 fetch + WebSocket，实测 v24） |
| 浏览器 | PPM Chromium 已打开知乎且**已登录**（登录由用户完成，AI 不碰登录操作） |
| CDP 端口 | 本机 9222（PPM Chromium 默认开放） |

脚本位置：`csf-lite/knowledge/skills/zhihu-batch-search/scripts/`，下文命令均从该目录执行。

## 脚本一览

| 脚本 | 用途 | 典型场景 |
|------|------|----------|
| `get_cookies.mjs` | CDP 提取知乎 Cookie → `cookie.txt` | 登录后第一步；Cookie 失效时重跑（十几秒） |
| `zhihu_batch_search.mjs` | **批量搜索（核心）** | 多话题 → 结构化 JSON；断点续传、失败分级、上限配置 |
| `test_api.mjs` | API 可用性探测 | 排查：搜索/详情/推荐流接口状态 |

## 主流程（推荐执行顺序）

### 1. 确认登录 + 提取 Cookie

用户已在浏览器登录知乎后，直接提取（无需用户装任何扩展）：

```bash
node get_cookies.mjs
```

成功标志：控制台输出「共取到 cookie N 条，其中知乎 M 条」，且 `cookie.txt` 已生成。验证登录态有效可看提取到的 cookie 里是否有 `z_c0`。

### 2. 批量搜索

```bash
node zhihu_batch_search.mjs "话题1" "话题2" "话题3" --limit 5 --out result.json
```

| 参数 | 说明 |
|---|---|
| 位置参数 | 一个或多个搜索话题（中文直接写） |
| `--limit N` | 每话题返回条数（默认 3，实际可能略少——知乎会去重/过滤） |
| `--out x.json` | 输出文件名（默认 `batch_result.json`） |

输出结构（每条结果）：

```json
{
  "type": "article | answer | question",
  "title": "标题",
  "excerpt": "摘要（前200字）",
  "url": "正确的网页链接（可直接浏览器打开）",
  "voteup_count": 128,
  "comment_count": 18,
  "favorites_count": 300,
  "created_time": 1784298853,
  "content_text": "完整正文纯文本（前600字）"
}
```

### 3. 打开/使用结果

搜索结果的 `url` 字段已是正确网页格式，直接 `browser_navigate` 打开给用户看。

## 配置与上限

- **请求间隔**：默认 1.5 秒/话题（防风控，勿调小）
- **断点续传**：每搜完一个话题立即写盘，中断后重跑同一命令、改 `--out` 为同一文件，已完成话题会跳过
- **失败分级**：连续 ≥5 个话题失败视为环境问题（Cookie 过期/网络），自动中断提示重新提取 Cookie；散发失败仅记录
- **正文截断**：`content_text` 默认取前 600 字。需要全文时改脚本中 `slice(0, 600)` 参数，或从结果 JSON 里拿完整 HTML 字段另行解析

## API URL → 网页 URL 转换规则（实测，勿改）

API 返回的 `object.url` 是 api.zhihu.com 内部地址，**不能直接打开**，须按类型转换：

| type | API URL | 网页 URL |
|------|---------|----------|
| article | `api.zhihu.com/articles/583250471` | `zhuanlan.zhihu.com/p/583250471` ⚠️ 注意：`www.zhihu.com/articles/{id}` 会 404 |
| answer | `api.zhihu.com/answers/{aid}` | `www.zhihu.com/question/{question.id}/answer/{aid}`（question.id 在 `object.question` 里） |
| question | `api.zhihu.com/questions/{id}` | `www.zhihu.com/question/{id}` |

脚本已内置此逻辑（`apiUrlToWeb` 函数）。

## 已知问题与对策

| # | 现象 | 对策 |
|---|------|------|
| 1 | 问题/答案**详情 API** 403（`code 10003` 签名校验） | 不需要它——搜索结果的 `object.content` 直接带全文 |
| 2 | **Cookie 失效**（搜索开始返回 401/403，或结果为空） | 重跑 `node get_cookies.mjs`（浏览器登录态若也没了，需用户重新登录） |
| 3 | **实际返回条数 < limit** | 知乎去重/过滤所致，属正常；翻页用 `offset` 参数 |
| 4 | **风控/限流** | 保持 ≥1.5s 间隔；短时间大量搜索会触发账号风控，宁慢勿贪 |
| 5 | 未登录时直接抓取网页 403 | 这就是本 skill 存在的意义：先登录再走 API |

## 故障排查

```
搜索结果为空或报错？
  → 跑 node test_api.mjs → 看哪类接口失效
  → 全部失效：Cookie 过期 → get_cookies.mjs 重提
  → 仅搜索失效：可能触发限流 → 停 10 分钟再试

get_cookies.mjs 找不到知乎页面？
  → 浏览器里打开任意 zhihu.com 页面（需登录态页面）

浏览器已退出 / CDP 端口不通？
  → 让用户重新打开浏览器并登录知乎
```

## 参考来源

- 本 skill 的核心方案（CDP 提 Cookie + search_v3 API）为 2026-08-30 会话实测原创
- 断点续传、失败分级、上限配置等设计模式参考自 [zhihu-fetch-skill](https://github.com/handsomestWei/zhihu-fetch-skill)（其专注收藏夹/专栏抓取与 Obsidian 入库，与本 skill 的关键词搜索互补；若需要收藏夹归档能力可安装它）
