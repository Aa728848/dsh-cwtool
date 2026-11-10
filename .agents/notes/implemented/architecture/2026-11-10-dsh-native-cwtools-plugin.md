# Agent Note: DSH 原生 CWTools 插件与传输中立宿主

Status: implemented

## Problem

DSH 需要直接使用 CWTools 的 Paradox 语义能力，但现有独立 Node 宿主与 MCP 包耦合，索敌权重仅在 VS Code 仓库内可用，LSP 调用缺少端到端取消和后端兼容握手。活跃扩展已经持有健康 LanguageClient 时，再启动独立服务会重复加载同一工作区。首版还必须同时提供真实的工具权限设置页，而不是只给用户一份 YAML。

## Decision

2026-11-10 落地独立 `dsh-cwtools` 组合包。Host 使用 DSH 原生 `ctx.tools.register`，依赖 `cwtools-shared` 的 schema/分派/索敌权重和 `cwtools-node` 的项目识别/LSP 宿主，不包含 MCP SDK、MCP transport 或 MCP `/rpc` 客户端。后续增加的原生活跃宿主客户端只访问独立 `/cwtools/*` API。

- 首版目录在 `src/contract/toolCatalog.ts` 唯一持有：37 个只读工具和 `write_localisation`。CWT-only 只暴露支持的子集，索敌权重仅用于 Stellaris full-mod；另外五个 VS Code 依赖写入和两个 IDE 工具不注册。
- `CwtoolsRuntimePool` 按 Session cwd 和解析后的 mod root 复用宿主，支持项目门禁、single-flight、LRU、idle、容量背压、按并发类别串行和统一释放。步骤级 `when` 不启动 LSP。
- `preferActiveBackend` 默认开启，`activeManifestPath` 空值自动发现。发现校验 manifest 结构、原生 URL/token、正整数 pid、精确 workspace、健康状态与协议版本；缺失/畸形/失效/不匹配/未活跃/连接失败或超时回退独立后端，AbortSignal 原样传播。健康宿主注入 `NativeBridgeLspHost`，复用其余 Node Host Services而不创建进程。不兼容协议或能力握手返回 `backend_incompatible`，绝不双开。运行时已创建后不热迁移，偏好关闭时完全跳过发现；唯一例外是活跃后端返回 `active_unavailable`/`bridge_unavailable`：此时池丢弃该 runtime、重新执行一次发现（可回退独立后端）并重试一次，避免坏连接一直续命到 `idleShutdownMs`。
- 后端在 initialize 后、模型加载通知前执行能力握手，检查协议版本、release 清单版本和 29 条真实调用命令。AbortSignal 连接 JSON-RPC CancellationTokenSource，abort/deadline 发送 `$/cancelRequest`，启动失败/中止由宿主自行清理子进程。
- `startupTimeoutMs` 与 `requestTimeoutMs` 分别控制启动和后续请求。加载中的空诊断表示 pending，不表示错误或权威空结果；响应保留 readiness/cache provenance。
- 规范结果只包含无损 JSON，`ok:false` 转为带稳定错误码的 `CwtoolsToolError`，只有渲染文本被有界截断。
- `dsh.bundle` 与 `dsh.client` 同包发布。设置通过 `settings.section` 和 `configForms` 进入同一 Host 配置；`FlatSectionScope` 负责嵌套配置的点号路径适配，一次保存一次 revision-fenced `mutate`，组开关不改写单工具值。Client 运行时只导出 `apply` 和 `inject`。
- 构建使用独立 tsdown/tsc，Host 输出 ESM，Client 输出 `window.__ModuleLoader__.load` 包装和 CSS Modules。发布包包含 `lib/index.js`、`lib/client.js`、类型、patch、双语元数据和原创图标。

