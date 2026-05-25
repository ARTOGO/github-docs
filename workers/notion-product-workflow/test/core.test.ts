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
      async query(args) {
        const number = args.filter?.unique_id?.equals;
        const results = Object.values(pages).filter((candidate: any) => {
          for (const prop of Object.values(candidate.properties ?? {}) as any[]) {
            if (prop?.type === "unique_id" && prop.unique_id?.prefix === "ISS" && prop.unique_id?.number === number) {
              return true;
            }
          }
          return false;
        });
        return { results, has_more: false };
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
  const issue = page("11111111-1111-4111-8111-111111111111", {
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
  const notion = createMockNotion({ "repo-1": repo, "11111111-1111-4111-8111-111111111111": issue });

  const result = await rerouteReviewIssue(notion, { reviewIssueDatabaseId: "review-db", now: () => new Date("2026-05-23T00:00:00Z") }, {
    reviewIssuePageId: "11111111-1111-4111-8111-111111111111",
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

test("routeReviewIssue resolves a Notion page URL when the agent passes an internal page ref", async () => {
  const repo = page("repo-4", {
    "Task ID": uniqueId("SB", 40),
    "Card Type": select("Repo Execution"),
    "GitHub Repo": select("tool-imagecompressor"),
    Developer: people(["user-dev"]),
    "指派給": people([]),
    "Name": title("Repo card"),
  });
  const issue = page("36b5135e-076e-819d-82ed-f03caa6dec9c", {
    ID: uniqueId("ISS", 206),
    "狀態": status("Open"),
    "Sprint Backlog": relation(["repo-4"]),
    "Affected Repo Execution": relation([]),
    "Resolved Repo Execution": relation([]),
    "Repair Routing Summary": richText(""),
    "Name": title("Agent URL issue"),
  });
  const notion = createMockNotion({ "repo-4": repo, "36b5135e-076e-819d-82ed-f03caa6dec9c": issue });

  const result = await routeReviewIssue(notion, { reviewIssueDatabaseId: "review-db" }, {
    reviewIssuePageId: "notion-62",
    reviewIssuePageUrl: "https://www.notion.so/36b5135e076e819d82edf03caa6dec9c?pvs=25",
    affectedRepoNames: ["tool-imagecompressor"],
    applyChanges: true,
  });

  assert.equal(result.applied, true);
  assert.equal(result.reviewIssuePageId, "36b5135e-076e-819d-82ed-f03caa6dec9c");
  assert.deepEqual(notion.updates[0].properties["Affected Repo Execution"].relation, [{ id: "repo-4" }]);
});

test("routeReviewIssue falls back to Review Issue ID when page ref is not usable", async () => {
  const repo = page("repo-5", {
    "Task ID": uniqueId("SB", 50),
    "Card Type": select("Repo Execution"),
    "GitHub Repo": select("tool-imagecompressor"),
    Developer: people([]),
    "指派給": people(["user-assignee"]),
    "Name": title("Repo card"),
  });
  const issue = page("issue-206", {
    ID: uniqueId("ISS", 206),
    "狀態": status("Open"),
    "Sprint Backlog": relation(["repo-5"]),
    "Affected Repo Execution": relation([]),
    "Resolved Repo Execution": relation([]),
    "Repair Routing Summary": richText(""),
    "Name": title("Agent ID issue"),
  });
  const notion = createMockNotion({ "repo-5": repo, "issue-206": issue });

  const result = await routeReviewIssue(notion, { reviewIssueDatabaseId: "review-db" }, {
    reviewIssuePageId: "notion-62",
    reviewIssueId: "ISS-206",
    affectedRepoNames: ["tool-imagecompressor"],
    applyChanges: true,
  });

  assert.equal(result.applied, true);
  assert.equal(result.reviewIssueId, "ISS-206");
  assert.deepEqual(notion.updates[0].properties["Affected Repo Execution"].relation, [{ id: "repo-5" }]);
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
  const issue = page("22222222-2222-4222-8222-222222222222", {
    ID: uniqueId("ISS", 21),
    "狀態": status("Open"),
    "Sprint Backlog": relation(["hub-1"]),
    "Affected Repo Execution": relation([]),
    "Name": title("Ambiguous issue"),
  });
  const notion = createMockNotion({ "repo-a": repoA, "repo-b": repoB, "hub-1": hub, "22222222-2222-4222-8222-222222222222": issue });

  const result = await routeReviewIssue(notion, { reviewIssueDatabaseId: "review-db" }, {
    reviewIssuePageId: "22222222-2222-4222-8222-222222222222",
    applyChanges: true,
  });

  assert.equal(result.applied, false);
  assert.equal(result.needsHumanDecision, true);
  assert.equal(notion.updates.length, 0);
  assert.equal(notion.createdComments.length, 0);
});

test("completeReviewIssueIfReady marks issue Tech Fixed only when all affected repos are resolved", async () => {
  const issue = page("33333333-3333-4333-8333-333333333333", {
    ID: uniqueId("ISS", 22),
    "狀態": status("Fixing"),
    "Sprint Backlog": relation([]),
    "Affected Repo Execution": relation(["repo-1", "repo-2"]),
    "Resolved Repo Execution": relation(["repo-1", "repo-2"]),
    "Name": title("Ready issue"),
  });
  const notion = createMockNotion({ "33333333-3333-4333-8333-333333333333": issue });

  const result = await completeReviewIssueIfReady(notion, { reviewIssueDatabaseId: "review-db", now: () => new Date("2026-05-23T00:00:00Z") }, {
    reviewIssuePageId: "33333333-3333-4333-8333-333333333333",
    applyChanges: true,
    notify: false,
  });

  assert.equal(result.applied, true);
  assert.equal(result.allResolved, true);
  assert.equal(notion.updates[0].properties["狀態"].status.name, "Tech Fixed");
});

test("completeReviewIssueIfReady notifies Feature Hub when all related issues are ready for retest", async () => {
  const repo = page("repo-7", {
    "Task ID": uniqueId("SB", 70),
    "Card Type": select("Repo Execution"),
    "GitHub Repo": select("tool-imagecompressor"),
    "Parent item": relation(["hub-7"]),
    "Name": title("Repo card"),
  });
  const issue = page("44444444-4444-4444-8444-444444444444", {
    ID: uniqueId("ISS", 23),
    "狀態": status("Fixing"),
    "Sprint Backlog": relation(["repo-7"]),
    "Affected Repo Execution": relation(["repo-7"]),
    "Resolved Repo Execution": relation(["repo-7"]),
    "Name": title("Ready issue"),
  });
  const hub = page("hub-7", {
    "Task ID": uniqueId("SB", 71),
    "Card Type": select("Feature Hub"),
    "Func. Reviewer": people(["user-reviewer"]),
    "指派給": people(["user-assignee"]),
    "💦 Review Issue Database": relation(["44444444-4444-4444-8444-444444444444"]),
    "Name": title("Feature Hub"),
  });
  const notion = createMockNotion({ "repo-7": repo, "hub-7": hub, "44444444-4444-4444-8444-444444444444": issue });

  const result = await completeReviewIssueIfReady(notion, { reviewIssueDatabaseId: "review-db", now: () => new Date("2026-05-23T00:00:00Z") }, {
    reviewIssuePageId: "44444444-4444-4444-8444-444444444444",
    applyChanges: true,
    notify: true,
  });

  assert.equal(result.applied, true);
  assert.equal(result.retestNotifications, 1);
  assert.equal(result.retest.featureHubs[0].readyForRetest, true);
  assert.equal(notion.createdComments.length, 2);
  assert.equal(notion.createdComments[1].parent.page_id, "hub-7");
  assert.equal(notion.createdComments[1].rich_text[0].mention.user.id, "user-reviewer");
});
