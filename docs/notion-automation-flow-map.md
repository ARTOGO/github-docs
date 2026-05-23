# Notion 自動化 Flow Map

最後更新：2026-05-23 09:23 Asia/Taipei

這份文件用圖像化方式呈現目前 Notion / GitHub / AI repair 自動化流程，並標註每個節點的實作與測試狀態。

Source of truth：

- 測試盤點：[docs/notion-automation-flow-test-status.md](./notion-automation-flow-test-status.md)
- 進度儀表板：[progress.html](../progress.html)

## 狀態圖例

| 標籤 | 意義 |
| --- | --- |
| `已實作 + 已 live 測` | 已部署或可執行，並用真實 Notion / GitHub side effect 驗證過。 |
| `已實作 + 部分測` | 主流程已跑過，但仍有分支事件或真人 reviewer path 未補完。 |
| `已實作 + blocked` | 程式存在，但目前需要外部條件才能測，例如非 PR author 的真人 GitHub review。 |
| `未實作 + 未測` | 目前只是目標架構或待做 runtime，還沒有可測執行面。 |
| `已移除` | 舊流程已退出 active path。 |

```mermaid
flowchart LR
  done["已實作 + 已 live 測"]
  partial["已實作 + 部分測"]
  blocked["已實作 + blocked"]
  todo["未實作 + 未測"]
  removed["已移除"]

  classDef done fill:#dcfce7,stroke:#15803d,color:#14532d,stroke-width:2px
  classDef partial fill:#fef9c3,stroke:#ca8a04,color:#713f12,stroke-width:2px
  classDef blocked fill:#ffedd5,stroke:#ea580c,color:#7c2d12,stroke-width:2px
  classDef todo fill:#e5e7eb,stroke:#6b7280,color:#374151,stroke-width:2px
  classDef removed fill:#111827,stroke:#111827,color:#ffffff,stroke-width:2px

  class done done
  class partial partial
  class blocked blocked
  class todo todo
  class removed removed
```

## 1. 整體 Runtime Ownership

目前正式 live runtime 是 GitHub Actions；Notion Worker / Agent 是下一階段，尚未實作部署。

```mermaid
flowchart TD
  notion["Notion DBs<br/>Sprint Backlog / Review Issue / Review Log"] --> ghActions["GitHub Actions reusable workflows<br/>branch / PR sync / cascade<br/>已實作 + 已 live 測"]
  productRepos["Product repos caller workflows<br/>backend / officialwebsite / mailtemplate / guide-tool / tool-imagecompressor<br/>已部署，多數已 live 測於 tool-imagecompressor/mailtemplate"] --> ghActions
  userAI["使用者端 AI repair skill<br/>fix-sprint-review-issues<br/>已實作 + 已 live 測核心 E2E"] --> notion
  userAI --> productRepos
  ghActions --> notion
  notionAgent["Notion Custom Agent<br/>目標觸發層<br/>未實作 + 未測"] -.-> worker["Notion Worker tools/webhooks<br/>routing / reroute / retest notification<br/>未實作 + 未測"]
  worker -.-> notion
  worker -.-> productRepos
  legacy["Fix Task fan-out / AI Dev Prompt / AI code review<br/>已移除"] -.-> notion

  classDef done fill:#dcfce7,stroke:#15803d,color:#14532d,stroke-width:2px
  classDef partial fill:#fef9c3,stroke:#ca8a04,color:#713f12,stroke-width:2px
  classDef todo fill:#e5e7eb,stroke:#6b7280,color:#374151,stroke-width:2px
  classDef removed fill:#111827,stroke:#111827,color:#ffffff,stroke-width:2px

  class ghActions,userAI done
  class productRepos partial
  class notionAgent,worker todo
  class legacy removed
```

## 2. Repo Execution 開發 Flow

這條 flow 處理 `SB-*` branch / PR 與 Sprint Backlog `Repo Execution` 狀態同步。