- 设置分区依赖宿主 settings 投影：只有 Config 中位于 \`.volatile()\` 节点下的字段才会生成命名空间与表单；没有 volatile 字段的条目被 \`volatileForm()\` 过滤，浏览器端 \`whileServed(['cwtools'])\` 因此永不触发。本包六个可编辑区块（enabled/readGroups/readTools/writeTools/backend/output）整块声明为 volatile，\`snapshotConfig()\` 统一 \`.get()\` 成普通值供运行时消费，\`apply\` 监听 \`loader/volatile-update\` 重建运行时与工具注册，保存后无需重启实例。类型侧只 type-only 引入 \`@deepseek-ai/cordis-plugin-loader\`（devDependency）以获取该事件声明。

- 设置页按信息类型拆成四个页签（项目 / 后端 / 只读工具 / 写入与输出），用共享 \`SegmentedTabs\` 提供等宽页签与键盘切换；总开关固定在页签上方，因为它门禁所有其它控件。字体层级对齐既有产品页：标题 16/500、分区标题 13/600（去掉全大写微型标题）、行标签 13、说明 12 三级色；每一行只有一个控件，并且所有行都是同一种卡片：同样的描边、填充、圆角和 10px 间距；字段卡包装共享 `SettingsValueField` 并清掉它自带的相邻分隔线（`field + field` 的 border-top），避免同页出现两种分隔方式。共享 \`SettingsForm\` 的根节点不带间距，页面自建 14px 块间距包住总开关、页签与面板，避免控件彼此贴住。37 个只读工具改为分组卡片内的多列网格加组头计数徽标。诊断降噪在「只读工具」页内自成一卡：`diagnostics.ignoreCodes` / `ignoreFiles` 以逗号分隔文本编辑并写成字符串数组（`listField` 适配），`diagnostics.localisationFilter` 用共享 `SegmentedControl` 取 `off` / `problems` / `all`（`localisationFilterField` 只接受这三个值），三者随 `snapshotConfig()` 一路透传到 LSP 的 `errors.ignore` / `errors.ignorefiles` / `errors.localisationFilter`；原版错误仍固定为 `errors.vanilla = false`。

## Alternatives considered

- 使用 DSH MCP 客户端：违反不采用 MCP 的产品约束，并保留不必要的协议层。
- 在 DSH 插件内复制 Node 宿主：进程、诊断和索引逻辑会长期漂移，因此改为上游抽取共享包。
- 复用 MCP `/rpc` 桥接：会继承不需要的 MCP 方法和语义；改为独立、受限的 `/cwtools/*` 原生 API，活跃扩展仍只是可选优化。
- 首版开放全部写入：其中五项依赖 VS Code，无法形成真实独立闭环。
- 默认开放本地化写入：违反首版默认只读的安全决策。
- 用硬编码版本或只信程序集版本：普通开发构建会得到默认程序集版本，改为最近的 release/package.json 优先、程序集回退。
- 用递归清理维持 staging：违反工作区安全规则，改为按名称合并拷贝与明确的单文件清理。

## Consequences

- 后端掉线自愈的回归测试覆盖「重发现并重试一次」与「非活跃后端不重试」两项；错误消息保留稳定错误码（如 `active_unavailable`），因为 DSH 只渲染 message 文本。
- Host 与 Client 的 60 个测试通过；上游 shared/node/mcp 的 177 个契约测试通过，其中原生发现覆盖健康复用、不兼容不双开、工作区不匹配/超时回退、畸形 manifest 和取消传播。真实 DSH 调用验证 query_types ready、索敌 W1/p 数值、诊断 pending、默认无写入、本地化 BOM 保留/创建和越界拒绝。
- F# 的 19 项能力握手检查通过，VS Code 类型检查、MCP schema/detection 和 release 校验通过；VSIX 包含 65 个 cwtools-shared 文件且不含 src/。
- 静态本地链接 `dsh plugin` 安装和 `--dump-config` 已确认 `# == dsh-cwtools` 与 `id: cwtools`，没有启动验收实例。tarball 已生成；直接安装 tarball 时，包管理器尝试从 registry 解析未发布的 `cwtools-node` 并以 404 失败，因此 tarball 安装不能记为通过，profile 保持原有链接。
- 全量 VS Code 单测仍只有既有的 shader_files=50 vs 49 失败，原因是用户已有的 rules 子模块改动，本变更未修改该数据或测试。
- 用户不允许启动新 DSH 实例，因此真实 profile 中的 Client 激活、配置保存以及精确视口 UI After 尚未完成；当前只有安装前基线和组件测试，不能声称完整 UI 验收通过。
- 旧后端缺少能力握手时必须升级；本包不自带后端。发布顺序为 cwtools-shared → cwtools-node → dsh-cwtools。Git 交付不等同于 npm 发布，真实 profile UI 验收仍须单独完成。
- 修复后 \`tests/host\` 24 项全部通过，其中新增回归测试要求 Config 的每个叶子字段都位于 volatile 节点下（镜像宿主 \`isVolatilePath\`）。\`tests/client\` 在本机无法装载：\`@deepseek-ai/dsh-client-ui-primitives\` 的 \`lib/index.js\` 引用未随包声明的 \`clsx\` 等运行时依赖，报错发生在 import 阶段、未进入本包代码，属既有环境缺口而非本次改动引入；真实 profile 的 Client 激活与保存仍需重启宿主后单独验收。
- 客户端测试环境此前不可运行：\`@deepseek-ai/dsh-client-ui-primitives\` 与 \`dsh-client-store\` 把运行时依赖只写在 devDependencies，消费方需自备。补入所需运行时依赖（clsx、diff、anser、katex、micromark/mdast 系列、shiki、zustand、immer、simple-icons 等）并在 \`vitest.config.ts\` 内联该 UI 包以加载其 CSS Modules 后，9 个套件 61 项全部通过；\`section.spec.tsx\` 改为按页签切换后再断言。