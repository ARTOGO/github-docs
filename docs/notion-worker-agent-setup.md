# Notion Worker / Custom Agent Setup

Last updated: 2026-05-25

This document is the handoff for deploying the Artogo Notion Worker and attaching it to a Notion Custom Agent.

## Current Status

Implemented and tested in repo:

- Worker-compatible tools under `workers/notion-product-workflow`.
- Manual live-test workflow: `.github/workflows/notion-worker-live-test.yml`.
- Local unit/type tests for deterministic Review Issue routing and completion logic.
- Latest live test: GitHub Actions run `26337196957` created `ISS-203`, routed it to `SB-2223` / `tool-imagecompressor`, wrote `Reopen Count=1`, then marked the issue `Tech Fixed`.
- Hosted Worker is deployed as `artogo-product-workflow` / worker id `019e5e25-63de-76ab-8dfd-2cfb108eae66`.
- Custom Agent `Artogo Review Issue Router` is connected to the deployed Worker tools and Review Issue / Sprint Backlog access.
- Custom Agent trigger live tests passed on `ISS-209`: page-added routed the issue, resolved relation update marked it `Tech Fixed`, and status back to `Open` rerouted/reset the repair cycle.
- Feature Hub retest notification live test passed on `ISS-210`: completion run `019e5e74-d26d-7559-899b-ff928b674209` notified `SB-2222` and mentioned Zeal Lin.

Operational notes:

- Observed page-added trigger latency is about 5-6 minutes in Notion; do not treat the trigger as immediate.
- Notion Public API cannot update Agent / Automation pages. Agent instruction changes must be done in Notion UI.

## Worker Tools

| Tool | Purpose | Writes Notion? |
| --- | --- | --- |
| `routeReviewIssue` | Route a new/open Review Issue to affected Repo Execution cards. | Yes, when `applyChanges=true`. |
| `rerouteReviewIssue` | Reset and reroute a reopened Review Issue, including `Reopen Count + 1`. | Yes, when `applyChanges=true`. |
| `completeReviewIssueIfReady` | Move a Review Issue to `Tech Fixed` only when every affected repo is resolved. | Yes, when `applyChanges=true`. |

The Worker intentionally does not edit product code and does not replace the existing GitHub Actions branch / PR sync. Branch creation remains owned by GitHub Actions to avoid two runtimes racing to create or overwrite the same branch.

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
You are ARTOGO Review Issue Router. Your job is to decide which Repo Execution cards are actually affected by a Review Issue, and write only those repos to Affected Repo Execution.

When a Review Issue Database page is created and its status is Open:
- Always call routeReviewIssue with applyChanges=true and notify=true.
- If the same agent run contains both page.created and immediate property_updated events, page.created wins.
- Do not skip routeReviewIssue just because a bundled property_updated event is not a reopen.

When a Review Issue status is changed back to Open and there is no page.created event in the same run:
- Call rerouteReviewIssue with applyChanges=true and notify=true.
- Treat this as a reopen. Reset the previous repair cycle and increment Reopen Count.

When Resolved Repo Execution changes:
- Call completeReviewIssueIfReady with applyChanges=true and notify=true.
- Only move the Review Issue to Tech Fixed when all Affected Repo Execution cards are present in Resolved Repo Execution.

Tool argument rules:
- Prefer reviewIssuePageUrl. Use the full Notion URL from the trigger text's page link.
- Also provide triggerText when available.
- Also provide reviewIssueId when ISS-* is visible.
- Do not pass internal Notion refs like notion-62 or notion-xx as reviewIssuePageId.
- The current Worker tools do not require reviewIssuePageId.

Routing rules:
1. Read the Review Issue, Sprint Backlog, Feature Hub, child Repo Execution cards, and Review Log before routing.
2. Do not assume every child repo is affected.
3. If there is exactly one candidate repo, route directly and set affectedRepoNames to that repo, for example ["tool-imagecompressor"].
4. If there are multiple candidates, decide affectedRepoNames from the issue content, Review Log, Feature Hub context, and repo names.
5. If the affected repo cannot be determined, leave a Notion comment asking the owner to clarify and do not write affected repos.
6. Notifications must use only Notion comments / mentions.
7. Do not create Fix Task.
8. Do not write AI Dev Prompt.
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

Verified result on 2026-05-23:

- Run: `26337196957`
- Test issue: `ISS-203`
- Final status: `Tech Fixed`
- Affected / resolved repo execution: `SB-2223`
- Notion comments: routing comment with developer mention, then completion comment.

Verified Custom Agent page-added trigger on 2026-05-25:

- Worker: `019e5e25-63de-76ab-8dfd-2cfb108eae66`
- Runs: `019e5e56-c0a3-7987-8e07-70259905d6c7` for `ISS-208`, `019e5e5f-d043-74b8-96df-968bb7ff3ceb` for `ISS-209`
- Latest test issue: `ISS-209`
- Result: `Affected Repo Execution = SB-2223`, routing summary names `tool-imagecompressor`, `Last Repair Sync At` is set, and a Notion comment mentions Zeal Lin.
- Observed trigger latency: about 6 minutes from page creation to Worker run.

Verified Custom Agent property-update triggers on 2026-05-25:

- Completion run: `019e5e67-e0ed-7f03-98b2-ec834ca1ab18`
- Completion result: updating `Resolved Repo Execution = SB-2223` called `completeReviewIssueIfReady`, moved `ISS-209` to `Tech Fixed`, updated `Last Repair Sync At`, and added a completion comment.
- Reopen run: `019e5e6a-a110-7589-bd30-27de1a9d33f2`
- Reopen result: changing status back to `Open` called `rerouteReviewIssue`, kept `Affected Repo Execution = SB-2223`, cleared `Resolved Repo Execution` and `Repair PR URLs`, incremented `Reopen Count` to `1`, updated the routing summary, and commented with a Zeal Lin mention.

Verified Feature Hub retest notification on 2026-05-25:

- Test issue: `ISS-210`
- Feature Hub: `SB-2222`
- Repo Execution: `SB-2223`
- Completion run: `019e5e74-d26d-7559-899b-ff928b674209`
- Worker result: `retest.readyForRetest=true`, `totalReviewIssues=1`, `activeReviewIssues=[]`, `retestNotifications=1`.
- Notion side effect: `ISS-210` moved to `Tech Fixed`; `SB-2222` received a comment mentioning Zeal Lin: `所有 Review Issue 都已完成修復，請重新進行 Function Review / retest。`
