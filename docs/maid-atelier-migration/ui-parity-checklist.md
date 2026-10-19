# Maid Atelier UI / 功能对齐清单

从 [企划书](./企划书.md) §4.3 与 §8 抽出。缺任一 §4.3 硬约束，或任一「动漫高手锁定门」，即未达观感验收。

企划书 §8 已把下列锁定门列为验收门。对照图未纳入本仓库。未给出的 hex 不补成规格。

## Hermes Desktop 落地记录

工台是 Desktop 插件 `maid-atelier`（`@hermes/plugin-sdk`），路由 `/atelier`，侧栏 Atelier，命令面板 Open Maid Atelier。三栏是页面内部网格（`data-atelier-pane=left|main|right`），不是桌面窗格树里三块永远并排的 pane，也不是 Dashboard Chat。同位置的 pane 会跟 Sessions / Chat / Files 叠成标签，中栏会被盖住，所以没有走那条路。

组件测试在 `apps/desktop`：`npm run test:ui -- src/plugins/maid-atelier`。没有在本环境启动 Electron，也没有对活网关做端到端。

### 已落地

- 三栏：左会话 / 干员 / 工作流 / 工作队列，中对话 + Goal / progress，右 Markdown 阅读。
- 空态文案就是 `No goal` / `No log` / `No checklist`。没有 `Sample`。
- pending `#5b8def`、blocked `#d4546a` 画在进度和任务上：未完成步骤用 pending 点；目标 `status: blocked` 时进度灯和未完成步骤改用 blocked 点。两者不相等，也不混成紫。
- 左栏忙闲：活会话为暖琥珀，空闲为冷薄荷，网关开着时「你」是 sage。`session.active_list` 读失败是未知空心环，不涂成空闲或在线绿。`pending_approval` 把该会话点涂成 pending。
- Draft line 只往输入框追加 `Pull {name} into this conversation.`，不改「In room」。
- Work 勾选经插件存储写入再读回。对不上或写入抛错则不更新，并提示 `Could not save this step on the progress card.` 分数只在有步骤时出现（`Process completed/total`）。不拿 `turns_used` / `max_turns` 当进度。
- 步骤文字不是编辑框。标题像 `chNN_` 或 `.md` 的会话以手稿打开，进右栏阅读，不冒充步骤。
- 群房里第一个指向其他在房干员的 `@` 会 `prompt.submit` 到对方 profile。房间会话不再收这一轮。提示：`Sent this turn to {name}. The reply stays in that agent's session.` 建不了会话时改走对方主会话，文案改成 main 那一句。
- 小圆头像是插件内打包的 MyGO!!!!! / Ave Mujica 脸部 WebP。没存过的 profile 用 id 哈希落在固定一张脸上，换脸条按序号循环。换脸条在房间标题下面，不盖标题，也不盖侧栏名字。
- @ 气泡左条 2px，`color-mix(white 24%, accent)`。阅读器一级标题和 Goal 强调色用同一实现色。

### 残留（过不去或未验）

1. Hermes 没有 `progressCard.put`。工作步骤只活在 `hermes.plugin.maid-atelier` 的插件存储里。别的界面看不到这张卡。
2. 没有跨 profile 的房间子会话，也没有把回复写回房间记录的通道。`parent_session_id` 只在同一网关内有意义，这里不用它跨 profile。`@` 的回复不在房间记录里。所谓回读是打开那个 profile 的会话，不是房间聚合记录。
3. 「In room」是工台自己的勾选记录，不是 OpenClaw 的 session-child 图。Draft line 不写这张记录。房主永远在房里。
4. 插件 SDK 没有安全的读文件口。右栏渲染的是恢复出来的会话记录（转成 Markdown），加上空态。它不是 OpenClaw 的工作区文件预览，插件也不去刮 `/api/files/read`。
5. busy `#f59e0b`、idle `#7ec8c3`、online `#6fbf8a`、attention `#f87171`、Goal / 阅读器一级标题 `#60a5fa`、壳色（背景 `#1c1d21` 等）是实现选择。pending / blocked 才是锁定值。OpenClaw 自己的 pip CSS 仍把 busy 指到 `--info`；这里按清单的三分走，不跟那条 CSS。
6. 头像是插件内的角色脸部图，不是 OpenClaw 的 `/maid-avatars/*.jpg`，也不是外链。
7. 记录刷新是每 4 秒 `session.resume`，不是 `message.delta` 流。
8. 文案只有英文，跟 OpenClaw 的英文字符串锁在一起。
9. 没有活网关端到端，也没有 Electron 里的肉眼对照。管理员主观「是同一工台」不勾。
10. P4 未做。OpenClaw 仍是生产壳。

## 色态（已定）

| 状态 | 色值 / 约束 |
| --- | --- |
| pending | `#5b8def` |
| blocked | `#d4546a` |
| busy | 暖琥珀。与 idle、online 分开。hex 未给出，不补成规格 |
| idle | 冷薄荷。与 busy、online 分开。hex 未给出，不补成规格 |
| online | sage（鼠尾草绿）。不是与 busy/idle 混用的一档「在线绿」。hex 未给出，不补成规格 |

