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

使用 `scripts/test_pipeline.js` 進行端到端驗證，並固定透過 `npm run extract` 呼叫（已在 `package.json` 中定義），Agent 不應每次自行組裝 bash 指令。

**首次使用前置作業（僅需一次）：** 本 skill 依賴 `@ibm/ibmi-mcp-server`（提供 `SourceManager` 服務模組）。若 skill 根目錄尚未有 `node_modules`，先執行一次：
```bash
npm install
```
`scripts/preflight.js` 的 `loadServices()` 會自動從 `node_modules/@ibm/ibmi-mcp-server` 解析出 `services.js`，不需手動設定 `IBMI_SERVICES_PATH`（除非是安裝到非標準位置）。

可用參數：
- `--host=<主機ID>`：`hosts_config.json` 中的 key（設定檔僅一組主機時可省略）
- `--date=<MM/DD>`：指定要擷取的**單一日期**（例如 `07/14`），與 `--dateFrom`/`--dateTo` 二擇一、必填其一
- `--dateFrom=<MM/DD>` + `--dateTo=<MM/DD>`：指定要一次擷取的**日期區間**（含頭尾，例如 `--dateFrom=07/12 --dateTo=07/14` 會擷取 07/12、07/13、07/14 三天）
- `--lib=<LibraryName>`：覆寫該主機設定的 `library`
- `--forceSchemaCheck=true`：強制重新驗證 Schema

擷取範圍為指定 Library 中**實際存在**的 partition（member），不設人工天數上限；`extractor.js` 的 `extractDates()` 會自動枚舉 library 內所有 partition，再篩出符合目標日期（單日或區間展開後）的那些。

**輸出位置與命名**：同一個 Library 的資料視為同一資料池，資料夾**不再**依日期切分，改由**檔名**區分日期範圍，避免單日擷取與區間擷取互相覆蓋：
```
data/<主機ID>/<Library>/perf_<label>.json
outputs/<主機ID>/<Library>/<LIBRARY>_perf_<label>.html
```
其中 `<label>` 由**實際擷取到的資料**（payload 的 `dates` 陣列)反推，而非直接套用 `--date`/`--dateFrom`/`--dateTo` 參數本身：只有一天則為 `MMDD`（例如 `0714`），有多天則為 `最早日期_to_最晚日期`（例如 `0712_to_0714`）。這樣即使 Library 中的 partition 有缺漏、或實際涵蓋範圍與請求不完全一致，檔名仍會忠實反映內容；若請求的日期在 Library 中完全找不到對應 partition，Pipeline 會直接報錯，不會產生任何檔案。

**實機完整擷取指令：**
```bash
# 單日
npm run extract -- --host=<主機ID> --date=<MM/DD>

# 區間（一次擷取多天）
npm run extract -- --host=<主機ID> --dateFrom=<MM/DD> --dateTo=<MM/DD>
```

---

## 3. 自動化驗證原則

每次修改 SQL 欄位或計算邏輯後，必須執行 `scripts/validate_metrics.js` 進行基準值對比驗證，以確保報告數據與綠色畫面完全一致。

```bash
npm run validate -- --host=<主機ID>
```

---

## 📚 References Routing

> **注意 (Agent Guidance)**: 為了維持高效的 Token 使用率，本 Skill 採用「延遲加載 (Lazy Loading) 架構」。請根據當下任務的上下文，使用 `view_file` 讀取對應的擴充參考文件：

| 當遇到以下任務情境... | 必須讀取的擴充文件 |
| :--- | :--- |
| **憑證與設定問題** (如設定 DPAPI、新增主機、Pre-flight 檢查失敗) | `references/credential-management.md` |
| **RCA 根因分析** (用戶要求對特定時段深入追查，需要看 Job 排名、鎖定等待或 Pool 狀態) | `references/rca-diagnostics.md` |
| **每日健康摘要／多日趨勢／磁碟熱點報告** (用戶要一頁式健康總結、容量規劃趨勢、或想知道是哪顆磁碟 ARM 在拖速度) | `references/report-catalog.md` |
| **HTML 報表視覺調整** (使用者想要修改圖表樣式、新增/調整儀表板版面) | `references/html-visual-rules.md` |
| **打包與分享** (使用者想知道如何把這個 Skill 分享給同事) | `references/sharing-guide.md` |
| **SQL 查詢或欄位異常** (需要知道具體每張 QAPM 表格的欄位意義與公式) | `references/field_reference.md` |
