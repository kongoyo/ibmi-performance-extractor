---
name: ibmi-performance-extractor
description: Extract IBM i Collection Services performance data from custom libraries and hosts using the scratch folder scripts, perform credential pre-flight validation, and generate beautiful responsive HTML performance reports.
---

# IBM i Performance Extractor Skill

本 Skill 專門用於指導 AI Agent 與開發者使用專案中的腳本工具鏈，對任意 IBM i 主機與自訂 Library 的 `*MGTCOL` 效能資料庫進行資料提取、憑證事前點檢、JSON 串接以及 HTML 互動式儀表板的產出。

---

## 1. 觸發與提示詞規範 (Triggering Rules)

當用戶希望執行效能分析且包含自訂參數時，必須識別並擷取以下三個變數：
- **主機 (Host)**: 指定的主機 IP、DNS 名稱或設定檔中的主機 ID (預設為 `<HostID>`)。
- **Library**: 儲存效能實體檔案的資料庫庫名 (預設為 `QPFRDATA`)。
- **日期 (Date)**: 格式如 `MM/DD` (例如 `07/30`)，將用於計算 Julian Day。

### 提示詞觸發範例 (Example Prompts)
- 「請幫我擷取主機 `<HostID>`、Library `<LibraryName>` 在 `<MM/DD>` 的效能資料並生成 HTML 報表。」
- 「從 IP `<Host IP>` 的 `<LibraryName>` 庫中讀取 `<MM/DD>` 效能數據，產出網頁分析圖表。」

---

## 2. Pipeline 執行與測試指南

使用 `scripts/test_pipeline.js` 進行端到端驗證。所有參數皆可省略，省略時會自動回退 (Fallback) 到 `hosts_config.json` 的設定值。

可用參數：
- `--host=<主機ID>`：`hosts_config.json` 中的 key（設定檔僅一組主機時可省略）
- `--lib=<LibraryName>`：覆寫該主機設定的 `library`
- `--maxDays=<N>`：覆寫該主機設定的 `maxDays`
- `--forceSchemaCheck=true`：強制重新驗證 Schema

**實機完整擷取指令：**
```bash
node ./scripts/test_pipeline.js --host=<主機ID>
```

---

## 3. 自動化驗證原則

每次修改 SQL 欄位或計算邏輯後，必須執行 `scripts/validate_metrics.js` 進行基準值對比驗證，以確保報告數據與綠色畫面完全一致。

```bash
node ./scripts/validate_metrics.js --host=<主機ID>
```

---

## 📚 References Routing

> **注意 (Agent Guidance)**: 為了維持高效的 Token 使用率，本 Skill 採用「延遲加載 (Lazy Loading) 架構」。請根據當下任務的上下文，使用 `view_file` 讀取對應的擴充參考文件：

| 當遇到以下任務情境... | 必須讀取的擴充文件 |
| :--- | :--- |
| **憑證與設定問題** (如設定 DPAPI、新增主機、Pre-flight 檢查失敗) | `references/credential-management.md` |
| **RCA 根因分析** (用戶要求對特定時段深入追查，需要看 Job 排名或 Pool 狀態) | `references/rca-diagnostics.md` |
| **HTML 報表視覺調整** (使用者想要修改圖表樣式、新增/調整儀表板版面) | `references/html-visual-rules.md` |
| **打包與分享** (使用者想知道如何把這個 Skill 分享給同事) | `references/sharing-guide.md` |
| **SQL 查詢或欄位異常** (需要知道具體每張 QAPM 表格的欄位意義與公式) | `references/field_reference.md` |
