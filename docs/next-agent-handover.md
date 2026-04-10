# Next Agent Handover

最後更新：2026-03-26

## 交接目的
- 這份文件提供下一個 agent 直接接手 Notion x GitHub automation implementation 所需的最小完整上下文。
- 目標不是重新討論架構，而是讓下一個 agent 可以依既有共識直接進入設計細化與實作。

## Source Of Truth
- 主架構文件：
  - `/Users/peterting/Documents/artogo/github-docs/docs/notion-github-automation-architecture.md`
- Notion 同步頁面：
  - `https://www.notion.so/artogotw/Notion-2c05135e076e81f393b1eb7c71130fd3?source=copy_link`

## 已定案的核心結論
- `github-docs` 是 control plane，只放 reusable workflows、router、共用腳本與規範，不直接執行產品程式碼。
- 實際 checkout repo、跑 AI、commit、push、開 PR，都在各產品 repo 執行。
- AI 執行方式用 `Codex CLI` 或 `Claude Code CLI` 的非互動模式，不依賴桌面 app 本體。
- merge 規則：
  - merge 到 `staging_review_branches`（預設 `staging`）→ `STAGING FUNC REVIEW`
  - merge 到 `prod_review_branches`（預設 `main,master`）→ `PROD FUNCTION REVIEW`
  - merge 到其他 branch → 只更新 PR Status，不改任務狀態
- review 的單位是「功能」，不是 repo。
- execution 的單位是「repo」。
- 資料模型：
  - `Product Backlog`
  - `Sprint Backlog / Card Type = Feature Hub`（功能級進度中心）
  - `Sprint Backlog / Card Type = Repo Execution`（repo 級執行單位）
  - `Sprint Backlog / Card Type = Stage/Admin`（管理用，不參與自動化）
  - `💦 Review Issue Database`（功能級問題追蹤）
  - `🔫 Review Log Database`（驗收紀錄）
  - `🔧 Review Fix Task`（repo 級修復追蹤）

## Notion Database IDs

| Database | ID | Data Source |
|---|---|---|
| Sprint Backlog | `521b82edb2684897a36b4fd7fad412fd` | `collection://f16a2bd0-b855-4da9-8d68-273003c1ba11` |
| Product Backlog | — | `collection://0847fca7-b837-4496-84f7-b13e7463c90d` |
| 💦 Review Issue | `a770832e338c4babae01cc74ffc9394a` | `collection://43a7a9ab-12f8-440f-8b79-fd8df7ac3e67` |
| 🔫 Review Log | `ca4c8b1840e1413c9df3311d5c442a56` | `collection://b0186d1f-cae7-438b-a5be-59a6b01fbb73` |
| 🔧 Review Fix Task | `1100423dc8ad42febd2fa1e442628e0d` | `collection://c1b86f00-8c8a-4b04-ba57-42cc9aa268e7` |

## GitHub Secrets（ARTOGO 組織層級）

| Secret | 值 | 用途 |
|---|---|---|
| `NOTION_API_KEY` | （已設定） | Notion API 存取 |
| `NOTION_DATABASE_ID` | Sprint Backlog DB ID | Sprint Backlog 查詢 |
| `ANTHROPIC_API_KEY` | （已設定） | Branch 命名翻譯（Claude Haiku） |
| `FIX_TASK_DB_ID` | `1100423dc8ad42febd2fa1e442628e0d` | Fix Task 查詢/建立 |
| `REVIEW_ISSUE_DB_ID` | `a770832e338c4babae01cc74ffc9394a` | Review Issue 掃描 |

注意：`NOTION_DATABASE_ID` 也需在 `github-docs` repo 層級設定（用於 scheduler 的 Feature Hub cascade）。

## 涵蓋的 Repos

| Repo | Default Branch | GitHub Repo Select 值 |
|---|---|---|
| officialwebsite | `master` | `officialwebsite` |
| backend | `master` | `backend` |
| mailtemplate | `main` | `mailtemplate` |
| guide-tool | `main` | `guide-tool-app` |
| tool-imagecompressor | `master` | `tool-imagecompressor` |

