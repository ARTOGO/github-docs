# Notion 自動化流程測試狀態

最後更新：2026-05-22 15:35 Asia/Taipei

## 目的

這份文件是目前 Notion / GitHub 自動化流程的測試盤點表。後續順序固定為：

1. 先補測所有「已實作但尚未 live 測試」的流程。
2. 測試通過後，把證據補回本文件與 `progress.json`。
3. 只有在可測流程都測完後，才開始設定 Notion Worker / Notion Agent。

## 狀態定義

| 狀態 | 意義 |
| --- | --- |
| `已 live 測` | 已使用真實 Notion card、GitHub branch / PR、GitHub Actions 跑過，且結果符合預期。 |
| `已 dry-run` | 已用真實 schema / page 或本地腳本驗證邏輯，但沒有完整跑真實 GitHub / Notion side effect。 |
| `已實作未 live 測` | workflow 或 skill 已存在，但尚未用真實測試卡跑完整流程。 |
| `未實作不可測` | 目前沒有 runtime / Worker / trigger，因此還不能測完整自動化。 |
| `已移除` | 舊流程已退出 active path，只保留 legacy 文件或歷史資料。 |

## 目前執行架構

目前 Phase 1 的正式 live runtime 是 GitHub Actions，不是 Notion Worker。

| Runtime | 狀態 | 說明 |
| --- | --- | --- |
| GitHub Actions reusable workflows | 已部署 | `github-docs/main` 提供 branch 建立、PR sync、Feature Hub cascade。 |
| Product repo caller workflows | 多數已部署 | `backend`、`officialwebsite`、`mailtemplate`、`tool-imagecompressor`、`guide-tool` 的 main/master caller 已指向 reusable workflows。 |
| Notion Worker / Notion Agent | 未實作不可測 | 文件已有目標架構，但目前沒有已部署的 Worker tool 或 Notion trigger。 |
| AI repair skill | 已實作未 live 測 | `fix-sprint-review-issues` 已改成 Review Issue 直修模型，但尚未用真實 Review Issue 做完整修 code + PR 流程。 |

## 2026-05-22 補測摘要

本輪新增一組 live flow coverage test，全部使用 `[TEST][Codex]` Notion card 與空 commit PR。

| 測試群組 | 結果 | 證據 |
| --- | --- | --- |
| Feature Hub + Repo Execution branch / PR sync | 通過 | `SB-2217` / `SB-2218`、tool-imagecompressor PR #4 / #5、runs `26273737393`, `26273785058`, `26273809670`, `26273841914`, `26273866058` |
| Repo Execution `FUNC REVIEW FAILED` rollback | 通過 | `SB-2218`、run `26273906740` |
| Feature Hub cascade | 通過 | `SB-2217` / `SB-2218`、runs `26273974018`, `26274011037`, `26274062773` |
| Review Issue closed-not-merged | 通過 | `ISS-196`、tool-imagecompressor PR #6、runs `26274138228`, `26274170667` |
| Review Issue terminal guard | 通過 | `ISS-197`、tool-imagecompressor PR #7、runs `26274239053`, `26274481889` |
| Review Issue multi-repo completion | 通過 | `ISS-198`、tool-imagecompressor PR #8、mailtemplate PR #12、runs `26274353723`, `26274377773`, `26274411662`, `26274431584` |
| Review Issue Sprint relation fallback | 通過 | `ISS-199`、tool-imagecompressor PR #9、runs `26274711348`, `26274729007` |
| Branch prefix `BUG` / `專案` | 通過 | `SB-2220` / `SB-2221`、run `26274615337` |

本輪沒有測 GitHub review `approved` / `changes_requested` / `commented` 與 `review_requested`，原因是這些需要非 PR author 的第二個 GitHub reviewer；目前不能在不打擾真實同事的情況下完成 live 測試。

## Flow A：Notion schema / 資料模型

