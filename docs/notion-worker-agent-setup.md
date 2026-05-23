# Notion Worker / Custom Agent Setup

Last updated: 2026-05-23

This document is the handoff for deploying the Artogo Notion Worker and attaching it to a Notion Custom Agent.

## Current Status

Implemented in repo:

- Worker-compatible tools under `workers/notion-product-workflow`.
- Manual live-test workflow: `.github/workflows/notion-worker-live-test.yml`.
- Local unit/type tests for deterministic Review Issue routing and completion logic.

Blocked outside repo automation:

- Hosted Notion Worker deployment requires `ntn login` with an eligible workspace member.
- Custom Agent creation / trigger setup is currently done in Notion web or desktop UI, not through the available MCP connector.

## Worker Tools

| Tool | Purpose | Writes Notion? |
| --- | --- | --- |
| `routeReviewIssue` | Route a new/open Review Issue to affected Repo Execution cards. | Yes, when `applyChanges=true`. |
| `rerouteReviewIssue` | Reset and reroute a reopened Review Issue, including `Reopen Count + 1`. | Yes, when `applyChanges=true`. |
| `completeReviewIssueIfReady` | Move a Review Issue to `Tech Fixed` only when every affected repo is resolved. | Yes, when `applyChanges=true`. |

The Worker intentionally does not edit product code and does not replace the existing GitHub Actions PR sync.

## Deploy Worker

Run from repo root:

```bash
cd workers/notion-product-workflow
npm ci
npm run typecheck
npm test
../../.tools/ntn login
../../.tools/ntn workers deploy --name artogo-product-workflow --local-build --no-git
../../.tools/ntn workers env set NOTION_API_TOKEN=<notion-token-with-review-db-access>
../../.tools/ntn workers env set REVIEW_ISSUE_DB_ID=<review-issue-db-id>
```

Then confirm the deployed capabilities:

```bash
../../.tools/ntn workers capabilities list
../../.tools/ntn workers exec routeReviewIssue -d '{"reviewIssuePageId":"<page-id>","affectedRepoNames":["tool-imagecompressor"],"applyChanges":false}'
```

## Custom Agent Setup

Create one Custom Agent in Notion:

- Name: `Artogo Review Issue Router`
- Model: Auto
- Tools and access:
  - Add `Review Issue Database`.
  - Add `Sprint Backlog`.
  - Add the deployed Worker tools:
    - `routeReviewIssue`
    - `rerouteReviewIssue`
    - `completeReviewIssueIfReady`

Triggers:

| Trigger | Condition | Agent action |
| --- | --- | --- |
| Review Issue page added | `狀態 = Open` | Read issue, Sprint Backlog, Feature Hub and child Repo Executions. Decide affected repos. Call `routeReviewIssue` with `applyChanges=true`. |
| Review Issue page updated | `狀態` changed to `Open` | Treat as reopen. Re-evaluate affected repos. Call `rerouteReviewIssue` with `applyChanges=true`. |
| Review Issue page updated | `Resolved Repo Execution` changed | Call `completeReviewIssueIfReady` with `applyChanges=true`. |

Agent instruction:

```text
你是 Artogo Review Issue Router。你的責任是判斷 Review Issue 真正牽涉的 Repo Execution，並只把需要修復的 repo 寫入 Affected Repo Execution。

規則：
1. 先讀 Review Issue、Sprint Backlog、Feature Hub、child Repo Execution 與 Review Log。
2. 不要預設所有 child repos 都需要修。
3. 若只有一個 candidate repo，可直接 route。
4. 若有多個 candidate repo，根據 issue 內容、Review Log、Feature Hub context 判斷 affectedRepoNames。
5. 若無法判斷，留下 Notion comment 請負責人補充，不要亂寫 affected repos。
6. 新 issue 或 Open issue 呼叫 routeReviewIssue。
7. Reopen issue 呼叫 rerouteReviewIssue，必須清空上一輪 Resolved Repo Execution / Repair PR URLs 並增加 Reopen Count。
8. Resolved Repo Execution 更新後呼叫 completeReviewIssueIfReady；只有全部 affected repos 都 resolved 時才能改 Tech Fixed。
9. 通知只使用 Notion comment / mention，不使用 Slack。
10. 不建立 Fix Task，不寫 AI Dev Prompt。
```

## Live Test

Use the manual GitHub workflow after pushing this repo:

```bash
gh workflow run notion-worker-live-test.yml --ref main --repo ARTOGO/github-docs
gh run list --repo ARTOGO/github-docs --workflow "Notion Worker Live Test" --limit 1
```

Expected result:

- A `[TEST][Codex] Worker routing live test ...` Review Issue is created.
- `rerouteReviewIssue` writes `Affected Repo Execution`, clears old repair state, increments `Reopen Count`, and comments with a mention.
- `completeReviewIssueIfReady` moves the test issue to `Tech Fixed`.
