# 非 Job 中心報告目錄 (Report Catalog)

本文件收錄 3 種不以「單一 Job」為中心的分析報告：**每日健康摘要**、**磁碟熱點**、**多日趨勢與容量規劃**。三者都延續 `references/rca-diagnostics.md` 已建立的「深度模組 (Deep Module)」架構：**由腳本收集數據並摘要化，AI 只負責讀 Context 撰寫報告**，以及 `context/`（機器可讀）vs `outputs/`（人類可讀）的資料夾分工。

> Seize/Wait（鎖定等待）分析**不**是獨立報告——它只是 `npm run rca` / `npm run anomaly` 既有流程新增的一個 metric（`Szwt`），用法與既有 CPU/Disk/Faults 分析完全相同，詳見 `references/rca-diagnostics.md`。

---

## 每日健康摘要報告 (Daily Executive Digest)

適用情境：使用者要「一頁式」健康總結、晨會/主管快速閱讀，不需要深入單一 Job。

```bash
npm run digest -- --host=<主機ID> --date=<MM/DD>
```

腳本（`scripts/daily_digest.js`）會：
1. 讀取該日期已擷取的 `perf_*.json`。
2. 對每個維度計算當日最高值＋發生時間。
3. 對照 `scripts/reportingThresholds.js`（Tot>70%／Rsp>2.0s／Usr>50/s，對齊 HTML 儀表板既有標準）判斷是否超標。
4. 直接重用 `anomaly_scan.js` 的 `scanAnomalies()` 取得異常 Job Top 5（不重新計算排行邏輯）。

輸出 `context/daily_digest_<label>.md`；AI 讀取後撰寫 `outputs/<主機ID>/<Library>/daily_digest_report_<label>.md`，格式建議簡短（門檻超標概況 + Top 5 異常 Job + 一句話結論），符合「一頁式」定位，不要寫成完整 RCA 報告的長度。

---

## 多日趨勢與容量規劃報告 (Multi-Day Trend & Capacity Planning)

適用情境：使用者要看「這幾天是不是在惡化」、容量規劃、是否該加開資源。**必須先用區間擷取**（`npm run extract -- --dateFrom/--dateTo`）取得涵蓋整個區間的單一 JSON，本報告不會自動合併多個單日檔案。

```bash
npm run trend -- --host=<主機ID> --dateFrom=<MM/DD> --dateTo=<MM/DD>
```

腳本（`scripts/trend_report.js`）會對每個維度：
1. 列出區間內每一天的當日最高值＋發生時間。
2. 計算簡單線性趨勢斜率（每日變化量）與首末差值。
3. 對有門檻的維度（Tot/Rsp/Usr）判斷「是否已超標」與「是否正朝門檻惡化」（含粗略外推天數，僅供參考，非正式預測模型）。

輸出 `context/trend_report_<from>_to_<to>.md`；AI 讀取後撰寫 `outputs/<主機ID>/<Library>/trend_report_<from>_to_<to>.md`。**v1 僅提供 Markdown 表格，沒有圖表**（既有 HTML 儀表板的 Chart.js 完全綁死在單日頁面、瀏覽器端渲染，沒有可重用的伺服器端繪圖工具；若要圖表化需另外在 `generate_report.py` 加 `--mode=trend`，屬於後續擴充項目）。

---

## 磁碟熱點 / Queue Depth 報告 (Disk Hot-Spot)

適用情境：整體 Disk% 偏高、想知道**是哪一顆實體 ARM** 在拖速度，或懷疑 I/O 分布不均。

**前置條件**：資料必須是用**含逐 ARM 明細的新版 pipeline**擷取的（`extractor.js` 的 `diskArms` 欄位，2026-08 新增）。舊版擷取的 `perf_*.json` 沒有這個欄位，執行本報告會顯示「無 diskArms 資料，請重新擷取」而非報錯。

```bash
npm run extract -- --host=<主機ID> --date=<MM/DD>   # 若尚未用新版擷取過，先重跑一次
npm run disk-hotspot -- --host=<主機ID> --date=<MM/DD>
```

腳本（`scripts/disk_hotspot_scan.js`）會掃描全天每個時段的 Top-5 最忙 ARM 清單，依「當日成為最忙 ARM 的次數」為主、「累計 Service+Wait 時間」為輔排序。

> **⚠️ 解讀陷阱**：busy% 在 SAN Cache（`DSDCFW`）大量吸收 I/O 時可能偏低，即使 I/O 量很大也可能顯示低使用率（實測案例：單一 interval 8,700 萬次 I/O，ARM 使用率僅 4–12%）。撰寫報告時務必同時檢視 I/O 次數、busy%、Cache Fast Writes 三者，不要只憑 busy% 一個欄位下結論。

輸出 `context/disk_hotspot_scan_<label>.md`；AI 讀取後撰寫 `outputs/<主機ID>/<Library>/disk_hotspot_report_<label>.md`。

**驗證狀態**：`DSSRVT`/`DSWT`/`DSDCFW` 是本專案首次使用的欄位，尚未經真實主機 `WRKDSKSTS` 畫面實測驗證（`scripts/validate_metrics.js` Test Area 8 目前僅為原始數值 dump，供人工核對；核對通過後需在 `references/field_reference.md` 補上變更記錄，才能視為可信欄位）。busy% 本身沿用已驗證過的 `CEILING(...)` 公式（見 `field_reference.md` 第三節），可信。