| 流程 | 實作狀態 | 測試狀態 | 證據 / 備註 |
| --- | --- | --- | --- |
| `Review Issue` 新增 `Affected Repo Execution` | 已實作 | 已 live 測 | `ISS-195` 使用此欄位指向 `SB-2213`。 |
| `Review Issue` 新增 `Resolved Repo Execution` | 已實作 | 已 live 測 | PR #3 merge 後寫回 `SB-2213`。 |
| `Review Issue` 新增 `Repair Routing Summary` | 已實作 schema | 尚未 live 測實際 routing 寫入 | 自動 routing 尚未實作，所以未測實際內容生成。 |
| `Review Issue` 新增 `Repair PR URLs` | 已實作 | 已 live 測 | PR #3 opened/merged 後都有寫入。 |
| `Review Issue` 新增 `Last Repair Sync At` | 已實作 | 已 live 測 | PR #3 sync 後有更新。 |
| `Review Issue` 新增 `Reopen Count` | 已實作 schema | 已實作未 live 測 | reopen 自動流程未實作。 |
| `Sprint Backlog` 移除 `AI Dev Prompt` | 已實作 | 已 live schema 驗證 | 已從 live schema 移除。 |
| `Sprint Backlog` / `Review Issue` 移除 `Fix Tasks` relation | 已實作 | 已 live schema 驗證 | active model 不再依賴 Fix Task。 |

## Flow B：Repo Execution branch 建立

Runtime：`.github/workflows/notion-create-branch-reusable.yml`

| 流程 | 實作狀態 | 測試狀態 | 證據 / 備註 |
| --- | --- | --- | --- |
| `Repo Execution` 狀態為 `NOT STARTED` 或 `DEV IN PROGRESS`，且 `GitHub Branch` 空白時建立 branch | 已實作 | 已 live 測 | `SB-2213`，run `26271165149`。 |
| 建立 branch 後回寫 `GitHub Branch` | 已實作 | 已 live 測 | `SB-2213` 回寫 `feat/SB-2213_test_codex_notion_live_automat`。 |
| branch 從 repo default branch 建立 | 已實作 | 已 live 測 | `tool-imagecompressor` 測試 run 成功。 |
| 只處理符合當前 repo 的 `GitHub Repo` | 已實作 | 已 live 測單 repo | `tool-imagecompressor` run 只處理 1 張測試卡。 |
| `Feature Hub` 自身不建立 branch | 已實作 | 已 live 測 | `SB-2217` 為 Feature Hub，branch workflow 只回寫 child `SB-2218`。 |
| child `Repo Execution` branch name 使用 parent `Feature Hub` Task ID | 已實作 | 已 live 測 | `SB-2218` 回寫 `feat/SB-2217_*`，run `26273737393`。 |
| 依 `任務類型` 選 `feat` / `fix` / `project` prefix | 已實作 | 已 live 測 | `SB-2218`=`feat`、`SB-2220`=`fix`、`SB-2221`=`project`，run `26274615337`。 |
| branch 建立後 comment 通知 Developer / Assignee | 已實作 | 已實作未確認 live mention | live 測試卡未以多人通知作為驗證重點。 |
| 單張 `Repo Execution -> FUNC REVIEW FAILED` 時 rollback 到 `DEV IN PROGRESS` | 已實作 | 已 live 測 | `SB-2218`，run `26273906740`。 |

## Flow C：Sprint Backlog PR sync

Runtime：`.github/workflows/notion-pr-sync-reusable.yml`

| 流程 | 實作狀態 | 測試狀態 | 證據 / 備註 |
| --- | --- | --- | --- |
| 從 `SB-*` branch 解析 Sprint Backlog ID | 已實作 | 已 live 測 | PR #2 使用 `feat/SB-2213_*`。 |
| `Feature Hub` branch 依 repo resolve child `Repo Execution` | 已實作 | 已 live 測 | PR #4 / #5 的 branch 使用 `SB-2217`，workflow 正確更新 child `SB-2218`。 |
| PR `opened` / `reopened` -> `PR Status=Open`、`TECH REVIEW` | 已實作 | 已 live 測 | PR #2 opened，run `26271213059`。 |
| PR `review_requested` 且目前是 `DEV IN PROGRESS` -> `TECH REVIEW` | 已實作 | blocked | 需要非 PR author reviewer；本輪不 ping 真實同事。 |
| PR review `changes_requested` -> `DEV IN PROGRESS` | 已實作 | blocked | 需要非 PR author reviewer；本輪不 ping 真實同事。 |
| PR review `commented` -> `DEV IN PROGRESS` | 已實作 | blocked | 需要非 PR author reviewer；本輪不 ping 真實同事。 |
| PR review `approved` 不改狀態，等待 merge | 已實作 | blocked | 需要非 PR author reviewer；本輪不 ping 真實同事。 |
| PR closed but not merged -> `PR Status=Closed`、`DEV IN PROGRESS` | 已實作 | 已 live 測 | PR #2 closed-not-merged，run `26271239716`。 |
| PR merged to `staging` -> `STAGING FUNC REVIEW` | 已實作 | 已 live 測 | PR #4 merge 到 staging，run `26273809670`。 |
| PR merged to `main` / `master` -> `PROD FUNCTION REVIEW` | 已實作 | 已 live 測 | PR #5 merge 到 master，run `26273866058`。 |
| tech reviewer 空白時從 parent `Feature Hub` 繼承 | 已實作 | 未覆蓋 | 測試卡沒有設定 reviewer；不影響狀態同步主流程。 |
| no-backward guard 避免 terminal / advanced status 被 PR event 打回 | 已實作 | 已 live 測 | PR #5 opened 時 `SB-2218` 保持 `STAGING FUNC REVIEW`，沒有退回 `TECH REVIEW`。 |
| child 都達 `STAGING FUNC REVIEW` / `PROD FUNCTION REVIEW` / `DONE` 後 rollup parent Feature Hub | 已實作 | 已 live 測 | `SB-2217` 隨 `SB-2218` rollup 到 staging/prod，DONE 由 cascade 驗證。 |