- pending 与 blocked **不得**混成紫色。
- 状态点约 **8px**，深色描边（约 **74% 黑**混合），保证小点可读。不把该比例写成未给出的具体描边 hex。

## 硬约束（§4.3）

- [x] **三栏**：左（会话 / 分区 / 工作流）· 中（对话 + Goal / progress）· 右（Markdown Reader）
- [x] **色态**：pending `#5b8def`、blocked `#d4546a` 在进度/任务态上可辨
- [x] **忙闲**：左栏或等价位置可见干员/会话忙闲
- [x] **progress**：中栏有可追踪进度卡（插件存储，不是网关卡）
- [x] **@**：选择后有真实路由效果（发到目标 profile 的会话；回复不进房间记录）
- [ ] **气质**：深色、信息密度优先、圆形二次元头像、角色感克制。壳按这个做了；没有对照图，也没有 Electron 肉眼验收
- [ ] **动漫高手锁定门**全部满足。下面已勾的是代码和组件测试盖住的；未勾的见残留

## 动漫高手锁定门

### 色与状态点

- [x] pending `#5b8def`、blocked `#d4546a` 可辨，且两者不混成紫
- [x] busy、idle、online 三分：暖琥珀 / 冷薄荷 / sage，互不相等，也不并成一档绿
- [x] 状态 pip 约 8px，深色描边（约 74% 黑混合），小点仍可读
- [x] 未知忙闲不假绿、不伪造成空闲

### 壳与密度

- [x] 三栏 Control 密度（信息密度优先，不是玩具化留白）
- [x] 侧栏字号与行高比正文收紧半档（12.5px / 1.3，正文 14px / 1.5）
- [x] @ 展开时，Goal / progress 仍在顶栏
- [x] 空态诚实文案：`No goal` / `No log` / `No checklist`
- [x] 无 `Sample` 徽章抢焦点

### 头像

- [x] 仅小圆二次元头像（插件内 MyGO!!!!! / Ave Mujica 脸部 WebP，不是 OpenClaw jpg）
- [x] 换脸条不遮住房间标题，也不遮住侧栏名字
- [x] 禁止贴纸、换装剧场、大号角色扮演装饰

### 交互

- [x] @ 气泡左条克制：宽 2px，比强调色略亮（实现为 `color-mix(white 24%, accent)`，该 hex 不是规格）
- [x] Reader 第一章颜色 = Goal 强调色（实现同色；该 hex 不是规格）
- [x] Draft 行用弱化色，不发出邀请
- [x] Work 的真实步骤不是编辑框；手稿可打开
- [x] 未知忙闲不得假绿

### 硬失败

出现任意一条即验收失败。下面四条在当前插件里没有：

- [x] 无玩具化 UI
- [x] 无伪造的 progress 分数
- [x] 无紫色 pip（pending 与 blocked 不得混紫）
- [x] 无 `Sample` 叙述抢叙述位

## 界面对照（企划书 §8.1）

- [ ] 三栏比例与信息层级可对照本机参考图与现 OpenClaw 壳，管理员主观「是同一工台」
- [x] 深色专业壳；无过度角色扮演装饰
- [x] 圆形二次元头像位存在且可区分干员
- [x] pending `#5b8def` / blocked `#d4546a` 在进度相关 UI 正确
- [x] 忙闲状态在左栏可见；未知态不伪造成空闲
- [x] 右栏 Reader 能打开一种 Markdown 来源（恢复出的会话记录）。不能读任意工作区文件

## 功能对照（企划书 §8.2）

- [ ] 创建并打开会话；消息进出经 gateway 真实可用。代码走 `session.create` / `prompt.submit` / `session.resume`，只对假网关做过组件测试
- [x] @ 之后 `prompt.submit` 打到目标 profile。组件测试看得到这次调用。回复不在房间记录里，活会话日志未验
- [x] Work / 勾选写入进度卡并读回；pending / blocked 色态按上一节
- [x] 多 profile 可切换。这是 P3 之前允许的降级，不是完整监督
- [ ] 群房最小监督：能看、能指派。不能把回复回读进房间记录
- [x] Draft line 标明起草，不邀请，不改成员
- [x] 插件前端包不放明文密钥；不刮仪表盘 token

## 弃用门槛（企划书 §8.3，P4）

- [ ] 动漫高手锁定门、§8.1 与 §8.2 管理员勾选通过
- [ ] 并行期问题清单清零，或接受残留并书面记录。残留已写在上面，管理员还没书面接受
- [ ] 入口文档与书签只指向 Hermes fork 工台

P4 之前 OpenClaw 仍为生产壳。切换默认入口须走企划书 §9。

## 本清单故意留空的项

- 截图与录屏（本环境没有 Electron 对照）
- busy / idle / online、Goal 强调色、「略亮于强调色」作为规格的 hex
- 8px pip 与约 74% 黑描边之外的精确描边 hex
- 像素级动画、灯效、栏宽比例的数值规格（实现用了 248px / 300px，那不是规格）
