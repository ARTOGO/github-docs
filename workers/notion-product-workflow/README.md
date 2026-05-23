# Notion Product Workflow Worker

This Worker exposes deterministic tools for the Artogo Notion workflow. It does not replace coding agents or the existing GitHub Actions PR sync path.

## Tools

- `routeReviewIssue`: writes `Affected Repo Execution`, `Repair Routing Summary`, and a Notion comment for a Review Issue.
- `rerouteReviewIssue`: same as routing, but resets the repair cycle and increments `Reopen Count`.
- `completeReviewIssueIfReady`: moves a Review Issue to `Tech Fixed` when `Resolved Repo Execution` covers every affected repo.

## Local Verification

```bash
npm install
npm test
npm run typecheck
NOTION_API_TOKEN=... REVIEW_ISSUE_DB_ID=... npm run live:test
```

## Deployment

Hosted Notion Worker deployment requires Notion CLI auth:

```bash
ntn login
ntn workers deploy --name artogo-product-workflow --local-build --no-git
ntn workers env set NOTION_API_TOKEN=...
ntn workers exec routeReviewIssue -d '{"reviewIssuePageId":"...","affectedRepoNames":["tool-imagecompressor"],"applyChanges":true}'
```

After deployment, enable the Worker tools in the Notion Custom Agent settings.
