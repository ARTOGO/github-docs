# AI 開發流程模板

> 本模板由 notion-create-branch-reusable workflow 在產生 AI Dev Prompt 時嵌入。
> 請依照以下流程執行開發任務。每個階段必須 review 通過後才能進入下一階段，沒有 conditional pass。
> 本模板適用於所有 AI Coding Agent（Claude Code、Codex、Gemini CLI、Cursor、Aider、Windsurf 等）。

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

在開始前，先根據任務內容評估複雜度，決定每個階段的 agent 編制：

| 複雜度 | 判斷標準 | agent 編制 |
|--------|----------|-----------|
| **高** | 跨 repo、涉及架構變更、新功能模組、資料庫 migration | 每階段 3 agent（2 討論 + 1 review） |
| **中** | 單 repo 但多檔案、涉及 UI + API 變更 | 每階段 2 agent（1 執行 + 1 review） |
| **低** | 單檔案修改、文案修正、config 調整、bug fix | 每階段 1 agent（自行完成 + 自我 review） |

階段是否需要執行也由複雜度決定（見各階段說明）。

---

## 開發流程

**前置要求**：所有 agent 在開始工作前，都必須使用對應的 skill，並且對開發的 repo 有充分的了解（閱讀現有程式碼結構、慣例、相關文件）。

### 階段 1：產品規劃（PM）

> 所有任務都需要，但低複雜度任務可精簡為一份簡要需求確認。

- 根據開發需求進行規劃，產出 PRD
- **建議 Skill**：
  - `gstack/office-hours` — 挑戰假設、釐清需求
  - `gstack/plan-ceo-review` — 審視 scope（擴大/聚焦/精簡）
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
- **建議 Skill（依任務類型選用）**：
  - `senior-frontend` — 前端開發（React/Next.js/TypeScript/Tailwind）
  - `senior-backend` — 後端開發（Node.js/Express/PostgreSQL/API 設計）
  - `senior-ml-engineer` — AI/ML 模型開發與整合
  - `senior-data-engineer` — 資料管線、ETL、資料平台
  - `email-template-builder` — 郵件模板開發
  - `docker-development` — 容器化開發（Dockerfile 優化、docker-compose）
  - `tdd-guide` — TDD 紅綠燈流程、測試產生、覆蓋率分析
- **TDD 原則**：先寫失敗測試，再寫實作，最後重構
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

### 階段 6：發 PR

- 使用 `gstack/ship` 或手動執行：跑測試 → review diff → commit → push → 建 PR
- PR description 包含：變更摘要、測試結果、review 通過紀錄
- 確認 CI 通過

---

## 除錯

若開發過程中遇到 bug 或非預期行為：

- 使用 `gstack/investigate` 進行系統性除錯（四階段：調查 → 分析 → 假設 → 修復）
- **鐵律**：找到 root cause 才修，不猜測

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
