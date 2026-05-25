type RichText = Array<{ plain_text?: string; text?: { content?: string } }>;

export type NotionLikeClient = {
  pages: {
    retrieve(args: { page_id: string }): Promise<any>;
    update(args: { page_id: string; properties: Record<string, any> }): Promise<any>;
    create?(args: any): Promise<any>;
  };
  databases?: {
    query(args: Record<string, any>): Promise<any>;
  };
  dataSources?: {
    query(args: Record<string, any>): Promise<any>;
  };
  comments: {
    create(args: Record<string, any>): Promise<any>;
    list?(args: Record<string, any>): Promise<any>;
  };
};

export type WorkerConfig = {
  reviewIssueDatabaseId: string;
  now?: () => Date;
};

export type RouteReviewIssueInput = {
  reviewIssuePageId?: string | null;
  reviewIssuePageUrl?: string | null;
  reviewIssueId?: string | null;
  triggerText?: string | null;
  affectedRepoNames?: string[] | null;
  routingSummary?: string | null;
  applyChanges?: boolean | null;
  resetRepairCycle?: boolean | null;
  incrementReopenCount?: boolean | null;
  notify?: boolean | null;
};

export type CompleteReviewIssueInput = {
  reviewIssuePageId?: string | null;
  reviewIssuePageUrl?: string | null;
  reviewIssueId?: string | null;
  triggerText?: string | null;
  applyChanges?: boolean | null;
  notify?: boolean | null;
};

type RepoExecutionCandidate = {
  page: any;
  pageId: string;
  taskId: string | null;
  title: string;
  repoName: string;
  developers: any[];
  assignees: any[];
};

const TERMINAL_REVIEW_ISSUE_STATUSES = new Set(["Fixed", "Duplicate", "Won't Fix"]);
const ACTIVE_REVIEW_ISSUE_STATUSES = new Set(["Open", "Fixing"]);

