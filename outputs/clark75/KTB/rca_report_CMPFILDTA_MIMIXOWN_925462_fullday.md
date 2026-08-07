# 🔍 全天異常 Job 分析與 RCA 報告：CMPFILDTA/MIMIXOWN/925462

**主機**：clark75 (172.16.12.126) / Library：KTB
**分析範圍**：07/14 全天（00:00 ~ 24:00，15 分鐘間隔）
**診斷對象**：影響最大的異常 Job — `CMPFILDTA/MIMIXOWN/925462`

---

## 1. 異常 Job 掃描結果（Top 10）

掃描全天所有時段，針對 Response Time、Total/Interactive/Batch CPU、Disk I/O、Page Faults 六大資源維度，統計各 Job 登上「該時段排行榜第一名」的次數：

| 排名 | Job | 使用者 | 登頂維度 | 登頂總次數 | 達成當日絕對峰值次數 |
| ---: | :--- | :--- | :--- | ---: | ---: |
| 1 | **CMPFILDTA/MIMIXOWN/925462** | MIMIXOWN | Rsp、Total/Interactive/Batch CPU、Disk I/O、Page Faults | **166** | 1 |
| 2 | DBOP-PLANCACHE// | (系統) | Page Faults | 40 | 0 |
| 3 | A#EPCB45HB/AP131091/719383 | AP131091 | Rsp、Total/Interactive/Batch CPU、Page Faults | 35 | 0 |
| 4 | CMPFILDTA/MIMIXOWN/943737 | MIMIXOWN | Rsp、Total/Interactive/Batch CPU、Disk I/O、Page Faults | 17 | 4 |
| 5~11 | CFE#COD/TJCOD/* （多個 Job Number）、TB7012203A/U180049/368589、SMPOL001 | TJCOD 等 | Rsp/CPU/Disk 各 1 個時段 | 各 5 | 0 |
| 12~15 | QZDASOINIT/QUSER/*、TB6696213B/U190401/496371、DHCB45H/AP131091/884737 | QUSER 等 | Rsp/CPU、Page Faults | 各 4 | 0～1 |

> **判定依據**：登頂總次數代表「全天有多少個 15 分鐘區間，此 Job 是該資源維度消耗最高的作業」，用於衡量**持續性影響**；達成絕對峰值次數則代表**單點極端值**。`CMPFILDTA/MIMIXOWN/925462` 在 576 個「時段 x 維度」樣本中獨占 166 次（約 29%），且橫跨 CPU / Disk I/O / Page Faults 三大硬體資源，遠超其他候選 Job，判定為**影響最大的異常 Job**。

其餘候選多為單一時段的短暫尖峰（如 `CFE#COD/TJCOD` 系列各自僅在自己的批次時段出現 1 次、共 5 個排行），屬正常批次作業特徵，不构成全天性異常。

---

## 2. 影響最大 Job 全天行為模式：CMPFILDTA/MIMIXOWN/925462

### 活動時間窗
該 Job 從 **03:30 持續活躍至 13:15**，橫跨近 **10 小時**，期間幾乎每個 15 分鐘區間都是 CPU（Total/Interactive/Batch）、Disk I/O、Page Faults 三個維度的排行榜第一名。13:15 之後未再出現，判斷此批次工作於當日 13:15 左右結束。

### 資源消耗特徵
| 維度 | 數值範圍 | 全天最高峰 |
| :--- | :--- | :--- |
| Total/Interactive/Batch CPU | 約 16.8 萬 ~ 47.9 萬 CPU_MS/區間 | 599,525.4（04:30，由同程式的併行實例 `943737` 創下） |
| Disk I/O | 約 2,500 萬 ~ 9,283 萬 次/區間 | 92,830,861（12:00，本 Job 本身創下的全天絕對峰值） |
| Page Faults | 約 3 萬 ~ 157 萬 次/區間 | 3,587,940（06:15，由併行實例 `943737` 創下） |
| Transaction Count / Response Time | 全程 0 | — |

> Transaction Count 與 Response Time 全程為 0，符合此 Job 是**批次型系統作業**（非互動交易）的特徵——MIMIX 的 `CMPFILDTA`（Compare File Data）功能負責比對來源/目標系統的複寫檔案是否一致，本質上是資料庫掃描 + 大量磁碟讀取的背景作業。

### 併發實例（同 Program/User，不同 Job Number）
同時段內偵測到**多個併發的 `CMPFILDTA/MIMIXOWN` Job Number**，代表 MIMIX 同時啟動了多個平行 Worker 進行比對：

| Job Number | 活躍時間窗 | 備註 |
| :--- | :--- | :--- |
| 923561 | 03:15 | 短暫出現，先於主要窗口 |
| **925462** | 03:30 ~ 13:15 | 主要 Job，貢獻 166 次登頂 |
| 943737 | 04:15 ~ 07:00 | 與 925462 併行，CPU/Page Faults 分別創下全天絕對峰值 |
| 951400 | 05:00 | 短暫出現 |
| 957726 | 05:30 ~ 05:45 | 短暫出現 |

多個 Job Number 同時段併發，代表這是 MIMIX 排程的**多執行緒批次比對窗口**，而非單一長跑 Job。

### 與系統整體 CPU 使用率的關聯
比對系統層級 CPU% 時序（`data.data['07/14'].Tot`），03:30~13:15 窗口內多次出現超過 70% 的尖峰（如 05:15 = 87%、08:15 = 83%、09:15 = 69%、10:15 = 71%），明顯高於窗口外的常態水位（多在 20~40%）。由於 `CMPFILDTA/MIMIXOWN` 系列 Job 在同一時段持續佔據 CPU 排行榜第一名，可判定其為此窗口 CPU 使用率偏高的主要貢獻來源。惟系統回應時間（Rsp）全天峰值出現在 22:15（0.39 秒），與此窗口無關，顯示**尚未造成交易端可感知的延遲**，目前風險等級為「資源消耗異常但未演變為服務品質問題」。

---

## 🎯 診斷結論與建議

**根因 (Root Cause)**：
`CMPFILDTA/MIMIXOWN` 是 MIMIX 資料複寫比對（Compare File Data）批次作業，於 07/14 03:30~13:15 以多個併發 Job Number 執行，持續佔用系統 CPU、Disk I/O、Page Faults 三項硬體資源排行榜第一名長達近 10 小時，並使該窗口內系統 CPU 使用率多次超過 70% 警戒線。此為**全天影響力最大的資源消耗異常**，但尚未反映在系統回應時間或交易量上，暫無使用者端可感知的影響。

**建議**：
1. **確認排程合理性**：與 MIMIX 管理者確認 `CMPFILDTA` 比對窗口是否原本規劃在離峰時段（如凌晨），為何延續至 13:15（已進入日間營業時間）；若為資料落後追趕（catch-up）導致的異常延長，應追查複寫延遲（replication lag）的根本原因。
2. **評估併發 Worker 數量**：目前偵測到至少 5 個併發 Job Number，可與 MIMIX 設定核對併發執行緒數是否符合預期，過多併發可能是造成 CPU/Disk 尖峰的直接原因，可考慮調降併發度以平滑負載。
3. **持續監控**：雖然尚未影響回應時間，建議在此時間窗口設定 CPU 使用率 > 70% 的告警，並觀察是否有惡化趨勢（例如比對窗口逐日延長），避免未來與日間交易尖峰重疊。
4. **次要觀察對象**：`DBOP-PLANCACHE`（Page Faults 40 次登頂）與 `A#EPCB45HB/AP131091/719383`（35 次登頂）雖影響力次於 MIMIX 作業，仍建議列入日常巡檢觀察名單。

---
*本報告資料來源：`data/clark75/KTB/perf_0714.json`（07/14 全天離線快取），透過 `npm run anomaly` 掃描全天異常 Job 排行，並以 `npm run rca` 對排名第一的 Job 進行全天上下文擷取；系統 CPU% 時序另行讀取 `data.data['07/14'].Tot` 佐證。*
