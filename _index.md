# csf-skills — Skill 共享源索引

> PPM Desk 配置源（`.ppm/skill-sources.json`）。AI 搜索 skill 时先读本文件，按触发词与描述匹配，再取对应文件安装到 `csf-lite/knowledge/skills/`。

## Skill 列表

| 触发词 | 文件 | 一句话 | 版本 |
|---|---|---|---|
| 产品讨论, 话题分析, 概念分析, 设计讨论, 有新想法, 讨论方法, 跳出回看, 辨新, 话题思维, 规划重构 | 话题思维四步法.md | 产品讨论四步：辨新→判性质→定位→跳出→回看，防止讨论滑向文本排列组合游戏 | 1.3 |
| 案例入库, 素材判定, 案例价值, 入库判定, 证据价值, 档案鉴定, 什么值得入库 | 案例价值判定-档案学三价值.md | 档案学三价值框架判定素材/案例入库：信息价值+证据价值+历史价值+优先排序 | 1.0 |
| 打包CSF, 生成模版, 导出CSF, 更新模板, csf-packaging, 重新打包 | csf-打包.md（配套 csf-pack.js） | 将当前 CSF 框架打包为干净的可分发 ZIP | 2.1 |
| 知乎搜索, 搜知乎, 知乎话题, 知乎内容, 知乎批量, 知乎全文, zhihu | zhihu-batch-search/SKILL.md | 登录态知乎批量搜索话题并获取全文（CDP 提 Cookie + search_v3 API） | 1.0 |

## 安装

AI 搜索本源命中后：`web_fetch` 或 GitHub API 取 raw 文件 → 写入本地 `csf-lite/knowledge/skills/`（目录型 skill 保持目录结构）→ 更新本地 `csf-lite/knowledge/_index.md` 技能类触发词表。

## 贡献

本地新沉淀的 skill 经 Owner 确认后可提交到本仓（保持 CSF frontmatter 格式：type/name/title/description/triggers/version/last_updated），并同步更新本索引。