function uniqById<T extends { id?: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function normalizePageId(pageId: string): string {
  return pageId.replace(/-/g, "");
}

function getStatus(page: any, propertyName: string): string | null {
  return page.properties?.[propertyName]?.status?.name ?? null;
}

function getSelect(page: any, propertyName: string): string | null {
  return page.properties?.[propertyName]?.select?.name ?? null;
}

function getUrl(page: any): string {
  return page.url ?? `https://www.notion.so/${normalizePageId(page.id)}`;
}

function getRichText(page: any, propertyName: string): string {
  const richText = (page.properties?.[propertyName]?.rich_text ?? []) as RichText;
  return richText.map((part) => part.plain_text ?? part.text?.content ?? "").join("");
}

function getTitle(page: any, fallback = "untitled"): string {
  for (const prop of Object.values(page.properties ?? {}) as any[]) {
    if (prop?.type === "title") {
      const title = (prop.title ?? [])
        .map((part: any) => part.plain_text ?? part.text?.content ?? "")
        .join("")
        .trim();
      if (title) return title;
    }
  }
  return fallback;
}

function getUniqueId(page: any, prefix?: string): string | null {
  for (const prop of Object.values(page.properties ?? {}) as any[]) {
    if (prop?.type !== "unique_id" || !prop.unique_id) continue;
    const value = `${prop.unique_id.prefix}-${prop.unique_id.number}`;
    if (!prefix || value.startsWith(`${prefix}-`)) return value;
  }
  return null;
}

function getRelationIds(page: any, propertyName: string): string[] {
  return (page.properties?.[propertyName]?.relation ?? []).map((ref: any) => ref.id);
}

function getNumber(page: any, propertyName: string): number {
  const value = page.properties?.[propertyName]?.number;
  return typeof value === "number" ? value : 0;
}

function richText(content: string): any {
  return { rich_text: content ? [{ type: "text", text: { content } }] : [] };
}

function uniqueRelations(ids: string[]): any {
  return {
    relation: [...new Set(ids)].map((id) => ({ id })),
  };
}

async function retrievePage(notion: NotionLikeClient, pageId: string): Promise<any> {
  return notion.pages.retrieve({ page_id: pageId });
}

async function queryAll(notion: NotionLikeClient, args: Record<string, any>): Promise<any[]> {
  const results: any[] = [];
  let startCursor: string | undefined;
  do {
    const queryArgs = {
      ...args,
      start_cursor: startCursor,
      page_size: args.page_size ?? 100,
    };
    const response = notion.dataSources?.query
      ? await notion.dataSources.query(queryArgs)
      : await notion.databases!.query(queryArgs);
    results.push(...(response.results ?? []));
    startCursor = response.has_more ? response.next_cursor : undefined;
  } while (startCursor);
  return results;
}

function toDashedUuid(value: string): string | null {
  const hex = value.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function extractPageId(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || /^notion-\d+$/i.test(trimmed)) return null;
  const match = trimmed.match(/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i);
  return match ? toDashedUuid(match[0]) : null;
}

function extractReviewIssueId(value?: string | null): string | null {
  const match = value?.match(/\bISS-\d+\b/i);
  return match ? match[0].toUpperCase() : null;
}

async function findReviewIssue(notion: NotionLikeClient, config: WorkerConfig, input: RouteReviewIssueInput | CompleteReviewIssueInput): Promise<any> {
  const pageId = extractPageId(input.reviewIssuePageId) ?? extractPageId(input.reviewIssuePageUrl) ?? extractPageId(input.triggerText);
  if (pageId) {
    return retrievePage(notion, pageId);
  }

  const reviewIssueId = input.reviewIssueId?.trim() || extractReviewIssueId(input.triggerText);
  const match = reviewIssueId?.match(/^ISS-(\d+)$/i);
  if (!match) {
    throw new Error("Provide reviewIssuePageUrl, triggerText with a Notion page URL, a valid reviewIssuePageId UUID, or reviewIssueId like ISS-200. Do not pass Notion internal refs like notion-62.");
  }

  const results = await queryAll(notion, {
    database_id: config.reviewIssueDatabaseId,
    filter: {
      property: "ID",
      unique_id: { equals: Number(match[1]) },
    },
  });

  if (!results.length) {
    throw new Error(`Review Issue not found: ${reviewIssueId}`);
  }
  return results[0];
}

async function collectRepoExecutionCandidates(notion: NotionLikeClient, reviewIssue: any): Promise<RepoExecutionCandidate[]> {
  const candidates: RepoExecutionCandidate[] = [];
  const sprintRefs = getRelationIds(reviewIssue, "Sprint Backlog");
  const existingAffectedRefs = getRelationIds(reviewIssue, "Affected Repo Execution");

  for (const refId of [...sprintRefs, ...existingAffectedRefs]) {
    const sprintPage = await retrievePage(notion, refId);
    const cardType = getSelect(sprintPage, "Card Type");

    if (cardType === "Repo Execution") {
      candidates.push(toRepoExecutionCandidate(sprintPage));
      continue;
    }

    if (cardType === "Feature Hub") {
      for (const childId of getRelationIds(sprintPage, "Sub-item")) {
        const child = await retrievePage(notion, childId);
        if (getSelect(child, "Card Type") === "Repo Execution") {
          candidates.push(toRepoExecutionCandidate(child));
        }
      }
    }
  }

  return uniqCandidates(candidates);
}

function uniqCandidates(candidates: RepoExecutionCandidate[]): RepoExecutionCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.pageId)) return false;
    seen.add(candidate.pageId);
    return true;
  });
}

function toRepoExecutionCandidate(page: any): RepoExecutionCandidate {
  return {
    page,
    pageId: page.id,
    taskId: getUniqueId(page, "SB"),
    title: getTitle(page),
    repoName: getSelect(page, "GitHub Repo") ?? "",
    developers: page.properties?.Developer?.people ?? [],
    assignees: page.properties?.["指派給"]?.people ?? [],
  };
}

