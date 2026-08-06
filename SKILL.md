---
name: ibmi-scratch-perf-extractor
description: Extract IBM i Collection Services performance data from custom libraries and hosts using the scratch folder scripts, perform credential pre-flight validation, and generate beautiful responsive HTML performance reports.
---

# IBM i Scratch Performance Data Extractor Skill

本 Skill 專門用於指導 AI Agent 與開發者使用專案中的 `scratch/` 腳本工具鏈，對任意 IBM i 主機與自訂 Library 的 `*MGTCOL` 效能資料庫進行資料提取、憑證事前點檢、JSON 串接以及 HTML 互動式儀表板的產出。

---

## 1. 觸發與提示詞規範 (Triggering Rules)

當用戶希望執行效能分析且包含自訂參數時，必須識別並擷取以下三個變數：
- **主機 (Host)**: 指定的主機 IP、DNS 名稱或設定檔中的主機 ID (預設為 `clark73`)。
- **Library**: 儲存效能實體檔案的資料庫庫名 (預設為 `QPFRDATA`)。
- **日期 (Date)**: 格式如 `MM/DD` (例如 `07/30`)，將用於計算 Julian Day。

### 提示詞觸發範例 (Example Prompts)
- 「請幫我擷取主機 `<主機ID>`、Library `<LibraryName>` 在 `<MM/DD>` 的效能資料並生成 HTML 報表。」
- 「從 IP `<YOUR_IBMI_HOST_IP>` 的 `<LibraryName>` 庫中讀取 `<MM/DD>` 效能數據，產出網頁分析圖表。」

---

## 2. 憑證與設定檔管理 (Credential Profiles)

為了避免明文憑證寫死在程式碼中，連線資料優先透過以下兩種方式載入：

### 2.1 主機設定檔 `scratch/hosts_config.json`
在 `scratch/` 下建立此檔並登錄各主機連線設定，且在版控中忽略該檔案的實際內容：
```json
{
  "<your_host_id_1>": {
    "host": "<YOUR_IBMI_HOST_IP_OR_DNS>",
    "port": 8076,
    "user": "<YOUR_IBMI_USER_PROFILE>",
    "password": "<YOUR_IBMI_PASSWORD>",
    "ignore-unauthorized": true
  },
  "<your_host_id_2>": {
    "host": "<YOUR_IBMI_HOST_IP_OR_DNS>",
    "port": 8076,
    "user": "<YOUR_IBMI_USER_PROFILE>",
    "password": "<YOUR_IBMI_PASSWORD>",
    "ignore-unauthorized": true
  }
}
```

### 2.2 環境變數備援
若未配置 JSON 檔，程式將自動嘗試從環境變數載入，變數格式為：
- `IBMI_HOST_[主機ID]`、`IBMI_USER_[主機ID]`、`IBMI_PASSWORD_[主機ID]`

---

## 3. 事前憑證點檢 (Pre-flight Validation)

在執行任何連線與資料擷取前，腳本必須調用檢查邏輯。若偵測到連線資訊不全或使用預留字，應立刻中斷並輸出引導指引：

```javascript
function validateCredentials(hostId, hostConfig) {
  if (!hostConfig.host || !hostConfig.user || !hostConfig.password || hostConfig.password === "YOUR_PASSWORD_HERE") {
    console.error(`\n❌ [憑證缺失錯誤] 找不到主機 "${hostId}" 的連線憑證，或密碼仍為預設預留字。`);
    console.error(`💡 [解決指引]:`);
    console.error(`  1. 請檢查並填寫 scratch/hosts_config.json`);
    console.error(`  2. 或在專案根目錄的 .env 檔案中新增環境變數：`);
    console.error(`     IBMI_HOST_${hostId}=主機IP\n     IBMI_USER_${hostId}=帳號\n     IBMI_PASSWORD_${hostId}=密碼\n`);
    throw new Error(`Missing credentials for host profile: ${hostId}`);
  }
}
```

---

## 4. 資料來源與成員解析原則

1. **Julian Day 成員識別**：依 `MM/DD` 計算一年中的第幾天（`ddd`），映射至 `Qddd000002` 格式的成員名稱，詳細換算邏輯實作於 `scripts/test_pipeline.js`。
2. **QTEMP 別名**：對每個成員在 `QTEMP` 動態建立 `ALIAS`，需涵蓋 `QAPMISUM`、`QAPMSYSTEM`、`QAPMJOBL`、`QAPMJOBOS`、`QAPMDISK` 共五張來源表。
3. **CPU 使用率對齊原則**：CPU 指標必須以 LPAR 分區整體容量為基準計算，而非單一核心，以確保與綠色畫面 `DSPPFRDTA` 的數值一致。
4. **高磁碟使用率 (High Disk)**：此指標不存在於 `QAPMISUM`，需透過 `QAPMDISK` 中各 ARM 的閒置/取樣計數動態推算後，取所有 ARM 中的最大值。
5. **分頁缺失欄位**：`QAPMJOBL` 中的分頁缺失欄位名稱與直覺不同，必須使用正確欄位，詳見 `references/field_reference.md`。

