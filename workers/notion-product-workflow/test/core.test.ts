import assert from "node:assert/strict";
import { test } from "node:test";
import {
  completeReviewIssueIfReady,
  rerouteReviewIssue,
  routeReviewIssue,
  type NotionLikeClient,
} from "../src/core.js";

function uniqueId(prefix: string, number: number) {
  return { type: "unique_id", unique_id: { prefix, number } };
}

function status(name: string) {
  return { type: "status", status: { name } };
}

function select(name: string) {
  return { type: "select", select: { name } };
}

function title(content: string) {
  return { type: "title", title: [{ plain_text: content, text: { content } }] };
}

function richText(content: string) {
  return { type: "rich_text", rich_text: content ? [{ plain_text: content, text: { content } }] : [] };
}

function relation(ids: string[]) {
  return { type: "relation", relation: ids.map((id) => ({ id })) };
}

function people(ids: string[]) {
  return { type: "people", people: ids.map((id) => ({ id })) };
}

function page(id: string, properties: Record<string, any>) {
  return { id, url: `https://notion.test/${id}`, properties };
}

function createMockNotion(pages: Record<string, any>): NotionLikeClient & { updates: any[]; createdComments: any[] } {
  const updates: any[] = [];
  const createdComments: any[] = [];
  return {
    updates,
    createdComments,
    pages: {
      async retrieve({ page_id }) {
        const result = pages[page_id];
        if (!result) throw new Error(`missing page ${page_id}`);
        return result;
      },
      async update(args) {
        updates.push(args);
        pages[args.page_id].properties = {
          ...pages[args.page_id].properties,
          ...Object.fromEntries(
            Object.entries(args.properties).map(([key, value]) => [key, { ...(pages[args.page_id].properties[key] ?? {}), ...value }]),
          ),
        };
        return pages[args.page_id];
      },
    },
    databases: {
      async query() {
        return { results: [], has_more: false };
      },
    },
    comments: {
      async create(args) {
        createdComments.push(args);
        return {};
      },
    },
  };
}

test("routeReviewIssue writes selected repo execution and comment", async () => {
  const repo = page("repo-1", {
    "Task ID": uniqueId("SB", 10),
    "Card Type": select("Repo Execution"),
    "GitHub Repo": select("tool-imagecompressor"),
    Developer: people(["user-dev"]),
    "指派給": people(["user-assignee"]),
    "Name": title("Repo card"),
  });
  const issue = page("issue-1", {
    ID: uniqueId("ISS", 20),
    "狀態": status("Open"),
    "Sprint Backlog": relation(["repo-1"]),
    "Affected Repo Execution": relation([]),
    "Resolved Repo Execution": relation(["repo-old"]),
    "Repair PR URLs": richText("old"),
    "Repair Routing Summary": richText(""),
    "Reopen Count": { type: "number", number: 0 },
    "Name": title("Image compressor bug"),
  });
  const notion = createMockNotion({ "repo-1": repo, "issue-1": issue });

  const result = await rerouteReviewIssue(notion, { reviewIssueDatabaseId: "review-db", now: () => new Date("2026-05-23T00:00:00Z") }, {
    reviewIssuePageId: "issue-1",
    affectedRepoNames: ["tool-imagecompressor"],
    routingSummary: "Only image compression repo is affected.",
    applyChanges: true,
  });

  assert.equal(result.applied, true);
  assert.deepEqual(result.selected.map((item: any) => item.repoName), ["tool-imagecompressor"]);
  assert.equal(notion.updates.length, 1);
  assert.deepEqual(notion.updates[0].properties["Affected Repo Execution"].relation, [{ id: "repo-1" }]);
  assert.deepEqual(notion.updates[0].properties["Resolved Repo Execution"].relation, []);
  assert.equal(notion.updates[0].properties["Reopen Count"].number, 1);
  assert.equal(notion.createdComments.length, 1);
  assert.equal(notion.createdComments[0].rich_text[0].mention.user.id, "user-dev");
});

test("routeReviewIssue refuses ambiguous multi-repo routing without repo names", async () => {
  const repoA = page("repo-a", {
    "Task ID": uniqueId("SB", 11),
    "Card Type": select("Repo Execution"),
    "GitHub Repo": select("backend"),
    Developer: people([]),
    "指派給": people([]),
    "Name": title("Backend"),
  });
  const repoB = page("repo-b", {
    "Task ID": uniqueId("SB", 12),
    "Card Type": select("Repo Execution"),
    "GitHub Repo": select("officialwebsite"),
    Developer: people([]),
    "指派給": people([]),
    "Name": title("Frontend"),
  });
  const hub = page("hub-1", {
    "Task ID": uniqueId("SB", 13),
    "Card Type": select("Feature Hub"),
    "Sub-item": relation(["repo-a", "repo-b"]),
    "Name": title("Hub"),
  });
  const issue = page("issue-2", {
    ID: uniqueId("ISS", 21),
    "狀態": status("Open"),
    "Sprint Backlog": relation(["hub-1"]),
    "Affected Repo Execution": relation([]),
    "Name": title("Ambiguous issue"),
  });
  const notion = createMockNotion({ "repo-a": repoA, "repo-b": repoB, "hub-1": hub, "issue-2": issue });

  const result = await routeReviewIssue(notion, { reviewIssueDatabaseId: "review-db" }, {
    reviewIssuePageId: "issue-2",
    applyChanges: true,
  });

  assert.equal(result.applied, false);
  assert.equal(result.needsHumanDecision, true);
  assert.equal(notion.updates.length, 0);
  assert.equal(notion.createdComments.length, 0);
});

test("completeReviewIssueIfReady marks issue Tech Fixed only when all affected repos are resolved", async () => {
  const issue = page("issue-3", {
    ID: uniqueId("ISS", 22),
    "狀態": status("Fixing"),
    "Sprint Backlog": relation([]),
    "Affected Repo Execution": relation(["repo-1", "repo-2"]),
    "Resolved Repo Execution": relation(["repo-1", "repo-2"]),
    "Name": title("Ready issue"),
  });
  const notion = createMockNotion({ "issue-3": issue });

  const result = await completeReviewIssueIfReady(notion, { reviewIssueDatabaseId: "review-db", now: () => new Date("2026-05-23T00:00:00Z") }, {
    reviewIssuePageId: "issue-3",
    applyChanges: true,
    notify: false,
  });

  assert.equal(result.applied, true);
  assert.equal(result.allResolved, true);
  assert.equal(notion.updates[0].properties["狀態"].status.name, "Tech Fixed");
});