## Workflow 檔案總覽

### github-docs（control plane）
| 檔案 | 類型 | 觸發 | 功能 |
|---|---|---|---|
| `notion-create-branch-reusable.yml` | reusable | 各 repo 每 5 分鐘呼叫 | 功能 1: Sprint 卡自動建 branch（NOT STARTED / DEV IN PROGRESS）；功能 2: Repo Execution FUNC REVIEW FAILED → 通知 Developer + 重置為 DEV IN PROGRESS；功能 3a: Fix Task 自動建 fix branch（從 staging 切出，fallback default branch）；功能 3b: Won't Fix 清理（通知刪除分支 + 清空 Fix Branch） |
| `notion-pr-sync-reusable.yml` | reusable | 各 repo PR 事件觸發 | SB- branch PR sync（開啟→PR Status=Open，狀態/通知交由 AI review workflow 決定、review→DEV IN PROGRESS、merge→STAGING/PROD FUNC REVIEW）；Feature Hub 子卡查找（by repo + branch match）；Feature Hub rollup（所有子卡到位→更新 Hub 狀態 + 通知 Func. Reviewer）；FIX- branch PR sync（Fix Task 狀態 + Fix PR 欄位；opened 時通知交由 AI review workflow 決定）；Fix PR merge → 檢查所有 Fix Task 完成 → Review Issue → Tech Fixed |
| `notion-review-fix-task-scheduler.yml` | scheduled | 每 15 分鐘 + 手動 | 功能 1: Review Issue（Open + 修復者已指派）→ 自動建 Fix Task（展開 Feature Hub 找所有 Repo Execution）→ 狀態 Fixing → 通知修復者；功能 2: Feature Hub cascade — FUNC REVIEW FAILED 向下 reset 所有子卡 + 通知 Developer，DONE/ABANDONED 向下 cascade（近 60 分鐘內） |

### 各 product repo（caller）
| 檔案 | 功能 |
|---|---|
| `notion-create-branch.yml` | 每 5 分鐘呼叫 branch reusable workflow（帶 `repo_name` + secrets） |
| `notion-pr-sync.yml` | PR 事件觸發呼叫 PR sync reusable workflow（帶 PR 資訊 + review 資訊 + secrets） |

## 已完成的實作

### Phase 0：Schema 漂移修復 ✅
- `任務類型`：`select` → `multi_select` 讀法修正
- `Function Reviewer` → `Func. Reviewer` 欄位名對齊
- merge 狀態：`FUNC REVIEW` → 依 `base_branch` 判斷 `STAGING FUNC REVIEW` / `PROD FUNCTION REVIEW`
- Tech Review 打回時通知 `Developer`（fallback `指派給`）

### Phase 1：Card Type 過濾 ✅
- Sprint Backlog 新增 `Card Type` select（Repo Execution / Feature Hub / Stage/Admin）
- branch workflow + PR sync workflow 只處理 `Card Type = Repo Execution`
- 現有 5 張有 `GitHub Repo` 的卡片已回填 `Repo Execution`

### Phase 2：Review Fix Task ✅
- Notion 建立 `🔧 Review Fix Task` database（位於「產品開發」頁面下）
- 排程 workflow：掃描 Review Issue（修復者已指派 + 狀態 Open）→ 自動建 Fix Task
  - 支援 Feature Hub 展開：關聯到 Feature Hub 時，自動找所有 Repo Execution 子卡建立多個 Fix Task
  - 冪等性：已有 Fix Task 的 Review Issue 不會重複建立，僅補救狀態更新
- branch workflow 擴充：為 Fix Task 從 staging 切出 `fix/FIX-xxx_description` branch
  - staging 不存在時 fallback 到 default branch
  - 翻譯修復描述為英文 snake_case（Claude Haiku）
