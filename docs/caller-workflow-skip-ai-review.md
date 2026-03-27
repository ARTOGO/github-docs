# Caller Workflow：`[skip-ai-review]` 防護指引

## 背景

AI Code Review 的 Fixer 在自動修復程式碼後，會在 commit message 中加入 `[skip-ai-review]` 標記。
當此 commit push 到 PR 時，會觸發 `pull_request.synchronize` 事件，可能導致無限迴圈。

## 問題

`github.actor` 在 `pull_request` 事件中永遠是 PR 作者，不是 pusher。
因此無法用 `github.actor != 'artogo-bot[bot]'` 來過濾 bot 的 push。

## 解法

在 caller workflow 中，檢查最新 commit message 是否包含 `[skip-ai-review]`，若包含則跳過 AI Review。

## Caller Workflow 修改範例

在呼叫 reusable workflow **之前**，加入以下步驟：

```yaml
jobs:
  ai-code-review:
    runs-on: ubuntu-latest
    steps:
      # 檢查最新 commit 是否為 AI auto-fix（防止無限迴圈）
      - name: Check for skip marker
        id: check-skip
        run: |
          COMMIT_MSG=$(gh api repos/${{ github.repository }}/commits/${{ github.event.pull_request.head.sha }} --jq '.commit.message')
          if echo "$COMMIT_MSG" | grep -q '\[skip-ai-review\]'; then
            echo "skip=true" >> $GITHUB_OUTPUT
            echo "Skipping AI review: commit has [skip-ai-review] marker"
          else
            echo "skip=false" >> $GITHUB_OUTPUT
          fi
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Call AI Code Review
        if: steps.check-skip.outputs.skip != 'true'
        uses: artogo/github-docs/.github/workflows/ai-code-review-reusable.yml@main
        with:
          # ... your inputs ...
        secrets:
          # ... your secrets ...
```

## 替代方案（更簡潔）

如果 caller workflow 使用 `workflow_call` 而非直接 job，可以在 reusable workflow 的輸入加一個 `head_sha` 參數，
讓 reusable workflow 內部自行檢查。目前 reusable workflow 已在 Fixer commit message 中加入 `[skip-ai-review]`，
但因為 reusable workflow 在 `synchronize` 事件觸發時無法取得觸發 commit 的 message，
所以需要 caller 端做第一層過濾。
