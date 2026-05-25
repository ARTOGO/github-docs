# Notion 自動化流程測試狀態

最後更新：2026-05-25 17:30 Asia/Taipei

## 目的

這份文件是目前 Notion / GitHub 自動化流程的測試盤點表。後續順序固定為：

1. 先補測所有「已實作但尚未 live 測試」的流程。
2. 測試通過後，把證據補回本文件與 `progress.json`。
3. 只有在可測流程都測完後，才開始設定 Notion Worker / Notion Agent。

圖像化 flow map：[docs/notion-automation-flow-map.md](./notion-automation-flow-map.md)。

## 狀態定義

| 狀態 | 意義 |
| --- | --- |
| `已 live 測` | 已使用真實 Notion card、GitHub branch / PR、GitHub Actions 跑過，且結果符合預期。 |
| `已 dry-run` | 已用真實 schema / page 或本地腳本驗證邏輯，但沒有完整跑真實 GitHub / Notion side effect。 |
| `已實作未 live 測` | workflow 或 skill 已存在，但尚未用真實測試卡跑完整流程。 |
| `未實作不可測` | 目前沒有 runtime / Worker / trigger，因此還不能測完整自動化。 |
| `已移除` | 舊流程已退出 active path，只保留 legacy 文件或歷史資料。 |

## 目前執行架構

目前正式 runtime 是混合架構：GitHub Actions 負責 branch / PR sync / cascade；Notion Worker / Custom Agent 負責 Notion-side Review Issue routing / reroute / completion / retest notification。

| Runtime | 狀態 | 說明 |
| --- | --- | --- |
| GitHub Actions reusable workflows | 已部署 | `github-docs/main` 提供 branch 建立、PR sync、Feature Hub cascade。 |
| Product repo caller workflows | 多數已部署 | `backend`、`officialwebsite`、`mailtemplate`、`tool-imagecompressor`、`guide-tool` 的 main/master caller 已指向 reusable workflows。 |
| Notion Worker / Notion Agent | Hosted Worker 已部署；Custom Agent triggers 已 live 測 | Worker `019e5e25-63de-76ab-8dfd-2cfb108eae66` 已連到 `Artogo Review Issue Router`。`ISS-209` 驗證 page-added route、resolved update complete、status back to Open reroute；`ISS-210` 驗證 Feature Hub retest notification。 |
| AI repair skill | 已 live 測核心 E2E | `fix-sprint-review-issues` 已用真實 `ISS-201` 跑過 repo 判斷、Notion 回寫、branch、README 修復、測試、PR merge 與 repair sync。 |

## 2026-05-22 補測摘要

本輪新增多組 live flow coverage test，全部使用 `[TEST][Codex]` Notion card。多數 GitHub Actions 狀態機使用空 commit PR；AI repair skill E2E 使用真實 README 文字修復 PR。

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
| Reviewer event / Notion mention 補測 | 通過 | `SB-2222` / `SB-2223`、`ISS-200`、tool-imagecompressor PR #10 / #11、runs `26282142330`, `26282194741`, `26282238457`, `26282312397`, `26282354736`, `26282409153`, `26282501635`, `26292164189`, `26292193861`, `26319498585`, `26320506418`, `26323416359` |
| Parent Feature Hub reviewer inheritance | 通過 | `SB-2224`、tool-imagecompressor PR #13、runs `26282892876`, `26282931319`, `26282986105` |
| 使用者端 AI repair skill E2E | 通過 | `ISS-201`、tool-imagecompressor PR #12 / #14 / #15 / #16、runs `26282735804`, `26282770577`, `26282808528`, `26283054976`, `26283144472`, `26283144522`, `26283215554`, `26283307702`, `26283299721`, `26283432982`, `26283550987` |

