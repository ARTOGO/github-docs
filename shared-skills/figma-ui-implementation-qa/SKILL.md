---
name: figma-ui-implementation-qa
description: Mandatory cross-agent workflow for Figma-backed UI implementation and QA. Use when a task includes Figma URLs, node IDs, design states, visual parity, screenshots, modals, dropdowns, or interaction flows. Works for Codex and Claude.
---

# Figma UI Implementation QA

## Rule

Figma-backed UI work is not complete until every referenced Figma node/state has a matching runtime state, proven by BOTH a **per-element dimension ledger** AND an **adversarial high-zoom per-element diff that passes in one clean run**. A screenshot alone, computed-style numbers alone, or a glance at a whole-page screenshot are each insufficient on their own.

This skill is the shared canonical source for both Codex and Claude. Local runtime mirrors may live in:

- Codex: `~/.codex/skills/figma-ui-implementation-qa/SKILL.md`
- Claude: `~/.claude/skills/figma-ui-implementation-qa/SKILL.md`
- Claude workflow: `~/.claude/workflows/figma-compare.md` (this is the G2 diff procedure)

## Root-Cause Post-Mortem — read this first

This skill was hardened after one card (SB-2229 data center) took **~14 commits and 10+ user-caught rounds** to match Figma. The user had to act as QA, finding each difference one at a time. It was never a capability problem — it was a **verification-discipline** problem. The exact failures, so they are never repeated:

1. **Partial measurement masquerading as verification.** Each round only the few dimensions that happened to come to mind were measured (e.g. first-card-left, search-right), then "done" was declared. The footer alone needed THREE rounds — horizontal inset, then button width, then the 20px below the button — because all of the footer's dimensions were never measured at once. One-axis-at-a-time fixing = the user becomes your QA.
2. **Computed-style numbers gave false confidence.** Token/size matches are not visual parity. They never caught: the wrong product-icon glyph (2×2 grid vs layout-window outline), the wrong "…" orientation (vertical ⋮ vs horizontal ⋯), a raw ISO timestamp vs YYYY-MM-DD, the status text contradiction (上線中 + 尚未上線), or the icon being **clipped by an `overflow:hidden` ancestor**. Every token matched; the pixels did not.
3. **Eyeballing is unreliable for sub-20px differences.** Shown the two crops side by side, the difference (footer inset; button-to-bottom gap) still could not be named by eye. That is exactly why partial numbers got leaned on — and why glancing at a whole-page screenshot is worthless: it hides everything under ~20px.
4. **Premature "matches / 相符 / pixel-perfect".** It was said before the adversarial diff confirmed, repeatedly, even immediately after acknowledging the same mistake. Wanting to close the item lowered the evidence bar every single time.
5. **No full element × state × dimension contract up front.** Work was reactive, element-by-element as the user surfaced them, sometimes from an incomplete/older Figma node.
6. **Structural traps are invisible to element-style checks.** The icon clipping (`overflow:hidden` cover wrapper) and the footer living OUTSIDE the padded `.body` were DOM-structure bugs. The element's own computed style looked correct; only measuring the *rendered position vs the expected position* exposed them.

What worked every time was the **adversarial per-element high-zoom diff** (one agent per element; zoom both Figma and runtime; an independent agent re-verifies each claimed gap). Run it BEFORE you claim, not after the user catches you.

## Enforced Gates — hard stops

These are not advice. If any gate is unmet, the work is NOT done and you may NOT say it matches.

- **G1 — Dimension ledger before any "done".** For every element, fill a ledger row with EVERY dimension at once: top / right / bottom / left inset (or padding), width, height, each gap to its neighbours, the sub-glyph / icon identity, the container it lives in + any `overflow`/clip, and z-index / paint order if it overlaps a sibling. Each cell = Figma value vs runtime measured value. A missing cell = not verified.
- **G2 — Adversarial high-zoom diff before any claim.** Run the per-element Figma-vs-runtime diff (the `figma-compare` workflow: one agent per element; `get_screenshot` at maxDimension ≥ 2048; zoom to the element; compare glyph / pixel / spacing; then an independent agent re-verifies each claimed gap). Require a single clean consolidated run with 0 confirmed gaps. Re-run it AFTER fixes — a change can regress a neighbour.
- **G3 — Forbidden phrases.** "matches Figma", "pixel-perfect", "parity verified", "相符", "像素級", "全部命中", "13/13" are BANNED until G1 and G2 are complete and green. If you are about to type one, stop and run G2 first.
- **G4 — Measure, never eyeball.** Never declare a match from a glance or a whole-page screenshot. Require measured pixels (`getBoundingClientRect` / computed style) AND a high-zoom crop comparison. If the user sees a difference you cannot, that means MEASURE harder — not "it's fine".
- **G5 — Structural-trap sweep.** For each element explicitly check: clipped by an ancestor `overflow:hidden`? inside the correct padded container? correct positioning ancestor for `absolute`? correct z-index / paint order when overlapping? height inflated by `line-height` where Figma uses cap-trimmed text (`text-box-trim`)? These never appear in a single element's own computed style.

## Mandatory Flow

### 1. Build The Design Contract

For every Figma URL or node ID:

