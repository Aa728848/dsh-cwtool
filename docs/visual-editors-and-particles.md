# CWTools 三维编辑器与 Stellaris 粒子设计·Agent 使用指南

> 面向 CWTools Agent 的可执行指南。标注约定：
> - **[源码]** 来自 `cwtools-vscode` 仓库源码或 `cwtools-shared` 工具目录的事实。
> - **[CWT规则]** 来自 `submodules/cwtools-stellaris-config/config/gfx/*.cwt` 的强类型规则。
> - **[原版示例]** 来自某个 Stellaris 安装目录（**不要假设固定盘符**，用下文“原版根”占位）。
> - **[运行时近似]** 预览层是估算，不等于引擎精确行为。
> - **[推测]** 未文档化、需另行取证，禁止当作事实输出。

## 0. 原版根与路径约定

- 本文用 `VANILLA` 表示**当前用户实际配置的原版游戏目录**（例如某个 Steam 库下的 `.../steamapps/common/Stellaris`）。**禁止把任何具体盘符路径当作所有用户的固定路径**；先用项目配置/`get_ide_context`/`vanillaCache` 解析真实位置，无法确定时直接说明“无法定位原版”，不要编造。
- 仓库内事实路径：`client/extension/`、`client/webview/`、`submodules/cwtools-stellaris-config/config/gfx/`。
- 原版相对路径（相对 `VANILLA`）：`gfx/particles/**/*.gfx`、`gfx/particles/**/*.asset`、`gfx/models/**/*.asset`、`gfx/models/**/*.gfx`、`common/ship_sizes/*.txt`、`common/solar_system_initializers/*.txt`、`map/setup_scenarios/*.txt`、`common/global_ship_designs/*.txt`。

## 1. Agent 打开可视化编辑器的两条通道

**[源码] 通道 A（可被 Agent 直接调用）**：工具 `open_in_visual_editor`（`ide` 组），`editor` 枚举 = `auto | gui | entity | particle | solar_system | tech_tree | event_chain | target_weight`，`file` 为工作区相对或绝对路径，`line` 为可选 1 基行号。用于 `gui`、`entity`、`particle`、`solar_system`、`tech_tree`、`event_chain`、`target_weight`。

**[源码] 通道 B（仅 VS Code 侧命令/自定义编辑器，不在 `open_in_visual_editor` 枚举内）**：**舰船设计工作台** 与 **静态银河编辑器**。Agent 无法用通道 A 打开它们，应通过 `get_ide_context` 了解现状，并提示用户在 VS Code 中执行对应命令/入口；不要声称能直接以工具打开。

## 2. 各三维/可视化编辑器：入口、操作、只读与 dispose

### 2.1 舰船设计工作台（Ship Design Workbench）
- **[源码] 入口**：编辑器标题栏/右键命令 `cwtools.shipDesign.open`，`when` = `.txt` 且路径含 `global_ship_designs` 且 `editorLangId == stellaris`（装配清单 `release/package.json` 的 `menus.editor/title`）。命令实现见 `client/extension/extension.ts` 中 `cwtools.shipDesign.open`，非 `common/global_ship_designs/` 会拒绝。
- **[源码] 操作**：基于真实 locator 的船体/区段/武器组装、点击放置与拖放、槽位/核心组件编辑、按等级与来源筛选组件库、**Host 草稿机制（只有点“保存”才写回文档）**、静态数值面板带来源标注。3D 场景复用 `client/webview/entityModelRuntime.ts`，按祖先组合键增量重建 locator 子树（见 `ARCHITECTURE.md`）。
- **[源码] 只读/dispose**：草稿注册为虚拟脏文档，与 GUI 编辑器共用 fail-closed 保护，阻止磁盘写入覆盖草稿；改动经 VS Code 工作区编辑应用，可撤销/重做。