function issueSearchText(reviewIssue: any): string {
  const pieces = [
    getTitle(reviewIssue),
    getRichText(reviewIssue, "Repair Routing Summary"),
    getRichText(reviewIssue, "問題描述"),
  ];
  return pieces.join("\n").toLowerCase();
}

function selectCandidates(reviewIssue: any, candidates: RepoExecutionCandidate[], affectedRepoNames?: string[] | null): {
  selected: RepoExecutionCandidate[];
  reason: string;
  needsHumanDecision: boolean;
} {
  const wanted = (affectedRepoNames ?? []).map((name) => name.toLowerCase().trim()).filter(Boolean);
  if (wanted.length) {
    const selected = candidates.filter((candidate) => wanted.includes(candidate.repoName.toLowerCase()));
    const missing = wanted.filter((name) => !selected.some((candidate) => candidate.repoName.toLowerCase() === name));
    if (missing.length) {
      return {
        selected,
        reason: `Requested repo(s) not found under linked Sprint Backlog: ${missing.join(", ")}`,
        needsHumanDecision: true,
      };
    }
    return {
      selected,
      reason: "Custom Agent supplied affectedRepoNames.",
      needsHumanDecision: false,
    };
  }

  if (candidates.length === 1) {
    return {
      selected: candidates,
      reason: "Only one Repo Execution candidate is linked to this Review Issue.",
      needsHumanDecision: false,
    };
  }

  const text = issueSearchText(reviewIssue);
  const selected = candidates.filter((candidate) => candidate.repoName && text.includes(candidate.repoName.toLowerCase()));
  if (selected.length) {
    return {
      selected,
      reason: "Repo name(s) were found in the Review Issue text.",
      needsHumanDecision: false,
    };
  }

  return {
    selected: [],
    reason: "Multiple Repo Execution candidates exist and no repo name was provided or detected.",
    needsHumanDecision: true,
  };
}

async function addComment(notion: NotionLikeClient, pageId: string, users: any[], message: string): Promise<void> {
  const rich_text: any[] = [];
  for (let i = 0; i < users.length; i++) {
    rich_text.push({ type: "mention", mention: { type: "user", user: { id: users[i].id } } });
    if (i < users.length - 1) rich_text.push({ type: "text", text: { content: " " } });
  }
  rich_text.push({ type: "text", text: { content: `${users.length ? " " : ""}${message}` } });
  await notion.comments.create({ parent: { page_id: pageId }, rich_text });
}

function routingSummary(input: RouteReviewIssueInput, selected: RepoExecutionCandidate[], reason: string): string {
  const repoList = selected.map((candidate) => candidate.repoName).join(", ");
  const userSummary = input.routingSummary?.trim();
  return [
    "[Notion Worker] Review Issue routing",
    `Affected repos: ${repoList || "(none)"}`,
    `Reason: ${userSummary || reason}`,
  ].join("\n");
}

