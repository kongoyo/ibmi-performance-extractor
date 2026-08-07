# 🔍 Daily Digest Context

**Host**: 172.16.12.126
**Date**: 07/14

> 系統提示：此為每日健康摘要腳本產出的上下文數據，各維度當日最高值與門檻超標判斷已預先計算完畢，異常 Job Top 5 直接重用 anomaly_scan.js 的排名邏輯。請 AI Agent 直接依據此上下文撰寫一頁式健康摘要報告，不需再自行解析原始 JSON。

### 1. 各維度當日最高值

| 維度 | 當日最高值 | 發生時間 | 警戒門檻 | 是否超標 |
| :--- | ---: | :--- | ---: | :--- |
| Transaction Count（交易量） | 15824 | 15:30 | N/A（無設定門檻） | N/A |
| Response Time（回應時間） | 0.39 | 22:15 | 2 | 正常 |
| Total CPU | 87 | 05:15 | 70 | ⚠️ 超標 |
| Interactive CPU | 13 | 15:30 | N/A（無設定門檻） | N/A |
| Batch CPU | 87 | 05:15 | N/A（無設定門檻） | N/A |
| Disk I/O（磁碟I/O） | 11 | 06:30 | N/A（無設定門檻） | N/A |
| Page Faults（分頁缺失） | 5397 | 06:15 | 50 | ⚠️ 超標 |

**超標維度數**：2 / 3（僅 Tot/Rsp/Usr 三個維度有設定門檻，門檻值對齊 HTML 儀表板 insights_engine.py 的既有標準）

### 2. 異常 Job Top 5（依全天登頂資源排行榜次數排序）

| 排名 | Job | 使用者 | 登頂維度 | 登頂總次數 | 達成當日絕對峰值次數 |
| ---: | :--- | :--- | :--- | ---: | ---: |
| 1 | CMPFILDTA/MIMIXOWN/925462 | MIMIXOWN | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O）、Page Faults（分頁缺失） | 166 | 1 |
| 2 | DBOP-PLANCACHE// |  | Page Faults（分頁缺失） | 40 | 0 |
| 3 | A#EPCB45HB/AP131091/719383 | AP131091 | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Page Faults（分頁缺失） | 35 | 0 |
| 4 | CMPFILDTA/MIMIXOWN/943737 | MIMIXOWN | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O）、Page Faults（分頁缺失） | 17 | 4 |
| 5 | CFE#COD/TJCOD/570634 | TJCOD | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O） | 5 | 0 |