### 2.2 恒星系预览（Solar System Preview）
- **[源码] 入口**：命令 `cwtools.previewSolarSystem`，`when` = `.txt` 且路径含 `solar_system_initializers`（`release/package.json`）。Agent 也可用 `open_in_visual_editor(editor="solar_system", file=...)`。命令实现 `client/extension/extension.ts`：仅 `.txt`，不在目录会二次确认。
- **[源码] 操作**：3D 布局与轨道预览，支持改属性/轨道、增删行星/卫星/环世界等（见 `client/extension/solarSystemPanel.ts` 消息类型）。引擎硬限制轨道距离 `MAX_ORBIT_DISTANCE = 500`（`solarSystemPanel.ts` 顶部 `MAX_ORBIT_DISTANCE`，webview 先夹取，Host 侧二次防御）。
- **[源码] dispose**：`SolarSystemPanel` 关闭时释放 webview 监听与 GPU 资源（`client/webview/solarSystemPreview.ts` 使用 three.js，遵循 Webview 释放约定）。

### 2.3 静态银河编辑器（Static Galaxy Editor）
- **[源码] 入口（通道 B）**：自定义编辑器 `cwtools.staticGalaxyEditor`，`selector` = `**/map/setup_scenarios/*.txt`，`priority = option`；另有命令 `cwtools.previewStaticGalaxy`（`release/package.json` 的 `customEditors` 与 `menus`）。**不在 `open_in_visual_editor` 枚举**。
- **[源码] 操作**：初始izer 坐标与显式超空间航道编辑（`client/extension/staticGalaxyEditorProvider.ts`、`staticGalaxyParser.ts`）。
- **[运行时近似]**：`random_hyperlanes = yes` 的航道为估计层——`client/shared/staticGalaxyEstimate.ts` 明确写“This is NOT Stellaris' generator — the real runtime algorithm is undocumented”，用 k 近邻启发式，仅预览、**绝不写回源码**。

### 2.4 实体预览（3D Entity Preview）
- **[源码] 入口**：命令 `cwtools.previewEntity`（`when` = `.asset`）；Agent 用 `open_in_visual_editor(editor="entity", file=...)`。命令实现 `client/extension/extension.ts`：仅 `.asset`。
- **[源码] 操作**：解析 entity 的 `pdxmesh`、`state`（动画/事件/粒子）、`locator`、`attach`；支持 locator 多选变换与增删（`entityLocatorEditing.ts`、`entityAttachDiagnostics.ts`）。渲染 `client/webview/entityPreview.ts` + `entityModelRuntime.ts`。
- **[源码] 只读/dispose**：Host 用草稿文档 + `vscode.workspace.applyEdit` 应用编辑（`entityPanel.ts` `applyEdit` 处），撤销/重做栈上限；脏草稿 fail-closed 防止磁盘写入覆盖。

### 2.5 粒子预览（Particle Preview）
- **[源码] 入口**：命令 `cwtools.previewParticle`（`when` = `.asset`）；Agent 用 `open_in_visual_editor(editor="particle", file=...)`。命令实现 `client/extension/extension.ts`：仅 `.asset`，且 `classifyAssetFile` 判定顶层为 `particle` 才打开，否则提示“可能是实体资源”（`client/extension/particleSniff.ts`）。
- **[源码] 操作**：解析 `particle { name, subsystem, animation, force }`，three.js 渲染 + UnrealBloom；可视化编辑子系统/曲线/力（`client/webview/particlePreview.ts`、`particleSimulation.ts`、`particleRenderer.ts`、`particleTypes.ts`）。
- **[源码] 只读保护**：`client/extension/particlePanel.ts` 的 `_ensureWritableDocument` —— 文件在工作区外或原版目录时弹出“另存为 mod 副本(Save Copy)”，**禁止写入原版游戏目录**；`_isEditableFile = 工作区内且非游戏目录`；payload 携带 `readonly` 标志，webview 顶部显示只读横幅。
- **[运行时近似]**：预览自带“近似模拟 Approximate simulation”横幅（`particlePreview.ts`），模拟用带种子的随机与经验常量（如 `particleSimulation.ts` 的 `FRICTION_RESPONSE_SCALE`），**不是引擎精确复现**。

### 2.6 GUI 画布 / 科技树 / 事件链 / 索敌权重
- **[源码] GUI**：命令 `cwtools.previewGUI`（`.gui`），或 `open_in_visual_editor(editor="gui")`。
- **[源码] 科技树**：`cwtools.visualizeTechTree`（`technology/`），或 `editor="tech_tree"`。
- **[源码] 事件链**：`cwtools.visualizeEventChain`（`events/`），或 `editor="event_chain"`，可带 `line` 定位。
- **[源码] 索敌权重**：`cwtools.targetWeights.open(-AtCursor)`，或 `editor="target_weight"`。