GitHub `review_requested` 已 live 測。`SB-*` PR review `commented`、`changes_requested` 與 `approved` 已由 Zeal Lin 的真人 review 測到。`ISS-*` repair PR review `commented` 已由 Gemini Code Assist 的真實 `pull_request_review COMMENTED` 測到，`ISS-*` repair PR `approved` 與 `changes_requested` 已由 Zeal Lin 的真人 review 測到。review submitted 類可測 path 已補測完成。

注意：`SB-*` review `approved` 設計上不會新增 Notion comment，也不會改變目前卡片狀態；PR #10 run `26320506418` log 顯示 `Approved -> waiting for merge`，`SB-2223` 維持 `TECH REVIEW` / `PR Status=Open`。

注意：多次測試觀察到 Notion API / database query 有短暫索引延遲。剛建立或剛切狀態的測試卡，workflow 第一次可能找到 0 張，約 20 秒後 rerun 即可抓到目標卡；後續 Worker 設計需要納入 retry / backoff。

## Flow A：Notion schema / 資料模型

| 流程 | 實作狀態 | 測試狀態 | 證據 / 備註 |
| --- | --- | --- | --- |
| `Review Issue` 新增 `Affected Repo Execution` | 已實作 | 已 live 測 | `ISS-195` 使用此欄位指向 `SB-2213`。 |
| `Review Issue` 新增 `Resolved Repo Execution` | 已實作 | 已 live 測 | PR #3 merge 後寫回 `SB-2213`。 |
| `Review Issue` 新增 `Repair Routing Summary` | 已實作 schema | 已 live 測 skill 寫入 | `ISS-201` 由 AI repair skill 寫入 repo routing summary。 |
| `Review Issue` 新增 `Repair PR URLs` | 已實作 | 已 live 測 | PR #3 opened/merged 後都有寫入。 |
| `Review Issue` 新增 `Last Repair Sync At` | 已實作 | 已 live 測 | PR #3 sync 後有更新。 |
| `Review Issue` 新增 `Reopen Count` | 已實作 | 已 live 測 trigger | `ISS-209` 從 `Tech Fixed` 改回 `Open` 後觸發 reroute，`Reopen Count=1`。 |
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
| branch 建立後 comment 通知 Developer / Assignee | 已實作 | 已 live 測 | `SB-2223` comment 有 Zeal Lin mention，run `26282142330`。 |
| 單張 `Repo Execution -> FUNC REVIEW FAILED` 時 rollback 到 `DEV IN PROGRESS` | 已實作 | 已 live 測 | `SB-2218` run `26273906740`；`SB-2223` run `26282409153` 另驗證 rollback comment mention Zeal Lin。 |

## Flow C：Sprint Backlog PR sync

Runtime：`.github/workflows/notion-pr-sync-reusable.yml`

