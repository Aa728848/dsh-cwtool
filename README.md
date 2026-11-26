# dsh-cwtools

[English](#english) | [中文](#中文)

<a id="english"></a>
## English

`dsh-cwtools` is a standalone DeepSeek Harness bundle that exposes CWTools as native DSH tools and adds a CWTools section to DSH Settings. It does not use MCP or require an MCP transport. A running VS Code extension is optional: a healthy active host is reused by default, otherwise a standalone backend is started.

The right-sidebar **CWTools Workbench** is a native DSH Session Tab with guide entry, resizing, fullscreen and per-Session persistence. It follows the selected Agent Session and reads its live IDE context and diagnostics through a Session-confined Remote service. Its read-only `execute` facade uses the same runtime pool and configuration gates as Agent tools; it never accepts a browser-supplied workspace path. Native Tech Tree, Event Chain, Static Galaxy, Solar orbital and Entity structure views parse real workspace documents through `cwtools-shared/editors`; document reads enforce extensions, byte limits and realpath containment. Localisation queries and edits use the shared index and mandatory `write_localisation` tool through a separate allowlisted write facade. With `gui_draft` explicitly enabled, the Workbench and Agent share AST-identified GUI position/size candidates with validate/commit/discard, overlay diagnostics, drift checks and rollback. The Host resolves workspace and detected-vanilla GFX sprites and decodes DDS/TGA to bounded PNG captures. Event Chain uses the live semantic catalog and bounded cross-file graph construction. One DSH-materialized client module provides Entity/Particle WebGL scenes plus full Ship catalog/stats/icons and resolved mesh/attachment/texture scenes; Ship resources load lazily by model node through a content-hash-invalidated Host cache. `ship_design_draft` and `static_galaxy_draft` independently authorize section/component, numeric or dragged coordinate, and explicit-hyperlane candidates. The design preview is isolated from live data and has all write controls disabled.

See [the visual-editor and particle guide](docs/visual-editors-and-particles.md) for editor entry points, safe three-dimensional workflows, vanilla particle reverse lookup, and the boundary between source evidence and approximate runtime previews.

### Features

- Every read-only tool the installed `cwtools-shared` publishes, grouped for project knowledge, rules and scopes, navigation, diagnostics, localisation, semantic analysis, Shader queries, and IDE bridge calls.
- `query_targeting_weight` for Stellaris combat targeting calculations.
- Diagnostics honour the filter list configured for the workspace (`.vscode/settings.json`), and suppressed items stay counted.
- Vanilla-game errors are off by default; the settings page also forwards ignored error codes, ignored file names, and the localisation diagnostic filter to the backend.
- Every write stays disabled until its own name is stored in the write allowlist; `write_localisation` keeps workspace path checks and UTF-8 BOM handling.
- Active-first backend reuse over a dedicated `/cwtools/*` HTTP API, with no second process when a healthy matching host exists.
- A bounded runtime per mod workspace with single-flight startup, LRU/idle disposal, cooperative cancellation, and backend protocol/capability checks.
- A bilingual CWTools settings section split into Project, Backend, Read tools, and Write and output tabs, covering backend paths, runtime bounds, read groups, individual read tools, the write allowlist, and output limits.

Nothing is filtered by a compiled tool list: a tool is hidden only when the shared catalog does not publish it, the configuration withdraws its group or grant, the workspace is CWT-only, or the backend cannot answer it. CWT-only workspaces expose only their supported document/navigation/diagnostic subset, and targeting weights require a Stellaris full-mod workspace.

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

右侧栏 **CWTools 工作台**是 DSH 原生 Session Tab，支持 guide 入口、宽度调整、全屏和每会话布局持久化。它跟随当前 Agent Session，通过 Session 限定的 Remote 服务读取真实 IDE 上下文与诊断。只读 `execute` 外观与 Agent 工具共用运行时池和配置门禁；浏览器不能传入任意工作区路径。原生科技树、事件链、静态银河、恒星系轨道和实体结构视图通过 `cwtools-shared/editors` 解析真实工作区文档，读取实施扩展名、字节上限和 realpath 包含检查。本地化查询与编辑使用共享索引和强制的 `write_localisation` 工具，经独立白名单写接口执行。显式启用 `gui_draft` 后，工作台与 Agent 共享按 AST 元素定位的 GUI position/size 候选，支持 validate/commit/discard、覆盖层诊断、漂移检查与回滚。Host 解析工作区及自动识别 vanilla 的 GFX sprite，并把 DDS/TGA 解码为有界 PNG 截图纹理。事件链使用实时语义目录构建有界跨文件关系图。单一 DSH 可物化 client 模块提供 Entity/Particle WebGL 场景，以及完整舰船 catalog/stats/icons 和已解析 mesh/附件/纹理场景；舰船资源按模型节点懒加载，Host 缓存按文档内容哈希失效。`ship_design_draft` 与 `static_galaxy_draft` 分别独立授权 section/component、数字或拖拽坐标和显式航道候选。设计预览与实时数据完全隔离，所有预览写操作均禁用。

三维编辑器入口、安全操作、原版粒子反查链以及源码证据与运行时近似的边界见[可视化编辑器与粒子指南](docs/visual-editors-and-particles.md)。

### 功能

- 覆盖已安装 `cwtools-shared` 发布的全部只读工具，按项目知识、规则与作用域、导航、诊断、本地化、语义分析、Shader 查询和 IDE 桥接分组。
- 使用 `query_targeting_weight` 计算 Stellaris 战斗索敌权重。
- 诊断会按工作区配置的过滤列表（`.vscode/settings.json`）过滤，被过滤掉的条目仍计入统计。
- 原版游戏错误默认关闭；设置页还会把忽略的错误码、忽略的文件名和本地化诊断过滤模式透传给后端。
- 所有写工具默认关闭，只有在写入白名单中显式保存其名称后才生效；`write_localisation` 保留工作区路径约束和 UTF-8 BOM 处理。
- 通过独立 `/cwtools/*` HTTP API 优先复用活跃后端，工作区匹配且健康时不创建第二个进程。
- 每个 Mod 工作区使用有界运行时，支持 single-flight 启动、LRU/idle 释放、协作取消和后端协议/能力握手。
- 中英双语 CWTools 设置分区，分为项目 / 后端 / 只读工具 / 写入与输出四个页签，覆盖后端路径、运行时上限、只读组、单个只读工具、写入白名单和结果上限。

不再有任何编译期工具清单：只有共享目录未发布、配置关闭了能力组或单工具、工作区是 CWT-only，或后端无法应答时，工具才会被隐藏。CWT-only 工作区只提供支持的文档、导航和诊断子集，索敌权重只用于 Stellaris full-mod 工作区。

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