## 3. 粒子反查链（Agent 必须按原版证据，不要凭记忆）

粒子在 Stellaris 里分**两层**，这是最容易搞混的点：

1. **[原版示例] 实体实例 → 粒子名**：实体 `.asset` 的 `state.event { particle = "<name>" }` 引用一个粒子实例名。例：`VANILLA/gfx/models/add_ons/_add_ons_entities.asset` 中 `survey_base_effect_entity` 的 `state = { name = "working" ... event = { time = 0 particle = "survey_effect_particle" keep_particle = yes ... } }`。
2. **[原版示例] 粒子名 → 代理(name,type,scale)**：在 `VANILLA/gfx/particles/**/*.gfx` 的 `objectTypes = { pdxparticle = { name = "<name>" type = "<type>" scale = ... } }` 找到同名代理。例：`VANILLA/gfx/particles/_generic_particles.gfx` 里 `name = "survey_effect_particle"` 对应 `type = "survey_effect"`、`scale = 1.0`。
3. **[CWT规则]** 这条 `.gfx` 代理被 `particles.cwt` 的 `type[particle]`（`skip_root_key = objectTypes`，`path = "game/gfx"`）识别——见 `config/gfx/particles.cwt` 顶部 `types` 块。
4. **[原版示例] type → 真正的粒子定义(particle_type)**：用上一步的 `type` 值，在 `VANILLA/gfx/particles/**/*.asset` 找 `particle = { name = "<type>" subsystem = {...} animation = {...} force = {...} }`。
5. **[CWT规则]** 这条 `.asset` 的 `particle` 被 `particles.cwt` 的 `type[particle_type]`（`path = "game/gfx"`）识别；`particle_type` 结构（`name`、`subsystem`、`animation`、`force`）定义在同文件 `particle_type = { ... }` 块。
6. **[原版示例] subsystem → 曲线/力**：subsystem 字段内用 `{ 值, 曲线名 }` 引用曲线（如 `alpha = { 200, flash_fade }`、`rotation = { spin 180 }`），曲线名在同 `.asset` 的 `animation = { name = "<曲线名>" ... curve = { x y  x y ... } }` 段定义；`force` 段按 `name` 引用于 subsystem 的 `force = <name>`。

**[CWT规则] 常用字段（`config/gfx/particles.cwt`，与 `client/webview/particleTypes.ts` 的 `Subsystem` 一致）**：
- subsystem：`max_amount`、`sort`（`depth/age/distance`）、`texture { file, shader, x, y }`、`position { x, y, z }`、`emitter_yaw/emitter_pitch`、`start`、`duration`、`emission`、`velocity/_yaw/_pitch`、`rotation`（可 `{ spin 180 }`）、`life`、`size`（可 `{ 0, flash_size }`）、`color { r, g, b, alpha }`、`emitter_type`（`point/sphere/box`）、`local_space/billboard/trail`、`sphere_emitter_*/box_emitter_*`、`childsystem`。
- animation：`name/time(life·life_abs·system·spawn)/start/duration/repeat/op(MUL·ADD·ABS)/minValue/maxValue/curve{{x y}...}`。
- force：`name/type(planar·friction·point·spin·turbulence·vortex)/position[3]/direction[3]/local_force/yaw/division/amount`。

**反查命令（在原版根下执行；不要写死盘符）**：
```
# 2) 粒子名 -> 代理 type
grep -rn 'name = "<particle_name>"' VANILLA/gfx/particles --include=*.gfx
# 4) type -> 粒子定义
grep -rn 'name = "<type>"' VANILLA/gfx/particles --include=*.asset
```

## 4. 实体 / locator / attach / pdxmesh / 材质 / 动画 的关系