| 流程 | 實作狀態 | 測試狀態 | 證據 / 備註 |
| --- | --- | --- | --- |
| 從 `SB-*` branch 解析 Sprint Backlog ID | 已實作 | 已 live 測 | PR #2 使用 `feat/SB-2213_*`。 |
| `Feature Hub` branch 依 repo resolve child `Repo Execution` | 已實作 | 已 live 測 | PR #4 / #5 的 branch 使用 `SB-2217`，workflow 正確更新 child `SB-2218`。 |
| PR `opened` / `reopened` -> `PR Status=Open`、`TECH REVIEW` | 已實作 | 已 live 測 | PR #2 opened，run `26271213059`。 |
| PR `review_requested` 且目前是 `DEV IN PROGRESS` -> `TECH REVIEW` | 已實作 | 已 live 測 | PR #10 request `zeallin`，run `26282238457`，`SB-2223` 回到 `TECH REVIEW` 並 comment mention reviewer。 |
| PR review `changes_requested` -> `DEV IN PROGRESS` | 已實作 | 已 live 測 | PR #10 Zeal Lin `CHANGES_REQUESTED`，run `26319498585`；`SB-2223 -> DEV IN PROGRESS`，Notion comment mention Zeal Lin：「Tech Review 未通過」。 |
| PR review `commented` -> `DEV IN PROGRESS` | 已實作 | 已 live 測 | PR #10 Zeal Lin `COMMENTED`，run `26292164189`；`SB-2223 -> DEV IN PROGRESS`，Notion comment mention Zeal Lin：「Tech Reviewer 有留言需要回應」。 |
| PR review `approved` 不改狀態，等待 merge | 已實作 | 已 live 測 | PR #10 Zeal Lin `APPROVED`，run `26320506418`；log 顯示 `Approved -> waiting for merge`，`SB-2223` 維持 `TECH REVIEW` / `PR Status=Open` 且沒有新增 approve-specific comment，符合設計。 |
| PR closed but not merged -> `PR Status=Closed`、`DEV IN PROGRESS` | 已實作 | 已 live 測 | PR #2 closed-not-merged，run `26271239716`。 |
| PR merged to `staging` -> `STAGING FUNC REVIEW` | 已實作 | 已 live 測 | PR #4 merge 到 staging，run `26273809670`。 |
| PR merged to `main` / `master` -> `PROD FUNCTION REVIEW` | 已實作 | 已 live 測 | PR #5 merge 到 master，run `26273866058`。 |
| tech reviewer 空白時從 parent `Feature Hub` 繼承 | 已實作 | 已 live 測 | `SB-2224` 無 child reviewer，從 parent `SB-2222` 繼承 Zeal Lin；PR #13 opened sync run `26282931319`。 |
| no-backward guard 避免 terminal / advanced status 被 PR event 打回 | 已實作 | 已 live 測 | PR #5 opened 時 `SB-2218` 保持 `STAGING FUNC REVIEW`，沒有退回 `TECH REVIEW`。 |
| child 都達 `STAGING FUNC REVIEW` / `PROD FUNCTION REVIEW` / `DONE` 後 rollup parent Feature Hub | 已實作 | 已 live 測 | `SB-2217` 隨 `SB-2218` rollup 到 staging/prod，DONE 由 cascade 驗證。 |

## Flow D：Feature Hub cascade

Runtime：`.github/workflows/notion-feature-hub-cascade.yml`

| 流程 | 實作狀態 | 測試狀態 | 證據 / 備註 |
| --- | --- | --- | --- |
| `Feature Hub -> FUNC REVIEW FAILED` 時，全部 child `Repo Execution -> DEV IN PROGRESS` | 已實作 | 已 live 測 | `SB-2217` -> `SB-2218` rollback，run `26273974018`。 |
| cascade 時 comment 通知每個 child 的 Developer / Assignee | 已實作 | 已 live 測 | `SB-2222` -> `SB-2223` rollback run `26282501635`，child comment mention Zeal Lin。 |
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
| repair PR opened 後通知 Tech Reviewer / Assignee | 已實作 | 已 live 測 | `ISS-200` / PR #11 opened run `26282312397`，comment mention Zeal Lin。`ISS-201` / PR #12 也寫入 opened line。 |
| repair PR `review_requested` -> 維持 / 改為 `Fixing` 並通知 reviewer | 已實作 | 已 live 測 | PR #11 request `zeallin`，run `26282354736`，`ISS-200` 維持 `Fixing` 並 comment mention reviewer。 |
| repair PR review `changes_requested` -> comment 通知 developer / assignee / fixer | 已實作 | 已 live 測 | PR #11 Zeal Lin `CHANGES_REQUESTED`，run `26323416359`；`ISS-200` 維持 `Fixing`，`Repair PR URLs` 追加 submitted line，Notion comment mention Zeal Lin：「Repair PR 未通過」。 |
| repair PR review `commented` -> comment 通知 developer / assignee / fixer | 已實作 | 已 live 測 | Gemini Code Assist 在 PR #12 / #14 / #15 送出真實 `pull_request_review COMMENTED`，runs `26282808528`, `26283144472`, `26283307702` 寫入 submitted line 與 Notion comment。 |
| repair PR `approved` 不改狀態，等待 merge | 已實作 | 已 live 測 | PR #11 Zeal Lin `APPROVED`，run `26292193861`；log 顯示 `Approved -> waiting for merge`，`ISS-200` 維持 `Fixing` 且沒有新增 comment，符合設計。 |
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
| 使用者貼 Sprint Backlog URL，AI resolve Feature Hub / Repo Execution / Review Issue | 已實作 skill | 已 live 測核心 E2E | `ISS-201` E2E 以真實 Review Issue 入口執行；過程往上 resolve 到 `SB-2223` 與 repo。Sprint Backlog URL 入口未單獨另跑一次，但相同 relation resolve 已用真實資料驗證。 |
| 使用者貼 Review Issue URL，AI deep-read Issue / Sprint / Review Log | 已實作 skill | 已 live 測 | `ISS-201` deep-read 後判定只需修 `tool-imagecompressor`。 |
| AI 判斷 affected repos，不預設全部 child repos | 已實作 skill 規則 | 已 live 測單 repo | `ISS-201` 判斷只影響 `tool-imagecompressor`，未建立其他 repo branch。 |
| AI 在 live execution mode 寫回 `Affected Repo Execution` / `Repair Routing Summary` | 已實作 skill 規則 | 已 live 測 | `ISS-201` 寫回 `Affected Repo Execution`、`Resolved Repo Execution` 與 `Repair Routing Summary`。 |
| AI 建立 `fix/ISS-*` branch、修 code、跑測試、開 PR | 已實作 skill 規則 | 已 live 測 | branch `fix/ISS-201_readme_local_test_path_clarification` 修 README；跑 `yarn prettier --check README.md`、`git diff --check`；PR #12 合併後 `ISS-201 -> Tech Fixed`，後續 PR #14 / #15 / #16 修 Gemini review comment。 |

