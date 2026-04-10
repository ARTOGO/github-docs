# Caller Workflow：AI Review 呼叫指引

## 現況

AI review reusable workflow 現在只做 review，不再自動修改程式碼、push commit、或依賴 `[skip-ai-review]` 防無限迴圈。

這代表 caller workflow 不需要再檢查最新 commit message 是否包含 `[skip-ai-review]`。

## 建議觸發時機

常見做法是在以下 PR 事件呼叫 reusable workflow：

- `pull_request.opened`
- `pull_request.reopened`
- `pull_request.synchronize`

如果你的 product repo 希望在開發者按下 Re-request review 後也重新跑一次 AI review，可以額外接 `pull_request.review_requested`。

## 建議 caller workflow 範例

```yaml
name: AI Code Review

on:
  pull_request:
    types:
      - opened
      - reopened
      - synchronize

jobs:
  ai-code-review:
    uses: artogo/github-docs/.github/workflows/ai-code-review-reusable.yml@main
    with:
      pr_number: ${{ github.event.pull_request.number }}
      pr_url: ${{ github.event.pull_request.html_url }}
      head_branch: ${{ github.event.pull_request.head.ref }}
      base_branch: ${{ github.event.pull_request.base.ref }}
      repo_full_name: ${{ github.repository }}
    secrets:
      NOTION_API_KEY: ${{ secrets.NOTION_API_KEY }}
      NOTION_DATABASE_ID: ${{ secrets.NOTION_DATABASE_ID }}
      FIX_TASK_DB_ID: ${{ secrets.FIX_TASK_DB_ID }}
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      BOT_APP_ID: ${{ secrets.BOT_APP_ID }}
      BOT_PRIVATE_KEY: ${{ secrets.BOT_PRIVATE_KEY }}
```

## 目前 reusable workflow 的行為

- Reviewer 組合：Claude + Codex
- 輸入範圍：只看 PR changed files / changed hunks 的 patch bundle
- 流程：各自 review -> 互相 critique 對方 findings -> 輸出 agreed / disputed findings
- 不會自動修 code，也不會寫回 PR branch
- `Review Mode = AI Only` 且 clean pass 時，仍可自動 merge
- `Review Mode = Human Review` 時，clean pass 或 disputed-only 會把球交回人工 reviewer

## 舊文件說明

本檔案原本描述 `[skip-ai-review]` 防護。該機制屬於舊版 auto-fix 流程，現在已不再使用，保留此檔案是為了讓既有連結不失效。
