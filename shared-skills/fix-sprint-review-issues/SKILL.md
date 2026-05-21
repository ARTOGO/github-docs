---
name: fix-sprint-review-issues
description: Use when the user gives a Sprint Backlog card or Review Issue and wants the unresolved review problems to be repaired end-to-end under the new Review Issue direct-repair model.
---

# Fix Sprint Review Issues

## Trigger

Use this skill when the user:

- pastes a Sprint Backlog page or URL
- pastes a Review Issue page or URL
- asks to fix review issues for a Sprint card
- asks to continue a repair flow that should route from Notion into the correct repo and repair branch

## Required support skills

Always use these together:

1. `notion-product-architecture`
2. `systematic-debugging`
3. `test-driven-development` when the change is reasonably testable
4. `playwright` for browser verification
5. `verification-before-completion`

## Operating model

This skill is an execution skill, not a documentation skill.

Under the current model:

- `Review Issue` is the only repair object
- `Fix Task` is no longer part of the active workflow
- impacted repos are written directly to `Review Issue -> Affected Repo Execution`
- merged repair repos are written directly to `Review Issue -> Resolved Repo Execution`

The goal is:

1. resolve the Sprint card or Review Issue correctly
2. gather actionable `Review Issue` items
3. determine the real repo scope
4. write routing decisions back to Notion when live execution is allowed
5. switch into the correct repo and repair branch
6. repair the code
7. verify in browser where the bug is user-visible
8. report what was wrong, how it was fixed, and the evidence

## Execution modes

### Default mode: read-only dry-run

Unless the user explicitly asks for live execution, the first pass must be read-only.

Read-only dry-run means:

- read Notion only
- do not update Notion statuses
- do not write back `Affected Repo Execution`
- do not create branches remotely
- do not push commits

The purpose of the dry-run is to prove that scope resolution is correct before any side effect happens.

### Live execution mode

Only after the user explicitly approves execution may the agent:

- create or checkout repair branches
- make code changes
- run tests and browser verification
- write routing decisions back to Notion
- update `Review Issue` comments or properties when the workflow truly requires it

## Scope resolution

### 1. Resolve the input type

The minimum valid input is one of:

- a Sprint Backlog page
- a Review Issue page

If the user gives a Sprint Backlog card:

- `Feature Hub`: operate at function scope, then inspect child `Repo Execution` cards
- `Repo Execution`: operate at repo scope, but still fetch the parent `Feature Hub` if present because `Review Issue` remains function-level
- `Stage/Admin`: stop and report that this card is not a valid repo-automation target

If the user gives a Review Issue directly:

- fetch the linked `Sprint Backlog`
- resolve its `Feature Hub` / `Repo Execution` context before coding

### 2. Resolve the review scope

Use the canonical architecture in `shared-skills/notion-product-architecture/references/current-state.md`.

Interpret the model as:

- `Feature Hub` = function-level coordination card
- `Repo Execution` = repo-level execution card
- `Review Log` = review session / round
- `Review Issue` = function-level issue record and direct repair entrypoint

### 3. Gather actionable work

Build the work queue from live Notion, not from docs.

Always gather:

- related `Review Issue` entries
- the current `Repo Execution` card(s)
- the linked `Review Log` entries

Interpretation rules:

- one `Review Issue` may map to one or more repo execution cards
- if the Sprint card is `Feature Hub`, collect unresolved `Review Issue` work across its child `Repo Execution` cards
- if the Sprint card is `Repo Execution`, only act on work tied to that repo execution
- if a `Review Issue` has no `Affected Repo Execution` yet, the agent must route it before implementation

### 4. Actionable vs terminal work

Do not hardcode stale assumptions from docs. Read live status values first when possible.

Default actionable rules:

- `Review Issue` is actionable when its status is not clearly terminal
- current terminal statuses should be treated as at least:
  - `Fixed`
  - `Duplicate`
  - `Won't Fix`

Statuses such as `Open`, `Fixing`, `Tech Fixed`, and `To Be Confirmed` should be treated as still relevant to execution or follow-up.

### 5. Deep-read requirement before fixing

Queue resolution is not enough to begin implementation.

Before changing code for any actionable item, the agent must deep-read the task context for that item.

Minimum required deep-read set:

- the target `Review Issue` page
- the relevant `Repo Execution` page(s)
- the parent `Feature Hub` page when the work originates from a feature hub
- the linked `Review Log` entries that explain the reviewer intent