---

## 5. HTML 報告視覺化原則

生成的 HTML 報告需符合以下設計規範，具體實作於 `scripts/generate_report.py`：

1. **百分比 Y 軸固定**：CPU 及 High Disk 等百分比圖表的 Y 軸必須固定在 0–100%，嚴禁自動縮放。
2. **互動式 Job 排行面板**：每個圖表卡片右側需配置 Tab 式日期切換的 Top 10 Job 列表，且 hover 圖表時自動更新對應時段排行。
3. **雙欄 RCA 診斷卡片**：報告底部保留根因分析區塊，以雙欄卡片格式並列系統異常診斷結果。

---

## 6. 自動化驗證原則

每次修改 SQL 欄位或計算邏輯後，必須執行 `scripts/validate_metrics.js` 進行基準值對比驗證，以確保報告數據與綠色畫面完全一致。

```bash
node scratch/validate_metrics.js
```

---

## 7. Pipeline 執行與測試指南

使用 `scripts/test_pipeline.js` 進行端到端驗證：

### 7.1 事前憑證點檢（負向測試）
```bash
node scratch/test_pipeline.js --host=<主機ID>
```
*預期結果*：偵測到密碼缺失，顯示引導說明並中斷執行。

### 7.2 實機完整擷取
```bash
node scratch/test_pipeline.js --host=<主機ID> --lib=<LibraryName> --date=<MM/DD>
```
*預期結果*：連線 IBM i、自動識別成員、查詢效能資料並輸出命名格式為 `[HOST]_[LIB]_Performance_Report.html` 的報告。

---

## 8. 分享與打包指引 (How to Share)

若要將此項 Skill 與腳本打包分享給同事，最推薦的方式是**專案級配置 (Project-level Customization)**：
1. **目錄結構**：在專案根目錄下建立 `.agents/` 目錄，結構如下：
   ```text
   .agents/
   └── skills/
       └── ibmi-performance-extractor/
           ├── SKILL.md (即本文件)
           ├── scripts/
           │   ├── test_pipeline.js
           │   ├── generate_report.py
           │   └── validate_metrics.js
           ├── references/
           │   └── field_reference.md  (欄位對照、公式細節)
           └── examples/
               └── hosts_config.json.example
   ```
2. **自動載入**：同事只要使用 Git 拉取此專案，Antigravity IDE 就會**自動識別並載入**本 Skill，不需要手動在全域配置。
3. **執行**：同事只需在根目錄下執行 `node scratch/test_pipeline.js` 或配置連線，AI 即可自動讀取此 Skill 來輔助引導與故障診斷。

---

## 9. RCA 根因診斷執行原則

當使用者要求對特定時段進行根因分析時，AI 應主動透過 `SourceManager` 連線至 IBM i，依序從以下五個維度取得佐證證據，並以「時間、Job、影響時段」為三個必要敘述要素組成 RCA 報告：

1. **系統層次時序**：查詢目標 Interval 前後 ±2 個區間的系統摘要（交易數、回應時間、CPU、分頁缺失），建立時序背景。
2. **Job 負載排行**：對目標 Interval 查詢 Top 15 高負載 Job，依目標指標（I/O 次數、分頁缺失、CPU）排序。
3. **OS 層次診斷**：對排行前列的 Job 查詢 OS 層次統計，識別 Native I/O vs SQL、子系統歸屬、交易模式。
4. **Pool 聚合分析**：按記憶體 Pool 彙總資源消耗，識別哪個 Pool 正在承受壓力。
5. **跨時段趨勢**：查詢前後 10 個 Interval 的 Job 趨勢，判斷異常是突發性還是持續性。

> 詳細的查詢 SQL 範本與欄位對照，請參閱 `references/field_reference.md`。


1. **Julian Day 轉換公式 (非閏年)**：
   - 依據 `MM/DD` 累加月份天數，算出是一年中的第幾天 `ddd`（填補至三位數）。
   - 映射實體檔案成員名為：`Qddd000002` (例如 `07/30` ➔ `211` ➔ `Q211000002`)。
