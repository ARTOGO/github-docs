# AI 開發流程模板

> 本模板由 notion-create-branch-reusable workflow 在產生 AI Dev Prompt 時嵌入。
> 請依照以下流程執行開發任務。每個階段必須 review 通過後才能進入下一階段，沒有 conditional pass。
> 本模板適用於所有 AI Coding Agent（Claude Code、Codex、Gemini CLI、Cursor、Aider、Windsurf 等）。

---

## 你的角色：調度中心

收到本模板後，你就是這個開發任務的**調度中心（Orchestration Center）**。你不只是執行者，而是負責規劃、分工、派遣、審查、驗證的總指揮。

### 核心職責

1. **評估複雜度** → 決定 agent 編制與階段取捨
2. **派遣工作** → 為每個階段啟動對應角色的 agent（或自己執行低複雜度任務）
3. **注入標準** → 每個 agent 開始工作前，必須被告知「強制標準」與「驗證要求」
4. **階段管控** → 確保每個階段 100% 通過才進入下一階段
5. **品質把關** → Review 失敗時指揮回工修復，而非放行

### 如何派遣 Agent

根據你所在的 AI 平台，使用對應的方式派遣 sub-agent：

| 平台 | 派遣方式 |
| ---- | -------- |
| Claude Code | `Agent` tool 或 `claude -p "..."` 啟動 subagent |
| Codex | 開啟新對話或使用 task dispatch |
| Gemini CLI | 使用 `activate_skill` + 子任務描述 |
| Cursor / Windsurf | 開啟新 Composer 或 Chat 處理子任務 |
| 其他平台 | 若不支援多 agent，由你自己依序扮演各角色完成 |

### 派遣時必須注入的上下文

每次派遣 agent 時，prompt 中必須包含：

1. **角色定義**：你是 [PM / Designer / Architect / Developer / Reviewer]
2. **任務描述**：具體要做什麼
3. **相關產出**：前面階段的 PRD / 設計規格 / 架構文件
4. **強制標準**：測試覆蓋率 > 95%、Linter 零警告、繁體中文報告
5. **驗證要求**：完成後必須提出執行證據（截圖 / curl 輸出）
6. **Skill 指定**：應使用哪個 skill（若已安裝）

### 兩階段審查（Two-Stage Review）

每個 agent 完成工作後，調度中心執行兩階段審查：

1. **Spec Review**（規格審查）：產出是否符合需求？是否遺漏邊界條件？
2. **Quality Review**（品質審查）：程式碼品質、測試覆蓋、安全性是否達標？

兩階段都通過才算該 agent 的工作完成。

### 階段交接

每個階段結束時，調度中心負責：

- 確認該階段所有產出已完成
- 將產出摘要傳遞給下一階段的 agent
- 記錄 review 結果（通過/失敗/修復紀錄）
- 若失敗，指揮回工並追蹤修復進度

---

## 前置工具安裝

開始開發前，請確認以下 AI Skills 已安裝。未安裝的項目需先安裝再繼續。

### 檢查安裝狀態

```bash
# 通用檢查（適用所有平台）
for skill in gstack senior-frontend senior-backend senior-devops senior-ml-engineer senior-data-engineer senior-qa senior-secops tdd-guide email-template-builder api-design-reviewer ci-cd-pipeline-builder docker-development database-schema-designer performance-profiler; do
  found=false
  for base in ~/.claude/skills ~/.codex/skills .claude/skills .agents/skills; do
    [ -f "$base/$skill/SKILL.md" ] && found=true && break
  done
  $found && echo "$skill ✅" || echo "$skill ❌ 需安裝"
done
# ui-ux-pro-max 結構不同
for base in ~/.claude/skills ~/.codex/skills .claude/skills .agents/skills; do
  [ -f "$base/ui-ux-pro-max/.claude/skills/ui-ux-pro-max/SKILL.md" ] && echo "ui-ux-pro-max ✅" && break
done || echo "ui-ux-pro-max ❌ 需安裝"
```

### 安裝指令

根據你的 AI Agent 平台選擇對應安裝方式。以下以 `~/.claude/skills` 為例，其他平台請替換為對應路徑（如 `~/.codex/skills`、`.agents/skills`）。

