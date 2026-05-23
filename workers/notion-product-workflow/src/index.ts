import { Worker } from "@notionhq/workers";
import { j } from "@notionhq/workers/schema-builder";
import {
  completeReviewIssueIfReady,
  rerouteReviewIssue,
  routeReviewIssue,
  type CompleteReviewIssueInput,
  type RouteReviewIssueInput,
} from "./core.js";

const worker = new Worker();
export default worker;

function config() {
  const reviewIssueDatabaseId = process.env.REVIEW_ISSUE_DB_ID;
  if (!reviewIssueDatabaseId) {
    throw new Error("REVIEW_ISSUE_DB_ID is not configured.");
  }
  return { reviewIssueDatabaseId };
}

const routeSchema = j.object({
  reviewIssuePageId: j.string().describe("The Notion page ID for the Review Issue.").nullable(),
  reviewIssueId: j.string().describe("The unique Review Issue ID, for example ISS-200.").nullable(),
  affectedRepoNames: j
    .array(j.string())
    .describe("Repo names that the agent determined are affected, for example tool-imagecompressor.")
    .nullable(),
  routingSummary: j.string().describe("Short rationale for why these repos are affected.").nullable(),
  applyChanges: j
    .boolean()
    .describe("Set true to write Affected Repo Execution, routing summary, and comments into Notion.")
    .nullable(),
  resetRepairCycle: j
    .boolean()
    .describe("Set true when rerouting a reopened issue and old resolved/PR data should be cleared.")
    .nullable(),
  incrementReopenCount: j.boolean().describe("Set true to increment Reopen Count.").nullable(),
  notify: j.boolean().describe("Set false to suppress Notion comments.").nullable(),
});

worker.tool("routeReviewIssue", {
  title: "Route Review Issue",
  description:
    "Use after a Review Issue is created or opened. Writes the affected Repo Execution cards and routing summary only when the affected repos are known.",
  schema: routeSchema,
  execute: async (input: RouteReviewIssueInput, { notion }) => {
    return routeReviewIssue(notion as any, config(), input);
  },
});

worker.tool("rerouteReviewIssue", {
  title: "Reroute Review Issue",
  description:
    "Use when a Review Issue is reopened. Clears old repair state, increments Reopen Count, then writes the new affected Repo Execution cards.",
  schema: routeSchema,
  execute: async (input: RouteReviewIssueInput, { notion }) => {
    return rerouteReviewIssue(notion as any, config(), input);
  },
});

worker.tool("completeReviewIssueIfReady", {
  title: "Complete Review Issue If Ready",
  description:
    "Use after a repair PR is merged or Resolved Repo Execution changes. Moves the Review Issue to Tech Fixed only when all affected repos are resolved.",
  schema: j.object({
    reviewIssuePageId: j.string().describe("The Notion page ID for the Review Issue.").nullable(),
    reviewIssueId: j.string().describe("The unique Review Issue ID, for example ISS-200.").nullable(),
    applyChanges: j.boolean().describe("Set true to update the Review Issue status in Notion.").nullable(),
    notify: j.boolean().describe("Set false to suppress Notion comments.").nullable(),
  }),
  execute: async (input: CompleteReviewIssueInput, { notion }) => {
    return completeReviewIssueIfReady(notion as any, config(), input);
  },
});
