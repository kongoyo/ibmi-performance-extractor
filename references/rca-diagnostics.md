# RCA 根因診斷執行原則 (Deep Module Workflow)

當使用者要求對特定時段或特定 Job 進行根因分析時，AI 必須遵循「**深度模組 (Deep Module)**」架構原則：**由腳本負責自動化收集數據，AI 只專注於數據分析與診斷報告撰寫。**

## 執行三部曲 (Workflow)

### Step 1: 呼叫資料收集器 (Data Collector)
AI 絕對**不要**自己寫 SQL 去查資料或自己爬 JSON 檔。請直接呼叫專屬的 RCA 提取腳本：
```bash
node ./scripts/rca_extractor.js --host=<主機ID> --job=<Job名稱> --date=<日期, 例 07/13> --time=<時間, 例 12:45>
```
*此腳本會自動尋找對應的資料庫或快取，並將這 5 大維度（系統時序、Job 排行、OS 層次診斷、Pool 聚合、跨時段趨勢）的原始數據萃取出來。*

### Step 2: 讀取上下文數據
腳本執行成功後，會在終端機告訴您輸出的 Context 檔案路徑（通常位於 `outputs/<IP>/rca_context_<JOB>.md`）。
請使用 `view_file` 工具讀取該 Context 檔案，獲取該 Job 在該時段的各種 Metrics 數據。

### Step 3: 產出與歸檔最終報告
基於獲取的 Context，撰寫一份包含「時間、Job、影響時段、診斷結論與修復建議」的 RCA Markdown 報告。
**【強制規定】歸檔位置**：
AI 必須將產出的最終報告檔案，**直接寫入至與該主機對應的 `outputs/` 目錄中**（例如 `outputs/<IP>/rca_report_<JOB>.md`）。
絕對不可將其留在 AI 的暫存區或專案根目錄，以確保所有的效能分析報告都按照主機 IP 被妥善分類與歸檔。

> 詳細的查詢 SQL 範本與欄位對照（若需手動除錯），請參閱 `references/field_reference.md`。
