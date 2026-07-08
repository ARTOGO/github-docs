# frontier-reasoning-discipline — 安裝指引（每位成員）

讓 Claude Code（Opus/Fable）與 Codex（GPT）在所有非 trivial 任務強制使用此 skill。

## 1. 安裝 skill（兩個 agent 都裝）

```bash
REPO="$(git rev-parse --show-toplevel)"  # 在 github-docs repo 內執行
mkdir -p ~/.claude/skills/frontier-reasoning-discipline ~/.codex/skills/frontier-reasoning-discipline
cp "$REPO/shared-skills/frontier-reasoning-discipline/SKILL.md" ~/.claude/skills/frontier-reasoning-discipline/SKILL.md
cp "$REPO/shared-skills/frontier-reasoning-discipline/SKILL.md" ~/.codex/skills/frontier-reasoning-discipline/SKILL.md
```

## 2. 強制使用（加入個人全域設定）

在 `~/.claude/CLAUDE.md` 與 `~/.codex/AGENTS.md` 各加入：

```markdown
## 強制 Reasoning 紀律技能（所有非 trivial 任務）

任何 BUILD、FIX、REVIEW、TEST、PLAN，或任何會宣稱「verified / 完成 / 修好」、
給出數字結論或 verdict 的任務，必須先讀並遵守
`~/.claude/skills/frontier-reasoning-discipline/SKILL.md`
（Codex 用 `~/.codex/skills/frontier-reasoning-discipline/SKILL.md`）。
```

## 3. 驗收（裝完自測）

問 agent：「X 修好了嗎？」— 回答必須以 `VERIFIED:` / `NOT VERIFIED:` / `VERDICT:` 三行開頭。
要求 agent 驗證任何數字 — 答案必須含 `Executed evidence:` 段落（完整程式碼 + 逐字輸出）。

## 維護規則

- Canonical source 是本目錄的 `SKILL.md`；個人目錄是鏡像，更新時重跑步驟 1。
- 修改 skill 前必須先有觀察到的失敗案例（RED→GREEN→REFACTOR）；禁止無測試的措辭調整。
- 實證背景：2026-07-08 以 75 次 subagent 實測建立 — Opus 4.8 / GPT 5.5 任務層 31/31 全過，
  差距集中在主張紀律；具名欄位（named slot）遵循率 5/5，散文規則僅約 1/3。
