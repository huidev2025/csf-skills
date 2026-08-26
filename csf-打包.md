---
type: skill
name: csf-packaging
title: CSF 打包 — 生成可分发模版 ZIP
description: 将当前 CSF 框架打包为干净的可分发 ZIP（新项目初始化用）。三阶段：清洗 → diff + release notes（Owner 确认）→ 打包。配套脚本 csf-pack.js。
triggers:
  - 打包CSF
  - 生成模版
  - 导出CSF
  - 更新模板
  - csf-packaging
  - 重新打包
version: "2.1"
last_updated: 2026-08-25
---
# CSF 打包

> 将当前 `csf-lite/` 打包为干净的可分发 ZIP。
> **版本号唯一事实源** = `cos-context.md` frontmatter「版本」字段。

---

## 前置确认

打包前向 Owner 确认：当前 `csf-lite/` 中的框架改进是否稳定？

**打包语义（铁律）**：打包 = **当前状态**的快照。只清除运行时数据与项目数据，此外：
- **不从历史 ZIP 恢复任何文件**——当前状态没有的文件，打包里就没有；
- **不删除当前状态中的任何文件**——包括「看起来没用」的框架文件、知识条目，删除须 Owner 专门指令；
- knowledge/ 下的 skills / crafts / methods / redlines 是积累资产，除非 Owner 专门说明，一律原样保留。

---

## 环境识别（决定输出与 diff 基线）

| 判定 | 环境 | ZIP 输出 | diff 基线 |
|---|---|---|---|
| `dev/resources/template/` 存在 | 母仓（开发仓库） | `dev/resources/template/` | 上一版 ZIP（该目录最新） |
| 不存在 | 用户项目（PPM 发布后） | 项目根 `_outputs/`（自动创建） | **无**——不与项目既往包对比（Owner 裁定），release notes 标注「无基线」 |

> 用户项目里不存在母仓的 `afterPack` / `injectProject` 链路——打包产物只用于分享或另开新项目，由 Owner 自行取用。

---

## 哨兵约定（清洗的机制基础）

以下四文件内嵌 `@TEMPLATE` 注释哨兵，清洗时严格按哨兵执行：

| 标记 | 语义 | 清洗动作 |
|---|---|---|
| `@TEMPLATE:FIXED` … `@/TEMPLATE:FIXED` | 框架区 | **字节级原样保留** |
| `@TEMPLATE:PROJECT` … `@/TEMPLATE:PROJECT` | 项目区 | 按「清洗规则表」重置（脚本内置骨架） |
| 无标记段落 | frontmatter / §A 项目行等 | 字段级处理（脚本内置） |

---

## 阶段 1：清洗（脚本优先，手动兜底）

> **执行优先级：优先使用脚本；脚本不可用（无 node / PowerShell 异常）时走下方手动兜底。两条路径等价，产出物一致。**

在**项目根目录**（csf-lite/ 在其下）运行：

```powershell
node csf-lite/knowledge/skills/csf-pack.js build
```

脚本自动完成：建临时目录（`%TEMP%\csf-zip-build\csf-lite`）→ 复制 csf-lite → 清运行时数据（sessions/staging/plans/attachments 清空**保留空目录**；triplets 仅留 `_TEMPLATE.md` + `_index.md`）→ 账本槽重置 0 → 四 context 文件按哨兵清洗 → 断言 9 项。

**清洗规则表**（脚本内置；手动兜底与脚本修改骨架时均以此为准）：

| 文件 | 段/区 | 清洗规则 |
|---|---|---|
| `cos-context.md` | frontmatter / §A 项目行 | `项目:` → 占位符块；`**项目**：` 行 → 占位符 |
| | §A PROJECT 区（工作区布局） | 删除含 `clarity` 或当前项目名的行 |
| | §B..§收件箱（PROJECT 区） | 骨架替换：空白全景图 / 三元组指针「暂无」/ §C（无）/ §D 初始化方向 / 收件箱清空 |
| `dev-context.md` | frontmatter | `项目:` → 占位符 |
| | 快速状态栏（PROJECT 区） | 骨架替换（项目初始化四行） |
| | §A（FIXED 区） | 原样保留 |
| | §B..§收件箱（PROJECT 区） | 骨架替换：定位占位符 / 进度表待立项行 / 通用资源保留 / 防御与备忘「暂无」/ §C（无）/ §D 等待 / 收件箱清空 |
| `全景图.md` | frontmatter / PROJECT 区 | `项目:` → 占位符；PROJECT 区 → 空白树骨架 |
| `triplets/_index.md` | 活跃列表（PROJECT 区） | 骨架替换（暂无三元组行） |

**断言 9 项**（脚本自动执行，全绿才进阶段 2）：四 context 无 `devlog-N` / `coslog-N` / `@MSG:N` / `triplet-N` / 项目全名残留；clarity 路径形零残留（例外：knowledge/ 案例、Staging-处理协议.md、RELEASE_NOTES.md 自述）；哨兵配对；账本槽 0。

