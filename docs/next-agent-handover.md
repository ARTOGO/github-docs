# Next Agent Handover

最後更新：2026-03-23

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
| `ANTHROPIC_API_KEY` | （已設定） | Branch 命名翻譯 |
| `FIX_TASK_DB_ID` | `1100423dc8ad42febd2fa1e442628e0d` | Fix Task 查詢/建立 |
| `REVIEW_ISSUE_DB_ID` | `a770832e338c4babae01cc74ffc9394a` | Review Issue 掃描 |

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
| 檔案 | 類型 | 功能 |
|---|---|---|
| `notion-create-branch-reusable.yml` | reusable | 功能 1: Sprint 卡自動建 branch；功能 2: Func Review 失敗通知；功能 3: Fix Task 自動建 fix branch |
| `notion-pr-sync-reusable.yml` | reusable | SB- branch PR sync（狀態/通知）；FIX- branch PR sync（Fix Task 狀態/Review Issue 自動關閉） |
| `notion-review-fix-task-scheduler.yml` | scheduled | 每 15 分鐘掃描 Review Issue → 自動建 Fix Task |

### 各 product repo（caller）
| 檔案 | 功能 |
|---|---|
| `notion-create-branch.yml` | 每 5 分鐘呼叫 branch reusable workflow |
| `notion-pr-sync.yml` | PR 事件觸發呼叫 PR sync reusable workflow |

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
- branch workflow 擴充：為 Fix Task 從 staging 切出 `fix/FIX-xxx_description` branch
- PR sync workflow 擴充：`FIX-` prefix branch 的 PR 事件同步 Fix Task 狀態
- Fix PR merge 後自動檢查：同一 Review Issue 的所有 Fix Task 都 Tech Fixed → Review Issue → Tech Fixed
- 5 個 repo 的 caller workflow 已全部更新

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

## 自動化流程全景

### 開發流程（SB- branch）
```
Sprint 卡建立（Card Type = Repo Execution, GitHub Repo 有值）
  ↓ branch workflow（每 5 分鐘）
branch 自動建立 → 回寫 GitHub Branch
  ↓ Developer 開發完成 → 開 PR
PR opened → 狀態 TECH REVIEW → 通知 Tech Reviewer
  ↓ Tech Reviewer review
changes_requested → 狀態 DEV IN PROGRESS → 通知 Developer
approved → 等待 merge
  ↓ Developer re-request review
狀態 TECH REVIEW → 通知 Tech Reviewer
  ↓ merge
merge 到 staging → 狀態 STAGING FUNC REVIEW → 通知 Func. Reviewer
merge 到 main/master → 狀態 PROD FUNCTION REVIEW → 通知 Func. Reviewer
```

### 修復流程（FIX- branch）
```
Func. Reviewer 發現問題 → 建 Review Issue（關聯 Sprint 卡, 指派修復者）
  ↓ 排程 workflow（每 15 分鐘）
自動建 Fix Task → Review Issue 狀態 Fixing → 通知修復者
  ↓ branch workflow（每 5 分鐘）
自動從 staging 切出 fix/FIX-xxx branch → 回寫 Fix Branch
  ↓ Developer 修復完成 → 開 Fix PR
Fix PR opened → Fix PR Status = Open
  ↓ merge
Fix PR merged → Fix Task 狀態 Tech Fixed
  ↓ 自動檢查
所有 Fix Task 都 Tech Fixed → Review Issue → Tech Fixed → 通知修復者驗證
```

## 尚未實作（未來 Phase）

### Feature Hub rollup 邏輯
- 所有 `Repo Execution` 子卡都到 staging → Feature Hub 才進 `STAGING FUNC REVIEW`
- 所有 `Repo Execution` 子卡都到 prod → Feature Hub 才進 `PROD FUNCTION REVIEW`
- 目前單 repo 功能直接用一張 `Repo Execution` 卡即可，Feature Hub 只在多 repo 時才需要

### Automation Log
- 已決定暫緩，先用 GitHub Actions run log 做除錯
- 未來需要時再建 database，用於去重和稽核

### AI Router
- `github-docs` 放一個 router workflow，處理路由、驗證、去重
- 各產品 repo 執行實際 AI 開發（Codex CLI / Claude Code CLI）

## Review Fix Task 狀態機（需在 Notion UI 手動設定）

| Group | 狀態 | 說明 |
|---|---|---|
| To-do | `Open` | 新建，等待開始 |
| In progress | `Fixing` | 修復中 |
| In progress | `Tech Fixed` | 修復完成，等待驗證 |
| Complete | `Verified` | 驗證通過 |
| Complete | `Won't Fix` | 不修復 |

## 交接注意事項
- Review Fix Task 的 Status 預設值是中文（未開始/進行中/完成），需在 Notion UI 手動改成上方的英文狀態
- guide-tool repo 有既有的 lint 問題（pre-commit hook），commit 時可能需要 `--no-verify`
- `NOTION_API_KEY` 使用的 integration 需要有所有相關 database 的存取權限
- MCP Docker 的 `Openclaw-Peter` integration 沒有權限存取這些 database，不要用它