## Flow G：Notion Worker / Notion Agent

這一段已完成 Worker-compatible tool implementation、Hosted Worker deploy、Custom Agent tool/access 設定，以及 Review Issue route / complete / reroute / retest notification 的 Custom Agent trigger live side-effect test。GitHub branch / PR sync 仍由 GitHub Actions 負責。

| 流程 | 實作狀態 | 測試狀態 | 備註 |
| --- | --- | --- | --- |
| `Review Issue -> Open` 後自動 route affected repos | Worker tool + Custom Agent trigger 已實作 | 已 live 測 trigger | `ISS-208` 與 `ISS-209` 由 Review Issue page-added trigger 呼叫 `routeReviewIssue`。最新 Worker run `019e5e5f-d043-74b8-96df-968bb7ff3ceb` 將 `ISS-209` route 到 `SB-2223` / `tool-imagecompressor`。 |
| route 後自動寫回 `Affected Repo Execution` | Worker tool + Custom Agent trigger 已實作 | 已 live 測 trigger | `ISS-209` 寫入 `Affected Repo Execution = SB-2223`。 |
| route 後自動寫回 `Repair Routing Summary` | Worker tool + Custom Agent trigger 已實作 | 已 live 測 trigger | `ISS-209` 寫入 `[Notion Worker] Review Issue routing` summary，reason 為 issue title 提到 `tool-imagecompressor`。 |
| route 後自動 tag 對應 repo developer / assignee | Worker tool + Custom Agent trigger 已實作 | 已 live 測 trigger | `ISS-209` comment mention Zeal Lin：「Worker 已判斷此 Review Issue 需要修復 repo」。 |
| `Review Issue` 被改回 `Open` 後自動清空 resolved / PR 摘要並 reroute | Worker tool + Custom Agent trigger 已實作 | 已 live 測 trigger | `ISS-209` 從 `Tech Fixed` 改回 `Open` 後觸發 run `019e5e6a-a110-7589-bd30-27de1a9d33f2`；`Resolved Repo Execution` / `Repair PR URLs` 清空，`Reopen Count=1`，並重新 comment mention Zeal Lin。 |
| 所有 affected repo 完成後由 Worker `complete_review_issue_if_ready` 判斷 | Worker tool + Custom Agent trigger 已實作 | 已 live 測 trigger | `ISS-209` 更新 `Resolved Repo Execution = SB-2223` 後觸發 run `019e5e67-e0ed-7f03-98b2-ec834ca1ab18`，狀態改為 `Tech Fixed` 並新增 completion comment。 |
| Feature Hub 底下所有 Review Issue 都不再 `Open/Fixing` 時通知 tester retest | Worker tool + Custom Agent trigger 已實作 | 已 live 測 trigger | `ISS-210` 直接綁定 `SB-2222` Feature Hub；`completeReviewIssueIfReady` run `019e5e74-d26d-7559-899b-ff928b674209` 回傳 `retestNotifications=1`，並在 `SB-2222` comment mention Zeal Lin：「所有 Review Issue 都已完成修復，請重新進行 Function Review / retest。」 |
| `create_execution_branch` Worker tool | 非 active path | 不適用 | branch 建立由 GitHub Actions branch workflow 正式負責且已 live 測；Worker 不重複建立 branch，避免雙 runtime race。 |

