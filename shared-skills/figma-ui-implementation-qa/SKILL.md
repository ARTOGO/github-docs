---
name: figma-ui-implementation-qa
description: Mandatory cross-agent workflow for Figma-backed UI implementation and QA. Use when a task includes Figma URLs, node IDs, design states, visual parity, screenshots, modals, dropdowns, or interaction flows. Works for Codex and Claude.
---

# Figma UI Implementation QA

## Rule

Figma-backed UI work is not complete until every referenced Figma node/state has a matching runtime state with fresh browser screenshot evidence.

This skill is the shared canonical source for both Codex and Claude. Local runtime mirrors may live in:

- Codex: `~/.codex/skills/figma-ui-implementation-qa/SKILL.md`
- Claude: `~/.claude/skills/figma-ui-implementation-qa/SKILL.md`
- Claude workflow: `~/.claude/workflows/figma-compare.md`

## Mandatory Flow

### 1. Build The Design Contract

For every Figma URL or node ID:

- Run Figma `get_design_context` for the exact node.
- Run Figma `get_screenshot` for the exact node.
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

Use Playwright, `/browse`, `/gstack`, or the available browser automation on the real local app.

For every target state:

- Navigate to a valid runtime route with real data.
- Capture a runtime screenshot of the same component/state as the Figma node.
- Check console and network errors.
- Inspect computed styles only as supporting evidence. A computed-style check without a screenshot is insufficient for visual parity.
- Re-run the screenshot after every visual fix.

### 4a. Micro-Element Parity Gate

When the user points at a specific UI detail, or when the Figma node contains small but meaningful sub-elements, verify that detail separately.

Examples: icon color, icon wrapper chrome, text weight, tag color, button height, border color, spacing between two controls, hover/focus state.

Required evidence for each micro-element:

- A cropped runtime screenshot focused on the target element or its immediate group.
- Figma evidence for the same element: design context token/code, Figma screenshot crop, or pixel sample from the exact node screenshot.
- Runtime computed style for the exact rendered element, not only its parent container.
- If the element is an icon, verify the glyph itself and any wrapper separately. Ant Design upload/button wrappers often add chrome that is not visible from the icon component style alone.
- If the target is color, report both Figma expected color and runtime actual color in RGB or hex.

Do not close a visual bug by verifying only the enclosing row/card when the reported difference is a child element.

### 5. Compare And Close Gaps

Maintain a parity checklist:

| Figma node | Runtime route/state | Screenshot evidence | Result | Gaps |
| --- | --- | --- | --- | --- |

Common required checks:

- Layout order and grouping
- Container size, padding, border, radius, and background
- Typography size, weight, line-height, color, and truncation
- Icon size, color, surrounding chrome, spacing, and click target
- Button size, label, icon placement, hover/focus/disabled behavior
- State transitions: dropdown open/close, modal entry, upload, delete, expand/collapse
- Micro-elements explicitly mentioned by the user, each with their own screenshot and exact computed style

Do not say "matches Figma" until every row is `Verified`, `Not covered`, or `Blocked`.

### 6. Clean Up And Report

- Delete temporary screenshots/traces unless the user asks to keep them.
- Report Figma nodes used, runtime routes used, files changed, screenshots captured, console/network issues, and `Not covered`/`Blocked` items.

## Failure Modes To Prevent

- Only using `get_design_context` but not `get_screenshot`.
- Only checking computed styles and not capturing runtime screenshots.
- Comparing a whole long page when the issue is one component state.
- Missing sibling states such as expanded/collapsed, modal, dropdown, and uploaded/empty.
- Leaving Ant Design default button chrome when Figma shows a bare icon.
- Verifying a parent row/card while missing child-level mismatches such as icon color, typography weight, or wrapper border.
- Changing global selectors for a product-specific Figma design.
