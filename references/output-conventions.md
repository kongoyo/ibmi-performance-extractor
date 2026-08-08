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

## Library 自動偵測（找不到目標日期資料時）

一台主機的 Collection Services 資料可能分散在不只一個 `*MGTCOL` library（`hosts_config.json` 只登記一個預設值）。當**未帶 `--lib`**、且預設 library 對目標日期沒有資料時，腳本會自動掃描並切換，AI／使用者不需要手動猜測改用哪個 library：

- **擷取階段**（`npm run extract`，`test_pipeline.js`）：對主機即時查詢所有含 `QAPMISUM` 的 library，挑出相符 partition 數最多的那個，自動重新擷取。
- **分析階段**（`npm run rca`/`anomaly`/`digest`/`trend`/`disk-hotspot`）：掃描本機 `data/<主機ID>/` 底下所有 library 子目錄的既有快取，找到第一個涵蓋目標日期（或日期區間）的 `perf_*.json`。
- 兩種情境都只在**沒有明確指定 `--lib`** 時才會自動切換；若使用者明確指定 `--lib`，找不到資料就直接報錯，不會被靜默覆蓋。
- 自動切換時終端機會印出 `⚠️ ... 自動改用 Library "X"` 訊息；後續同一份報告若要重跑，可直接帶上偵測到的 `--lib=X` 跳過偵測。

## 產出報告的真實資訊 vs 遮蔽規則

`.agents/AGENTS.md` 的遮蔽規則（IP／HostID／UserID／密碼一律用 `<Host IP>` 等佔位符）只適用於**文件、README、範例提示詞**這類可能被公開分享、或作為通用範例的內容。

**實際產出的分析報告不適用遮蔽規則**——`outputs/<主機ID>/<Library>/` 底下的 `rca_report_*.md`、`daily_digest_report_*.md`、`trend_report_*.md`、`disk_hotspot_report_*.md` 都必須寫出**真實**主機資訊（例如 `clark75 (172.16.12.126)`），否則使用者無法據此採取行動。標頭格式統一比照既有報告：

```
**主機**：<HostID> (<Host IP>) ／ Library：<Library>
```

---

## 注意事項

- 同一台主機、同一個 Library 的資料視為**同一資料池**，資料夾**不依日期切分**，由檔名區分日期範圍，避免單日與區間擷取互相覆蓋。
- 所有目錄由腳本自動建立，AI 或使用者無需手動建立。