```mermaid
flowchart TD
  sb["Repo Execution<br/>NOT STARTED / DEV IN PROGRESS<br/>GitHub Branch empty"] --> branch["Create branch workflow<br/>feat/fix/project prefix<br/>已實作 + 已 live 測"]
  branch --> branchWrite["回寫 GitHub Branch<br/>comment mention Developer / Assignee<br/>已實作 + 已 live 測"]
  branch --> prOpen["SB-* PR opened / reopened<br/>PR Status=Open<br/>Repo Execution=TECH REVIEW<br/>已實作 + 已 live 測"]
  prOpen --> reviewReq["review_requested<br/>DEV IN PROGRESS -> TECH REVIEW<br/>已實作 + 已 live 測"]
  prOpen --> reviewComment["review submitted: commented<br/>TECH REVIEW -> DEV IN PROGRESS<br/>已實作 + 已 live 測"]
  prOpen --> reviewChange["review submitted: changes_requested<br/>TECH REVIEW -> DEV IN PROGRESS<br/>已實作 + 已 live 測"]
  prOpen --> reviewApprove["review submitted: approved<br/>不改狀態，等待 merge<br/>已實作 + blocked"]
  prOpen --> closeNoMerge["PR closed but not merged<br/>PR Status=Closed<br/>Repo Execution=DEV IN PROGRESS<br/>已實作 + 已 live 測"]
  prOpen --> mergeStaging["PR merged to staging<br/>Repo Execution=STAGING FUNC REVIEW<br/>已實作 + 已 live 測"]
  prOpen --> mergeProd["PR merged to main/master<br/>Repo Execution=PROD FUNCTION REVIEW<br/>已實作 + 已 live 測"]
  mergeStaging --> rollup["Feature Hub rollup<br/>child all staging/prod/done<br/>已實作 + 已 live 測"]
  mergeProd --> rollup
  prOpen --> inherit["Tech reviewer inheritance<br/>child blank -> parent Feature Hub reviewer<br/>已實作 + 已 live 測"]
  prOpen --> noBackward["No-backward guard<br/>advanced/terminal status 不倒退<br/>已實作 + 已 live 測"]

  classDef done fill:#dcfce7,stroke:#15803d,color:#14532d,stroke-width:2px
  classDef blocked fill:#ffedd5,stroke:#ea580c,color:#7c2d12,stroke-width:2px

  class sb,branch,branchWrite,prOpen,reviewReq,reviewComment,reviewChange,closeNoMerge,mergeStaging,mergeProd,rollup,inherit,noBackward done
  class reviewApprove blocked
```

目前 blocked 的原因：PR #10 已重新 request 並 tag `zeallin`，但還缺非 PR author 的 `approved` review。PR author 自己送 review 會被 workflow guard 跳過，不能用來驗證。

## 3. Feature Hub Rollup / Cascade Flow

這條 flow 處理 `Feature Hub` 與 child `Repo Execution` 的上下游狀態同步。

```mermaid
flowchart TD
  childStaging["所有 child Repo Execution<br/>達 STAGING FUNC REVIEW"] --> hubStaging["Feature Hub -> STAGING FUNC REVIEW<br/>已實作 + 已 live 測"]
  childProd["所有 child Repo Execution<br/>達 PROD FUNCTION REVIEW"] --> hubProd["Feature Hub -> PROD FUNCTION REVIEW<br/>已實作 + 已 live 測"]
  childDoneRollup["所有 child Repo Execution<br/>達 DONE"] --> hubDoneRollup["Feature Hub -> DONE rollup<br/>已實作 + 已 live 測"]

  hubFailed["Feature Hub -> FUNC REVIEW FAILED"] --> childRollback["全部 child Repo Execution -> DEV IN PROGRESS<br/>comment mention Developer / Assignee<br/>已實作 + 已 live 測"]
  hubFailed --> hubRollback["Feature Hub 自身 -> DEV IN PROGRESS<br/>已實作 + 已 live 測"]
  hubDone["Feature Hub -> DONE"] --> childDone["全部 child Repo Execution -> DONE<br/>已實作 + 已 live 測"]
  hubAbandoned["Feature Hub -> ABANDONED"] --> childAbandoned["全部 child Repo Execution -> ABANDONED<br/>已實作 + 已 live 測"]
  repoFuncFailed["單張 Repo Execution -> FUNC REVIEW FAILED"] --> repoRollback["該 Repo Execution -> DEV IN PROGRESS<br/>comment mention Developer / Assignee<br/>已實作 + 已 live 測"]

  classDef done fill:#dcfce7,stroke:#15803d,color:#14532d,stroke-width:2px
  class childStaging,hubStaging,childProd,hubProd,childDoneRollup,hubDoneRollup,hubFailed,childRollback,hubRollback,hubDone,childDone,hubAbandoned,childAbandoned,repoFuncFailed,repoRollback done
```