## Flow D：Feature Hub cascade

Runtime：`.github/workflows/notion-feature-hub-cascade.yml`

| 流程 | 實作狀態 | 測試狀態 | 證據 / 備註 |
| --- | --- | --- | --- |
| `Feature Hub -> FUNC REVIEW FAILED` 時，全部 child `Repo Execution -> DEV IN PROGRESS` | 已實作 | 已 live 測 | `SB-2217` -> `SB-2218` rollback，run `26273974018`。 |
| cascade 時 comment 通知每個 child 的 Developer / Assignee | 已實作 | 未覆蓋 mention | 測試卡沒有設定 developer / assignee；流程執行成功但未驗 mention。 |
| `Feature Hub` 自身從 `FUNC REVIEW FAILED` 回 `DEV IN PROGRESS` | 已實作 | 已 live 測 | `SB-2217`，run `26273974018`。 |
| `Feature Hub -> DONE` 時，全部 child 同步 `DONE` | 已實作 | 已 live 測 | `SB-2217` -> `SB-2218`，run `26274011037`。 |
| `Feature Hub -> ABANDONED` 時，全部 child 同步 `ABANDONED` | 已實作 | 已 live 測 | `SB-2217` -> `SB-2218`，run `26274062773`。 |

## Flow E：Review Issue repair PR sync

Runtime：`.github/workflows/notion-pr-sync-reusable.yml`

| 流程 | 實作狀態 | 測試狀態 | 證據 / 備註 |
| --- | --- | --- | --- |
| 從 `ISS-*` branch 解析 Review Issue ID | 已實作 | 已 live 測 | PR #3 使用 `fix/ISS-195_*`。 |
| 用 `ISS-*` unique ID 找到 Review Issue | 已實作 | 已 live 測 | `ISS-195` sync 成功。 |
| 優先從 `Affected Repo Execution` resolve repo execution | 已實作 | 已 live 測 | `ISS-195` affected 指向 `SB-2213`。 |
| 若沒有 affected，從 linked Sprint / Feature Hub child fallback resolve repo execution | 已實作 | 已 live 測 | `ISS-199` 無 affected，透過 linked `SB-2218` resolve repo，PR #9 寫入 PR URLs。 |
| repair PR `opened` / `reopened` -> `Fixing` | 已實作 | 已 live 測 | PR #3 opened，run `26271301168`。 |
| repair PR opened 後寫入 `Repair PR URLs` | 已實作 | 已 live 測 | `ISS-195` 有 opened line。 |
| repair PR opened 後通知 Tech Reviewer / Assignee | 已實作 | 未覆蓋 mention | 測試卡沒有設定 reviewer / assignee。 |
| repair PR `review_requested` -> 維持 / 改為 `Fixing` 並通知 reviewer | 已實作 | blocked | 需要非 PR author reviewer；本輪不 ping 真實同事。 |
| repair PR review `changes_requested` -> comment 通知 developer / assignee / fixer | 已實作 | blocked | 需要非 PR author reviewer；本輪不 ping 真實同事。 |
| repair PR review `commented` -> comment 通知 developer / assignee / fixer | 已實作 | blocked | 需要非 PR author reviewer；本輪不 ping 真實同事。 |
| repair PR `approved` 不改狀態，等待 merge | 已實作 | blocked | 需要非 PR author reviewer；本輪不 ping 真實同事。 |
| repair PR closed but not merged -> 寫入 closed line，但不標 resolved | 已實作 | 已 live 測 | `ISS-196` + PR #6；opened run `26274138228`，closed run `26274170667`。 |
| repair PR merged -> 寫入 `Resolved Repo Execution` | 已實作 | 已 live 測 | PR #3 merged，run `26271344806`。 |
| repair PR merged -> `Repair PR URLs` 補上 merged line | 已實作 | 已 live 測 | `ISS-195` 有 merged line。 |
| `Resolved Repo Execution` 覆蓋全部 `Affected Repo Execution` -> `Tech Fixed` | 已實作 | 已 live 測 | `ISS-195` 單 repo、`ISS-198` 多 repo 都通過。 |
| 多 repo Review Issue 需全部 affected repo 都 resolved 才 `Tech Fixed` | 已實作 | 已 live 測 | `ISS-198` 先 merge tool-imagecompressor 維持 `Fixing`，再 merge mailtemplate 後變 `Tech Fixed`。 |
| terminal status `Verified` / `Fixed` / `Won't Fix` / `Duplicate` 不被 repair PR open 打回 | 已實作 | 已 live 測 | `ISS-197` 原本 `Fixed`，PR #7 opened/closed 後仍為 `Fixed`。 |

