# 🔍 RCA 根因診斷報告：HN040130A 資源異常分析

**診斷對象**：Job `HN040130A/AP131091/730390`
**發生時間**：07/13 12:45 (INTNUM 51)
**異常現象**：極端回應時間 (Response Time) 飆高至 **14.27 秒**

基於目前的效能提取快取資料，以下是針對該時段與該 Job 所進行的系統資源消耗診斷：

---

### 1. 系統層次時序 (System Level Context)
在 07/13 12:45 區間，系統層級的平均交易回應時間原本位於正常範圍 (約 3.89 秒)，但該特定 Job 卻發生了嚴重的延遲 (14.27 秒)。這表明系統整體並未陷入全面癱瘓，而是該 Job 內部發生了高度的資源競爭或等待 (Wait State)。

### 2. Job 負載排行與資源消耗 (Job Load & Resource Consumption)
在該 15 分鐘區間內，`HN040130A` 的資源消耗數據如下：
*   **Response Time**: 14.27 秒 (嚴重超標)
*   **CPU 消耗 (Total CPU)**: 50,961 ms (約 50.9 秒 CPU 時間)
*   **磁碟 I/O (Total I/O)**: 高達 **7,103,535 次**
*   **分頁缺失 (Page Faults)**: **58,486 次**

> [!WARNING]
> **I/O 異常警告**
> 該 Job 在短短 15 分鐘內產生了超過 710 萬次的實體/邏輯 I/O！這意味著它平均每秒進行將近 7,800 次的資料庫讀寫，這是導致它回應時間長達 14.27 秒的最主要**根因**。

### 3. OS 層次診斷 (OS Level Diagnostics)
*由於目前處於離線 JSON 快取環境，未能直接連線至 `QAPMJOBOS` 取得精確的 SQL vs Native I/O 拆分，但基於數據特徵可做以下推斷：*
如此龐大的 I/O 數量 (7.1M) 與高 CPU 消耗 (50.9s) 通常見於：
1. **全表掃描 (Table Scan)**：缺乏適當的索引 (Index/Logical File)，導致 SQL 引擎或 Native RPG 程式必須讀取大量無效的 Physical 紀錄。
2. **無窮迴圈或龐大批次**：程式內部可能在進行高密度的游標 (Cursor) 逐筆讀寫。

### 4. Pool 聚合分析與分頁缺失 (Pool & Memory Pressure)
該 Job 產生了 **58,486 次 Page Faults (分頁缺失)**。
這代表該 Job 所在的 Memory Pool (可能為 Base Pool 或特定的 Batch Pool) 記憶體已經不足以容納其所需的資料分頁，導致系統必須頻繁地將資料從 Disk 換入 RAM 中 (Paging)。這不僅拖慢了該 Job 本身，也會對同一 Pool 內的其他 Job 造成干擾。

### 5. 跨時段趨勢 (Cross-time Trend)
從快取趨勢來看，`HN040130A` 在 12:45 的資源消耗是一個**突發性的異常尖峰 (Spike)**。在此區間前後，它的資源消耗並未持續維持在百萬級的 I/O。

---

## 🎯 診斷結論與修復建議 (Conclusion & Next Steps)

**根因 (Root Cause)**：
`HN040130A` 在 12:45 執行了某種極度密集的資料庫操作，產生了 **710 萬次 I/O** 與 **5.8 萬次分頁缺失**。龐大的 Disk 讀取與記憶體換頁等待 (Wait Time) 直接導致了它的回應時間拉長至 14.27 秒。

**修復建議**：
1. **檢查執行計畫 (Index Tuning)**：請應用程式開發人員使用 `Visual Explain` 或 `STRDBMON` 檢查該程式碼，確認是否有漏建 Index 導致的 Table Scan。
2. **記憶體池調整 (Pool Tuning)**：如果該 Job 是合法的月結/日結重度批次作業，建議透過 `WRKSHRPOOL` 為其專屬的 Subsystem 增加記憶體配置，以減少 5.8 萬次的分頁缺失。
