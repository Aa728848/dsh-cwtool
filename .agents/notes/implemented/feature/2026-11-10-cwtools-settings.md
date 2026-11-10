# Agent Note: CWTools 设置分区

Status: implemented

## Problem

CWTools 的配置（后端路径、超时、运行时上限、六组只读工具、一个本地化写入、结果预览上限）由 Host 的 `cwtools` 配置条目拥有。用户需要在 DSH 设置界面里看到并修改同一份文档，而不是另开一份界面状态、手改 YAML，或依赖一个和 Host 各记一份的权限副本。

四个约束决定了实现形态：

- 配置是嵌套的（`backend.*`、`readGroups.*`、`readTools.*`、`writeTools.*`、`output.*`），而 DSH 的共享表单模型按「单个 section 的顶层字段」寻址。
- 一次保存必须是一次原子写入：草案跨多个字段，半截落盘会让「组关闭但工具仍开」这类中间态被 Host 当真。
- 权限只有一份：界面上的每个开关都必须是 `cwtools` 条目里的真实字段，不额外保存任何本地副本。
- 界面只能在 Host 真的服务该条目时出现，否则就是一个什么都写不进去的空壳。

## Decision

**分区走 `settings.section`，能力走 `configForms`。** `src/client/index.ts` 声明 `inject = ['slots', 'locale', 'configForms']`，并通过 `ctx.configForms.whileServed(['cwtools'], ...)` 注册 `settings.section`（id `cwtools`、order 40）与 id 相同的 `settings.section.icon`。命名空间不再被服务时，导航行与图标一起消失，不留残余。

**`/client` 入口只导出 cordis 加载所需的值。** 按 DSH 客户端导出纪律，`src/client/index.ts` 的运行时导出恰好是 `apply` 与 `inject` 两个；字典命名空间与分区 id 是模块内私有常量，控制器与组件仍由各自模块导出，供同包测试直接相对导入。共享类型（`CwtoolsSectionProps`、`CwtoolsSectionFace`、`CwtoolsSectionState`、`CwtoolsAcceptedValue`、`CwtoolsFieldRef`、`CwtoolsLocaleKey`）作为类型导出保留。新增值导出需要用户批准，而不是「测试要编译」。

**空 `serverPath` 表示自动发现独立后端，不是回退到随包后端。** 本组合包不自带 CWTools 语言服务器可执行文件；字段留空时由已安装的 CWTools 扩展或开发构建提供独立后端。`preferActiveBackend` 默认开启，`activeManifestPath` 空值自动发现活跃宿主清单；界面同时说明健康复用、不可用回退和不兼容不双开。

**嵌套配置通过一层拉平适配器接入共享表单模型。** `FlatSectionScope` 实现 `SettingsFormScope<FlatSection>`：把 Host 快照的 `value`/`base`/`user` 各展开一层，叶子用点号路径（`backend.serverPath`、`readTools.get_diagnostics`）寻址，于是 `SettingsFormModel` 的暂存、校验、覆盖标记、reset 语义原样复用。写入时 `toWireOp` 把单段路径按点号拆回嵌套路径，`mutate` 一次提交全部操作，并用草案开始时的 revision 作为围栏。

**开关的两种默认值分开建模。** `enabled`、六个组和 37 个只读工具属于「缺省即开启」，`forceStart`、`debug`、`writeTools.write_localisation` 属于「缺省即关闭」；两组各有自己的 `SettingsFieldSpec`，因此首次打开页面时控件显示的是 Host 实际生效的值，而不是一律 false。

**组与工具是两票制，不是同一票。** 组关闭时只禁用子控件，不改写任何 `readTools.*` 值：重新开启组后各工具恢复原样。渲染的 `tools[name]` 是「组开启 AND 工具开启」的合成结果，用来给工具行着色和禁用，而控件自身的值仍来自该工具字段。

**失败与冲突分开呈现。** 保存被拒时保留全部草案，展示 Host 已接受值（从 accepted section 读，不是从草案推），并在 revision 变化时额外说明「设置已在别处更新」。传输异常同样落到 `failed`，草案不丢。

**reset 走 `unset`。** 恢复默认是清除用户层覆盖，让字段重新继承组合层，而不是把默认值写死进文档。

**只写自己那一个写入工具。** 页面只渲染 `write_localisation`，并在同段落下说明：本页不授予写入，每次写入仍要通过 DSH 工具策略。首版未实现的另外五个写入和两个 IDE 工具不出现在界面上。

**文案全部走 typed locale。** `settings.cwtools` 命名空间提供 `en`/`zh` 全量字典，工具名、路径、配置键保持原文不译。`locale/en.json` 与 `locale/zh.json` 提供 `meta.title`/`meta.description`，`icon.svg` 是原创的 C 形标识。

## Alternatives considered

- **直接在组件里读写 `ctx.configForms.get('cwtools')` 并做本地 state。** 会在界面和 Host 之间产生第二份权限状态，组关闭/工具开关的中间态无法原子落盘，也拿不到 revision 冲突语义。
- **给 `SettingsFormModel` 增加嵌套路径支持。** 那要改 DSH 的共享原语（`packages/client/ui-primitives`），属于本仓库边界之外，且会让所有插件卡片承担新的路径语义。拉平适配器把复杂度关在本仓库内。
- **每个块一个表单、各自保存。** 与「一次保存」的交互承诺冲突：用户改了路径和工具开关后按一次保存，不应该只落一半。
- **在界面里另存一份「有效权限」快照。** 会和 Host 漂移，且违反「不做假开关、不留本地权限副本」。
- **用 `Tab`/`SegmentedControl` 把六个组折叠起来。** 六组共 37 个工具，折叠后用户无法一眼看出哪些工具被单独关掉；分组卡片 + 组内平铺更直接。

## Consequences

- 客户端不持有任何权限状态：页面上每个控件都映射到 `cwtools` 冻结配置里的一个叶子字段，Host 是唯一权威。
- 组件与控制器都不 import Host 运行时或 Node 内置模块；类型上只依赖 `ui-primitives`、`ui-slots`、`ui-settings` 的公开面。
- 数值边界（1..8、1000..200000、超时上限）在客户端也做一次校验，目的是让明显的笔误在表单里就被拦住；Host 仍然复核，被拒时草案保留，因此两边不会对「已存值」产生分歧。
- 拉平适配器假设配置只有一层嵌套。若将来出现更深的结构，`flatten` 与 `toWireOp` 必须一起改，这是该适配器的已知边界。
- 页面注册跟随 `whileServed`：从未组合过 CWTools Host 的部署看不到任何痕迹，Host 停止服务时整页撤下。
- 公开浏览器 API 只有 `apply`/`inject`：任何新增值导出都要单独审批，测试只能相对导入内部模块，不能为了编译而放宽入口。
- 后端由外部提供：插件不打包语言服务器，空 `serverPath` 走自动发现；因此缺少后端时的失败诊断必须由 Host 侧给出，界面只负责如实描述该行为。
- `pnpm run build`、60 项 DSH 测试和静态安装/dump 已通过；真实 profile 中的 Client 激活、保存和 Before/After 视觉验收仍未执行，不能用源码或组件测试替代。