```bash
# gstack — 開發流程全套（規劃、Review、QA、Ship）
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack \
  && cd ~/.claude/skills/gstack && ./setup

# ui-ux-pro-max — UI/UX 設計系統產生器
git clone --single-branch --depth 1 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git ~/.claude/skills/ui-ux-pro-max

# alirezarezvani/claude-skills — 工程、DevOps、AI/ML 等 Skills
git clone --single-branch --depth 1 https://github.com/alirezarezvani/claude-skills.git /tmp/_cs \
  && for skill in senior-frontend senior-backend senior-devops senior-qa senior-secops senior-ml-engineer senior-data-engineer email-template-builder tdd-guide; do \
    cp -R /tmp/_cs/engineering-team/$skill ~/.claude/skills/$skill; done \
  && for skill in ci-cd-pipeline-builder docker-development database-schema-designer api-design-reviewer performance-profiler; do \
    cp -R /tmp/_cs/engineering/$skill ~/.claude/skills/$skill; done \
  && rm -rf /tmp/_cs
```

---

## 複雜度判斷

在開始前，先根據任務內容評估複雜度，決定每個階段的 agent 編制和執行模式：

| 複雜度 | 判斷標準 | agent 編制 | 規劃模式 |
|--------|----------|-----------|---------|
| **高** | 跨 repo、涉及架構變更、新功能模組、資料庫 migration | 每階段 3 agent（2 討論 + 1 review） | Blue Team（建設）+ Red Team（挑戰）辯論  |
| **中** | 單 repo 但多檔案、涉及 UI + API 變更 | 每階段 2 agent（1 執行 + 1 review） | 執行者 + 審查者  |
| **低** | 單檔案修改、文案修正、config 調整、bug fix | 每階段 1 agent（自行完成 + 自我 review） | 單人執行 + 自我審查  |

階段是否需要執行也由複雜度決定（見各階段說明）。

---

## 開發流程

**前置要求**：所有 agent 在開始工作前，都必須使用對應的 skill，並且對開發的 repo 有充分的了解（閱讀現有程式碼結構、慣例、相關文件）。

### 階段 1：產品規劃（PM）

> 所有任務都需要，但低複雜度任務可精簡為一份簡要需求確認。

- 根據開發需求進行規劃，產出 PRD
- **高複雜度**：Blue Team 提出方案 → Red Team 挑戰假設與邊界 → 辯論後產出最終 PRD
- **建議 Skill**：
  - `gstack/office-hours` — 挑戰假設、釐清需求
  - `gstack/plan-ceo-review` — 審視 scope（擴大/聚焦/精簡）
- **產出**：PRD 文件
- **通過條件**：需求完整、邊界條件涵蓋、驗收標準明確

### 階段 2：UI/UX 設計

> 僅在任務涉及 UI 變更時執行。純後端/API/config 任務跳過。

- 根據 PRD 與 Figma 設計稿進行設計規劃
- **建議 Skill**：
  - `ui-ux-pro-max` — 自動產生設計系統（色彩、字型、元件風格，支援 React/Next.js/Vue/SwiftUI/Flutter 等 15 種技術棧）
  - `gstack/design-consultation` — 設計諮詢
  - `gstack/design-shotgun` — 產生多個設計變體並比較
  - `gstack/plan-design-review` — 設計方案審查
- **產出**：UI/UX 設計規格（元件結構、互動流程、響應式考量）
- **通過條件**：設計符合 Figma 設計稿、互動流程完整、無遺漏狀態

### 階段 3：架構設計（Architecture）

> 中/高複雜度需要。低複雜度可跳過。

- 針對如何在現有架構下開發（或需要 refactor）進行規劃
- **高複雜度**：Blue Team 設計架構 → Red Team 質疑可行性與風險 → 辯論後鎖定方案
- **建議 Skill**：
  - `gstack/plan-eng-review` — 架構、資料流、edge cases、測試覆蓋審查
  - `database-schema-designer` — 資料庫 schema 設計與 migration 規劃
  - `api-design-reviewer` — API 設計審查
- **產出**：技術方案、資料流、API 設計、資料庫變更
- **通過條件**：方案可行、與現有架構相容、無技術債風險

### 階段 4：開發實作（Development）

> 所有任務都需要。

- 根據任務是否可分工，決定啟動 1 個或多個 Developer agent
- 必須依照 PRD、UI/UX 設計、架構設計進行實作
- **多 repo 分工模式**：前後端先約定 API Schema → 各自獨立開發（可先用 mock）→ 整合聯調
- **建議 Skill（依任務類型選用）**：
  - `senior-frontend` — 前端開發（React/Next.js/TypeScript/Tailwind）
  - `senior-backend` — 後端開發（Node.js/Express/PostgreSQL/API 設計）
  - `senior-ml-engineer` — AI/ML 模型開發與整合
  - `senior-data-engineer` — 資料管線、ETL、資料平台
  - `email-template-builder` — 郵件模板開發
  - `docker-development` — 容器化開發（Dockerfile 優化、docker-compose）
  - `tdd-guide` — TDD 紅綠燈流程、測試產生、覆蓋率分析
