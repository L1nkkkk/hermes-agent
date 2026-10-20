# Maid Atelier click inventory

Route: `#/atelier` (`apps/desktop/src/plugins/maid-atelier/`). Snapshot after PR #5, which made the mounted route look like the Control window (full-bleed charcoal frame, host sidebar / statusbar / titlebar clusters hidden). This file is a wiring-sprint board. It does not change handlers.

OpenClaw remains the production Maid Atelier. Hermes Desktop is pre-release. Hypotheses below are labeled **Hypothesis** and are not a claim that OpenClaw behaves that way.

## Evidence

Read for this inventory:

- `plugin.tsx`, `window-chrome.ts`, `atelier.css` — route chrome
- `rail.tsx`, `desk.tsx`, `reader.tsx`, `workbench.tsx`, `actions.ts`, `feeds.ts`, `gateway.ts`, `paths.ts`, `copy.ts`
- Host seams the frame covers or could call later: `app/shell/titlebar.ts`, `app/shell/wslg-window-controls.tsx`, `app/shell/titlebar-controls.tsx`, `components/notifications.tsx`, `app/chat/composer/model-pill.tsx`, `lib/desktop-fs.ts`, `electron/preload.ts` (`readFileText` → `hermes:readFileText`; no general read on the `hermes:fs:*` channel)

