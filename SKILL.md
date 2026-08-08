---
name: ibmi-performance-extractor
description: Analyze IBM i system performance from Collection Services data. Use when the user wants to extract QAPM metrics from a specific host/library/date, generate interactive HTML performance dashboards, identify resource-hogging jobs, or produce AI-driven RCA reports for job-level anomalies and system bottlenecks.
---

# IBM i Performance Extractor Skill

本 Skill 專門用於指導 AI Agent 與開發者使用專案中的腳本工具鏈，對任意 IBM i 主機與自訂 Library 的 `*MGTCOL` 效能資料庫進行資料提取、憑證事前點檢、JSON 串接以及 HTML 互動式儀表板的產出。

---

## 1. 觸發與提示詞規範 (Triggering Rules)

當用戶希望執行效能分析且包含自訂參數時，必須識別並擷取以下三個變數：
- **主機 (Host)**: 指定的主機 IP、DNS 名稱或設定檔中的主機 ID (預設為 `<HostID>`)。
- **Library**: 儲存效能實體檔案的資料庫庫名 (預設為 `QPFRDATA`)。
- **日期 (Date)**: 格式如 `MM/DD` (例如 `07/30`)，將用於計算 Julian Day。

### 觸發判斷規則

以下動詞與名詞**至少各命中一個**，即視為觸發本 Skill：

| 類型 | 關鍵字 |
| :--- | :--- |
| **動詞（行動意圖）** | 擷取、分析、生成、產出、查、看、診斷、跑、提取、extract、analyze、generate |
| **名詞（主題領域）** | IBM i、效能、QAPM、Collection Services、MGTCOL、報表、儀表板、RCA、根因、dashboard、performance |

> **不觸發本 Skill 的情況**：純粹詢問 RPG 語法、Job 定義、DB2 schema 等，與效能擷取 pipeline 無關者，應路由至其他 Skill。

### 提示詞觸發範例 (Example Prompts)
- 「請幫我擷取主機 `<HostID>`、Library `<LibraryName>` 在 `<MM/DD>` 的效能資料並生成 HTML 報表。」
- 「從 IP `<Host IP>` 的 `<LibraryName>` 庫中讀取 `<MM/DD>` 效能數據，產出網頁分析圖表。」

---

## 2. Pipeline 執行與測試指南

使用 `scripts/test_pipeline.js` 進行端到端驗證，並固定透過 `npm run extract` 呼叫（已在 `package.json` 中定義），Agent 不應每次自行組裝 bash 指令。

**首次使用前置作業（僅需一次）：** 若 skill 根目錄尚未有 `node_modules`，先執行一次：
```bash
npm install
```
> 若遇到 Pre-flight 失敗、`IBMI_SERVICES_PATH` 設定問題或服務模組解析異常，請讀取 `references/credential-management.md`。
>
> 💡 **開發與維護指引**：編寫新腳本或修改現有入口時，請直接使用 `preflight.js` 導出的 `runPreflight()` 聚合函式。它會自動依序執行環境檢查、動態載入 `SourceManager` 並處理憑證解密，無需在腳本中手動序列化 preflight 步驟。

可用參數：
- `--host=<主機ID>`：`hosts_config.json` 中的 key（設定檔僅一組主機時可省略）
- `--date=<MM/DD>`：指定要擷取的**單一日期**（例如 `07/14`），與 `--dateFrom`/`--dateTo` 二擇一、必填其一
- `--dateFrom=<MM/DD>` + `--dateTo=<MM/DD>`：指定要一次擷取的**日期區間**（含頭尾，例如 `--dateFrom=07/12 --dateTo=07/14` 會擷取 07/12、07/13、07/14 三天）
- `--lib=<LibraryName>`：覆寫該主機設定的 `library`
- `--forceSchemaCheck=true`：強制重新驗證 Schema

擷取範圍為指定 Library 中**實際存在**的 partition（member），不設人工天數上限；`extractor.js` 的 `extractDates()` 會自動枚舉 library 內所有 partition，再篩出符合目標日期（單日或區間展開後）的那些。

**輸出位置與命名**：資料落在 `data/<主機ID>/<Library>/`，報表落在 `outputs/<主機ID>/<Library>/`，檔名由實際擷取的日期範圍自動推導。詳細路徑結構與命名規則請參閱 `references/output-conventions.md`。

**實機完整擷取指令：**
```bash
# 單日
npm run extract -- --host=<主機ID> --date=<MM/DD>

# 區間（一次擷取多天）
npm run extract -- --host=<主機ID> --dateFrom=<MM/DD> --dateTo=<MM/DD>
```

---

## 3. 自動化驗證原則

每次修改 SQL 欄位或計算邏輯後，必須執行 `scripts/validate_metrics.js` 進行基準值對比驗證（共 8 個 Test Area，對照綠色畫面截圖）。

```bash
npm run validate -- --host=<主機ID>
```

**判準（必須全部通過才能繼續）：**
- ✅ 輸出結尾為 `ALL N TESTS PASSED SUCCESSFULLY!`
- ❌ 輸出出現任何 `[FAIL]` → 代表計算公式與綠色畫面不一致，**必須修正後重跑，不得送出報告**
- ⚠️ 出現 `⚠️` 警告的 Area（Area 7、Area 8c）屬於人工驗測待升格項目，不計入失敗

> 詳細的 8 個 Test Area 說明、失敗排查步驟、人工驗測升格流程，請讀取 `references/validate-workflow.md`。

---

## 📚 References Routing

> **注意 (Agent Guidance)**: 為了維持高效的 Token 使用率，本 Skill 採用「延遲加載 (Lazy Loading) 架構」。請根據當下任務的上下文，使用 `view_file` 讀取對應的擴充參考文件：

| 當遇到以下任務情境... | 必須讀取的擴充文件 |
| :--- | :--- |
| **憑證與設定問題** (如設定 DPAPI、新增主機、Pre-flight 檢查失敗) | `references/credential-management.md` |
| **RCA 根因分析**（已知特定 Job 要查資源用量、或不知是哪個 Job 想先找最異常的） | `references/rca-diagnostics.md` |
| **每日健康摘要／多日趨勢／磁碟熱點**（無特定 Job 嫌疑、要整體系統層次一頁式總結） | `references/report-catalog.md` |
| **HTML 報表視覺調整** (使用者想要修改圖表樣式、新增/調整儀表板版面) | `references/html-visual-rules.md` |
| **打包與分享** (使用者想知道如何把這個 Skill 分享給同事) | `references/sharing-guide.md` |
| **SQL 查詢或欄位異常** (需要知道具體每張 QAPM 表格的欄位意義與公式) | `references/field_reference.md` |
| **輸出路徑或命名規則** (需要了解 data/ 與 outputs/ 的結構、label 命名推導邏輯) | `references/output-conventions.md` |
| **驗測失敗排查、Test Area 細節、人工驗測升格流程** | `references/validate-workflow.md` |