- Run Figma `get_design_context` for the exact node.
- Run Figma `get_screenshot` for the exact node.
- Pin ONE canonical node as the source of truth and enumerate its FULL element list before coding (the SB-2229 mess started from an older/stripped variant that lacked the "…" menu and StatusTag).
- Record node ID, visible text, controls, icon behavior, layout, sizing, spacing, color, typography, and interaction state.
- If multiple Figma nodes are provided, each node must get its own contract row.
- Do not implement from memory, nearby frames, or only one node when the user gave multiple nodes.

### 2. Map Runtime Surface

Before editing:

- Identify route, component, file path, data shape, feature flag/product context, and required auth/data.
- Determine every runtime state needed to reproduce the Figma states: empty, uploaded, expanded, collapsed, dropdown, modal, hover, disabled, error.
- Scope product-specific designs narrowly. Do not change global behavior unless Figma explicitly applies globally.

### 3. Implement Against Project Patterns

- Reuse existing components, tokens, i18n, SCSS modules, mixins, and helper APIs.
- Translate Figma output into the project stack; do not copy Tailwind or generated React blindly.
- Prefer final rendered parity over literal CSS value copying when project tokens provide equivalent output.
- Keep changes scoped to the target page/product.

### 4. Verify With Real Browser Evidence

Use `agent-browser` on the real local app.

For every target state:

- Navigate to a valid runtime route with real data.
- Capture a runtime screenshot of the same component/state as the Figma node.
- Check console and network errors.
- Inspect computed styles only as supporting evidence. A computed-style check without a screenshot is insufficient for visual parity (see Root-Cause #2).
- Re-run the screenshot after every visual fix.

### 4a. Micro-Element Parity Gate

When the user points at a specific UI detail, or when the Figma node contains small but meaningful sub-elements, verify that detail separately.

Examples: icon color, icon glyph shape, icon orientation, icon wrapper chrome, text weight, tag color, tag height, button height, button width %, border color, spacing between two controls, the gap below/around a control, hover/focus state.

Required evidence for each micro-element:

- A cropped runtime screenshot focused on the target element or its immediate group.
- Figma evidence for the same element: design context token/code, Figma screenshot crop, or pixel sample from the exact node screenshot.
- Runtime computed style AND `getBoundingClientRect` position for the exact rendered element, not only its parent container.
- If the element is an icon, verify the glyph itself (shape + orientation), its size, AND any wrapper separately. Ant Design wrappers add chrome; antd glyphs (EyeOutlined, MoreOutlined) often differ from the Figma glyph.
- If the target is color, report both Figma expected color and runtime actual color in RGB or hex.

Do not close a visual bug by verifying only the enclosing row/card when the reported difference is a child element.

### 5. Compare And Close Gaps — the dimension ledger (G1)

Maintain, per element, a ledger that proves EVERY dimension at once (not one axis per round):

| Element | Figma | Runtime | top/r/b/l inset | width | height | gaps to neighbours | glyph/sub-icon | container + overflow/clip | result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Common required checks (each is a column above, measured, not eyeballed):

- Layout order and grouping
- Container size, padding, border, radius, background — AND whether it clips children (`overflow`)
- Element position: all four insets, plus the gap to every neighbour (above/below/left/right), in ONE pass
- Typography size, weight, line-height, color, truncation — and box height vs Figma cap-trimmed height
- Icon glyph identity + orientation, size, color, surrounding chrome, spacing, click target
- Button size, width %, label, icon placement, hover/focus/disabled behavior, the gap below it to the container
- State transitions: dropdown open/close, modal entry, upload, delete, expand/collapse
- Micro-elements explicitly mentioned by the user, each with its own crop + exact computed style + position

Do not say it matches Figma (G3) until every row is `Verified` (with the ledger filled and the G2 diff green), `Not covered`, or `Blocked`.

### 6. Clean Up And Report

- Delete temporary screenshots/traces unless the user asks to keep them.
- Restore any test data/state you changed (DB rows, roles, passwords, plan grants).
- Report Figma nodes used, runtime routes used, files changed, screenshots captured, console/network issues, the G2 diff result, and `Not covered`/`Blocked` items.

## Failure Modes To Prevent

- Only using `get_design_context` but not `get_screenshot`.
- Only checking computed styles and not capturing runtime screenshots.
- Trusting token/size matches as visual parity (they miss wrong glyph, wrong orientation, wrong text format, clipping).
- Fixing one dimension per round (horizontal, then width, then vertical) instead of measuring all of an element's dimensions at once.
- Eyeballing a whole-page or low-zoom screenshot — it hides sub-20px differences. Measure + high-zoom crop instead.
- Saying "matches / 相符 / pixel-perfect" before the G2 adversarial diff passes in one clean run.
- Comparing a whole long page when the issue is one component state.
- Missing sibling states such as expanded/collapsed, modal, dropdown, and uploaded/empty.
- Leaving Ant Design default button/icon chrome (or an antd glyph) when Figma shows a bare or different glyph.
- Verifying a parent row/card while missing child-level mismatches such as icon color, glyph shape, typography weight, or wrapper border.
- Ignoring structural traps: an `overflow:hidden` ancestor clipping a straddling element; an element in the wrong padded container; a missing positioning ancestor; wrong z-index/paint order.
- Changing global selectors for a product-specific Figma design.
