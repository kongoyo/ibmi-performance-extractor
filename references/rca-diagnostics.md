# RCA 根因診斷執行原則 (Deep Module Workflow)

當使用者要求對特定時段或特定 Job 進行根因分析、或要求找出全天異常 Job 時，AI 必須遵循「**深度模組 (Deep Module)**」架構原則：**由腳本負責自動化收集數據、計算與摘要化，AI 只專注於數據分析與診斷報告撰寫。**

## 資料夾規劃：機器可讀 vs 人類可讀

`outputs/<主機ID>/<Library>/` 底下依讀者分成兩層：

- `outputs/<主機ID>/<Library>/context/`：**機器可讀**，由 `rca_extractor.js`／`anomaly_scan.js` 產出的 Context 檔案（`rca_context_*.md`、`anomaly_scan_*.md`）。這些是給 AI 讀的中繼資料，內容經過摘要化以節省 token，不對外分享。
- `outputs/<主機ID>/<Library>/`（不含 `context/`）：**人類可讀**，AI 撰寫的最終報告（`rca_report_*.md`）與 HTML 儀表板。這些才是要交付給使用者的產出。

兩個收集腳本都會自動建立 `context/` 子資料夾，AI 不需要手動建立。

## 執行三部曲 (Workflow)

### Step 1: 呼叫資料收集器 (Data Collector)

AI 絕對**不要**自己寫 SQL 去查資料、自己爬 JSON 檔、或用 `node -e` 之類的臨時腳本手動掃描——這些都應該由腳本完成，AI 只負責讀取產出的 Context 並撰寫報告，藉此大幅降低 token 用量。

**情境 A：已知特定 Job，要查其資源使用狀況** → 呼叫 `npm run rca`（`scripts/rca_extractor.js`）：

單一時段模式（提供 `--time`）：只擷取該 Job 在**指定時間點**的排行榜數據。

```bash
npm run rca -- --host=<主機ID> --job=<Job名稱> --date=<日期, 例 07/13> --time=<時間, 例 12:45>
```

全天模式（省略 `--time`）：掃描該日期**所有時段 x 所有排行榜維度**（Count/Rsp/Tot/Int/Bch/Dsk/Usr），找出該 Job 每一次上榜紀錄，並自動計算日峰值判斷；同時偵測同 Program/User 但不同 Job Number 的其他實例（IBM i 上 Job Number 改變通常代表作業重啟，為前後不同執行期間）。適用於使用者要求「全天使用情況」、「整天分析」等不限定單一時間點的問題。

```bash
npm run rca -- --host=<主機ID> --job=<Job名稱> --date=<日期, 例 07/14>
```

**情境 B：不知道是哪個 Job，要先找出全天異常/影響最大的 Job** → 先呼叫 `npm run anomaly`（`scripts/anomaly_scan.js`），掃描全天所有時段在 Response Time/CPU/Disk I/O/Page Faults（不含 Transaction Count，因高交易量本身非資源異常）這五類維度的排行榜第一名，依「登頂總次數」（持續性影響）排序產出候選清單：

```bash
npm run anomaly -- --host=<主機ID> --date=<日期, 例 07/14>
```

腳本執行完會在終端機直接提示影響最大的 Job 名稱與建議的後續 `npm run rca` 指令，AI 應接續對該 Job 執行全天模式 RCA。

兩支腳本都會在 `data/<主機ID>/<Library>/` 底下自動尋找包含該日期的 `perf_*.json` 快取（無論是單日或涵蓋該日的區間擷取），完成數據萃取與所有數值計算。

**輸出精簡策略**：當某個 Job/維度的樣本數超過門檻（預設 20 筆）時，兩支腳本都會自動從「逐筆列出每個時段」改為「每維度統計摘要（樣本數/時間範圍/最小/最大/平均）+ 僅列出達成當日絕對峰值的時刻」，避免長跑批次 Job（例如活躍 10 小時的背景作業）把 Context 檔案撐到數十 KB。原始 JSON 預設不輸出，需要人工複核底層數值時才加 `--debug=true`。

### Step 2: 讀取上下文數據

腳本執行成功後，會在終端機告訴您輸出的 Context 檔案路徑（皆位於 `context/` 子資料夾下：單一時段模式為 `rca_context_<JOB>.md`；全天模式為 `rca_context_<JOB>_fullday.md`；異常掃描為 `anomaly_scan_<日期label>.md`）。
請使用 `view_file` 工具讀取該 Context 檔案，所有數值、峰值判斷都已由腳本算好，AI 只需要解析並撰寫敘述，不需要重新運算或回頭查原始 JSON。

### Step 3: 產出與歸檔最終報告

基於獲取的 Context，撰寫一份包含「時間、Job、影響時段、診斷結論與修復建議」的 RCA Markdown 報告；若是情境 B，另需列出異常 Job 排行清單。
**【強制規定】歸檔位置**：
AI 必須將產出的最終報告檔案，**直接寫入至與該主機/Library 對應的 `outputs/<主機ID>/<Library>/` 目錄中**（不是 `context/` 子資料夾），例如 `outputs/<主機ID>/<Library>/rca_report_<JOB>.md`。
絕對不可將其留在 AI 的暫存區或專案根目錄，以確保所有的效能分析報告都按照主機與 Library 被妥善分類與歸檔，且機器可讀與人類可讀的產出分屬不同資料夾。

> 詳細的查詢 SQL 範本與欄位對照（若需手動除錯），請參閱 `references/field_reference.md`。

## Seize/Wait（鎖定等待）分析

`npm run rca`／`npm run anomaly` 已內建 `Szwt`（Seize/Wait Time，鎖定等待時間，來源欄位 `QAPMJOBL.JBSZWT`）這個維度，用法與 CPU/Disk/Faults 完全相同，**不需要額外指令或步驟**——當某個 Job 因為等鎖而拖慢（而非真的在算資料）時，會自動出現在情境 A 的全天上榜紀錄、或情境 B 的異常排行榜中。與其他 CPU/Disk/Faults 維度不同的是，`Szwt` **沒有系統層級總量可比**（`QAPMISUM`/`QAPMSYSTEM` 都沒有對應欄位），因此 Context 檔案裡此維度的「系統當時段總量/佔比」一律顯示不可比，改用「當日其他 Job 的同維度最高值」判斷是否為當日峰值，判讀時留意這點即可。

> ⚠️ `JBSZWT` 是本專案首次使用的欄位，尚未經真實主機資料實測驗證（`scripts/validate_metrics.js` Test Area 7 目前僅為原始數值 dump，供人工對照 `WRKACTJOB` 核對）。在驗證通過並於 `field_reference.md` 記錄查證結果之前，`Szwt` 相關數字應視為「格式正確但尚待確認」，不宜直接作為結論依據。

## 其他報告類型

非 Job 中心的報告（每日健康摘要、多日趨勢、磁碟熱點）請參閱 `references/report-catalog.md`。
