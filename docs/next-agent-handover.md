# Next Agent Handover

Last updated: 2026-05-21

This handover reflects the current `Review Issue` direct-repair model. Older `Review Fix Task`, `FIX-*`, and `AI Dev Prompt` flows have been removed from the active automation path.

## Current Source Of Truth

- Migration spec: `/Users/peterting/Documents/artogo/github-docs/docs/review-issue-ai-routing-migration.md`
- Architecture summary: `/Users/peterting/Documents/artogo/github-docs/docs/notion-github-automation-architecture.md`
- Product architecture skill: `/Users/peterting/Documents/artogo/github-docs/shared-skills/notion-product-architecture/SKILL.md`
- Repair execution skill: `/Users/peterting/Documents/artogo/github-docs/shared-skills/fix-sprint-review-issues/SKILL.md`
- Current state reference: `/Users/peterting/Documents/artogo/github-docs/shared-skills/notion-product-architecture/references/current-state.md`

## Active Model

- `Feature Hub`: function-level coordination and status rollup.
- `Repo Execution`: repo-level branch, PR, tech review, and function review execution.
- `Review Log`: review session / review round record.
- `Review Issue`: the only active repair entrypoint.
- `Review Fix Task`: legacy data only, not part of active automation.

Repair scope and completion now live directly on `Review Issue`:

- `Affected Repo Execution`: repos that need repair.
- `Resolved Repo Execution`: repos whose repair PRs have merged.
- `Repair Routing Summary`: why those repos were selected.
- `Repair PR URLs`: related repair PRs.
- `Last Repair Sync At`: last GitHub / workflow write-back time.
- `Reopen Count`: reopen tracking.

## Notion Data Sources

| Database | ID | Data Source |
|---|---|---|
| Sprint Backlog | `521b82edb2684897a36b4fd7fad412fd` | `collection://f16a2bd0-b855-4da9-8d68-273003c1ba11` |
| Product Backlog | - | `collection://0847fca7-b837-4496-84f7-b13e7463c90d` |
| Review Issue | `a770832e338c4babae01cc74ffc9394a` | `collection://43a7a9ab-12f8-440f-8b79-fd8df7ac3e67` |
| Review Log | `ca4c8b1840e1413c9df3311d5c442a56` | `collection://b0186d1f-cae7-438b-a5be-59a6b01fbb73` |
| Review Fix Task | `1100423dc8ad42febd2fa1e442628e0d` | `collection://c1b86f00-8c8a-4b04-ba57-42cc9aa268e7` legacy only |

## Current Notion Schema Notes

Sprint Backlog no longer has:

- `AI Dev Prompt`
- `Fix Tasks` relation

Review Issue no longer has:

- `Fix Tasks` relation

Review Issue currently still uses `Fixed` as the terminal verified status. The migration spec names the target state `Verified`, but workflow logic must treat live `Fixed` as terminal until Notion status naming is changed.

## Active Workflows

### github-docs

| File | Trigger | Current responsibility |
|---|---|---|
| `.github/workflows/notion-create-branch-reusable.yml` | called by product repos | Create branches for `Repo Execution` cards in `NOT STARTED` / `DEV IN PROGRESS`; handle single `Repo Execution` `FUNC REVIEW FAILED` reset |
| `.github/workflows/notion-pr-sync-reusable.yml` | called by product repo PR events | Sync `SB-*` PR state to `Repo Execution`; roll up Feature Hub status; sync `ISS-*` repair PR state to `Review Issue` |
| `.github/workflows/notion-feature-hub-cascade.yml` | schedule + manual | Cascade Feature Hub `FUNC REVIEW FAILED`, `DONE`, and `ABANDONED` down to child `Repo Execution` cards |

Removed from active workflow:

- `.github/workflows/notion-review-fix-task-scheduler.yml`
- `FIX-*` repair branch model
- `AI Dev Prompt` generation
- Anthropic branch slug / prompt dependency
- `Fix Task` count-based completion

### Product Repos

These repos call the reusable workflows from `ARTOGO/github-docs@main`:

- `backend`
- `officialwebsite`
- `guide-tool`
- `mailtemplate`
- `tool-imagecompressor`

Their caller workflows should pass only:

- `NOTION_API_KEY`
- `NOTION_DATABASE_ID`
- `REVIEW_ISSUE_DB_ID` for PR sync

They should not pass `ANTHROPIC_API_KEY` or `FIX_TASK_DB_ID`.

## SB Branch Flow

1. `Repo Execution` card enters `NOT STARTED` or `DEV IN PROGRESS`.
2. Product repo caller invokes `notion-create-branch-reusable.yml`.
3. Workflow creates an `SB-*` branch and writes `GitHub Branch`.
4. Developer opens PR.
5. `notion-pr-sync-reusable.yml` handles PR events:
   - opened / reopened -> `TECH REVIEW`
   - `review_requested` -> `TECH REVIEW`
   - GitHub review comment or changes requested -> `DEV IN PROGRESS`
   - closed without merge -> `DEV IN PROGRESS`
   - merged to staging -> `STAGING FUNC REVIEW`
   - merged to main / master -> `PROD FUNCTION REVIEW`
6. Feature Hub rollup updates when all child `Repo Execution` cards reach the same review level.

## Review Issue Repair Flow

1. Tester creates `Review Issue` on the `Feature Hub`.
2. Notion / agent routing determines impacted repos.
3. Routing writes `Affected Repo Execution` and `Repair Routing Summary`.
4. Developer or coding agent repairs in each affected repo using branch format:

   ```text
   fix/ISS-<issue_number>_<english_snake_case_title>
   ```

5. Repair PR URLs are written to `Repair PR URLs`.
6. GitHub PR events for `ISS-*` branches write back to `Review Issue`.
7. Merged repair PRs append their repo card to `Resolved Repo Execution`.
8. When `Resolved Repo Execution` covers all `Affected Repo Execution`, the issue becomes `Tech Fixed`.
9. Functional reviewer verifies and manually moves the issue to `Fixed`.

## Feature Hub Cascade

- `Feature Hub -> FUNC REVIEW FAILED`: all child `Repo Execution` cards reset to `DEV IN PROGRESS`, each relevant developer / assignee is notified.
- `Feature Hub -> DONE`: child `Repo Execution` cards are cascaded to `DONE`.
- `Feature Hub -> ABANDONED`: child `Repo Execution` cards are cascaded to `ABANDONED`.
- Single `Repo Execution -> FUNC REVIEW FAILED`: only that repo card resets; sibling cards are not changed.

## Status Guards

PR and review events must not accidentally move terminal or advanced states backward. The guarded states include:

- `STAGING FUNC REVIEW`
- `PROD FUNCTION REVIEW`
- `DONE`
- `ABANDONED`
- `DEPLOY PENDING`
- `PHASED DONE`

Explicit failed / reopen flows are allowed to move work back to `DEV IN PROGRESS`.

## Open Follow-Ups

- Implement Notion Worker / Custom Agent pieces if the team chooses to move routing and GitHub write-back out of GitHub Actions.
- Decide whether to rename live Review Issue final status from `Fixed` to `Verified`.
- Archive or hide the legacy `Review Fix Task` database after migration confidence is high.
- Remove unused org secrets after all caller repos are deployed without `ANTHROPIC_API_KEY` / `FIX_TASK_DB_ID`.