## Flow F：使用者端 AI repair skill

Runtime：`shared-skills/fix-sprint-review-issues/SKILL.md` 與使用者端 AI。

| 流程 | 實作狀態 | 測試狀態 | 證據 / 備註 |
| --- | --- | --- | --- |
| 使用者貼 Sprint Backlog URL，AI resolve Feature Hub / Repo Execution / Review Issue | 已實作 skill | 部分覆蓋 | 本輪透過真實 `SB-2217` / `SB-2218` / `ISS-196~199` 驗證資料可讀；尚未以使用者貼 URL 作為正式 skill E2E。 |
| 使用者貼 Review Issue URL，AI deep-read Issue / Sprint / Review Log | 已實作 skill | 部分覆蓋 | 本輪 fetch 多張 Review Issue 並依 relations 操作；尚未以正式 skill report contract 跑完。 |
| AI 判斷 affected repos，不預設全部 child repos | 已實作 skill 規則 | 部分覆蓋 | `ISS-198` 人工指定兩個 affected repos 並驗證 completion；AI 自動判斷仍未測。 |
| AI 在 live execution mode 寫回 `Affected Repo Execution` / `Repair Routing Summary` | 已實作 skill 規則 | 未覆蓋 | 本輪是用測試 setup 寫入，不是由 skill 自動 routing 寫入。 |
| AI 建立 `fix/ISS-*` branch、修 code、跑測試、開 PR | 已實作 skill 規則 | 未覆蓋 | 本輪 PR 為空 commit workflow 測試，不是實際 code repair。 |

## Flow G：Notion Worker / Notion Agent

這一段目前是目標架構，不是已部署 runtime。

| 流程 | 實作狀態 | 測試狀態 | 備註 |
| --- | --- | --- | --- |
| `Review Issue -> Open` 後自動 route affected repos | 未實作不可測 | 未測 | 需要 `route_review_issue` Worker tool 與 Notion trigger。 |
| route 後自動寫回 `Affected Repo Execution` | 未實作不可測 | 未測 | 目前 live 測試是人工設定 affected。 |
| route 後自動寫回 `Repair Routing Summary` | 未實作不可測 | 未測 | 需要 Worker / Agent 產生 rationale。 |
| route 後自動 tag 對應 repo developer / assignee | 未實作不可測 | 未測 | 現有 GitHub Actions 只處理 PR/branch 事件通知。 |
| `Review Issue` 被改回 `Open` 後自動清空 resolved / PR 摘要並 reroute | 未實作不可測 | 未測 | 需要 Notion update trigger。 |
| 所有 affected repo 完成後由 Worker `complete_review_issue_if_ready` 判斷 | 部分由 GitHub Actions 實作 | Worker 未實作 | 目前 GitHub Actions 在 repair PR merge 後會做單 issue completion check。 |
| Feature Hub 底下所有 Review Issue 都不再 `Open/Fixing` 時通知 tester retest | 未實作不可測 | 未測 | 需要 Worker 查詢 Feature Hub issue set。 |
| `create_execution_branch` Worker tool | 未實作不可測 | 未測 | Phase 1 由 GitHub Actions branch workflow 負責。 |

