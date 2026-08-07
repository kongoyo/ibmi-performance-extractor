# 📋 每日健康摘要：clark75 / QPFRDATA — 08/07

**主機**：clark75 (172.16.12.126) ／ Library：QPFRDATA
**日期**：08/07

---

## 系統健康總覽

| 維度 | 當日最高值 | 發生時間 | 門檻 | 狀態 |
| :--- | ---: | :--- | ---: | :--- |
| Total CPU | 94% | 17:00 | 70% | ⚠️ **超標** |
| Page Faults（分頁缺失） | 557 次/秒 | 17:00 | 50 | ⚠️ **超標** |
| Response Time（回應時間） | 0.46 秒 | 17:15 | 2.0 秒 | ✅ 正常 |
| Transaction Count（交易量） | 1,361 次 | 20:15 | — | 參考值 |
| Disk I/O（磁碟使用率） | 8% | 17:00 | — | 健康 |

**結論**：3 個有設定門檻的維度中有 **2 個超標**（CPU、Page Faults），且兩者的峰值都同樣落在 **17:00**，代表當天 17:00 前後有一波明顯的資源壓力，需要進一步關注；回應時間全天維持在 0.5 秒以內，交易端目前尚未感受到明顯延遲。磁碟 I/O 全天健康、無壓力。

---

## 異常 Job Top 5（全天登頂資源排行榜次數排序）

| 排名 | Job | 使用者 | 影響維度 | 登頂次數 | 達成當日峰值次數 |
| ---: | :--- | :--- | :--- | ---: | ---: |
| 1 | `Q1ACPDST/QBRMS/819266` | QBRMS | Response、CPU（Total/Interactive/Batch） | **330** | **72** |
| 2 | `QTMSSMTPD/QTCP/819274` | QTCP | Response、Disk I/O、Page Faults、Seize/Wait | 84 | 1 |
| 3 | `ADMIN2/QLWISVR/819247` | QLWISVR | Response、Disk I/O、Page Faults | 30 | 3 |
| 4 | `P0FSYNC00N000` | （系統） | Seize/Wait（鎖定等待） | 26 | 0 |
| 5 | `QTMSSMTPD/QTCP/819282` | QTCP | Seize/Wait（鎖定等待） | 21 | 0 |

**重點觀察**：

- **`Q1ACPDST/QBRMS/819266`** 全天 96 個時段中有 330 次「登頂」（同一時段可橫跨多個維度），且有 72 次直接創下當日絕對峰值，是今天壓倒性的頭號資源消耗者。`QBRMS` 使用者對應的是 **BRMS（Backup, Recovery and Media Services）** 備份/媒體管理子系統，`Q1ACPDST` 通常是 BRMS 內部處理程序，研判是備份相關作業長時間佔用 CPU，時間點與上方 CPU/Page Faults 超標的 17:00 相符，**可合理推斷是今天 CPU 超標的主要成因**。
- 第 2、4、5 名都出現 **Seize/Wait（鎖定等待）** 這個新維度，代表當天有多個 Job 曾被鎖定拖慢而非真的在忙著算資料；其中 `QTMSSMTPD`（SMTP mail server）出現兩次（不同 Job Number），可留意是否為郵件佇列處理時的鎖定競爭。

> ⚠️ **驗證狀態提醒**：Seize/Wait（`JBSZWT`）欄位是這個 Skill 本次新增、**尚未對真機資料做過人工核對**（`validate_metrics.js` Test Area 7 目前僅供人工比對 `WRKACTJOB`）。上面關於「被鎖定拖慢」的判讀方向正確，但實際數值建議之後找機會用 `WRKACTJOB` 核對一次再完全採信。

---

## 建議

1. **優先確認 17:00 前後的 BRMS 備份排程**：`Q1ACPDST/QBRMS` 極可能是造成 CPU 94%／Page Faults 557 次/秒超標的主因，建議確認該備份是否可調整到離峰時段執行，或評估是否需要更多資源支援。
2. **Seize/Wait 訊號建議持續觀察**：`QTMSSMTPD`、`P0FSYNC00N000` 目前的鎖定等待次數不算極端，但值得列入下次全天 RCA 的觀察名單，尤其是 `QTMSSMTPD` 同時出現在 Disk I/O／Page Faults／Seize-Wait 三個維度。
3. **回應時間與磁碟目前健康**，無需採取行動。

---
*本報告資料來源：`data/clark75/QPFRDATA/perf_0807.json`（08/07 全天），透過 `npm run digest` 產出摘要數據，異常 Job 排行沿用 `anomaly_scan.js` 既有邏輯。*
