# Agent Note: DSH CWTools 工作台与可视化指南

Status: implemented

## Problem
DSH 插件只有设置页，无法跟随当前 Agent 查看真实 IDE 上下文与诊断；三维编辑器和原版粒子知识也分散在 VS Code 实现、CWT 规则和原版文件中。

## Decision
- 新增 Session 限定的 `cwtoolsWorkbench` Remote，宿主通过 Sessions 与 SandboxPolicy 解析工作区，复用 `CwtoolsRuntimePool`，只读 execute 不接受写入工具。
- Client 使用显式 Remote descriptors，并通过 `sidebarRightTabs` 与 Session 级右侧 pane 注册原生 Tab；DSH 负责 guide、分屏、全屏和布局持久化。工作台实时模式不伪造画布、Agent 对话或证据；预览只用于显式视图与组件测试。
- Remote 业务核心与装饰器薄壳分离，避免测试依赖特定装饰器转换。
- Agent prompt 与随包指南记录三维编辑器入口、只读保护、粒子两层反查链及运行时近似。

## Alternatives considered
- 通过 MCP 或浏览器传入工作区路径：增加协议层并扩大越权面，否决。
- Host 查询失败时显示预览数据：会把示例误认为真实项目，否决。
- 将 VS Code Panel 整体复制到插件：重复 Host、解析和写入逻辑，否决；后续迁移只复用纯解析/渲染核心。

## Consequences
- 已覆盖真实 Session 快照、IDE Context、诊断、本地化安全写入、原生关系图/轨道/实体结构、`.gui` 共享候选事务和三维/粒子 Agent 指南。
- Entity/Particle 使用原生 WebGL；Ship 复用 shared catalog/slots/stats 与 cwtools-node resources/sprites，按节点懒加载真实 mesh/附件/纹理，缓存以文档 SHA-256 失效且最多四项。resource roots 由 Host 配置或 `detectGameInstall` 得出，工作区优先，vanilla 仅在缺失时回退。
- Event 使用 `get_semantic_catalog` 和 Host 有界跨文件扫描；无游戏模型的 LSP null 已改为结构化 unavailable，load-dependent 工具附 readiness。Static Galaxy 支持原生预览、数字/拖拽坐标及显式航道候选，拖拽与数字编辑共享 transactionId。
- 真实 Kuat Mod 验证得到 107 个 GUI 元素和 27 个可截图纹理；Event 993 节点/1977 边/109 文件，Ship 22 设计/1497 component 选项。模型 ready 后单文件与全工作区诊断均为 authoritative、0 条；加载早期仍必须保持非权威。
- 已登录 DSH Host 已验证 guide 入口、右侧 Tab、真实 Remote GUI、分栏/全屏和关闭/重开持久化；宽度手柄双向拖拽通过（1727px ↔ 1844px）。Client 使用 `codeSplitting: false` 单模块，避免 DSH module table 不物化相对 chunk；构建拒绝相对模块请求。
- 客户端与 Host 测试覆盖预览写入禁用、实时数据隔离、Session 缺失、禁用后端与只读门禁，以及 DDS/TGA 解码、GFX sprite 捕获、资源字节上限和 Ship/Galaxy 独立事务；最终 18 个测试文件共 140 项通过。
- `gui_draft validate` 在 fresh diagnostics 仍为 pending 时返回 loading，活动候选保留且不得写盘；shared 最终 151 项契约通过。