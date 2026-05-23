# Current State

Last validated: `2026-05-24`

This file captures the currently confirmed product Notion architecture for this repo. It is based on:

- live Notion MCP reads
- current workflow code in this repo
- representative live data source schemas

## Confidence level

Current understanding is high-confidence for the active workflow model.

- `Sprint Backlog` and `Review Issue` were validated against the live data source schema directly on `2026-05-21`.
- `Review Log` relationships remain consistent with earlier validated samples.
- `Review Fix Task` still exists as a legacy database, but it is no longer part of the active workflow model.
- Notion Worker-compatible Review Issue routing tools were implemented in `workers/notion-product-workflow` and live-tested through GitHub Actions run `26337196957`.

## Core databases

### Sprint Backlog

Live data source:

- `collection://f16a2bd0-b855-4da9-8d68-273003c1ba11`

Confirmed routing property:

- `Card Type`

Confirmed `Card Type` options:

- `Repo Execution`
- `Feature Hub`
- `Stage/Admin`

Other confirmed automation-relevant properties:

- `GitHub Repo`
- `GitHub Branch`
- `GitHub PR`
- `PR Status`
- `Tech Reviewer`
- `Developer`
- `Func. Reviewer`
- `Parent item`
- `Sub-item`
- `💦 Review Issue Database`
- `🔫 Review Log Database`

Notable cleanup already applied:

- `AI Dev Prompt` has been removed from live schema
- `🔧 Fix Tasks` has been removed from live schema

Important distinction:

- `Card Type` is the automation routing field
- `任務類型` is a separate business tagging field and does not define the parent/child automation model

### Review Issue Database

Live data source:

- `collection://43a7a9ab-12f8-440f-8b79-fd8df7ac3e67`

Confirmed active relation / repair properties:

- `Sprint Backlog`
- `Review Log`
- `Affected Repo Execution`
- `Resolved Repo Execution`
- `Repair Routing Summary`
- `Repair PR URLs`
- `Last Repair Sync At`
- `Reopen Count`

Confirmed role:

- function-level issue record
- direct repair entrypoint
- stores the explicit impacted repo set
- stores per-repo repair completion state

Notable cleanup already applied:

- `🔧 Fix Tasks` has been removed from live schema

Current live status values:

- `Open`
- `Post-Launch`
- `To Be Confirmed`
- `Fixing`
- `Tech Fixed`
- `Fixed`
- `Duplicate`
- `Won't Fix`

Important note:

- The migration spec uses `Verified` as the target naming for the final validated state.
- Live Notion still uses `Fixed` today, so workflow logic must treat `Fixed` as a terminal state until that rename is done.

### Review Log Database

Live data source:

- `collection://b0186d1f-cae7-438b-a5be-59a6b01fbb73`

Confirmed relation properties:

- `Sprint Backlog`
- `Review Issues`

Confirmed role:

- review-round / review-session record
- links the act of review back to Sprint Backlog
- aggregates one or more Review Issues

### Review Fix Task

Legacy data source:

- `collection://c1b86f00-8c8a-4b04-ba57-42cc9aa268e7`

Current role:

- historical / legacy review-fix tracking
- no longer part of the active repo automation model

Rule:

- do not design new workflow logic around this database
- treat it as migration residue until archived or hidden

## Relationship map

### Sprint Backlog -> Feature Hub / Repo Execution

- `Feature Hub` is the parent function-level coordination card
- `Repo Execution` is the child execution card for a specific repo
- the parent/child structure is represented using `Parent item` and `Sub-item`
- in workflow logic, an `SB-*` identifier may first resolve a Sprint Backlog page and then narrow to the matching `Repo Execution` child using `GitHub Repo` + `GitHub Branch`

### Sprint Backlog -> Review Log

- Sprint Backlog has a direct relation field to `Review Log Database`
- Review Log also points back to Sprint Backlog
- this makes Review Log the review-event layer attached to the product/work item

### Sprint Backlog -> Review Issue

- Sprint Backlog has a direct relation field to `Review Issue Database`
- Review Issue also points back to Sprint Backlog
- this makes Review Issue the problem-record and repair-entry layer attached to the product/work item

### Review Log -> Review Issue

- Review Log links to one or more `Review Issues`
- Review Issue links back to one `Review Log`
- practical interpretation: a review round produces one or more issues

### Review Issue -> Repo Execution

- `Affected Repo Execution` stores the repos that must be repaired for that issue
- `Resolved Repo Execution` stores the repos whose repair PRs have already merged
- practical interpretation: one function-level issue may require one or more repo-level fixes, but the repo set must now be explicit

## Practical model

Use this mental model when editing automation:

- `Feature Hub` = function-level coordination card
- `Repo Execution` = repo-level execution card
- `Review Log` = one review round / one review event
- `Review Issue` = one function-level issue and the direct repair control object

Do not use this mental model anymore:

- `Review Issue` -> `Fix Task` -> `Fix Branch`

## Workflow-sensitive implications

- Any automation that updates repo-specific review or PR state should target `Repo Execution` or `Review Issue`, not `Fix Task`
- Any automation that summarizes review outcomes should preserve the distinction between:
  - review session (`Review Log`)
  - issue records (`Review Issue`)
  - repo execution state (`Repo Execution`)
- `Affected Repo Execution` must be treated as the authoritative repair scope
- `Resolved Repo Execution` must be treated as the authoritative per-repo repair completion state
- If you flatten these layers, the model loses the ability to represent:
  - one review producing many issues
  - one issue touching many repos without blindly fan-out to all repos
  - one feature spanning multiple repos with explicit repair scope

## Worker / Agent implementation status

- Worker project: `workers/notion-product-workflow`
- Worker tools:
  - `routeReviewIssue`
  - `rerouteReviewIssue`
  - `completeReviewIssueIfReady`
- Live test evidence:
  - GitHub Actions run `26337196957`
  - Test Review Issue `ISS-203`
  - Routed to Repo Execution `SB-2223` / `tool-imagecompressor`
  - Wrote `Affected Repo Execution`, `Repair Routing Summary`, `Reopen Count=1`, `Resolved Repo Execution`
  - Final status became `Tech Fixed`
- Hosted Worker deploy still requires `ntn login` by an eligible workspace member.
- Custom Agent trigger/access configuration still needs to be completed in Notion web/desktop UI.
