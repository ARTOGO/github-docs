---
name: frontier-reasoning-discipline
description: Use when doing any non-trivial software task — debugging a reported bug, reviewing or auditing code, implementing from a spec or ticket, coding against in-context API docs, changing shared code, handling a failing test — and before stating any verdict, count, timestamp, completion claim, or the word "verified". Also use when about to answer from memory of similar codebases instead of the context in front of you. Mirrors to ~/.codex/skills/frontier-reasoning-discipline/SKILL.md.
---

# Frontier Reasoning Discipline

> **Mirror**: keep `~/.claude/skills/frontier-reasoning-discipline/SKILL.md` ≡ `~/.codex/skills/frontier-reasoning-discipline/SKILL.md` ≡ canonical `/Users/peterting/Documents/artogo/github-docs/shared-skills/frontier-reasoning-discipline/SKILL.md` in sync.

Every rule below names a required output artifact, so compliance is visible in the answer itself. Each rule exists because its violation was observed in an otherwise-excellent answer from a strong model: the core task was right, and the defect lived in an unverified claim, an unchecked number, or a headline contradicting the answer's own body. None of this is "be careful" advice — produce the artifacts.

## Dispatch

| Trigger (mechanical, from the prompt/context) | Required artifact |
| --- | --- |
| User reports a bug with observable symptoms | Symptom table, before any fix text |
| Reviewing or auditing code | Hostile-input matrix, executed |
| Context contains docs for an API you will call | Contract block + cited code |
| Spec states rates, sizes, bit-widths, or "never / forever / all servers" | Feasibility math, before any code |
| Changing a function or format with more than one consumer | Call-site table |
| A test is failing | Tests-are-the-contract rule |
| Producing or judging visual output (UI, 3D, canvas, chart, design) | Rendered-evidence block |
| Implementing from a spec longer than ~200 words | Constraint-extraction quotes |
| User authorizes deploy / ship / merge-and-deploy / go live / 上線 | Production rollout ledger; keep monitoring until a terminal production state |
| Asked "is it done / safe / fixed / mergeable?" | Verdict template |
| Every substantive answer | Always-on rules + weakest-claim check |

## Always-on rules

**1. Executed evidence, or label it UNVERIFIED.** Every answer that verifies anything contains a section titled exactly `Executed evidence:` holding two fenced blocks — first the COMPLETE code/command that ran (not an excerpt; an elided comment like `# (b) count logic here` makes the output non-reproducible), second its verbatim printed output. Verification claims elsewhere point to that section. Naming the tool ("executed a zoneinfo-based simulation", "confirmed against the tz database"), summarizing results in backticks, or writing "run shows X" is the defect this rule exists to catch — no section, no "verified/tested/confirmed", and the claim moves under `UNVERIFIED (plausible)`. Execute derived labels too — in trials, the single false claim in an otherwise-clean review was an unexecuted gloss ("equals page N's data"). Disclose every parameter the run used: a number quoted from a simulation whose scale, latency, or timing inputs are not stated in the answer is a contradiction waiting to be found, not evidence.

**2. Show the arithmetic for every derived number.** Timestamps, indexes, counts, page labels, capacities: each shows its computation inline — `resolve = 0 + 100 = 100`; `start = (page − 1) × size`. Anchor: an answer wrote "t=70: response resolves" for a 100 ms fetch launched at t=0. Two of your own quantities may not be equated unless their derivations match — an answer equated its design's 109-minute lifetime with the theoretical 2.98-hour bound.

**3. Trace or delete asides.** Any "you could also…" or "simpler:" snippet must state inline what it returns or throws on its terminal case and on first success — or be deleted before sending. Labeling it "untested" is not an option: readers copy-paste runnable code regardless. Anchor: an aside's loop-bound "improvement" (`attempt < MAX_RETRIES`) silently returned `undefined` after exhausted retries; a casual "~81 lines" aside was off by one. Both shipped inside otherwise-perfect answers.

**4. Re-derive the headline from the body.** Write your opening verdict LAST. Re-read your own body facts and make every headline claim cite one that supports it. Anchor: an opening line declared two requirements "fully achievable" two paragraphs before the answer's own math proved ~3-hour capacity exhaustion; a summary table said "MET" for a requirement its own text showed collides after 68 minutes.

