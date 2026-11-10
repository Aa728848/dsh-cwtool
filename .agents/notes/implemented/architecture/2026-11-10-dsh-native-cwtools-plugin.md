# Agent Note: DSH 原生 CWTools 插件与传输中立宿主

Status: implemented

## Problem

DSH 需要直接使用 CWTools 的 Paradox 语义能力，但现有独立 Node 宿主与 MCP 包耦合，索敌权重仅在 VS Code 仓库内可用，LSP 调用缺少端到端取消和后端兼容握手。首版还必须同时提供真实的工具权限设置页，而不是只给用户一份 YAML。

## Decision

2026-11-10 落地独立 `dsh-cwtools` 组合包。Host 使用 DSH 原生 `ctx.tools.register`，依赖 `cwtools-shared` 的 schema/分派/索敌权重和 `cwtools-node` 的项目识别/LSP 宿主，不包含 MCP SDK、MCP transport 或 VS Code 桥接客户端。

- 首版目录在 `src/contract/toolCatalog.ts` 唯一持有：37 个只读工具和 `write_localisation`。CWT-only 只暴露支持的子集，索敌权重仅用于 Stellaris full-mod；另外五个 VS Code 依赖写入和两个 IDE 工具不注册。
- `CwtoolsRuntimePool` 按 Session cwd 和解析后的 mod root 复用宿主，支持项目门禁、single-flight、LRU、idle、容量背压、按并发类别串行和统一释放。步骤级 `when` 不启动 LSP。
- 后端在 initialize 后、模型加载通知前执行能力握手，检查协议版本、release 清单版本和 29 条真实调用命令。AbortSignal 连接 JSON-RPC CancellationTokenSource，abort/deadline 发送 `$/cancelRequest`，启动失败/中止由宿主自行清理子进程。
- `startupTimeoutMs` 与 `requestTimeoutMs` 分别控制启动和后续请求。加载中的空诊断表示 pending，不表示错误或权威空结果；响应保留 readiness/cache provenance。
- 规范结果只包含无损 JSON，`ok:false` 转为带稳定错误码的 `CwtoolsToolError`，只有渲染文本被有界截断。
- `dsh.bundle` 与 `dsh.client` 同包发布。设置通过 `settings.section` 和 `configForms` 进入同一 Host 配置；`FlatSectionScope` 负责嵌套配置的点号路径适配，一次保存一次 revision-fenced `mutate`，组开关不改写单工具值。Client 运行时只导出 `apply` 和 `inject`。
- 构建使用独立 tsdown/tsc，Host 输出 ESM，Client 输出 `window.__ModuleLoader__.load` 包装和 CSS Modules。发布包包含 `lib/index.js`、`lib/client.js`、类型、patch、双语元数据和原创图标。

## Alternatives considered

- 使用 DSH MCP 客户端：违反不采用 MCP 的产品约束，并保留不必要的协议层。
- 在 DSH 插件内复制 Node 宿主：进程、诊断和索引逻辑会长期漂移，因此改为上游抽取共享包。
- 依赖 VS Code 桥接：不能独立运行，并继承带 MCP 语义的桥接协议。
- 首版开放全部写入：其中五项依赖 VS Code，无法形成真实独立闭环。
- 默认开放本地化写入：违反首版默认只读的安全决策。
- 用硬编码版本或只信程序集版本：普通开发构建会得到默认程序集版本，改为最近的 release/package.json 优先、程序集回退。
- 用递归清理维持 staging：违反工作区安全规则，改为按名称合并拷贝与明确的单文件清理。

## Consequences

- Host 与 Client 的 54 个测试通过；上游 shared/node/mcp 的 173 个契约测试通过。真实 DSH 调用验证 query_types ready、索敌 W1/p 数值、诊断 pending、默认无写入、本地化 BOM 保留/创建和越界拒绝。
- F# 的 19 项能力握手检查通过，VS Code 类型检查、MCP schema/detection 和 release 校验通过；VSIX 包含 65 个 cwtools-shared 文件且不含 src/。
- 静态 `dsh plugin` 安装和 `--dump-config` 已确认 `# == dsh-cwtools` 与 `id: cwtools`，没有启动验收实例。
- 全量 VS Code 单测仍只有既有的 shader_files=50 vs 49 失败，原因是用户已有的 rules 子模块改动，本变更未修改该数据或测试。
- 用户不允许启动新 DSH 实例，因此真实 profile 中的 Client 激活、配置保存以及精确视口 UI After 尚未完成；当前只有安装前基线和组件测试，不能声称完整 UI 验收通过。
- 旧后端缺少能力握手时必须升级；本包不自带后端。发布顺序为 cwtools-shared → cwtools-node → dsh-cwtools，当前仅完成本地构建和静态安装，未发布、未提交、未推送。
