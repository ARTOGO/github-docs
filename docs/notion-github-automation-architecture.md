# Notion x GitHub Automation Architecture

Last updated: 2026-05-21

This document describes the current `Review Issue` direct-repair architecture. The previous `Review Issue -> Review Fix Task -> FIX-* branch` model is legacy only and should not be used for new automation.

## Goals

- Keep Notion as the workflow and status source of truth.
- Keep `github-docs` as the shared automation control plane.
- Keep product code changes inside product repos.
- Use `Feature Hub` for function-level review coordination.
- Use `Repo Execution` for repo-level branch and PR automation.
- Use `Review Issue` as the direct repair entrypoint.
- Avoid automatically creating branches for repos that are not actually affected by a review issue.

## Core Data Model

| Layer | Purpose | Automation role |
|---|---|---|
| Product Backlog | Product requirement source | Not directly automated by repo workflows |
| Sprint Backlog / `Feature Hub` | Function-level coordination | Review Log / Review Issue anchor, rollup target, cascade source |
| Sprint Backlog / `Repo Execution` | Repo-level execution | Branch, PR, tech review, function review |
| Sprint Backlog / `Stage/Admin` | Manual project/admin work | Not a repo automation target |
| Review Log | Review session / review round | Explains review context and links produced issues |
| Review Issue | Function-level problem and repair controller | Stores impacted repos, repair PRs, and completion |
| Review Fix Task | Historical repair-task database | Legacy data only |

## Review Issue Repair Fields

`Review Issue` owns repair routing and completion directly:

- `Affected Repo Execution`: repo execution cards selected for repair.
- `Resolved Repo Execution`: repo execution cards whose repair PRs have merged.
- `Repair Routing Summary`: routing rationale and confidence notes.
- `Repair PR URLs`: PR links for one or more repos.
- `Last Repair Sync At`: last GitHub write-back time.
- `Reopen Count`: number of times the issue was reopened.

Completion rule:

```text
Resolved Repo Execution covers all Affected Repo Execution
```

Only then may automation move the issue to `Tech Fixed`.

## Active GitHub Workflows

### Branch Creation

File: `.github/workflows/notion-create-branch-reusable.yml`

Responsibilities:

- Query Sprint Backlog for `Card Type = Repo Execution`.
- Create missing `SB-*` branches for `NOT STARTED` / `DEV IN PROGRESS`.
- Write back `GitHub Branch`.
- Handle individual `Repo Execution` `FUNC REVIEW FAILED` by notifying the developer / assignee and resetting that card to `DEV IN PROGRESS`.

Removed responsibilities:

- `AI Dev Prompt` generation.
- Anthropic-powered slug / prompt generation.
- `Fix Task` branch creation.
- `Won't Fix` branch cleanup.

### PR Sync

File: `.github/workflows/notion-pr-sync-reusable.yml`

Responsibilities for `SB-*` branches:

- PR opened / reopened -> `PR Status = Open`, `任務狀態 = TECH REVIEW`.
- `review_requested` -> `TECH REVIEW`.
- GitHub review comment or changes requested -> `DEV IN PROGRESS`.
- PR closed without merge -> `DEV IN PROGRESS`.
- PR merged to staging -> `STAGING FUNC REVIEW`.
- PR merged to main / master -> `PROD FUNCTION REVIEW`.
- Roll up Feature Hub status when all child `Repo Execution` cards reach the same review level.

Responsibilities for `ISS-*` branches:

- Find the matching `Review Issue`.
- Set issue to `Fixing` while repair PRs are active.
- Write / preserve `Repair PR URLs`.
- Write `Last Repair Sync At`.
- On merge, append the matching repo card to `Resolved Repo Execution`.
- If all affected repos are resolved, move issue to `Tech Fixed` and notify functional reviewers.

### Feature Hub Cascade

File: `.github/workflows/notion-feature-hub-cascade.yml`

Responsibilities:

- `Feature Hub -> FUNC REVIEW FAILED`: reset all child `Repo Execution` cards to `DEV IN PROGRESS`.
- `Feature Hub -> DONE`: cascade `DONE` to child `Repo Execution` cards.
- `Feature Hub -> ABANDONED`: cascade `ABANDONED` to child `Repo Execution` cards.