## Flow H：已移除 / legacy path

| 舊流程 | 狀態 | 備註 |
| --- | --- | --- |
| `Review Issue -> Fix Task` 自動 fan-out | 已移除 | 不再是 active workflow。 |
| `Fix Task -> Fix Branch` | 已移除 | Repair branch 改由 `Review Issue` 的 `ISS-*` 分支處理。 |
| `AI Dev Prompt` 自動生成 | 已移除 | `Sprint Backlog` schema 已移除欄位。 |
| 用 Fix Task count 判斷 Review Issue 是否完成 | 已移除 | 改為 `Affected Repo Execution` / `Resolved Repo Execution`。 |
| AI code review reusable workflow | 已移除 | 不再由 push / PR 觸發 AI review。 |

## Caller repo 部署狀態

| Repo | 部署分支 | Caller 狀態 | 測試狀態 / 備註 |
| --- | --- | --- | --- |
| `github-docs` | `main` | reusable workflows 已更新 | 本文件所在 repo。 |
| `backend` | `master` | caller 指向 `github-docs@main` 且帶 `REVIEW_ISSUE_DB_ID` | 尚未 live 測該 repo；本地 `.env` 有既有未提交變更。 |
| `officialwebsite` | `master` | caller 指向 `github-docs@main` 且帶 `REVIEW_ISSUE_DB_ID` | 尚未 live 測該 repo。 |
| `guide-tool` | `main` | `origin/main` caller 已更新 | 本地目前在既有 feature branch，該 branch 仍可看到舊 secret 參數；不代表 `origin/main` 未更新。 |
| `mailtemplate` | `main` | caller 指向 `github-docs@main` 且帶 `REVIEW_ISSUE_DB_ID` | 已用 PR #12 live 測 multi-repo repair sync。 |
| `tool-imagecompressor` | `master` | caller 指向 `github-docs@main` 且帶 `REVIEW_ISSUE_DB_ID` | 已作為主要 live 測試 repo。 |

## Notion Worker 前必須補測的項目

以下項目已完成 live 測試：

1. `SB-*` PR merge 到 `staging -> STAGING FUNC REVIEW`。
2. `SB-*` PR merge 到 `main/master -> PROD FUNCTION REVIEW`。
3. `Feature Hub` child status rollup。
4. `Feature Hub -> FUNC REVIEW FAILED` cascade。
5. `Feature Hub -> DONE` cascade。
6. `Feature Hub -> ABANDONED` cascade。
7. 單張 `Repo Execution -> FUNC REVIEW FAILED` rollback。
8. `ISS-*` repair PR closed-not-merged。
9. 多 repo `Review Issue` completion。
10. terminal status guard：`Fixed` / `Verified` / `Won't Fix` / `Duplicate` 不被 opened repair PR 誤改。
11. `ISS-*` fallback from linked Sprint Backlog。
12. `BUG` / `專案` branch prefix。

以下項目目前 blocked 或未覆蓋，不能當成已測：

1. `SB-*` PR `review_requested -> TECH REVIEW`：需要非 PR author reviewer，本輪不 ping 真實同事。
2. `SB-*` PR review `changes_requested/commented -> DEV IN PROGRESS`：需要非 PR author reviewer。
3. `SB-*` PR `approved` 不改狀態：需要非 PR author reviewer。
4. `ISS-*` repair PR `review_requested`：需要非 PR author reviewer。
5. `ISS-*` repair PR review `changes_requested/commented`：需要非 PR author reviewer。
6. `ISS-*` repair PR `approved` 不改狀態：需要非 PR author reviewer。
7. 使用者端 AI skill 正式 E2E：本輪只測 workflow sync，尚未跑實際 code repair。

## Worker 設定 Gate

在以下條件成立前，不開始 Notion Worker / Agent 設定：

1. 上方「Notion Worker 前必須補測的項目」已完成，或每個未測項都有明確 blocked reason。
2. 測試證據已回寫本文件與 `progress.json`。
3. 若測試中發現 workflow bug，先修 GitHub Actions / skill，再重新補測。
4. 確認 Notion Worker 要接手的責任只剩 Notion-side routing / trigger，不重複 GitHub Actions 已穩定負責的 PR sync。
