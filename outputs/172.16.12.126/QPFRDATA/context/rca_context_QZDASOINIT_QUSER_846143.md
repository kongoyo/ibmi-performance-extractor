# 🔍 RCA Data Context

**Host**: 172.16.12.126
**Date**: 08/07
**Time**: 17:00
**Job**: QZDASOINIT/QUSER/846143
**User**: QUSER
**Remote Address**: 10.255.0.197:52225

### Job 負載排行與資源消耗
| 維度 | 數值 (val1) | 次要值 (val2) |
| :--- | ---: | ---: |
| Transaction Count（交易量） | 0 | 0 |
| Response Time（回應時間） | 0 | 410093 |
| Total CPU | 161037.25 | 410093 |
| Interactive CPU | 161037.25 | 410093 |
| Batch CPU | 161037.25 | 410093 |
| Disk I/O（磁碟I/O） | 410093 | 161037.25 |
| Page Faults（分頁缺失） | 391755 | 161037.25 |
| Seize/Wait Time（鎖定等待時間） | 9.54 | 161037.25 |

*(Note: In a live environment, OS level diagnostics and Pool analysis from QAPMJOBOS would be appended here.)*

### DSPLOG 交叉比對（登入/登出紀錄）

**真實使用者**：CLARK（來源 client：`10.255.0.197`，連線時間 08/07 16:40:50）

**Job 生命週期**：結束於 08/07 19:25:15，總計使用 210.744 秒 CPU，結束碼 `10`（受控結束（controlled ending，通常為使用者主動關閉或子系統受控結束））

**同一使用者/來源在 ±30 分鐘內的其他連線**（同一次操作階段可能一併啟動的其他工作，例如互動式 5250 或 QZRCSRVS）：

| 時間 | Job | 使用者 |
| :--- | :--- | :--- |
| 16:40:50 | `QZRCSRVS/QUSER/846296` | CLARK |
| 16:40:50 | `QZRCSRVS/QUSER/846339` | CLARK |
| 17:01:59 | `QZDASOINIT/QUSER/846079` | CLARK |
| 17:02:23 | `QZRCSRVS/QUSER/846340` | CLARK |

**原始 LOG 佐證**：

```
來自用戶端10.255.0.197的使用CLARK已連接到26/08/07 16:40:50上QSYS中的子系統QUSRWRK中的工作846143/QUSER/QZDASOINIT。
```

```
工作846143/QUSER/QZDASOINIT已結束於26/08/07 (19:25:15)；使用210.744秒；結束碼為10 。
```