## 4. Review Issue Repair Flow

這條 flow 是新模型核心：`Review Issue` 直接承接修復，不再建立 `Fix Task`。

```mermaid
flowchart TD
  issueOpen["Review Issue Open<br/>tester 建立問題"] --> routeChoice{"route affected repos"}
  routeChoice --> aiRoute["使用者端 AI skill 判斷 repo<br/>寫回 Affected Repo Execution / Repair Routing Summary<br/>已實作 + 已 live 測核心 E2E"]
  routeChoice -.-> workerRoute["Notion Worker 自動 route<br/>未實作 + 未測"]
  aiRoute --> fixBranch["建立 fix/ISS-* branch<br/>修 code / 跑測試 / 開 PR<br/>已實作 + 已 live 測"]
  fixBranch --> repairOpen["ISS-* repair PR opened / reopened<br/>Review Issue=Fixing<br/>寫入 Repair PR URLs<br/>comment mention reviewer<br/>已實作 + 已 live 測"]
  repairOpen --> repairReviewReq["repair PR review_requested<br/>維持 Fixing 並通知 reviewer<br/>已實作 + 已 live 測"]
  repairOpen --> repairComment["repair PR review commented<br/>通知 fixer / assignee<br/>已實作 + 已 live 測"]
  repairOpen --> repairChange["repair PR changes_requested<br/>通知 fixer / assignee<br/>已實作 + blocked"]
  repairOpen --> repairApprove["repair PR approved<br/>不改狀態，等待 merge<br/>已實作 + 已 live 測"]
  repairOpen --> repairClosed["repair PR closed not merged<br/>寫入 closed line，不標 resolved<br/>已實作 + 已 live 測"]
  repairOpen --> repairMerged["repair PR merged<br/>寫入 Resolved Repo Execution / merged line<br/>已實作 + 已 live 測"]
  repairMerged --> allResolved{"Resolved covers all Affected?"}
  allResolved -- yes --> techFixed["Review Issue -> Tech Fixed<br/>已實作 + 已 live 測"]
  allResolved -- no --> keepFixing["Review Issue 留在 Fixing<br/>等待其他 repo PR merge<br/>已實作 + 已 live 測"]
  techFixed -.-> retest["通知 tester retest<br/>Notion Worker 目標<br/>未實作 + 未測"]
  issueOpen -.-> reopen["Review Issue reopen reroute<br/>clear resolved / PR summary / Reopen Count +1<br/>未實作 + 未測"]

  classDef done fill:#dcfce7,stroke:#15803d,color:#14532d,stroke-width:2px
  classDef blocked fill:#ffedd5,stroke:#ea580c,color:#7c2d12,stroke-width:2px
  classDef todo fill:#e5e7eb,stroke:#6b7280,color:#374151,stroke-width:2px

  class issueOpen,aiRoute,fixBranch,repairOpen,repairReviewReq,repairComment,repairApprove,repairClosed,repairMerged,allResolved,techFixed,keepFixing done
  class repairChange blocked
  class workerRoute,retest,reopen todo
```

目前 blocked 的原因：PR #11 已重新 request 並 tag `zeallin`，但還缺非 PR author 的 `changes_requested` review。

## 5. 使用者端 AI Repair Skill Flow

這條 flow 是「使用者把 Notion issue 貼給 AI，AI 自己判斷 repo 並開 PR 修復」的操作方式。