- PR sync workflow 擴充：`FIX-` prefix branch 的 PR 事件同步 Fix Task 狀態
  - Fix PR opened → Fix PR Status = Open；通知交由 AI review workflow 決定
  - Fix PR review → 通知修復者
  - Fix PR merge → Fix Task 狀態 Tech Fixed
- Fix PR merge 後自動檢查：同一 Review Issue 的所有 Fix Task 都 Tech Fixed → Review Issue → Tech Fixed → 通知 Func. Reviewer
- Won't Fix 清理：通知刪除分支 + 清空 Fix Branch 欄位避免重複通知
- 5 個 repo 的 caller workflow 已全部更新

### Phase 3：Feature Hub 支援 ✅
- **PR sync Feature Hub 子卡查找**：SB- branch PR 事件時，若 Task ID 對應 Feature Hub，自動找到同 repo + 同 branch 的 Repo Execution 子卡進行處理
- **Feature Hub rollup（向上）**：Repo Execution 狀態變為 STAGING FUNC REVIEW / PROD FUNCTION REVIEW / DONE 時，檢查所有兄弟 Repo Execution 是否都達標 → 更新 Feature Hub 狀態 + 通知 Func. Reviewer
- **Feature Hub cascade（向下）**：
  - FUNC REVIEW FAILED → 所有 Repo Execution 子卡 reset 為 DEV IN PROGRESS + 指派 Developer + 通知
  - DONE / ABANDONED → 子卡狀態跟著 cascade（近 60 分鐘內變更的）
- **Feature Hub 人員繼承**：Repo Execution 子卡缺少 Func. Reviewer / Tech Reviewer 時，從 Feature Hub 繼承
- **Branch 命名**：Repo Execution 子卡的 branch 使用 Feature Hub 的 Task ID（如 `feat/SB-2100_feature_name`），共用 branch 前綴

### Phase 4：架構強化 ✅
- 所有 Notion API 呼叫加入 retry（429/5xx → 指數退避，最多 3 次）
- 所有 DB 查詢支援分頁（`has_more` / `next_cursor` loop）
- Concurrency control：`cancel-in-progress: false`，確保排隊而非取消
- 防止狀態倒退：`noBackwardStatuses` 清單，已到 STAGING FUNC REVIEW 以上的不會被 PR 事件打回
- 自我 review 跳過：PR author = review author 時不處理
- Feature Hub cascade 從 branch workflow 移到 scheduler，避免 N 個 repo 重複執行
- default branch SHA 快取：branch workflow 內只呼叫一次 GitHub API 取得 SHA
- Alert on failure：所有 workflow 的最後一步加上失敗警示

## Sprint Backlog 關鍵 Schema

### 任務狀態（Status，含 group）
| Group | 狀態 |
|---|---|
| To-do | `NOT STARTED`, `PENDING` |
| In progress | `UI DESIGN`, `IN PROGRESS`, `DEV IN PROGRESS`, `TECH REVIEW`, `STAGING FUNC REVIEW`, `FUNC REVIEW FAILED`, `PROD FUNCTION REVIEW`, `DEPLOY PENDING`, `PHASED DONE` |
| Complete | `DONE`, `ABANDONED` |

### 任務類型（Multi-select）
`🔹 TASK`, `🐞 BUG`, `🕶️ 專案`, `影片`, `平面`, `輸出物`, `新聞稿`, `行銷`, `UXUI`, `品牌`, `其他`

### Branch 前綴對應
| 任務類型 | Branch 前綴 |
|---|---|
| 包含 `BUG` | `fix/` |
| 包含 `專案` | `project/` |
| 其他 | `feat/` |

### Branch 命名規則
- 格式：`{prefix}/{TaskID}_{english_slug}`
- Task ID 來源：若有 Feature Hub 父卡則使用父卡 Task ID，否則使用自己的 Task ID
- 英文 slug：由 Claude Haiku 翻譯中文標題，snake_case 格式，最多 30 字元
- 範例：`feat/SB-2100_backend_preview_by_service_typ`

