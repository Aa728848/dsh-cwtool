# Architecture

[English](#english) | [中文](#中文)

<a id="english"></a>
## English

### Host and upstream ownership

`dsh-cwtools` depends on `cwtools-shared` for generated schemas, tool metadata, dispatch, readiness/cache annotations and targeting weights, and on `cwtools-node` for project detection, Node host services, the standalone LSP process and the native active-host HTTP client. It has no MCP SDK dependency and never calls the extension's MCP `/rpc` endpoint.

`src/index.ts` owns one Cordis effect. It registers the CWTools system-prompt section, creates one `CwtoolsRuntimePool`, and disposes registrations and all runtimes together.

### Tool admission and execution

`src/contract/toolCatalog.ts` is the single first-release catalog for Host and Client. `src/config.ts` validates Host configuration. A read tool is effective only when the master switch, its group, its own grant and project capability all allow it. The write is independently controlled by `writeTools.write_localisation` and defaults to false.

Registration uses generated input schemas and a step-time `when` condition that performs read-only project detection without starting LSP. Execution resolves `ctx.workingDirectory.ensure(exec.agent, exec.signal)`; it never falls back to the plugin process cwd. Detection rejects unsupported or ambiguous projects before process creation. CWT-only and Stellaris-only filters apply again at execution.

The pool creates a `cwtools-node` host per resolved mod root, with single-flight reuse, a configured maximum, LRU and idle disposal. Calls marked `parallel` may overlap; other classes serialize per workspace. Disposal aborts active calls and releases watchers, timers, JSON-RPC connections and child processes.

### Backend lifecycle

Before creating a standalone process, the pool resolves a healthy active host for the exact mod root when `preferActiveBackend` is true (the default). An empty `activeManifestPath` uses standard manifest discovery. Missing/malformed manifests, stale pids, workspace mismatches, inactive hosts, and connection failures or timeouts are unavailable and permit standalone fallback. An unsupported native protocol or failed capability handshake returns `backend_incompatible` and never starts a competing process; cancellation remains cancellation.

An available `NativeBridgeLspHost` is injected into the same Node host services, so filesystem, indexing, rules, diagnostics, readiness, write policy and revalidation stay shared while no child process is created. Native traffic uses only bearer-authenticated `/cwtools/healthz` and `/cwtools/rpc`, not MCP methods or the MCP `/rpc` endpoint. Existing runtime entries do not hot-migrate; disabling `preferActiveBackend` skips discovery.

A standalone backend starts on the first LSP-dependent call with `startupTimeoutMs`. Immediately after `initialize`, the Node host invokes `cwtools.ai.getHostCapabilities` before `initialized` or `workspace/didChangeConfiguration`. It validates protocol version, assembly-independent release-manifest version and the 29 commands required by the shared dispatcher. An incompatible standalone backend is disposed and returns `backend_incompatible`.

`requestTimeoutMs` bounds subsequent requests. AbortSignal is linked to a vscode-jsonrpc `CancellationTokenSource`, so abort/deadline sends a real `$/cancelRequest`. Startup owns partial process cleanup even without an explicit caller dispose.

Null diagnostics while the game model is loading are represented as `pending`, not as an error. Load-dependent results gain readiness metadata, and vanilla-dependent results gain cache provenance.

### Canonical results

Successful calls return a validated, lossless-JSON envelope: `ok`, `status`, `source`, optional `data`, warnings, next steps, readiness and vanilla cache metadata. Undefined object fields are removed, non-finite numbers/non-plain objects are rejected, and error results become `CwtoolsToolError` with a stable code and actionable message. Native rendering alone truncates text with an explicit marker; canonical values are not truncated.

### Settings Client

The Client registers `settings.section` and its icon through `slots` while `configForms.whileServed(['cwtools'])` is active. `FlatSectionScope` expands the nested Host value/base/user snapshots into dotted field paths, then translates save operations back to nested `SettingsPathOpView` paths. One save is one revision-fenced `mutate` call. Group switches do not rewrite individual grants. Refusals preserve drafts and expose Host-accepted values; revision conflicts are distinguished from other failures.

The runtime Client export surface contains only `apply` and `inject`. Components, controller and pure helpers are tested through direct internal imports. Browser code uses typed locales, shared primitives, DSW tokens and CSS Modules without importing Host code or Node builtins.

<a id="中文"></a>
## 中文

### Host 与上游职责

`dsh-cwtools` 依赖 `cwtools-shared` 提供生成 schema、工具元数据、分派、readiness/cache 标注和索敌权重，依赖 `cwtools-node` 提供项目识别、Node 宿主服务、独立 LSP 进程和原生活跃宿主 HTTP 客户端。它没有 MCP SDK 依赖，也绝不调用扩展的 MCP `/rpc` 端点。

`src/index.ts` 拥有一个 Cordis effect，注册 CWTools 系统提示词区段，创建一个 `CwtoolsRuntimePool`，并统一释放注册项和所有运行时。

### 工具准入与执行

`src/contract/toolCatalog.ts` 是 Host 与 Client 共用的首版目录，`src/config.ts` 校验 Host 配置。只读工具只有在总开关、能力组、单工具和项目能力同时允许时才生效。`writeTools.write_localisation` 独立控制，默认关闭。

注册使用生成的 input schema，步骤级 `when` 只做只读项目检测，不启动 LSP。执行通过 `ctx.workingDirectory.ensure(exec.agent, exec.signal)` 取得目录，绝不回退到插件进程 cwd。不支持或歧义项目在创建进程前被拒绝，CWT-only 和 Stellaris-only 过滤在执行时再次生效。

运行时池按解析后的 mod root 创建 `cwtools-node` 宿主，支持 single-flight 复用、配置上限、LRU 和 idle 释放。`parallel` 调用可重叠，其余类别按工作区串行。释放会中止活动调用，并清理 watcher、timer、JSON-RPC 连接和子进程。

### 后端生命周期

`preferActiveBackend` 默认开启。创建独立进程前，运行时池先为精确的 mod root 发现健康活跃宿主；`activeManifestPath` 为空时使用标准清单发现。清单缺失或畸形、pid 失效、工作区不匹配、宿主未活跃、连接失败或超时属于不可用，允许独立回退。原生协议不支持或能力握手失败返回 `backend_incompatible`，绝不启动竞争实例；取消始终按取消传播。

可用宿主以 `NativeBridgeLspHost` 注入同一套 Node Host Services，因此文件系统、索引、规则、诊断、readiness、写策略和复验仍然共用，但不创建子进程。原生流量只使用 bearer 认证的 `/cwtools/healthz` 与 `/cwtools/rpc`，不使用 MCP 方法或 MCP `/rpc`。已创建的运行时不热迁移；关闭 `preferActiveBackend` 会完全跳过发现。

独立后端在首个依赖 LSP 的调用中以 `startupTimeoutMs` 启动。Node 宿主在 `initialize` 后立即调用 `cwtools.ai.getHostCapabilities`，早于 `initialized` 和 `workspace/didChangeConfiguration`，校验协议版本、release 清单版本和共享分派需要的 29 条命令。不兼容独立后端会被释放并返回 `backend_incompatible`。

后续请求使用 `requestTimeoutMs`。AbortSignal 连接 vscode-jsonrpc 的 `CancellationTokenSource`，所以 abort/deadline 会发送真实的 `$/cancelRequest`。即使调用方没有显式 dispose，启动过程也负责清理部分创建的子进程。

游戏模型加载时返回的空诊断表示 `pending`，不是错误。依赖加载的结果附 readiness，依赖 vanilla 的结果附缓存来源。

### 规范结果

成功调用返回经过校验的无损 JSON envelope：`ok`、`status`、`source`，以及可选 `data`、warnings、nextSteps、readiness 和 vanillaCache。对象中的 undefined 字段被移除，非有限数值和非普通对象被拒绝，失败结果转成带稳定错误码和可操作信息的 `CwtoolsToolError`。只有 Native 渲染会带明确标记地截断文本，规范值不被截断。

### 设置 Client

Client 在 `configForms.whileServed(['cwtools'])` 有效时通过 `slots` 注册 `settings.section` 和图标。`FlatSectionScope` 把嵌套的 Host value/base/user 快照拉平成点号路径，保存时再还原为嵌套 `SettingsPathOpView` 路径。一次保存就是一次带 revision 围栏的 `mutate`。组开关不改写单工具授权。拒绝保留草稿并展示 Host 已接受值，revision 冲突与其他失败分开显示。

Client 运行时只导出 `apply` 和 `inject`。组件、控制器和纯辅助函数通过内部相对导入测试。浏览器代码使用 typed locale、共享原语、DSW token 和 CSS Modules，不导入 Host 代码或 Node 内置模块。