```mermaid
flowchart TD
  userPaste["使用者貼 Sprint Backlog 或 Review Issue URL"] --> resolve["AI deep-read Review Issue / Sprint / Feature Hub / Repo Execution<br/>已實作 + 已 live 測"]
  resolve --> repoJudge["判斷真正 affected repo<br/>不預設全部 child repos<br/>已實作 + 已 live 測單 repo"]
  repoJudge --> writeBack["live mode 寫回 Affected Repo Execution / Repair Routing Summary<br/>已實作 + 已 live 測"]
  writeBack --> branch["建立 fix/ISS-* branch<br/>已實作 + 已 live 測"]
  branch --> code["修 code 並跑測試<br/>ISS-201: README 修復 + prettier/diff check<br/>已實作 + 已 live 測"]
  code --> pr["開 PR / merge / Notion repair sync<br/>PR #12 / #14 / #15 / #16<br/>已實作 + 已 live 測"]
  pr --> final["Review Issue -> Tech Fixed<br/>已實作 + 已 live 測"]
  userPaste -.-> sprintEntry["Sprint Backlog URL 入口單獨 E2E<br/>已實作 + 部分測<br/>相同 relation resolve 已由 ISS-201 驗證"]

  classDef done fill:#dcfce7,stroke:#15803d,color:#14532d,stroke-width:2px
  classDef partial fill:#fef9c3,stroke:#ca8a04,color:#713f12,stroke-width:2px

  class userPaste,resolve,repoJudge,writeBack,branch,code,pr,final done
  class sprintEntry partial
```

## 6. Notion Worker / Agent 目標 Flow

這是下一階段架構，不是現在 live runtime。

```mermaid
flowchart TD
  triggerCreate["Notion trigger<br/>Review Issue created/opened<br/>未實作 + 未測"] --> routeTool["Worker tool: route_review_issue<br/>判斷 affected repos<br/>未實作 + 未測"]
  routeTool --> writeAffected["寫回 Affected Repo Execution / Repair Routing Summary<br/>未實作 + 未測"]
  writeAffected --> notifyDev["comment tag repo developer / assignee<br/>未實作 + 未測"]
  triggerReopen["Notion trigger<br/>Review Issue reopened<br/>未實作 + 未測"] --> reroute["Worker reroute<br/>clear Resolved / PR summary / Reopen Count +1<br/>未實作 + 未測"]
  reroute --> writeAffected
  githubWebhook["GitHub webhook / PR events<br/>可考慮從 Actions 遷入 Worker<br/>未實作 + 未測"] --> completeTool["Worker tool: complete_review_issue_if_ready<br/>部分邏輯目前由 GitHub Actions live 負責"]
  completeTool --> issueDone["Review Issue -> Tech Fixed when all affected resolved<br/>GitHub Actions 已實作 + 已 live 測<br/>Worker 未實作"]
  issueDone --> retestNotify["Feature Hub 全部 issue 非 Open/Fixing<br/>通知 tester retest<br/>未實作 + 未測"]
  branchTool["Worker tool: create_execution_branch<br/>未實作 + 未測"] -.-> currentBranch["目前由 GitHub Actions branch workflow 負責<br/>已實作 + 已 live 測"]

  classDef done fill:#dcfce7,stroke:#15803d,color:#14532d,stroke-width:2px
  classDef partial fill:#fef9c3,stroke:#ca8a04,color:#713f12,stroke-width:2px
  classDef todo fill:#e5e7eb,stroke:#6b7280,color:#374151,stroke-width:2px

  class triggerCreate,routeTool,writeAffected,notifyDev,triggerReopen,reroute,githubWebhook,retestNotify,branchTool todo
  class completeTool,issueDone partial
  class currentBranch done
```

## 7. 已移除 Legacy Flow

```mermaid
flowchart TD
  reviewIssue["Review Issue"] -.-> fixTaskFanout["舊流程：自動建立 Fix Tasks<br/>已移除"]
  fixTaskFanout -.-> fixBranch["舊流程：Fix Task -> Fix Branch<br/>已移除"]
  fixTaskFanout -.-> fixCount["舊流程：用 Fix Task count 判斷 issue 完成<br/>已移除"]
  sprint["Sprint Backlog"] -.-> aiPrompt["舊流程：AI Dev Prompt 自動生成<br/>已移除"]
  pr["push / PR"] -.-> aiReview["舊流程：AI code review reusable workflow<br/>已移除"]

  classDef removed fill:#111827,stroke:#111827,color:#ffffff,stroke-width:2px
  class reviewIssue,fixTaskFanout,fixBranch,fixCount,sprint,aiPrompt,pr,aiReview removed
```

