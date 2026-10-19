# Maid Atelier → Hermes 迁移文档

本目录记录 Maid Atelier 迁到 Hermes Agent fork 的约束，以及 Desktop 工台已经落地的部分和仍然过不去的缺口。

| 文档 | 用途 |
| --- | --- |
| [企划书](./企划书.md) | 背景、范围、架构映射、分阶段、风险、验收 |
| [UI / 功能对齐清单](./ui-parity-checklist.md) | 硬约束勾选，以及本 fork 的落地 / 残留 |

## 仓库

| 项 | 值 |
| --- | --- |
| 目标宿主 | Hermes Agent fork [`https://github.com/L1nkkkk/hermes-agent`](https://github.com/L1nkkkk/hermes-agent) |
| 现壳基线 | OpenClaw fork `L1nkkkk/openclaw`，`main` 上的 squash `40403339745bd13316a9075e88259b5710656d27`（PR #10，`improve(ui): route Maid @ mentions and save work-queue steps`） |
| Hermes 工台 | 捆绑 Desktop 插件 `apps/desktop/src/plugins/maid-atelier`，路由 `/atelier` |
| 文档 PR #1 | 草案分支 `cursor/maid-atelier-migration-docs-b233` 仍开着。本目录以带工台实现的提交为准，两份不要一起合 |

## 诚实边界

- OpenClaw #10 已合 `main`。早先「#10 仍是 draft、本目录未对照远端」的说法作废。
- 未给出的 busy / idle / online、Goal 强调色、「略亮于强调色」hex，清单里仍然不写成规格。插件里的具体填色是实现选择，写在对齐清单的落地记录里。
- 草案点名的本机对照图（`/workspace/maid-atelier-target-ref.png` 等）不在本仓库。没有浏览器里的 Electron 对照，管理员主观「是同一工台」不勾。
- P4（弃用 OpenClaw 生产壳）没做。并行期仍然有效。