## 自動化流程全景

### 開發流程（SB- branch）
```
Sprint 卡建立（Card Type = Repo Execution, GitHub Repo 有值, GitHub Branch 空）
  ↓ branch workflow（每 5 分鐘）
  ↓ 條件：任務狀態 = NOT STARTED 或 DEV IN PROGRESS
branch 自動建立（從 default branch 切出） → 回寫 GitHub Branch
  ↓ Developer 開發完成 → 開 PR
PR opened → PR Status = Open；由 AI review workflow 決定是 clean pass / disputed / changes requested
  ↓ Tech Reviewer review
changes_requested → 狀態 DEV IN PROGRESS → 通知 Developer
approved → 等待 merge
  ↓ Developer re-request review
狀態 TECH REVIEW → 通知 Tech Reviewer
  ↓ merge
merge 到 staging → Repo Execution 狀態 STAGING FUNC REVIEW → 通知 Func. Reviewer
merge 到 main/master → Repo Execution 狀態 PROD FUNCTION REVIEW → 通知 Func. Reviewer
  ↓ Feature Hub rollup（若有父卡）
所有 Repo Execution 子卡都到位 → Feature Hub 狀態跟進 → 通知 Hub 的 Func. Reviewer
```

### Feature Hub cascade 流程
```
Feature Hub 狀態 = FUNC REVIEW FAILED（Scheduler 每 15 分鐘偵測）
  ↓
所有 Repo Execution 子卡 → DEV IN PROGRESS + 指派 Developer + 通知
Feature Hub 本身 → DEV IN PROGRESS

Feature Hub 狀態 = DONE 或 ABANDONED（Scheduler 每 15 分鐘，近 60 分鐘內變更）
  ↓
所有尚未到位的 Repo Execution 子卡 → cascade 為相同狀態

Repo Execution 個別 FUNC REVIEW FAILED（Branch workflow 每 5 分鐘偵測）
  ↓
該卡 → DEV IN PROGRESS + 指派 Developer + 通知（不影響其他子卡）
```

### 修復流程（FIX- branch）
```
Func. Reviewer 發現問題 → 建 Review Issue（關聯 Sprint 卡, 指派修復者）
  ↓ 排程 workflow（每 15 分鐘）
  ↓ 條件：修復者已指派 + 狀態 Open + 無既有 Fix Task
自動建 Fix Task（展開 Feature Hub 找所有 Repo Execution） → Review Issue 狀態 Fixing → 通知修復者
  ↓ branch workflow（每 5 分鐘）
  ↓ 條件：Fix Branch 空 + 狀態 Open 或 Fixing
自動從 staging 切出 fix/FIX-xxx branch → 回寫 Fix Branch → 狀態 Fixing
  ↓ Developer 修復完成 → 開 Fix PR
Fix PR opened → Fix PR Status = Open；由 AI review workflow 決定通知對象
  ↓ Tech Reviewer review
changes_requested → 通知修復者
  ↓ merge
Fix PR merged → Fix Task 狀態 Tech Fixed
  ↓ 自動檢查
所有 Fix Task 都 Tech Fixed → Review Issue → Tech Fixed → 通知 Func. Reviewer 驗證
```

### Won't Fix 清理流程
```
修復者標記 Fix Task 為 Won't Fix（手動）
  ↓ branch workflow（每 5 分鐘）
  ↓ 條件：狀態 Won't Fix + Fix Branch 非空
通知 Tech Reviewer 刪除分支 → 清空 Fix Branch 欄位
```

## Review Issue 狀態機