Deep-read means:

- read the page body, not only the title and properties
- extract the concrete bug statement, expected behavior, and any reviewer rationale
- identify whether the issue is visual, behavioral, data-flow, or architecture-related
- note any ambiguity or missing reproduction details before coding

If the page body is blank or insufficient:

- say so explicitly in the work log
- fall back to the richest available sources, such as linked review logs, parent cards, code, tests, and live UI behavior
- do not pretend the issue was fully specified when it was not

## Repo and branch resolution

### 1. Repo path

Default workspace root:

- `/Users/peterting/Documents/artogo`

Default repo path rule:

- `${ARTOGO_WORKSPACE_ROOT}/${GitHub Repo}`

If the resolved repo path does not exist locally, stop and report the exact missing repo path.

### 2. Branch resolution order

Always resolve the branch in this order:

1. current working branch if the user already supplied one and it matches the target issue
2. derive the repair branch from `Review Issue` ID
3. only then create the branch if it does not exist and execution requires it

### 3. Repair branch naming convention

Follow the current workflow behavior, not outdated docs.

Current repair branch format:

- `fix/ISS-<issue_number>_<english_snake_case_title>`

The title portion should be:

- derived from `問題描述`
- converted to short English snake_case
- sanitized to lowercase ASCII with underscores

### 4. Base branch rule

If a new repair branch must be created:

- prefer `staging` if it exists
- otherwise use the repo default branch

If you create the repair branch as part of the live repair flow, write back the routing / PR summary to `Review Issue` when the workflow truly requires it.

## Routing and write-back

### 1. Routing source of truth

The agent must not assume "all child repos" by default.

Routing should be decided from:

- `Review Issue` body
- linked `Review Log`
- linked Sprint / Feature Hub context
- child `Repo Execution` metadata
- codebase evidence from candidate repos

### 2. What to write back before coding

In live execution mode, before opening repair PRs, the agent should write:

- `Affected Repo Execution`
- `Repair Routing Summary`

### 3. What to write back after PR creation

In live execution mode, after opening PRs, the agent should add a Notion comment that includes:

- selected repos
- branch names
- PR URLs

## Execution loop

Process the queue sequentially, grouped by repo and branch.

For each actionable issue:

1. summarize the bug in one sentence before changing code
2. deep-read the relevant Sprint / Review Issue / Review Log context
3. write down the concrete acceptance target for that issue
4. create an explicit todo list for that issue
5. switch into the target repo
6. checkout the correct repair branch
7. reproduce the bug
8. add a failing test first when the bug is reasonably testable
9. implement the minimal coherent fix
10. run targeted tests and any required build checks
11. run browser verification if the bug is user-visible
12. collect evidence before moving to the next item

The agent must not skip from queue resolution straight to coding.

If deep-read reveals that the issue title is misleading, incomplete, or contradicted by logs or UI behavior:

- use the richer source of truth
- record the discrepancy in the final report

## Browser verification

Use existing browser automation instead of ad hoc manual claims.

Preferred stack:

1. repo-specific run instructions if they already exist
2. `~/.codex/skills/playwright/SKILL.md`
3. `~/.codex/skills/verification-before-completion/SKILL.md`

Verification rules:

- for user-visible regressions, do not claim success from code inspection alone
- capture the exact browser path used to verify the fix
- record the page, route, or flow exercised
- if the app cannot be started locally, report the verification gap explicitly

## Final report contract

The final report must be grouped by fixed issue.

For each repaired `Review Issue`, report:

- what the problem was
- how the repo scope was chosen
- how it was fixed
- what the finished outcome is
- what test evidence exists
- what browser evidence exists

Also report:

- blocked items
- items skipped because they are already terminal
- any missing Notion routing data that prevented execution

## Guardrails

- default first pass is read-only dry-run unless the user clearly requests live execution
- never treat `Stage/Admin` as a repo execution target
- never reintroduce `Fix Task` as the execution unit
- never update `Feature Hub` repo fields as though it were a `Repo Execution` card
- do not change `Feature Hub` status just to begin analysis
- do not treat `Affected Repo Execution` as "all child repos" unless the issue body and evidence really support that
- never claim a UI bug is fixed without fresh verification evidence
- if docs conflict with live Notion or workflow code, prefer live Notion and current workflow behavior
