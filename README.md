# dsh-cwtools

[English](#english) | [中文](#中文)

<a id="english"></a>
## English

`dsh-cwtools` is a standalone DeepSeek Harness bundle that exposes CWTools as native DSH tools and adds a CWTools section to DSH Settings. It does not use MCP, require an MCP transport, or depend on a running VS Code extension.

### Features

- Up to 37 read-only tools for project knowledge, rules and scopes, navigation, diagnostics, localisation, semantic analysis, and Shader queries.
- `query_targeting_weight` for Stellaris combat targeting calculations.
- Optional `write_localisation`, disabled by default, with workspace path checks and UTF-8 BOM handling.
- A bounded runtime per mod workspace with single-flight startup, LRU/idle disposal, cooperative cancellation, and backend protocol/capability checks.
- A bilingual CWTools settings section for backend paths, read groups, individual read tools, the write allowlist, and output limits.

CWT-only workspaces expose only their supported document/navigation/diagnostic subset. Targeting weights require a Stellaris full-mod workspace. The five VS Code-dependent domain writes, IDE tools, and visual editors are outside this release.

### Requirements

- DSH `>=0.2.2-rc.1 <0.3.0`.
- A matching external CWTools server built with capability protocol 1. Older servers are rejected with `backend_incompatible` instead of silently producing partial results.
- `cwtools-shared` 0.3.0 and `cwtools-node` 0.1.0. Development installations can link those checkouts; published installations should install them before this bundle.

The bundle does not ship a backend. Empty `backend.serverPath` auto-discovers an installed CWTools extension or development build. Game, rules, and cache paths remain configurable.

### Install

Build the upstream packages and this package, then install through DSH:

```sh
dsh plugin --profile <profile> add /path/to/cwtools-shared /path/to/cwtools-node /path/to/dsh-cwtool
dsh --profile <profile> --dump-config
```

The dump must contain `# == dsh-cwtools` and `id: cwtools`. Installation and activation are separate checks; do not infer a running backend from a dependency row alone.

### Configure and use

Open **Settings → CWTools**:

1. Set the external backend, game, rules, and cache paths, or leave them empty for auto-discovery.
2. Enable the read groups and individual tools you need. A group switch preserves the individual choices while that group is disabled.
3. Enable `write_localisation` only when you intend to allow localisation writes. DSH tool policy still applies to every call.
4. Save once. The form writes all changes atomically through `configForms`; revision conflicts keep the draft, and reset removes user overrides.

Tools resolve the calling Agent Session's current working directory. Unsupported or ambiguous projects do not start a language server. Loading and mod-only results carry readiness/cache provenance and must not be treated as complete vanilla answers.

See `ARCHITECTURE.md` for data flow and `CONTRIBUTING.md` for verification.

<a id="中文"></a>
## 中文

`dsh-cwtools` 是独立的 DeepSeek Harness 组合包，把 CWTools 作为 DSH 原生工具接入，并在 DSH 设置中增加 CWTools 分区。它不使用 MCP、不要求 MCP transport，也不依赖正在运行的 VS Code 扩展。

### 功能

- 最多 37 个只读工具，覆盖项目知识、规则与作用域、导航、诊断、本地化、语义分析和 Shader 查询。
- 使用 `query_targeting_weight` 计算 Stellaris 战斗索敌权重。
- 可选 `write_localisation`，默认关闭，带工作区路径约束和 UTF-8 BOM 处理。
- 每个 Mod 工作区使用有界运行时，支持 single-flight 启动、LRU/idle 释放、协作取消和后端协议/能力握手。
- 中英双语 CWTools 设置分区，配置后端路径、只读组、单个只读工具、写入白名单和结果上限。

CWT-only 工作区只提供支持的文档、导航和诊断子集。索敌权重只用于 Stellaris full-mod 工作区。另外五个依赖 VS Code 的领域写入、IDE 工具和可视化编辑器不在首版范围内。

### 环境要求

- DSH `>=0.2.2-rc.1 <0.3.0`。
- 带能力协议 1 的匹配外置 CWTools 服务端。旧服务端会返回 `backend_incompatible`，不会静默产生不完整的语义结果。
- `cwtools-shared` 0.3.0 与 `cwtools-node` 0.1.0。开发安装可链接这些 checkout；发布安装应先安装这两个包。

组合包不自带后端。`backend.serverPath` 留空时自动发现已安装的 CWTools 扩展或开发构建。游戏、规则和缓存路径均可配置。

### 安装

先构建上游包与本包，再通过 DSH 安装：

```sh
dsh plugin --profile <profile> add /path/to/cwtools-shared /path/to/cwtools-node /path/to/dsh-cwtool
dsh --profile <profile> --dump-config
```

输出必须包含 `# == dsh-cwtools` 和 `id: cwtools`。安装与激活是两项不同检查，不能仅凭依赖行就认定后端已经运行。

### 配置与使用

打开 **设置 → CWTools**：

1. 设置外置后端、游戏、规则和缓存路径，或留空自动发现。
2. 启用需要的只读组和单个工具。组关闭会保留组内单工具选择，重新开启后恢复。
3. 只在确实需要本地化写入时开启 `write_localisation`，每次调用仍经过 DSH 工具策略。
4. 一次保存全部修改。`configForms` 原子写回；revision 冲突保留草稿，恢复默认只移除用户覆盖。

工具使用调用 Agent Session 的当前工作目录。不支持或歧义项目不会启动语言服务。加载中和仅有 mod 数据的结果带 readiness/cache provenance，不能当作完整 vanilla 结论。

数据流见 `ARCHITECTURE.md`，验证方式见 `CONTRIBUTING.md`。
