import { Client } from "@notionhq/client";
import {
  completeReviewIssueIfReady,
  rerouteReviewIssue,
} from "../src/core.js";

const token = process.env.NOTION_API_TOKEN;
const reviewIssueDbId = process.env.REVIEW_ISSUE_DB_ID ?? "a770832e338c4babae01cc74ffc9394a";
const repoExecutionPageId = process.env.TEST_REPO_EXECUTION_PAGE_ID ?? "3685135e-076e-81f4-b0fb-effb13be5c6e";

if (!token) {
  throw new Error("NOTION_API_TOKEN is required.");
}

const notion = new Client({ auth: token });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

const created = await notion.pages.create({
  parent: { database_id: reviewIssueDbId },
  icon: { type: "emoji", emoji: "🧪" },
  properties: {
    "問題描述": {
      title: [
        {
          text: {
            content: `[TEST][Codex] Worker routing live test ${timestamp}`,
          },
        },
      ],
    },
    "狀態": { status: { name: "Open" } },
    "Sprint Backlog": { relation: [{ id: repoExecutionPageId }] },
    "Affected Repo Execution": { relation: [] },
    "Resolved Repo Execution": { relation: [{ id: repoExecutionPageId }] },
    "Repair PR URLs": {
      rich_text: [
        {
          text: {
            content: "[TEST] stale data should be reset by reroute",
          },
        },
      ],
    },
    "Repair Routing Summary": {
      rich_text: [
        {
          text: {
            content: "[TEST] before worker reroute",
          },
        },
      ],
    },
    "Reopen Count": { number: 0 },
  },
});

console.log(JSON.stringify({
  step: "created_review_issue",
  pageId: created.id,
  url: (created as any).url,
}));

const routeResult = await rerouteReviewIssue(notion as any, {
  reviewIssueDatabaseId: reviewIssueDbId,
}, {
  reviewIssuePageId: created.id,
  affectedRepoNames: ["tool-imagecompressor"],
  routingSummary: "[TEST] Worker live test explicitly routes ISS test card to tool-imagecompressor / SB-2223.",
  applyChanges: true,
  notify: true,
});

console.log(JSON.stringify({
  step: "reroute_review_issue",
  result: routeResult,
}));

await notion.pages.update({
  page_id: created.id,
  properties: {
    "Resolved Repo Execution": { relation: [{ id: repoExecutionPageId }] },
  },
});

const completeResult = await completeReviewIssueIfReady(notion as any, {
  reviewIssueDatabaseId: reviewIssueDbId,
}, {
  reviewIssuePageId: created.id,
  applyChanges: true,
  notify: true,
});

console.log(JSON.stringify({
  step: "complete_review_issue_if_ready",
  result: completeResult,
}));

const verified = await notion.pages.retrieve({ page_id: created.id });
console.log(JSON.stringify({
  step: "verified",
  pageId: created.id,
  status: (verified as any).properties["狀態"]?.status?.name,
  affectedCount: (verified as any).properties["Affected Repo Execution"]?.relation?.length ?? null,
  resolvedCount: (verified as any).properties["Resolved Repo Execution"]?.relation?.length ?? null,
  reopenCount: (verified as any).properties["Reopen Count"]?.number ?? null,
  url: (verified as any).url,
}));