注意：Notion Custom Agent page-added trigger 不是即時。`ISS-209` 於 2026-05-25 16:57 建立，Worker run 於 17:03:18 開始，觀察到約 6 分鐘延遲；property update triggers 目前觀察約 1 分鐘內可觸發。

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
| `tool-imagecompressor` | `master` | caller 指向 `github-docs@main` 且帶 `REVIEW_ISSUE_DB_ID` | 已作為主要 live 測試 repo；`master` 目前包含 PR #16 的 README 測試路徑說明修正。 |

## Notion Worker 前置補測結果

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
13. `SB-*` PR `review_requested -> TECH REVIEW`。
14. branch / PR / cascade Notion comment mention。
15. `ISS-*` repair PR `review_requested`。
16. `ISS-*` repair PR review `commented`，以 Gemini Code Assist 真實 `pull_request_review COMMENTED` 驗證。
17. parent Feature Hub tech reviewer inheritance。
18. 使用者端 AI repair skill 核心 E2E。
19. `SB-*` PR review `commented -> DEV IN PROGRESS`，以 Zeal Lin 真人 `pull_request_review COMMENTED` 驗證。
20. `ISS-*` repair PR review `approved` 不改狀態，等待 merge。
21. `SB-*` PR review `changes_requested -> DEV IN PROGRESS`，以 Zeal Lin 真人 `pull_request_review CHANGES_REQUESTED` 驗證。
22. `SB-*` PR review `approved` 不改狀態，等待 merge。
23. `ISS-*` repair PR review `changes_requested` comment 通知，並維持 `Fixing`。
24. `Review Issue` page-added route trigger。
25. `Review Issue` resolved relation update completion trigger。
26. `Review Issue` status back to `Open` reroute trigger。
27. Feature Hub retest notification trigger。

目前 GitHub Actions / 使用者端 AI repair skill / Notion Worker + Custom Agent 的 active path 已完成 live 測試，已無 reviewer-event blocked 項目。

補充：PR #10 / PR #11 的真人 review submitted path 已完成。Gemini 在空 commit PR #10 / #11 留的是 regular PR issue comment，不是 `pull_request_review`，不能用來驗證 `SB-*` review submitted path；正式驗證仍以 Zeal Lin / Gemini Code Assist 的 `pull_request_review` event 為準。

## Worker 設定結果

Notion Worker / Agent 設定已完成，結論如下：

1. `Artogo Review Issue Router` 已連接 Review Issue / Sprint Backlog access 與 `artogo-product-workflow` Worker tools。
2. 測試證據已回寫本文件、`docs/notion-automation-flow-map.md` 與 `progress.json` / `progress.html`。
3. Notion Worker active responsibility 限定為 Review Issue routing / reroute / completion / retest notification。
4. Repo Execution branch 建立、GitHub PR sync 與 Feature Hub cascade 繼續由 GitHub Actions 負責，避免與 Worker 形成雙 runtime race。
