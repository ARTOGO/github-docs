---
name: notion-product-architecture
description: Use when working on this repo's product-facing Notion automation, especially Sprint Backlog, Feature Hub, Repo Execution, Review Issue, and Review Log relationships under the new Review Issue direct-repair model.
---

# Notion Product Architecture

## When to use

Use this skill when any task touches:

- Sprint Backlog card routing
- Feature Hub and Repo Execution resolution
- Review Issue / Review Log data modeling
- GitHub workflow automation that reads from or writes to product Notion databases
- schema-sensitive explanations for PM, engineering, or automation changes

## Source of truth order

1. live Notion schema and representative live pages
2. current workflow behavior in this repo
3. repo documentation

If repo docs conflict with live Notion or workflow code, treat docs as stale until updated.

## Required reading

Before making schema-sensitive changes, read:

1. `shared-skills/notion-product-architecture/references/current-state.md`
2. the workflow(s) you are about to modify, usually:
   - `.github/workflows/notion-pr-sync-reusable.yml`
   - `.github/workflows/notion-create-branch-reusable.yml`
   - `.github/workflows/notion-feature-hub-cascade.yml`

## Working rules

- Distinguish `Card Type` from `任務類型`. `Card Type` drives automation routing; `任務類型` is business labeling.
- Treat `Feature Hub` as the function-level coordination card and `Repo Execution` as the repo-level execution card.
- When a branch or PR uses an `SB-*` identifier, the workflow may first resolve the parent Sprint card, then narrow to the matching `Repo Execution` child by repo and branch.
- Treat `Review Log` as the review round / session record that links the review event back to Sprint Backlog and Review Issues.
- Treat `Review Issue` as the only repair object in the active model.
- Treat `Affected Repo Execution` and `Resolved Repo Execution` on `Review Issue` as the new repo-scope and completion truth.
- Treat `Review Fix Task` as legacy data only. Do not design new automation around it.

## Active workflow model

The current target model is:

- `Feature Hub`
  - function-level coordination and rollup
- `Repo Execution`
  - repo-level branch / PR / tech review / function review execution
- `Review Log`
  - review-session record
- `Review Issue`
  - repair entrypoint, impacted repo set, repair PR summary, completion state

The current model is not:

- `Review Issue -> Fix Task -> Fix Branch`

That older shape is now historical context, not the active design target.

## Change discipline

- If you change workflow logic that depends on Notion relations, verify the relevant data source or representative pages in live Notion again before finalizing.
- If you update the architecture, update `references/current-state.md` in the same change so the shared skill does not drift.
- If live Notion has already moved ahead of docs, update the docs and skill references in the same task rather than leaving the repo in a mixed state.
