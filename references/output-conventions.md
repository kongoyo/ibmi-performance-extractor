# 輸出路徑與命名規範 (Output Path & Naming Conventions)

本文件說明 `ibmi-performance-extractor` 所有腳本產出的路徑結構與檔名推導邏輯。

---

## 目錄結構

```
data/
└── <主機ID>/
    └── <Library>/
        └── perf_<label>.json          ← 原始萃取資料（Source Data，機器可讀）

outputs/
└── <主機ID>/
    └── <Library>/
        ├── <LIBRARY>_perf_<label>.html  ← 視覺化 HTML 儀表板（人類可讀）
        ├── rca_report_<JOB>.md          ← AI 撰寫的 RCA 診斷報告（人類可讀）
        └── context/
            ├── rca_context_<JOB>.md          ← RCA 單一時段上下文（機器可讀，給 AI 讀）
            ├── rca_context_<JOB>_fullday.md  ← RCA 全天上下文（機器可讀）
            └── anomaly_scan_<label>.md        ← 異常掃描結果（機器可讀）
```

> `data/` 存放不可侵犯的原始資料；`outputs/` 存放所有產出物（報表 + AI 報告）。`context/` 子資料夾是機器可讀的中繼資料，不對外分享。

---

## `<label>` 命名規則

`<label>` 由腳本在萃取完成後，依**實際擷取到的資料**（payload 的 `dates` 陣列）反推，而非直接套用 CLI 參數：

| 情境 | label 格式 | 範例 |
| :--- | :--- | :--- |
| 只擷取到一天的資料 | `MMDD` | `0714` |
| 擷取到多天的資料 | `MMDD_to_MMDD`（最早至最晚） | `0712_to_0714` |

**為何用資料反推而非參數直用：**
- Library 中的 partition 可能有缺漏，實際涵蓋範圍可能比請求的小。
- 用實際資料命名，檔案內容永遠忠實反映真實情況。
- 若請求日期在 Library 中完全找不到對應 partition，Pipeline 會直接報錯，不產生任何檔案。

---

## `<主機ID>` 的取值規則

`<主機ID>` 使用 `config/hosts_config.json` 中的 `host` 欄位值（即主機的 IP 或 DNS 名稱），不是 JSON 的 key。

範例：`hosts_config.json` 中 key 為 `<HostName>`，`host` 欄位為 `<Host IP>`，則目錄為 `data/<Host IP>/`。

---

## 注意事項

- 同一台主機、同一個 Library 的資料視為**同一資料池**，資料夾**不依日期切分**，由檔名區分日期範圍，避免單日與區間擷取互相覆蓋。
- 所有目錄由腳本自動建立，AI 或使用者無需手動建立。