| Group | 狀態 | 說明 | 自動化觸發 |
|---|---|---|---|
| To-do | `Open` | 問題剛建立 | — |
| In progress | `Fixing` | Fix Task 已建立 | Scheduler 建立 Fix Task 後自動設定 |
| In progress | `Tech Fixed` | 所有 Fix Task 修復完成 | 所有 Fix Task 都 Tech Fixed 時自動設定 |
| Complete | `Fixed` | 驗證通過 | 人工設定 |
| — | `Duplicate` / `Won't Fix` / `Post-Launch` / `To Be Confirmed` | 其他人工流程 | — |

## Review Fix Task 狀態機

| Group | 狀態 | 說明 | 自動化觸發 |
|---|---|---|---|
| To-do | `Open` | 新建，等待開始 | Scheduler 建立時預設 |
| In progress | `Fixing` | 修復中 | Branch workflow 建立 fix branch 後自動設定 |
| In progress | `Tech Fixed` | 修復完成，等待驗證 | Fix PR merge 後自動設定 |
| Complete | `Verified` | 驗證通過 | 人工設定 |
| Complete | `Won't Fix` | 不修復 | 人工設定，觸發清理流程 |

## PR sync 狀態防護

### 防止狀態倒退（noBackwardStatuses）
以下狀態不會被 PR opened/review 事件打回 DEV IN PROGRESS 或 TECH REVIEW：
`STAGING FUNC REVIEW`, `PROD FUNCTION REVIEW`, `DONE`, `ABANDONED`, `DEPLOY PENDING`, `PHASED DONE`

### PR 事件處理矩陣
| 事件 | 條件 | 狀態更新 | 通知 |
|---|---|---|---|
| PR opened/reopened | — | PR Status=Open；任務狀態與通知由 AI review workflow 決定 | 由 AI review workflow 決定 |
| review changes_requested | — | DEV IN PROGRESS | Developer（fallback 指派給） |
| review commented | — | DEV IN PROGRESS | Developer（fallback 指派給） |
| review approved | — | 不更新 | — |
| review_requested | 狀態=DEV IN PROGRESS | TECH REVIEW | Tech Reviewer |
| PR merged | base=staging | STAGING FUNC REVIEW + PR Status=Merged | Func. Reviewer |
| PR merged | base=main/master | PROD FUNCTION REVIEW + PR Status=Merged | Func. Reviewer |
| PR merged | base=其他 | PR Status=Merged | — |
| PR closed (not merged) | — | DEV IN PROGRESS + PR Status=Closed | — |

## 尚未實作（未來 Phase）

### Automation Log
- 已決定暫緩，先用 GitHub Actions run log 做除錯
- 未來需要時再建 database，用於去重和稽核

### AI Router + AI 自動開發
- `github-docs` 放一個 router workflow，處理路由、驗證、去重
- Sprint 卡 `AI Start Dev` button → dispatch → 各產品 repo 執行 Codex CLI / Claude Code CLI
- 需新增 Sprint Backlog 欄位：`AI Provider`, `AI Run Requested`, `AI Run Status`, `AI Run ID`, `AI Last Routed Event ID`, `AI Requested At`, `AI Last Commit SHA`, `AI Summary`
- 完整規劃見架構文件

## 交接注意事項
- Review Fix Task 的 Status 預設值是中文（未開始/進行中/完成），需在 Notion UI 手動改成英文狀態（Open/Fixing/Tech Fixed/Verified/Won't Fix）
- guide-tool repo 有既有的 lint 問題（pre-commit hook），commit 時可能需要 `--no-verify`
- `NOTION_API_KEY` 使用的 integration 需要有所有相關 database 的存取權限
- MCP Docker 的 `Openclaw-Peter` integration 沒有權限存取這些 database，不要用它
- `github-docs` repo 需要單獨設定 `NOTION_DATABASE_ID` secret（org-level secret 不含此 repo）
- Feature Hub cascade（FUNC REVIEW FAILED / DONE / ABANDONED）放在 scheduler 而非 branch workflow，避免 5 個 repo 重複執行
- branch workflow 的 FUNC REVIEW FAILED 處理只針對個別 Repo Execution 卡，Feature Hub 級的由 scheduler 處理