> **告知 Owner 检查点**：断言全过后，把临时构建目录路径告诉 Owner，供确认前自查。

### 手动兜底（无 node 时）

1. 建临时目录 `%TEMP%\csf-zip-build`，复制 `csf-lite/` 进去。
2. 清运行时数据：`sessions/` `staging/` `plans/` `attachments/` 清空内容保留空目录；`triplets/` 仅留 `_TEMPLATE.md` + `_index.md`。
3. 账本槽重置：用编辑器把 `session-counter.md` 最后一行槽值改为 `- 编号: 0 | 写入者: 模板分发 | 环境: — | 时间: —`。
4. 四 context 文件清洗（编辑器操作，勿用终端文本替换）：
   - 按哨兵标记定位每个 `@TEMPLATE:PROJECT` 区，整体替换为骨架文本——骨架全文见本目录 `csf-pack.js` 中的 `SK_*` 常量（`SK_P2_COS` / `SK_P1_DEV` / `SK_P2_DEV` / `SK_P_PAN` / `SK_P_TRIP`），逐字复制，不得自行改写；
   - cos-context §A PROJECT 区（工作区布局）例外：不整体替换，而是**逐行过滤**——删除含 `clarity` 或当前项目名的行，其余原样保留；
   - frontmatter / §A 项目行：`项目:` 行与 `**项目**：` 行 → 对应占位符（见清洗规则表）。
5. 逐项自查断言 9 项（grep 检查），全过才进阶段 2。

---

## 阶段 2：diff + release notes（Owner 确认闸门）

**母仓**：与上一版 ZIP 全库 diff（文件级 + 行数级报告）：

```powershell
node csf-lite/knowledge/skills/csf-pack.js diff "dev/resources/template/{上一版zip名}"
```

diff 报告落 `%TEMP%\csf-zip-build\_diff.txt`，AI 审阅后写 `csf-lite/RELEASE_NOTES.md` 新版本节。

**用户项目**：无基线 → 跳过 diff；release notes 新版本节标注「首版/无基线，变更说明基于本会话记录」。

### 手动兜底（无 node 时）

```powershell
Expand-Archive -LiteralPath "{上一版zip}" -DestinationPath "$env:TEMP\csf-zip-prev" -Force
# 文件级：Compare-Object（两目录递归 -File 清单）；内容级：逐共同文件 Compare-Object 行 diff
```

**未经 Owner 确认，禁止进入阶段 3。** 汇报：diff 摘要 + release notes 全文 + 临时构建目录路径，等确认或纠偏。

---

## 阶段 3：打包（Owner 确认后）

```powershell
node csf-lite/knowledge/skills/csf-pack.js zip {版本号}
```

- 输出位置按环境识别（见上表）；命名 `CSF-v{版本}-{时间戳}.zip`。
- 脚本自动做包内验收：clarity / context-templates 条目 = 0、session-counter 与 RELEASE_NOTES 在包内。
- `RELEASE_NOTES.md` 位于 `csf-lite/` 根，随包分发。
- 清理：打包完成后可删除 `%TEMP%\csf-zip-build`（下次 build 自动重建）。

### 手动兜底（无 node 时）

```powershell
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$zipName = "CSF-v{版本}-$ts.zip"
Compress-Archive -Path "$env:TEMP\csf-zip-build\*" -DestinationPath "{输出目录}\$zipName" -Force
```

包内验收（用 `[IO.Compression.ZipFile]::OpenRead` 打开 ZIP 核对）：clarity / context-templates 条目 = 0；`session-counter.md` 与 `RELEASE_NOTES.md` 在包内；cos-context 版本字段 = ZIP 名版本。

---

## 版本号规则

- 版本号取 `csf-lite/cos-context.md` frontmatter「版本」字段（当前 v3.2）。`dev-context.md` 版本字段同步一致。
- 升档时机：CSF 框架有结构性变化（新增 context 段、角色协议调整、哨兵体系变更等）→ Owner 决定升版本。
- 升档动作（单一动作，缺一不可）：① 改两个 context 文件 frontmatter 版本字段；② 按本 skill 打包；③ 阶段 2 生成的新版本节随包发布。
- `全景图.md` / `triplets/_index.md` 的版本字段 = 文件自身版本，独立于 CSF 主版本。

---

## 相关文件

- 配套脚本：`knowledge/skills/csf-pack.js`（本 skill 旁，随包分发；零依赖，需 node + PowerShell）
- 发布记录：`csf-lite/RELEASE_NOTES.md`（每版本随包发布）
- ZIP 消费者（仅母仓链路）：PPM 构建时 `afterPack` 只保留最新、`injectProject()` 解压注入新项目
