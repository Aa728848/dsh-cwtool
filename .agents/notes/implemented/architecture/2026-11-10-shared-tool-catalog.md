# Agent Note: 工具目录改为由 cwtools-shared 驱动

Status: implemented

## Problem

首版把工具集合写死在 `src/contract/toolCatalog.ts`：37 个只读工具、一个写工具，外加 `CWTOOLS_FIRST_RELEASE_TOOL_NAMES` 与 `CWTOOLS_STELLARIS_ONLY_TOOLS` 两个名单。注册（`nativeTools.ts`）和准入（`runtime.exposureReason`）都以这份名单为准，共享目录里已发布但名单未列的只读工具（`get_ide_context`、`open_in_visual_editor`）因此被静默丢弃，运行时还会给出「outside the first-release CWTools catalog」这种与共享能力探测无关的拒绝理由。

共享目录正在扩张（override modes、scope bridge、archetype、项目初始化、GUI 预览等）。只要名单留在本包，每次上游新增工具都要在多处同步：契约常量、注册器、准入判定、设置页分组、测试计数。

## Decision

**工具集合只有一个来源：共享目录。** `toolCatalog.ts` 改为在加载时调用 `listMcpToolSchemas({ includeWrites: true })` 与 `getMcpToolRegistryMetadata`，产出一份投影 `CWTOOLS_CATALOG`。读写划分取二者的并集（`isMcpWriteToolName` 或 registry `isWrite`），因为 0.3.0 中 `convert_image_to_dds`、`convert_audio` 只在名字表里标记为写。

**分组是显示语义，不是准入清单。** 分组由 registry `effect` 推导，加一张显式的 `GROUP_OVERRIDES` 表把 `get_diagnostics`/`analyze_diagnostic_error` 归入 diagnostics、七个 shader 工具归入 shader、`query_localisation_index` 归入 localisation、两个 IDE 桥接工具归入新的 `ide` 组。registry 的 `effect` 不足以表达用途（`analyze_diagnostic_error` 的 effect 是 `none`），所以「未知工具落到 semantic 组」这一兜底保证上游新增工具一定出现在设置页，而不是被丢掉。

**准入不再按名字，而按能力。** `nativeTools` 注册目录里的每一个工具；是否可见、可调用由 `runtime.exposureReason` 决定：总开关 → 分组/单工具授权 → 写允许清单 → 项目检测 → `isMcpToolAvailable(..., { cwtOnly })` → `cwtoolsGameModelFor(name)`。IDE 组再经异步 `canExposeWithHost` 建立实际宿主并检查 `HostServices.capabilities`；活跃后端通过 NativeBridgeIdeHost 注入三个显式白名单操作，Standalone 不披露 IDE 工具。未发布的名字返回「not published by the active cwtools-shared catalog」，这是目录事实而不是编译期白名单。

**写授权改为开放字典。** `writeTools` 从固定的 `{ write_localisation: boolean }` 改为 `Record<string, boolean>`，默认空对象；`allowedWriteTools(config)` 把已允许的写工具全部传给 `cwtools-node` 的 `allowedTools`，`enableWrites` 仍由「至少允许一个写」推导。默认只读的语义不变：没有任何写工具在缺省状态下被允许。

**需要完整游戏模型的工具用数据表表达。** `CWTOOLS_STELLARIS_ONLY_TOOLS` 换成 `GAME_MODEL_TOOLS`/`cwtoolsGameModelFor()`，拒绝消息按表内容生成，未来需要 CK3 之类模型的工具只需加一行。

**目录投影只从浏览器安全入口 `cwtools-shared/catalog` 导入。** `toolCatalog.ts` 同时被 Host 与浏览器 Client 打包，不能从包根导入：包根会 re-export `workspaceGameDetection`、`project/*`、`safety/paths`、`tools/archetype*` 等 Host 模块，它们在求值时 `require("fs"|"path"|"crypto"|"url"|"os")`；0.3.0 的 Client 构建（`alwaysBundle`）把它们整体内联进 `lib/client.js`（596 KB），DSH 客户端模块表没有 Node 内置模块，factory 在 `apply()` 之前抛错，设置分区注册不上（issue #1）。`cwtools-shared@0.5.0` 为此新增 `./catalog` 子路径导出，只含生成目录、registry 元数据和读写名表，并由上游契约测试保证其运行时导入图不触达 Node 内置模块或 Host 模块。Host 构建的 external 规则同时匹配 `cwtools-shared/*`、`cwtools-node/*` 子路径，Host 运行期引用同一份 CJS 模块实例。`build` 在 `tsdown` 之后运行 `scripts/check-client-bundle.mjs`，`lib/client.js` 中出现任何 Node 内置模块的 `require`/`import` 即失败。

## Alternatives considered

- **保留名单，只是把新工具追加进去。** 解决一次，不是解决一类问题：下一次上游扩张仍要改多处，且容易漏改某一处，导致模型看得到工具、运行时却拒绝。
- **完全信任 registry `effect` 推导分组。** `analyze_diagnostic_error` 的 effect 是 `none`，会被分进 project 组；`query_shader_*` 的 effect 是通用的 `workspace_read`，会全部挤进 semantic 组，用户便无法按「关掉整个着色器组」来收缩表面。因此保留一张小而显式的归组表。
- **用 `effect !== 'workspace_read'` 判定只读。** `none` 只说明没有副作用声明，不保证能作为工具应答；写集合必须来自写名单与 registry 的显式写标记。
- **直接深层导入 `cwtools-shared/dist/tools/mcpSchema.js` 与 `names.js`。** 能不等上游发版就解阻，但把下游绑在上游内部目录布局上；`cwtools-shared@0.5.0` 增加 `exports` 后这类路径已不可导入。
- **在 Client 构建中给 Node 内置模块加 no-op 垫片或把 Host 模块标为 external。** 垫片只掩盖症状并保留约 400 KB 无用代码；external 会让 DSH 加载器去解析一个它没有的包，同样失败。
- **在注册期就把不可用工具从注册表移除。** 需要预先启动项目检测甚至 LSP，与「注册不启动后端」的既有约束冲突；可见性继续走步骤级 `when` 与执行期复核。

## Consequences

- 共享目录升级后，新工具自动注册、自动出现在对应分组，默认按组开启（只读）；写工具仍需逐个显式允许。
- `readTools`/`writeTools` 类型放宽为字符串字典，设置页对未知名字不渲染控件，历史残留键无害。
- 测试改为与目录对照（`publishes every shared tool and nothing else`、`registers every shared read tool`），不再是 `37`/`29` 这类会随上游漂移的魔数。
- `write_localisation` 仍保留 `isWriteLocalisationEnabled` 兼容导出，但内部改走通用的 `isWriteToolEnabled`。
- 本地 shared/node 构建下 Host/Client 81 项测试与 build 全绿；activeBackend mock 同步验证 IDE host 注入。
- `lib/client.js` 从 596 KB 降到约 212 KB（剩余主体是生成目录数据），不再请求任何 Node 内置模块；模拟 DSH 加载器求值 factory 时只请求 `@deepseek-ai/dsh-client-ui-primitives`、`react`、`react/jsx-runtime`。浏览器代码新增对 `cwtools-shared` 的使用时必须走 `cwtools-shared/catalog`，构建检查会兜底。