This cascade is scheduled, not run separately by every product repo.

## Product Repo Callers

Each product repo keeps lightweight caller workflows:

- `.github/workflows/notion-create-branch.yml`
- `.github/workflows/notion-pr-sync.yml`

The current known caller repos are:

- `backend`
- `officialwebsite`
- `guide-tool`
- `mailtemplate`
- `tool-imagecompressor`

Caller workflows should pass only the active secrets:

- `NOTION_API_KEY`
- `NOTION_DATABASE_ID`
- `REVIEW_ISSUE_DB_ID` for PR sync

They should not pass:

- `ANTHROPIC_API_KEY`
- `FIX_TASK_DB_ID`

## User Flow

### Normal Development

1. PM / developer creates a Sprint Backlog card.
2. If `Card Type = Repo Execution`, the relevant product repo creates an `SB-*` branch.
3. If `Card Type = Feature Hub`, no branch is created.
4. Developer opens a PR from the `SB-*` branch.
5. GitHub PR events update the `Repo Execution` card.
6. Tech review comments or changes requested move the card back to `DEV IN PROGRESS`.
7. Re-requested review moves the card back to `TECH REVIEW`.
8. Merge to staging or production review branches moves the card into the matching function review state.
9. Feature Hub rollup updates when all child repo cards are ready.

### Function Review Failed

1. Reviewer marks a `Feature Hub` as `FUNC REVIEW FAILED`.
2. The cascade workflow resets all child `Repo Execution` cards to `DEV IN PROGRESS`.
3. Each child developer / assignee is notified in Notion.

### Review Issue Repair

1. Tester creates or reopens a `Review Issue` on the `Feature Hub`.
2. Agent / Worker routing decides the affected repos.
3. Routing writes `Affected Repo Execution` and `Repair Routing Summary`.
4. Developer or coding agent opens repair branches in the affected product repos:

   ```text
   fix/ISS-<issue_number>_<english_snake_case_title>
   ```

5. Repair PR URLs are written back to the issue.
6. GitHub PR events for `ISS-*` branches update the issue.
7. Merged repair PRs populate `Resolved Repo Execution`.
8. When all affected repo executions are resolved, the issue moves to `Tech Fixed`.
9. Functional reviewer verifies and manually closes the issue as `Fixed`.

## Status Rules

### Review Issue

Current live status values include:

- `Open`
- `Post-Launch`
- `To Be Confirmed`
- `Fixing`
- `Tech Fixed`
- `Fixed`
- `Duplicate`
- `Won't Fix`

Automation should treat at least these as terminal:

- `Fixed`
- `Duplicate`
- `Won't Fix`

### PR Backward Guard

General PR events should not move these states backward:

- `STAGING FUNC REVIEW`
- `PROD FUNCTION REVIEW`
- `DONE`
- `ABANDONED`
- `DEPLOY PENDING`
- `PHASED DONE`

Explicit failure or reopen flows may still reset work to `DEV IN PROGRESS`.

## Notion Platform Direction

The target long-term shape is:

- Notion Custom Agents trigger Notion-native events.
- Notion Worker tools handle deterministic routing, rollup, and notification target resolution.
- Notion Worker webhooks handle GitHub -> Notion write-back.
- Coding agents and product repo CI handle actual code edits, tests, commits, and PRs.

Current live automation is a hybrid runtime. GitHub Actions owns branch creation, PR sync, and Feature Hub cascade. Notion Worker / Custom Agent owns Review Issue routing, reroute, completion, and retest notification. Do not add a second Worker branch creator unless GitHub Actions ownership is intentionally retired first.

## Legacy Items

The following are no longer active automation concepts:

- `Review Issue -> Fix Task -> Fix Branch`.
- `FIX-*` repair branch parsing.
- `AI Dev Prompt`.
- `Review Fix Task` count-based completion.
- Anthropic prompt / slug generation inside branch workflow.

The legacy `Review Fix Task` database may remain available for historical data until the team archives or hides it.