export async function routeReviewIssue(notion: NotionLikeClient, config: WorkerConfig, input: RouteReviewIssueInput): Promise<Record<string, any>> {
  const reviewIssue = await findReviewIssue(notion, config, input);
  const currentStatus = getStatus(reviewIssue, "狀態");
  if (currentStatus && TERMINAL_REVIEW_ISSUE_STATUSES.has(currentStatus) && !input.resetRepairCycle) {
    return {
      applied: false,
      skipped: true,
      reason: `Review Issue is terminal: ${currentStatus}`,
      reviewIssuePageId: reviewIssue.id,
      reviewIssueUrl: getUrl(reviewIssue),
    };
  }

  const candidates = await collectRepoExecutionCandidates(notion, reviewIssue);
  const selection = selectCandidates(reviewIssue, candidates, input.affectedRepoNames);
  const selected = selection.selected;
  const summary = routingSummary(input, selected, selection.reason);

  if (selection.needsHumanDecision || selected.length === 0) {
    return {
      applied: false,
      needsHumanDecision: true,
      reason: selection.reason,
      reviewIssuePageId: reviewIssue.id,
      reviewIssueUrl: getUrl(reviewIssue),
      candidates: candidates.map(candidateSummary),
      selected: selected.map(candidateSummary),
    };
  }

  const updateProps: Record<string, any> = {
    "Affected Repo Execution": uniqueRelations(selected.map((candidate) => candidate.pageId)),
    "Repair Routing Summary": richText(summary),
    "Last Repair Sync At": { date: { start: (config.now?.() ?? new Date()).toISOString() } },
  };

  if (input.resetRepairCycle) {
    updateProps["Resolved Repo Execution"] = { relation: [] };
    updateProps["Repair PR URLs"] = richText("");
  }

  if (input.incrementReopenCount) {
    updateProps["Reopen Count"] = { number: getNumber(reviewIssue, "Reopen Count") + 1 };
  }

  const notifyUsers = uniqById(selected.flatMap((candidate) => candidate.developers.length ? candidate.developers : candidate.assignees));
  const notifyMessage = `Worker 已判斷此 Review Issue 需要修復 repo：${selected.map((candidate) => candidate.repoName).join(", ")}。請對應負責人處理。`;

  if (input.applyChanges) {
    await notion.pages.update({ page_id: reviewIssue.id, properties: updateProps });
    if (input.notify !== false) {
      await addComment(notion, reviewIssue.id, notifyUsers, notifyMessage);
    }
  }

  return {
    applied: Boolean(input.applyChanges),
    needsHumanDecision: false,
    reviewIssuePageId: reviewIssue.id,
    reviewIssueId: getUniqueId(reviewIssue, "ISS"),
    reviewIssueUrl: getUrl(reviewIssue),
    selected: selected.map(candidateSummary),
    candidates: candidates.map(candidateSummary),
    summary,
    notifiedUserCount: input.applyChanges && input.notify !== false ? notifyUsers.length : 0,
  };
}

export async function rerouteReviewIssue(notion: NotionLikeClient, config: WorkerConfig, input: RouteReviewIssueInput): Promise<Record<string, any>> {
  return routeReviewIssue(notion, config, {
    ...input,
    resetRepairCycle: true,
    incrementReopenCount: input.incrementReopenCount ?? true,
  });
}

export async function completeReviewIssueIfReady(notion: NotionLikeClient, config: WorkerConfig, input: CompleteReviewIssueInput): Promise<Record<string, any>> {
  const reviewIssue = await findReviewIssue(notion, config, input);
  const status = getStatus(reviewIssue, "狀態");
  const affected = getRelationIds(reviewIssue, "Affected Repo Execution");
  const resolved = new Set(getRelationIds(reviewIssue, "Resolved Repo Execution"));
  const missing = affected.filter((id) => !resolved.has(id));
  const allResolved = affected.length > 0 && missing.length === 0;

  if (status && TERMINAL_REVIEW_ISSUE_STATUSES.has(status)) {
    return {
      applied: false,
      skipped: true,
      reason: `Review Issue is terminal: ${status}`,
      allResolved,
      reviewIssuePageId: reviewIssue.id,
      reviewIssueUrl: getUrl(reviewIssue),
    };
  }

  if (!allResolved) {
    return {
      applied: false,
      allResolved: false,
      reviewIssuePageId: reviewIssue.id,
      reviewIssueUrl: getUrl(reviewIssue),
      affectedCount: affected.length,
      resolvedCount: resolved.size,
      missingRepoExecutionIds: missing,
    };
  }

  const updateProps = {
    "狀態": { status: { name: "Tech Fixed" } },
    "Last Repair Sync At": { date: { start: (config.now?.() ?? new Date()).toISOString() } },
  };

  if (input.applyChanges) {
    await notion.pages.update({ page_id: reviewIssue.id, properties: updateProps });
    if (input.notify !== false) {
      await addComment(notion, reviewIssue.id, [], "Worker 已確認所有 Affected Repo Execution 都已完成修復，狀態更新為 Tech Fixed。");
    }
  }

  const retest = await getRetestReadiness(notion, reviewIssue);
  let retestNotifications = 0;
  if (input.applyChanges && input.notify !== false) {
    retestNotifications = await notifyRetestIfReady(notion, retest);
  }

  return {
    applied: Boolean(input.applyChanges),
    allResolved: true,
    reviewIssuePageId: reviewIssue.id,
    reviewIssueId: getUniqueId(reviewIssue, "ISS"),
    reviewIssueUrl: getUrl(reviewIssue),
    status: input.applyChanges ? "Tech Fixed" : status,
    retest,
    retestNotifications,
  };
}

