# 🔍 Daily Digest Context

**Host**: 172.16.12.126
**Date**: 08/07

> 系統提示：此為每日健康摘要腳本產出的上下文數據，各維度當日最高值與門檻超標判斷已預先計算完畢，異常 Job Top 5 直接重用 anomaly_scan.js 的排名邏輯。請 AI Agent 直接依據此上下文撰寫一頁式健康摘要報告，不需再自行解析原始 JSON。

### 1. 各維度當日最高值

| 維度 | 當日最高值 | 發生時間 | 警戒門檻 | 是否超標 |
| :--- | ---: | :--- | ---: | :--- |
| Transaction Count（交易量） | 1361 | 20:15 | N/A（無設定門檻） | N/A |
| Response Time（回應時間） | 0.46 | 17:15 | 2 | 正常 |
| Total CPU | 94 | 17:00 | 70 | ⚠️ 超標 |
| Interactive CPU | 22 | 20:15 | N/A（無設定門檻） | N/A |
| Batch CPU | 94 | 17:00 | N/A（無設定門檻） | N/A |
| Disk I/O（磁碟I/O） | 8 | 17:00 | N/A（無設定門檻） | N/A |
| Page Faults（分頁缺失） | 557 | 17:00 | 50 | ⚠️ 超標 |

**超標維度數**：2 / 3（僅 Tot/Rsp/Usr 三個維度有設定門檻，門檻值對齊 HTML 儀表板 insights_engine.py 的既有標準）

### 2. 異常 Job Top 5（依全天登頂資源排行榜次數排序）

| 排名 | Job | 使用者 | 登頂維度 | 登頂總次數 | 達成當日絕對峰值次數 |
| ---: | :--- | :--- | :--- | ---: | ---: |
| 1 | Q1ACPDST/QBRMS/819266 | QBRMS | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU | 330 | 72 |
| 2 | QTMSSMTPD/QTCP/819274 | QTCP | Response Time（回應時間）、Disk I/O（磁碟I/O）、Page Faults（分頁缺失）、Seize/Wait Time（鎖定等待時間） | 84 | 1 |
| 3 | ADMIN2/QLWISVR/819247 | QLWISVR | Response Time（回應時間）、Disk I/O（磁碟I/O）、Page Faults（分頁缺失） | 30 | 3 |
| 4 | P0FSYNC00N000// |  | Seize/Wait Time（鎖定等待時間） | 26 | 0 |
| 5 | QTMSSMTPD/QTCP/819282 | QTCP | Seize/Wait Time（鎖定等待時間） | 21 | 0 |