## 8. 狀態矩陣

| 範圍 | 實作狀態 | 測試狀態 | 目前結論 |
| --- | --- | --- | --- |
| Live schema：Review Issue repair 欄位 | 已實作 | 已 live 測 | 可用。 |
| 移除 Fix Tasks relation / AI Dev Prompt | 已實作 | 已 live schema 驗證 | active model 不再依賴舊欄位。 |
| Repo Execution branch 建立 | 已實作 | 已 live 測 | 可用。 |
| branch prefix `feat/fix/project` | 已實作 | 已 live 測 | 可用。 |
| branch / PR / cascade Notion mention | 已實作 | 已 live 測 | 可用。 |
| SB PR opened / closed / merge staging / merge prod | 已實作 | 已 live 測 | 可用。 |
| SB PR `review_requested` | 已實作 | 已 live 測 | 可用。 |
| SB PR review `commented` | 已實作 | 已 live 測 | Zeal Lin 在 PR #10 送出真人 `pull_request_review COMMENTED`，Notion 正確打回 `DEV IN PROGRESS` 並留言通知。 |
| SB PR review `changes_requested` | 已實作 | 已 live 測 | Zeal Lin 在 PR #10 送出真人 `pull_request_review CHANGES_REQUESTED`，Notion 正確打回 `DEV IN PROGRESS` 並留言通知。 |
| SB PR review `approved` | 已實作 | blocked | 等 Zeal 在 PR #10 送出真人 review。 |
| Feature Hub rollup | 已實作 | 已 live 測 | 可用。 |
| Feature Hub `FUNC REVIEW FAILED` / `DONE` / `ABANDONED` cascade | 已實作 | 已 live 測 | 可用。 |
| Parent Feature Hub reviewer inheritance | 已實作 | 已 live 測 | 可用。 |
| Review Issue repair PR opened / closed / merged | 已實作 | 已 live 測 | 可用。 |
| Review Issue repair PR `review_requested` | 已實作 | 已 live 測 | 可用。 |
| Review Issue repair PR review `commented` | 已實作 | 已 live 測 | Gemini Code Assist 真實 `pull_request_review COMMENTED` 已觸發。 |
| Review Issue repair PR review `approved` | 已實作 | 已 live 測 | Zeal Lin 在 PR #11 送出真人 `APPROVED`，workflow log 顯示等待 merge，不改 Notion 狀態。 |
| Review Issue repair PR review `changes_requested` | 已實作 | blocked | 等 Zeal 在 PR #11 送出真人 review。 |
| Review Issue multi-repo completion | 已實作 | 已 live 測 | 可用。 |
| Review Issue terminal status guard | 已實作 | 已 live 測 | 可用。 |
| 使用者端 AI repair skill E2E | 已實作 | 已 live 測核心 E2E | 可用；Sprint URL 入口尚未單獨另跑，但 relation resolve 已由 ISS-201 覆蓋。 |
| Notion Worker route / reroute / retest notify | 未實作 | 未測 | 下一階段，不可宣稱已完成。 |
| Worker `create_execution_branch` | 未實作 | 未測 | 目前由 GitHub Actions branch workflow 負責。 |
| Fix Task fan-out / Fix Branch / Fix Task completion | 已移除 | 不適用 | 不再是 active path。 |
| AI code review reusable workflow | 已移除 | 不適用 | 不再由 push / PR 觸發。 |

## 9. 下一步 Gate

1. 等 PR #10 的 Zeal review 補完 `SB-*` review `approved`。
2. 等 PR #11 的 Zeal review 補完 `ISS-*` review `changes_requested`。
3. 補測完成後更新本文件、測試狀態表與 progress dashboard。
4. 以上完成或保留明確 blocked reason 後，才開始 Notion Worker / Agent 設定。