Electron was not launched for this pass. This workspace has no `apps/desktop/node_modules`, and a cold Desktop launch on this VM does not start a gateway (same constraint called out on PR #5). Classification is from the components. The existing `workbench.test.tsx` cases already script the gateway for the paths marked “works when the gateway is up”; they were not re-run here.

Toasts from `host.notify` render at `z-index: var(--z-over-modal)` (200). The atelier frame is `z-index: 100`, so those toasts paint above the workbench. A `notify` call is treated as visible feedback.

## How to board a row

| Bucket | Meaning |
| --- | --- |
| 1. Dead | The control is on screen and accepts a click (or is styled as one), and the click has no handler, or the handler returns without feedback. |
| 2. Disabled on purpose | `disabled` (and, where noted, a title) matches an empty or unavailable state. Leave it. |
| 3. Silent when the gateway is down | A handler runs, then a failed RPC is swallowed. The UI keeps the previous content or shows an empty label. |
| 4. Works | Local state updates, or the named RPC runs when `gatewayOpen` is true. |

Priority: **P0** blocks the window or shows the wrong session with no feedback. **P1** is the next wiring pass. **Later** is polish, or it waits on a real path.

## P0

1. **No way out of the frame, and the in-page window caption is covered.** Entering `#/atelier` hides the host sidebar, statusbar, and titlebar clusters and paints a `position: fixed; inset: 0; z-index: 100` layer. When Desktop paints its own min / max / close (`customWindowControls`), those buttons are `z-index: 80` and sit under the layer. There is no Back control inside the workbench. The command palette is `z-index: 200`, so a palette shortcut can still leave.
2. **Opening a session can keep the previous transcript.** `session.resume` failure only clears the goal. The rail shows the new row; the desk and reader keep the previous messages.

## P1

1. Model pill (reads `$currentModel`, no picker).
2. Reader find glyph (🔎), reader tab, and path crumbs.
3. Group title and project title are not hit targets (only the caret is).
4. **New group** / **Save workflow** / **Open workflow** do nothing useful when no profile loaded.
5. **Copy path** copies a session title when resume reported no workspace path, and clipboard failure is ignored.
6. Session-list and profile-list failures render as **No sessions** while the gateway state still says open.
7. **Send** with an empty composer is a silent no-op (the gateway-down case is a toast — that part is fine).

## Leave disabled

**Source** stays disabled. The reader body is session-resume Markdown. A safe file read already exists (`readDesktopFileText` → `hermes:readFileText`, remote `/api/fs/read-text`). Do not invent `/api/files/read`. Do not enable **Source** until the click has a path the session actually reported, not a title glued onto a directory.

---

## 1. Dead clicks

| Label on screen | Component | What the click does today | Hypothesis | Priority |
| --- | --- | --- | --- | --- |
| Reader tab (file glyph + leaf name, `📄` or `📝`) | `reader.tsx` `Reader` — `<span className="atelier-reader__tab">` | Not a button. No `onClick`. Tab chrome (border, radius, fill) is in `atelier.css` `.atelier-reader__tab`. | **Hypothesis:** one document, so the tab should be a static label until a second document exists. A close action would only clear local reader state. | P1 |
| `🔎` in the reader toolbar | `reader.tsx` — `<Emoji symbol="🔎" />` beside **Source** | Decorative. Not a button. | **Hypothesis:** find inside the reader. Desktop already has find-in-page (`src/store/find-in-page.ts`). Scope it to the reader pane. This does not read a file. | P1 |
| Path crumbs (`folder` / `file` marks and chevrons) | `reader.tsx` `.atelier-reader__path` — one `<span>` per crumb | Not buttons. `title` is `fullWorkspacePath(...)`. | **Hypothesis:** click reveals the real `readerPath` via `revealPath` in `src/lib/desktop-fs.ts` (`hermes:fs:reveal`, returns false when the path is not on this machine). Crumb text is only a tail (`paths.ts` `workspaceCrumbs`). Do not rebuild a path from the tail, and do not invent `manuscript/` segments. | P1 |
| Model pill (`✨` + chip mark + model name, or **No model**) | `desk.tsx` `Desk` — `<span className="atelier-model">` | Reads `$currentModel`. Not a button. No `cursor: pointer`. The pill fill matches a control. | **Hypothesis:** open the existing picker with `setModelPickerOpen(true)`, same as `app/chat/composer/model-pill.tsx`. The picker dialog sits above `z-index: 100`. Catalog data still depends on the gateway. | P1 |
| Group name (the text, not the caret) | `rail.tsx` `GroupBranch` — `<span className="atelier-row__name">` | Caret (`Twist`) expands and collapses. The name has no handler. | **Hypothesis:** the row should call the same `onFold` as the caret. Groups are local profile lists (`desk-store.ts`), not gateway rooms. | P1 |
| Project name (the text, not the caret) | `rail.tsx` `ProjectNode` | Same split: caret toggles, label does not. | **Hypothesis:** same `onFold` as the caret. Do not treat the label as a file open. | P1 |
| **New group** when no profile is loaded | `rail.tsx` `GroupSave` → `workbench.tsx` `onSaveGroup` | Submit with a non-empty name returns immediately when `ownerId` is null. No toast. Button stays enabled. | **Hypothesis:** disable the form, or toast, when `profiles` is empty. Creating the group is local storage either way (`writeDesk`). | P1 |
| **Save workflow** when no profile is loaded | `rail.tsx` `WorkflowSave` → `onSaveWorkflow` | Same early return. The stored record is `{ id, title, memberIds }` only. | **Hypothesis:** same as **New group**. Opening a workflow does not start a run; see bucket 4. | P1 |
| **New group** / **Save workflow** with an empty name | `GroupSave` / `WorkflowSave` | Submit handler ignores a blank title. No disabled state. | **Hypothesis:** disable the button until the field has text. | Later |
| **Send** with an empty composer | `desk.tsx` submit button → `actions.ts` `sendComposer` | Returns `{ kind: 'empty' }`. `sendCurrent` in `workbench.tsx` ignores that kind. Button stays enabled. | **Hypothesis:** disable **Send** while the trimmed composer is empty. | P1 |
| Saved workflow row when its first member id is missing | `rail.tsx` workflow `<button>` → `openWorkflow` | `openWorkflow` returns when `memberIds[0]` is missing. No toast. | **Hypothesis:** drop the row on read, or toast. A normal saved workflow (owner present in `profiles`) does switch the desk — bucket 4. | Later |

## 2. Disabled on purpose

| Label | Component | Why it is disabled | Priority |
| --- | --- | --- | --- |
| **Source** | `reader.tsx` — `disabled`, `title` = `COPY.readerSourceHint` (“Session log only. No file is read.”) | The body is `transcriptMarkdown` from `session.resume` (`feeds.ts` `paintTranscript`). `workbench.test.tsx` asserts the button stays disabled. A safe read exists for other Desktop surfaces: `readDesktopFileText` → `hermes:readFileText` (local) and `/api/fs/read-text` (remote). There is no atelier call, and there must be no `/api/files/read`. | Leave disabled. A later patch may enable it only when the session reported a real file path and the read goes through `readDesktopFileText`. A title appended to a directory (`fullWorkspacePath`) is not that path. |
| **Copy path** when nothing is open | `reader.tsx` — `disabled={!fullPath}` | `fullPath` is `''` when both the workspace path and the title are empty. Disabled styling is in `.atelier-reader__copy:disabled`. No title string. | Leave disabled in the empty reader. The enabled-but-wrong case is in bucket 1’s neighbor below (bucket 3 / P1). |
| **Draft line** when every other profile is already in the room, or there is no other profile | `desk.tsx` — `disabled={candidates.length === 0}`, `title` = **No other agent to draft** | `draftCandidates` excludes the owner and current members. The enabled button only inserts composer text (`COPY.draftHint`: “Drafts a line in the composer. It does not invite the agent.”). | Leave disabled. The enabled path is bucket 4. |
| **In room {name}** on the owner row | `rail.tsx` `ProfileBranch` checkbox — `disabled` when `profile.id === ownerId`, kept checked | The owner is always a desk member (`maidRoom`). | Leave disabled. |

## 3. Wired, silent when the gateway is down

| Label | Component | Failure | Hypothesis | Priority |
| --- | --- | --- | --- | --- |
| Session row (title + presence) | `rail.tsx` `SessionRow` → `setSessionId` → `feeds.ts` resume | Click updates `sessionId` immediately. `resume` `catch` only calls `setGoal(null)`. Messages, reader title, crumbs, and body stay on the previous session. The 4s poll can heal a later success; a hard failure never toasts. First open from an empty desk stays on **No log**, which reads as an empty session. | **Hypothesis:** on failure, clear the transcript or keep the previous selection, and toast. `COPY` has no resume-failed string yet. | P0 for a switch that shows the wrong transcript. P1 for a first open that looks empty. |
| Manuscript row (title, sometimes **Refine**) | `rail.tsx` `WorkSteps` → `onOpenManuscript` = `setSessionId` | Same resume path. **Refine** is a `<span>` inside the button, not a second action. The row is absent when `sessions` is empty, so it is not on screen during a cold gateway-down launch. | **Hypothesis:** same error surface as the session row. **Refine** stays a badge until a real refine action exists. | P0 (same stale transcript) |
| Maid row | `rail.tsx` `ProfileBranch` → `setOwnerId` + `listSessions` / `listProjects` | Selection is local. `listSessions` `catch` sets `[]`. The tree then says **No sessions** (`COPY.noSessions`) whenever `gatewayOpen` is still true. **Gateway unavailable** is only when `profiles.length === 0` and `gatewayOpen` is false. `listProjects` `catch` drops folders; sessions stay as a flat list (`paths.ts` `groupSessions`). | **Hypothesis:** a failed list should use the gateway-down empty state, including when the gateway atom still says `open`. | P1 |
| **Maids** empty state after `profiles.list` throws | `feeds.ts` `catch` → `setProfiles([])`; `rail.tsx` empty copy | Throw while `gatewayOpen` is true shows **No sessions**, not **Gateway unavailable**. | **Hypothesis:** remember the list error separately from an empty roster. | P1 |
| **Copy path** | `reader.tsx` | Enabled when `fullWorkspacePath` is non-empty. With no `readerPath`, that function returns the session title (`paths.ts`), so the button copies the title. `navigator.clipboard?.writeText` ignores a missing API and a rejected promise. No toast. | **Hypothesis:** disable unless `readerPath` is non-empty, and toast on clipboard failure. Copy the gateway path string only. Do not read the file. | P1 |
| Workflow row while `profiles` failed to load | `openWorkflow` | Sets `ownerId` and local members, then clears `sessionId`. `owner` is `profiles.find(...)`, so a failed roster leaves the desk on the **Atelier** fallback and loads no sessions. | **Hypothesis:** no-op with a toast when that profile is not in the loaded roster. | P1 |

`prompt.submit` / mention failures are not in this bucket. They toast (**Connect to the Gateway…**, **Could not send this turn to {name}.**). See bucket 4.

## 4. Wired, and works when its dependency is up

### Local (no gateway call on the click)

| Label | Component | Result |
| --- | --- | --- |
| **Search** | `rail.tsx` search input | Filters loaded profile and session titles in memory. |
| **Groups**, **Maids**, **Work queue**, **Workflows** | `rail.tsx` `Section` | Collapses that section. |
| Expand / Collapse caret | `rail.tsx` `Twist` | Folds a group, a selected profile’s sessions, or a project bucket. |
| **In room {name}** (not the owner) | `ProfileBranch` checkbox | Toggles `records.members`. Two agents make the desk a group room (`maidRoom`). Does not create a gateway room. Hermes has no cross-profile parent session (`routing.ts`). |
| **Group {name}** `<select>` | `ProfileBranch` | Moves the selected profile among local groups. Shown only when that profile is selected and a group exists. |
| **New group** / **Save workflow** with an owner loaded | `GroupSave` / `WorkflowSave` | Appends to plugin storage (`desk` key). |
| Workflow row when `memberIds[0]` is a loaded profile | `openWorkflow` | Selects that profile, clears the session, restores the other member ids. Does not call `prompt.submit`. **Hypothesis (later):** a “run” would be a new gateway action; the saved record has no prompt. |
| **Change {name}'s face**, face grid, **Close** | `desk.tsx` | Writes `records.faces`. Works with the gateway down (the You face is always in the room). |
| **Draft line** and a name in the draft menu | `desk.tsx` → `draftLine` | Inserts `Pull {name} into this conversation.` and closes the menu. Does not check **In room**. Covered by `workbench.test.tsx`. |
| **Agents in this group** (`@{name}`) | `desk.tsx` mention list | Inserts the mention into the composer. |
| **Add a step** (Enter) and the step checkboxes on the desk and in **Work queue** | `desk.tsx` `StepAdd` / `TaskLog`, `rail.tsx` `WorkSteps` | Writes `progress:${sessionId}` through `progress-store.ts`. Needs a selected session id. Missing session or a failed read-back toasts **Could not save this step on the progress card.** `data-readonly-label` on the rail checkbox has no CSS and does not block the click. |
| Composer | `desk.tsx` textarea | Local text and caret. |

### Needs the gateway up

| Label | RPC | Result when the call succeeds |
| --- | --- | --- |
| Sidebar **Atelier** | route `/atelier` | Mounts the page. Hidden again once the frame claims the window (bucket P0). |
| Command palette **Open Maid Atelier** | `host.navigate('/atelier')` (`plugin.tsx`) | Same route. Palette overlay is above the frame, so this item can still run after entry. |
| Maid list | `profiles.list` | Rows from `parseProfile`. First row becomes the owner. |
| Session rows under the selected maid | `session.list`, `session.active_list` | Titles, ages, busy/idle. `busy === null` (active list failed) renders as unknown, not idle. |
| Project folder | `projects.tree` | Buckets only sessions the tree named. Otherwise sessions group by `git_repo_root` or `cwd`. |
| Session row / manuscript row | `session.resume`, `session.control.read` | Messages, goal, running flag, reader Markdown, crumbs from the resume cwd or the listed `cwd` / `git_repo_root`. Polls every 4s. |
| **Send** in a DM, non-empty, session selected | `prompt.submit` (retries `session.resume` once if the stored id is stale) | Toast is not used. The line is echoed locally, then the next resume replaces the thread. Gateway down: toast **Connect to the Gateway to send this turn to {name}.** No session: toast **Could not send this turn to {name}.** |
| **Send** with `@Name` in a group room | `session.create` (`source: 'desktop'`) or the profile’s main / canonical session, then `prompt.submit` | Toast **Sent this turn to {name}. The reply stays in that agent's session.** The room transcript does not gain the reply (`routing.ts`). Gateway down: the offline toast. RPC throw: **Could not send this turn to {name}.** |
| **Copy path** when resume or the session row supplied a workspace path | `navigator.clipboard.writeText` of `fullWorkspacePath` | No RPC on click. The string can be `cwd` plus a manuscript-like title (`paths.ts`). That concatenation is not a verified file. Clipboard errors: bucket 3. |
| You **Online** / **Offline** | none on click | Status only. `gatewayOpen` chooses online `#6fbf8a` vs blocked `#d4546a`. Not a button. |

## Status chrome (no click handler, and no pointer affordance)

Do not board these as dead buttons. They are `role="status"`, `aria-hidden`, or plain text.

| What you see | Where | Note |
| --- | --- | --- |
| Progress pill (**Atelier progress**, **No goal**, **Process n/m**) | `desk.tsx` `ProgressChip` | `role="status"`. |
| Goal strip (🎯 / ✅, goal sentence, process fraction) | `desk.tsx` `GoalStrip` | `aria-hidden`. |
| **You** + **Online** / **Offline** | `rail.tsx` footer | Not a button. |
| Desk title (`💬` + room name) | `desk.tsx` `<h1>` | Not a button. |
| Message rows | `desk.tsx` `MessageRow` | No hover control style. Reader Markdown is plain text (`markdown-view.tsx`); URLs are not links. |
| Empty lines (**No log**, **No checklist**, **No workflows**, **No file**) | rail, desk, reader | Copy only. |

**Hypothesis (later):** a goal action would use the existing session-control client (`runSessionControlAction` / `session.control.read`, which atelier already reads). The strip does not advertise a click today.

## Chrome this route takes over

| Host control | Where it lives | While `#/atelier` is mounted |
| --- | --- | --- |
| Sessions sidebar, including the **Atelier** nav item | `[data-sidebar='sidebar']` | `display: none`. `bindAtelierWindow` also closes the pane if it was open, and restores that on release / `pagehide`. |
| Status bar | `[data-slot='statusbar']` | `display: none`. |
| Titlebar tools (sidebar toggle, settings, layout, and the rest of `TitlebarControls`) | `[data-titlebar-cluster]`, `z-index: 70` | `display: none`, and underneath the frame. Atelier does not register `titleBar.*`, so the host would otherwise have kept these controls (`hidesFixedTitlebarClusters` yields only when the page mounts titlebar chrome). |
| Minimize, Maximize / Restore, Close | `WslgWindowControls`, `z-index: 80`, mounted only when `customWindowControls` is set. Main window uses `titleBarStyle: 'hidden'`. | Painted over by `.atelier` (`z-index: 100`). No replacement buttons in the plugin. macOS traffic lights are outside this component. |
| Command palette, toasts | `z-index: 200` | Still reachable. Palette is the only in-app exit that does not require the covered caption buttons. |

**Hypothesis (P0):** keep a drag strip and the caption buttons above the frame, and add a visible Back that navigates off `/atelier` so `bindAtelierWindow`’s release runs. Do not reimplement min / max / close; call the existing `window.hermesDesktop.windowControls` bridge.

## Out of scope for the wiring sprint

- Enabling **Source** without a session-reported file path.
- Any new `/api/files/read` (or a manuscript path that was not in `session.resume` / `session.list`).
- Pretend sessions, projects, or face URLs. Faces stay the local crops in `faces/`.
- Turning a local group or workflow into a gateway room. That needs a real group API; the stored records are profile-id lists.