**5. Verdict template for done/safe/fixed questions.** Open with exactly three lines: `VERIFIED:` commands run + observed outputs. `NOT VERIFIED:` checks not run — minimum rows: typecheck, tests, runtime exercise of the changed flow. `VERDICT:` safe | unsafe | unverified. "Safe/done" is available only when NOT VERIFIED is empty. Deadlines change the recommendation, never the VERDICT. A check that cannot run becomes `Blocked: <resource> — <attempted command + error>`. If the user overrides: "proceeding unverified at user direction" plus a one-line revert command. "Typecheck passed" is not "safe to merge."

**6. Impossibility answers must include the exit.** When requirements are jointly unsatisfiable, lead with the proof in numbers, then always propose the nearest feasible relaxations (wider type, coordination, weaker ordering). A bare refusal or a fail-fast `raise` with no alternative is an incomplete answer — that omission was the only failure in an otherwise-correct trial run.

**7. Artifacts replace narration.** Order: verdict/answer first, artifacts next, weakest-claim check last. Each artifact substitutes for the prose walkthrough it supersedes — delete that prose; the disciplined answer must not be longer than an undisciplined one. Internal process is never narrated in the answer: not this skill or its rule numbers ("as rule 6 requires" leaked in trials), not harness reminders, permission hooks, or gates ("the workflow hook about QA/PR is not relevant here" leaked too). The artifacts speak for themselves.

**8. A deployment request is monitor-to-production authorization, not fire-and-forget.** After starting or triggering a merge, CI run, build, release, or deploy, keep the task active and monitor the exact run IDs and runtime surfaces until one terminal state below is proven. Do not hand back merely because a command returned, a PR merged, CI is green, an image built, a candidate revision is healthy, or a deploy workflow was queued. Poll in bounded intervals, publish concise commentary at least once per 60 seconds while work is still running, and continue through failures that can be diagnosed and repaired within the user's authorization. If the platform's automatic deployment is disabled or skipped, trigger the normal production workflow when the user authorized deployment; do not silently downgrade the task to "merged". Terminal states are:

- `LIVE`: the intended commit is the version receiving intended production traffic; the public/custom-domain route responds; the changed flow has a production smoke or browser exercise; required migrations, seeds, embeddings, canaries, or cache invalidations completed; and post-cutover logs show no new relevant critical error.
- `BLOCKED`: production cannot be reached without a genuinely user-only action, new destructive authority, unavailable external system, or credentials the agent must not handle. State the exact completed lanes and use the guided-user-blocker flow when applicable.
- `FAILED`: the rollout reached a non-recoverable failure after safe in-scope diagnosis and repair attempts. Include the failing run/job, root cause or strongest evidence, rollback/current-traffic state, and the next executable recovery step.

`LIVE` is the only terminal state that may be phrased as "正式上線 / deployed / shipped". Candidate/no-traffic evidence, platform control-plane success, and production data-plane proof remain separate rows until each closes.

## Task-scoped recipes

**Debugging a reported bug → Symptom table.** Before any fix text: one row per reported symptom, quoted verbatim → mechanism → offending line → fix line that removes it — plus one row for why the user's workaround (refresh, retry, restart) clears it. A row saying "race" or "timing" instead of a code path is unresolved: keep digging. Multiple symptoms usually mean multiple co-resident mechanisms; a fix may only claim the rows it addresses.

**Reviewing code → Hostile-input matrix.** Findings may begin only after the matrix is filled: for each parameter — empty, single element, zero, negative, exact boundary multiple, boundary+1, non-default optionals — the EXECUTED output, classified `correct | crash | silent-wrong-data`. "Nothing throws" is not "correct": `items[-6:-3] → [50, 60, 70]` leaked real mid-list rows with no exception. Report a concrete failing input and actual output for every non-correct cell.

**Coding against in-context API docs → Contract block.** Before code: numbered near-quotes of every doc line that differs from mainstream convention, each naming the prior it overrides ("never rejects → no try/catch"; "body pre-parsed → no .json()"). In the code, every try/catch, `.catch`, `.json()`, or retry option carries a comment citing a contract number, like `{ retries: 0 } // C3: this loop owns backoff + 5xx`. Delete uncited occurrences.

**Quantitative spec → Feasibility math first.** Multiply rates × duration against capacity; check ordering/consistency demands against stated skew and coordination limits. `40 servers × 10,000/s = 4×10⁵/s exhausts 2³² in ~10,700 s ≈ 3 h` — four lines that invalidate an entire implementation before it is written. The math precedes ANY code, including a fail-fast stub. If the numbers don't close, apply always-on rule 6.

