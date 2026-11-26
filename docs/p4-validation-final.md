# P4 最终验证补充

- 根 `npm run compile`、`typecheck:test`、完整 `test:unit` 通过：客户端 904 项，规则/其它套件 60 项。
- 根 `npm test` Extension Host 集成测试退出码 0（20 passing、1 pending）；语义目录命令返回显式对象，日志无 `Illegal value for line`。
- `npm run test:fsx`：36/36 通过；`dotnet build src/Main/` 0 警告、0 错误；Carrier 定向 .NET 测试 12/12 通过。
- `cwtools-shared` 151 项、`cwtools-node` 77 项、`cwtools-mcp` 24 项契约通过。
- `dsh-cwtools`：18 个测试文件、140 项测试、生产构建、单一 client.js 无 Node builtin 和相对模块请求检查通过。
- 真实 Kuat Mod 在模型 ready 后，单文件与全工作区诊断均为 ready、authoritative、0 条；冷启动过早调用会明确返回 unavailable/loading，不再把 null 当作成功。
- 实际 Event Graph：2542 条规则、260 个 definitionTypes；993 节点、1977 条边、109 个来源文件，catalogStatus=ready 且无警告。
- 实际 Ship：22 个设计、350 个 shipSizes、563 个 section、1497 个 component、751 个科技、9 项核心 stats、256 个解析图标；root 节点取得真实 mesh。原版 `rotation { ... }` 简写解析已修复，独立 Ship 探针仅剩图标 256 上限的显式提示。
- 实际 GUI：107 元素、27 个 Host 解码 captureTexture；隔离 GUI 写探针提交后 fresh diagnostics 为 authoritative、0 条，真实 Mod 未写入。
- CarrierSnapshot 按 root 缓存节点数组后，同一真实 Mod 首次构建分配由 777MB 降为 505MB（约 -35%），Event 结果不变；完整探针约 90–94 秒，不能把缓存命中当作冷启动成本。
- 明暗右侧栏与真实 GUI 截图已重新生成并检查；Galaxy 拖拽 After 证据为 `artifacts/ui/galaxy-drag-canvas.png`，新功能无可靠 Before，采用 After-only 记录。
- 实际已登录 DSH Host：guide 入口、原生 Session Tab、`client/test/sample/interface/irm_sector.gui` 的 Remote read/gui/asset 与 SVG 画布、全屏、分栏、关闭/重开后的 Tab+路径+画布恢复均通过。证据：`artifacts/ui/dsh-host-gui-after.png`、`dsh-host-session-restored.png`。
- 单模块修复消除了真实 Host 的 `require("./editors-*.cjs") missed the module table` 错误；npm pack dry-run 包含单模块与指南，无旧 client.cjs。
- 右侧栏宽度手柄双向拖拽通过：Workbench 1727px → 1844px → 1727px，GUI 画布同步变化并恢复；Kuat Mod 数据验收使用 Standalone 探针，未切换当前 Host 工作区。