**[CWT规则] `config/gfx/model_entities.cwt` + [原版示例]**：
- `entity`：`name`、`pdxmesh = <model_mesh>`、`cull_radius`、`scale`、`default_state`、`state { animation = <model_animation>/enum[anim_states]、event { time, particle, node, light, entity, sound }、locator { name, position[3], rotation[3], scale, parent_joint } }`、`attach { root/scene_main = <model_entity> }`、`game_data`。
- `pdxmesh`（`<model_mesh>`）：`name`、`file = "*.mesh"`、`scale`、`animation { id = enum[anim_states], type = <model_animation> }`、`meshsettings { shader = $shader_effect, texture_diffuse/normal/specular/wpo }`、`cull_distance`。原版例：`VANILLA/gfx/models/add_ons/_add_ons_meshes.gfx` 的 `survey_base_effect_mesh` → `file = "gfx/models/add_ons/survey_base_effect.mesh"`、`animation = { id = "survey" type = "survey_base_effect_animation" }`。
- `model_animation`：`name` + `file = "*.anim"`（动画文件与 `.asset` 同目录）。
- `locator` 双重用途：`entity.locator.name` 既被同文件 `attach = { <locator> = <entity> }` 使用，也被 `common/ship_sizes/*.txt` 的 `section_slots = { "<slot>" = { locator = "<name>" } }` 复用。原版例：`VANILLA/common/ship_sizes/00_biogenesis.txt` 中 `entity = "mauler_stage_1_entity"` 与 `section_slots = { "mid" = { locator = "root" } }`。
- 材质链路：`entity.pdxmesh` → `*.gfx` 的 `pdxmesh{ file=*.mesh, meshsettings{ shader, texture_* } }`；动画链路：`state.animation` → `model_animation{ file=*.anim }` 或 `anim_states` 枚举；粒子链路：`state.event.particle` → 见第 3 节反查。

## 5. 运行时近似声明（输出时必须标注，禁止冒充引擎事实）
- **[运行时近似] 粒子预览**：近似模拟，参数/常量经经验校准，非引擎精确复现。
- **[运行时近似] 静态银河航道**：`random_hyperlanes = yes` 的航道为 k 近邻启发式估计，明确“不是 Stellaris 生成器”，只读预览、不写回。
- **[推测]**：引擎内部精确算法、未文档化的数值/行为——必须标注为未验证，需另行取证，禁止杜撰。

## 6. 安全与只读保护（源码事实）
- Webview 运行在浏览器沙盒：禁 `vscode`/`fs`/`path`/`require`/Node API，仅 `postMessage`；用 VS Code 主题变量并尊重 `prefers-reduced-motion`；关闭时释放渲染器/GPU/贴图/worker/监听器/动画循环（`ARCHITECTURE.md` Webview 约束）。
- 所有可视化改动经 VS Code 工作区编辑应用，可撤销/重做；预览只读，原版/游戏目录永不写入。
- 粒子另存保护：工作区外/原版目录弹“另存为 mod 副本”，禁止写入原版目录（`client/extension/particlePanel.ts` `_ensureWritableDocument`）。
- Agent 侧：只有白名单写入工具且用户启用时才允许写；被拒绝的写入绝不当作已完成。

## 7. 快速索引（源码/规则/原版路径）

| 主题 | 源码/规则路径 | 原版相对路径 |
| --- | --- | --- |
| 粒子规则 | `submodules/cwtools-stellaris-config/config/gfx/particles.cwt` | `gfx/particles/**/*.gfx`、`gfx/particles/**/*.asset` |
| 实体/网格规则 | `submodules/cwtools-stellaris-config/config/gfx/model_entities.cwt` | `gfx/models/**/*.asset`、`gfx/models/**/*.gfx` |
| 粒子面板 | `client/extension/particlePanel.ts`、`client/webview/particlePreview.ts` | — |
| 实体面板 | `client/extension/entityPanel.ts`、`client/webview/entityPreview.ts` | — |
| 恒星级预览 | `client/extension/solarSystemPanel.ts` | `common/solar_system_initializers/*.txt` |
| 静态银河 | `client/extension/staticGalaxyEditorProvider.ts`、`client/shared/staticGalaxyEstimate.ts` | `map/setup_scenarios/*.txt` |
| 舰船设计 | `client/extension/shipDesignPanel.ts`、`client/webview/shipDesignPreview.ts` | `common/global_ship_designs/*.txt` |
| 舰船槽位 locator | — | `common/ship_sizes/*.txt` |

（本指南基于 `cwtools-vscode` 源码与 `cwtools-stellaris-config` 规则核对；原版示例来自某个 Stellaris 安装，用户环境路径可能不同。）