**Changing shared code → Call-site table.** Paste the search output listing every consumer; mark each `unaffected` or `affected: <how handled>`. Keep the old behavior as the default; make the new behavior opt-in at the caller that asked for it. Counterfactual-test the breakage you avoided: run the downstream parser/regex against the naive output and show it fail (`matches reconcile regex? False`).

**A test fails → Tests are the contract.** Fix the product code. A diff touching test expectations, skip/xfail markers, or lint suppressions requires one line arguing the OLD expectation was wrong, quoting spec or user words — absent that line, revert the test edit. Check convenience APIs against the spec's rounding/encoding rules before trusting them: bare `round()` is banker's rounding — `round(94.5) == 94`.

**Long spec → Constraint extraction.** Before coding, list verbatim quotes of every constraint that changes the code — epochs, encodings, role gates, ordering, "must never" — each paired with the code line that will satisfy it. Probe the nastiest one with an execution: `ts=0 → must print 2001-01-01, not 1970`.

**Visual output → Rendered-evidence block.** "The code looks right" is not a verdict on pixels. Before claiming visual work correct or wrong, render it in a real browser/viewer, save a screenshot to a NAMED file, open and view that image, then write a `Rendered evidence:` block: the saved filename (it must exist on disk) plus one observation per requirement. In trials a rep claimed "verified by real-browser screenshot" while no screenshot file existed anywhere. Two hard sub-rules: (a) a static frame cannot verify motion or interaction — label such claims "inferred from code" or capture frames over time; "two faces visible confirms the spin" is inference dressed as observation; (b) every claimed visual defect or pass carries a measurement — sampled color value, bounding box, measured position — never an impression: unmeasured impressions produced the only false positives in a parity trial ("cube not centered", refuted by center x=736 vs frame 735). Unmeasured or unrendered claims go under `UNVERIFIED (plausible)`.

**Deploy / ship / go live → Production rollout ledger.** Keep one row per closure lane and update it as the rollout moves. At minimum record: exact `cwd`, branch, commit SHA, PR, CI/build/deploy run IDs, platform project/region, candidate revision, production revision, intended traffic percentage, public/custom-domain URL, changed-flow probe, post-deploy data task (migration/reseed/embedding/canary/cache), and relevant production-log query. Each row is `pending | passed | failed | blocked` with observed output. A representative ledger is:

| Closure lane | Required production evidence |
| --- | --- |
| Source | merged commit SHA equals the deploy input SHA |
| CI / build | exact run and required jobs reached success |
| Candidate | candidate revision is Ready/healthy, explicitly still not production |
| Cutover | intended production traffic points at the intended revision |
| Public route | custom domain resolves and returns the expected status/content |
| Changed flow | the actual changed API/UI path succeeds against production |
| Data/runtime tasks | applicable migration, seed, embedding, canary, and cache work succeeded |
| Logs | bounded post-cutover query contains no new relevant critical errors |

If a lane does not apply, write `N/A: <reason>` rather than silently omitting it. Monitoring stops only at `LIVE`, `BLOCKED`, or `FAILED`; a still-running or queued workflow is never a final answer.

## Weakest-claim check (last section of the answer)

Quote your single weakest verifiable claim — a number, an input→output pair, or a return/throw path; never an opinion — then rerun or recompute it and show the check. Eligible claims are ones NOT already sitting next to an evidence block: rerunning arithmetic you already proved is not the check (a trial run "checked" `2³²/4×10⁵/3600 = 2.98` it had already executed, while its actually-weakest logical claim went untested). If it fails, fix the answer and take the next weakest. This section always comes after the answers, never before them.

## Pre-send checklist

- Every "verified" adjacent to two fenced blocks — code AND verbatim output — with all run parameters disclosed?
- Every derived number shows its computation?
- Every aside terminal-traced or deleted?
- Headline re-derived from body facts, written last?
- Verdict template present if asked done/safe, with NOT VERIFIED honest?
- Deploy/ship request monitored through a terminal production state, with production traffic, public route, changed flow, data tasks, and logs kept distinct?
- Dispatch artifact (table / matrix / contract / math / quotes) present for this task type?
- Weakest claim (one without an evidence block) rechecked, at the end?
- Visual claims: named screenshot file exists on disk, observations measured, motion labeled inferred unless captured over time?
- No mention of this skill in the answer; narration the artifacts supersede deleted?

<!-- Authoring note: every rule must name an output artifact whose absence is visible in the answer; exhortations ("be rigorous") are placebo — delete them. -->