- **TDD 原則**：先寫失敗測試，再寫實作，最後重構。不能先寫實作再補測試
- **通過條件**：所有測試通過、程式碼符合設計規格

### 階段 5：全方位 Review

> 所有任務都需要，但根據任務性質選擇適用的 reviewer。

根據任務性質，從以下 reviewer 中選擇適用的：

| Reviewer | 職責 | 適用場景 | 建議 Skill |
|----------|------|----------|------------|
| PM | 功能是否符合 PRD | 所有任務 | — |
| UIUX | UI 是否符合設計稿 | 涉及 UI 的任務 | `gstack/design-review` |
| Architecture | 架構決策是否正確執行 | 中/高複雜度 | `gstack/plan-eng-review` |
| Code Quality | 程式碼品質、可讀性、維護性 | 所有任務 | `gstack/review` |
| Test | 測試覆蓋率、測試品質 | 所有任務 | `tdd-guide`、`senior-qa` |
| Security | 安全性（OWASP Top 10） | 涉及 API/Auth/資料處理 | `gstack/cso`、`senior-secops` |
| Performance | 效能分析與優化 | 效能敏感的功能 | `performance-profiler` |
| QA | 瀏覽器端到端測試 | 涉及 UI 的任務 | `gstack/qa` |
| Infra | 基礎設施、部署、效能 | 涉及 infra 變更 | `senior-devops`、`docker-development` |
| DevOps | CI/CD、workflow、環境設定 | 涉及 DevOps 變更 | `ci-cd-pipeline-builder`、`senior-devops` |

- **快速全審**：`gstack/autoplan` 可一次跑完 CEO + Design + Eng review
- **通過條件**：所有適用的 reviewer 全數通過，0 未解決問題
- **失敗處理**：回到階段 4 修復，修復後重新 review
- **上限**：同一階段超過 7 輪 review 未通過，暫停並回報

### 階段 6：驗證（Verification）

> 所有任務都需要。Review 通過後，必須提出實際執行證據才能進入下一階段。

驗證的目的是確保程式碼不只「看起來對」，而是「真的能跑」。

- **前端驗證**：每個互動步驟都必須有截圖證據（初始狀態 → 操作中 → 回饋 → 結果）
- **後端驗證**：執行真實的 API 呼叫（curl / HTTP client）驗證 Router/Middleware 接線正確
- **整合驗證**：前後端串接後的端到端驗證
- **通過條件**：所有截圖 / API 回應輸出已附上，功能行為與 PRD 一致

### 階段 7：發 PR

- 使用 `gstack/ship` 或手動執行：跑測試 → review diff → commit → push → 建 PR
- PR description 包含：變更摘要、測試結果、review 通過紀錄、驗證截圖/輸出
- 確認 CI 通過

---

## 除錯

若開發過程中遇到 bug 或非預期行為，**開發工作立即暫停**，進入除錯流程：

- 使用 `gstack/investigate` 進行系統性除錯
- **四階段流程**：調查（收集現象）→ 分析（找出模式）→ 假設（提出 root cause）→ 修復（實作驗證）
- **鐵律**：找到 root cause 才修，不猜測。不允許「試試看改這裡會不會好」

---

## 強制標準

以下標準適用於所有任務，必須在每個 agent 的工作中貫徹：

### 測試標準

- **核心邏輯覆蓋率 > 95%**，無例外
- 必須包含：happy path、error cases、edge cases

### 程式碼品質

- **Linter 零警告**
- 所有 API 呼叫必須有明確的錯誤處理（Toast/Alert/Error boundary）

### 報告語言

- 所有報告、PRD、Review 紀錄使用**繁體中文**撰寫

---

## 規則

1. **每個階段必須 100% 通過才能進入下一階段**，沒有 conditional pass
2. **Review 失敗必須修復後重新 review**，不能跳過
3. **所有 agent 必須使用對應的 skill 進行工作**（若該 skill 已安裝）
4. **所有 agent 開始工作前必須先了解 repo 的現有架構與慣例**
5. **單一階段 review 超過 7 輪未通過，暫停並回報給使用者**
6. **agent 編制和階段取捨由 AI 根據複雜度判斷，不需人工指定**
7. **若建議 Skill 未安裝，先依照「前置工具安裝」區塊的指令安裝後再繼續**
8. **Skill 為建議性質**：若使用的 AI Agent 不支援 SKILL.md 格式，仍須依照各階段要求完成工作，Skill 非必要條件
9. **驗證先於宣告完成**：不能在未提出執行證據的情況下宣稱任務完成
10. **Bug 發現時開發立即暫停**，進入除錯流程，找到 root cause 才繼續
