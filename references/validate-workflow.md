# 驗測流程參考 (Validate Workflow)

> 對應腳本：`scripts/validate_metrics.js`
> 觸發指令：`npm run validate -- --host=<主機ID>`

本文件說明驗測套件的結構、每個 Test Area 的目的、失敗判準，以及如何將人工驗測升格為自動化斷言。

---

## 驗測套件架構

`validate_metrics.js` 對一個固定的基準主機的歷史資料執行 **8 個 Test Area**，全部以綠色畫面截圖作為 ground truth，並以 `assertEqual(testName, actual, expected, tolerance)` 進行斷言。

> **注意**：基準資料（`benchmarkIntervals`、`diskUtilBenchmark` 等）硬編碼在腳本中，代表的是特定 Library 的歷史快照（KTB benchmark fixture），與 `--lib` 參數無關。執行時可帶任意主機，但斷言值永遠對照這組固定基準。

### 退出行為

| 結果 | 輸出 | 退出碼 |
|---|---|---|
| 所有斷言通過 | `ALL N TESTS PASSED SUCCESSFULLY! 🚀` | 0 |
| 任一斷言失敗 | `N TEST(S) FAILED. Please verify calculations.` | 0（不中斷，繼續跑完所有 Area） |
| 連線 / SQL 例外 | `💥 Validation Suite Error: <message>` | 非 0 |

> **判準**：若有任何 `[FAIL]` 出現在輸出中，代表 SQL 公式或欄位計算邏輯與綠色畫面已不一致，**必須停下來修正，不得繼續提交報告**。

---

## Test Area 一覽

### Area 1：多時間區間對齊（07/13 05:15～07:30）

- **目的**：驗證 `QAPMISUM` + `QAPMSYSTEM` 的交易次數、回應時間、CPU 佔用率、Page Faults/sec 四項指標公式
- **基準**：10 個區間（INTNUM 21～30）的綠色畫面截圖
- **容差**：RSP ±0.01 秒、Faults ±120（其他 Pool 的差異）

### Area 2：互動式交易回應時間計算

- **目的**：驗證 `QAPMJOBL.JBRSP / 1000.0` 的除法精度（特別是極端長回應時間）
- **基準**：07/13 12:45（INTNUM 51）Job `HN040130A` → 預期 14.27 秒（±0.05）

### Area 3：MIMIX I/O 暴衝筆數

- **目的**：驗證 `JBADBR + JBDBR` 的加總邏輯（非同步讀 + 同步讀）
- **基準**：07/16 11:00（INTNUM 44）Job `CMPFILDTA` → 預期 87,943,713 次讀取（±10）

### Area 4：Job 聚合去重驗證

- **目的**：確認 `GROUP BY JBNAME, JBUSER, JBNBR` 能正確識別唯一 Job（不會因 thread 重複產生多列）
- **基準**：同一 INTNUM 的 CMPFILDTA 應聚合為剛好 1 列

### Area 5：互動/批次 CPU 分割（Int/Bch Fix，2026-08-06）

- **目的**：驗證互動式 CPU（`JBTYPE = 'I'`）在零互動工作負載時段應回傳 0，而非舊 bug 的恆為 0
- **基準**：07/13 00:15～05:00（INTNUM 1～20），這段時間無真實互動工作
- **關鍵約束**：`Int + Bch == Tot` 必須成立於每個區間

### Area 6：磁碟高使用率四捨五入（Dsk Fix，2026-08-06）

- **目的**：驗證磁碟忙碌率使用 `CEILING` 而非 `TRUNC`（與 DSPPFRDTA 行為一致）
- **公式**：`CAST(CEILING((1.0 - DSNBSY / DSSMPL) * 100) AS INTEGER)`
- **基準**：跨兩個 member（07/13 + 07/15）共 20 個資料點

### Area 7：Seize/Wait Time（JBSZWT）—⚠️ 人工驗測

- **狀態**：此欄位尚未實測驗證
- **目前行為**：僅印出 Top 10 Jobs by JBSZWT，不做 `assertEqual`
- **升格條件**：對照 `WRKACTJOB Function/LOCKWAIT` 或 Job Wait Statistics 畫面確認後，改寫為 `assertEqual()` 並更新 `references/field_reference.md` 的變更記錄

### Area 8：單磁碟單元細節（Green Screen + 人工驗測）

- **(a) 已驗證**：Per-unit breakout 的 `MAX(BUSY_PCT)` 必須與 Area 6 的系統級 MAX 一致
- **(b) 已驗證**：`DSDRN`（設備資源名稱）在每個區間必須唯一（`COUNT(DISTINCT DSDRN) == COUNT(*)`）
  - 背景：`DSARM` 在此環境**不是**唯一鍵（4 個磁碟共用同一 ARM 號碼），`DSDRN` 才是
- **(c) 人工驗測**：`DSSRVT`/`DSWT`/`DSDCFW` 尚未實測，印出 Top 5 供人工對照 `WRKDSKSTS` 畫面

---

## 人工驗測升格為自動斷言的流程

當你在綠色畫面截圖或 `WRKACTJOB`/`WRKDSKSTS` 中確認了某個欄位的真實數值後：

1. 在 `validate_metrics.js` 中將對應的 `console.log` 區塊**改寫為 `assertEqual()`**，並加入 tolerance 值
2. 將新的基準值加入對應的 benchmark 陣列（例如 `benchmarkIntervals`）
3. 在 `references/field_reference.md` 的**變更記錄**中記下驗證事實與截圖時間戳
4. 執行 `npm run validate` 確認新斷言通過
5. Commit 時在 message 中標注 `[validate: area-N升格]`

---

## 何時需要執行驗測

- 每次修改 `scripts/queries.js` 中的 SQL 欄位或計算公式後
- 每次修改 `scripts/extractor.js` 的指標轉換邏輯後
- 新增一個 QAPM 表格的欄位引用到報表前
- CI 流程中的回歸保護（目前為手動觸發）