async function notifyRetestIfReady(notion: NotionLikeClient, retest: Record<string, any>): Promise<number> {
  let notified = 0;
  for (const hub of retest.featureHubs ?? []) {
    // Do not notify when the Feature Hub relation is empty or stale; otherwise every
    // isolated test card would look ready for retest.
    if (!hub.readyForRetest || hub.totalReviewIssues === 0) continue;
    const hubPage = await retrievePage(notion, hub.featureHubPageId);
    const reviewers = hubPage.properties?.["Func. Reviewer"]?.people ?? [];
    const assignees = hubPage.properties?.["指派給"]?.people ?? [];
    const users = reviewers.length > 0 ? reviewers : assignees;
    await addComment(notion, hub.featureHubPageId, users, "所有 Review Issue 都已完成修復，請重新進行 Function Review / retest。");
    notified += 1;
  }
  return notified;
}

async function getRetestReadiness(notion: NotionLikeClient, reviewIssue: any): Promise<Record<string, any>> {
  const featureHubs = await resolveFeatureHubs(notion, reviewIssue);
  const results = [];
  for (const hub of featureHubs) {
    const relatedIssueIds = getRelationIds(hub, "💦 Review Issue Database");
    const relatedIssues = [];
    for (const issueId of relatedIssueIds) {
      relatedIssues.push(await retrievePage(notion, issueId));
    }
    const activeIssues = relatedIssues.filter((issue) => ACTIVE_REVIEW_ISSUE_STATUSES.has(getStatus(issue, "狀態") ?? ""));
    results.push({
      featureHubPageId: hub.id,
      featureHubUrl: getUrl(hub),
      featureHubTaskId: getUniqueId(hub, "SB"),
      totalReviewIssues: relatedIssues.length,
      activeReviewIssues: activeIssues.map((issue) => ({
        pageId: issue.id,
        reviewIssueId: getUniqueId(issue, "ISS"),
        status: getStatus(issue, "狀態"),
        url: getUrl(issue),
      })),
      readyForRetest: activeIssues.length === 0,
    });
  }
  return { featureHubs: results };
}

async function resolveFeatureHubs(notion: NotionLikeClient, reviewIssue: any): Promise<any[]> {
  const hubs = [];
  for (const sprintId of getRelationIds(reviewIssue, "Sprint Backlog")) {
    const page = await retrievePage(notion, sprintId);
    const cardType = getSelect(page, "Card Type");
    if (cardType === "Feature Hub") {
      hubs.push(page);
      continue;
    }
    if (cardType === "Repo Execution") {
      for (const parentId of getRelationIds(page, "Parent item")) {
        const parent = await retrievePage(notion, parentId);
        if (getSelect(parent, "Card Type") === "Feature Hub") {
          hubs.push(parent);
        }
      }
    }
  }
  return uniqById(hubs);
}

function candidateSummary(candidate: RepoExecutionCandidate): Record<string, any> {
  return {
    pageId: candidate.pageId,
    taskId: candidate.taskId,
    title: candidate.title,
    repoName: candidate.repoName,
    url: getUrl(candidate.page),
  };
}
