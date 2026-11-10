# dsh-cwtools

[English](#english) | [中文](#中文)

<a id="english"></a>
## English

`dsh-cwtools` is a standalone DeepSeek Harness bundle that exposes CWTools as native DSH tools and adds a CWTools section to DSH Settings. It does not use MCP or require an MCP transport. A running VS Code extension is optional: a healthy active host is reused by default, otherwise a standalone backend is started.

### Features

- Up to 37 read-only tools for project knowledge, rules and scopes, navigation, diagnostics, localisation, semantic analysis, and Shader queries.
- `query_targeting_weight` for Stellaris combat targeting calculations.
- Diagnostics honour the filter list configured for the workspace (`.vscode/settings.json`), and suppressed items stay counted.
- Vanilla-game errors are off by default; the settings page also forwards ignored error codes, ignored file names, and the localisation diagnostic filter to the backend.
- Optional `write_localisation`, disabled by default, with workspace path checks and UTF-8 BOM handling.
- Active-first backend reuse over a dedicated `/cwtools/*` HTTP API, with no second process when a healthy matching host exists.
- A bounded runtime per mod workspace with single-flight startup, LRU/idle disposal, cooperative cancellation, and backend protocol/capability checks.
- A bilingual CWTools settings section split into Project, Backend, Read tools, and Write and output tabs, covering backend paths, runtime bounds, read groups, individual read tools, the write allowlist, and output limits.

CWT-only workspaces expose only their supported document/navigation/diagnostic subset. Targeting weights require a Stellaris full-mod workspace. The five VS Code-dependent domain writes, IDE tools, and visual editors are outside this release.

### Requirements

- DSH `>=0.2.2-rc.1 <0.3.0`.
- A matching external CWTools server built with capability protocol 1. Older servers are rejected with `backend_incompatible` instead of silently producing partial results.
- `cwtools-shared` 0.3.0 and `cwtools-node` 0.2.0. Development installations can link those checkouts; published installations should install them before this bundle.

The bundle does not ship a backend. Empty `backend.serverPath` auto-discovers a standalone CWTools installation or development build. Empty `backend.activeManifestPath` auto-discovers the active-host manifest. An empty `backend.gamePath` is discovered from the local Steam libraries; empty rules and cache paths try the installed extension first, then the workspace's rule checkout, then the server default.

### Install

Build the upstream packages and this package, then install through DSH:

```sh
dsh plugin --profile <profile> add /path/to/cwtools-shared /path/to/cwtools-node /path/to/dsh-cwtool
dsh --profile <profile> --dump-config
```

The dump must contain `# == dsh-cwtools` and `id: cwtools`. Installation and activation are separate checks; do not infer a running backend from a dependency row alone.

### Configure and use

Open **Settings → CWTools**:

1. Keep **Prefer active backend** enabled to reuse a healthy host for the exact workspace. Set **Active manifest path** only when automatic discovery is not suitable; disable the preference to force a standalone process.
2. Set the external backend, game, rules, and cache paths, or leave them empty for auto-discovery.
3. Enable the read groups and individual tools you need. A group switch preserves the individual choices while that group is disabled.
4. Enable `write_localisation` only when you intend to allow localisation writes. DSH tool policy still applies to every call.
5. Save once. The form writes all changes atomically through `configForms`; revision conflicts keep the draft, and reset removes user overrides.

Tools resolve the calling Agent Session's current working directory. Missing/malformed manifests, stale processes, workspace mismatches, inactive hosts, and connection failures or timeouts fall back to a standalone backend. An incompatible active protocol or capability handshake returns `backend_incompatible` and never starts a competing process. Existing runtime entries are not migrated between backends. Unsupported or ambiguous projects do not start a language server. Loading and mod-only results carry readiness/cache provenance and must not be treated as complete vanilla answers.

See `ARCHITECTURE.md` for data flow and `CONTRIBUTING.md` for verification.

<a id="中文"></a>
## 中文

`dsh-cwtools` 是独立的 DeepSeek Harness 组合包，把 CWTools 作为 DSH 原生工具接入，并在 DSH 设置中增加 CWTools 分区。它不使用 MCP，也不要求 MCP transport。正在运行的 VS Code 扩展只是可选优化：默认复用健康的活跃宿主，否则启动独立后端。

### 功能

- 最多 37 个只读工具，覆盖项目知识、规则与作用域、导航、诊断、本地化、语义分析和 Shader 查询。
- 使用 `query_targeting_weight` 计算 Stellaris 战斗索敌权重。
- 诊断会按工作区配置的过滤列表（`.vscode/settings.json`）过滤，被过滤掉的条目仍计入统计。
- 原版游戏错误默认关闭；设置页还会把忽略的错误码、忽略的文件名和本地化诊断过滤模式透传给后端。
- 可选 `write_localisation`，默认关闭，带工作区路径约束和 UTF-8 BOM 处理。
- 通过独立 `/cwtools/*` HTTP API 优先复用活跃后端，工作区匹配且健康时不创建第二个进程。
- 每个 Mod 工作区使用有界运行时，支持 single-flight 启动、LRU/idle 释放、协作取消和后端协议/能力握手。
- 中英双语 CWTools 设置分区，分为项目 / 后端 / 只读工具 / 写入与输出四个页签，覆盖后端路径、运行时上限、只读组、单个只读工具、写入白名单和结果上限。

CWT-only 工作区只提供支持的文档、导航和诊断子集。索敌权重只用于 Stellaris full-mod 工作区。另外五个依赖 VS Code 的领域写入、IDE 工具和可视化编辑器不在首版范围内。

### 环境要求

- DSH `>=0.2.2-rc.1 <0.3.0`。
- 带能力协议 1 的匹配外置 CWTools 服务端。旧服务端会返回 `backend_incompatible`，不会静默产生不完整的语义结果。
- `cwtools-shared` 0.3.0 与 `cwtools-node` 0.2.0。开发安装可链接这些 checkout；发布安装应先安装这两个包。

组合包不自带后端。`backend.serverPath` 留空时自动发现独立 CWTools 安装或开发构建；`backend.activeManifestPath` 留空时自动发现活跃宿主清单。`backend.gamePath` 留空时从本机 Steam 库自动发现安装目录；规则与缓存路径留空时先尝试已安装扩展，再尝试工作区的规则检出，最后用服务器默认值。

### 安装

先构建上游包与本包，再通过 DSH 安装：

```sh
dsh plugin --profile <profile> add /path/to/cwtools-shared /path/to/cwtools-node /path/to/dsh-cwtool
dsh --profile <profile> --dump-config
```

输出必须包含 `# == dsh-cwtools` 和 `id: cwtools`。安装与激活是两项不同检查，不能仅凭依赖行就认定后端已经运行。

### 配置与使用

打开 **设置 → CWTools**：

1. 保持“优先复用活跃后端”开启，可复用同一工作区的健康宿主；仅在自动发现不合适时填写“活跃宿主清单路径”。关闭该偏好可强制使用独立进程。
2. 设置外置后端、游戏、规则和缓存路径，或留空自动发现。
3. 启用需要的只读组和单个工具。组关闭会保留组内单工具选择，重新开启后恢复。
4. 只在确实需要本地化写入时开启 `write_localisation`，每次调用仍经过 DSH 工具策略。
5. 一次保存全部修改。`configForms` 原子写回；revision 冲突保留草稿，恢复默认只移除用户覆盖。

工具使用调用 Agent Session 的当前工作目录。清单缺失或畸形、进程失效、工作区不匹配、宿主尚未活跃、连接失败或超时才回退到独立后端。活跃宿主协议或能力握手不兼容时返回 `backend_incompatible`，绝不启动竞争实例。已创建的运行时不会在两种后端间热迁移。不支持或歧义项目不会启动语言服务。加载中和仅有 mod 数据的结果带 readiness/cache provenance，不能当作完整 vanilla 结论。

数据流见 `ARCHITECTURE.md`，验证方式见 `CONTRIBUTING.md`。