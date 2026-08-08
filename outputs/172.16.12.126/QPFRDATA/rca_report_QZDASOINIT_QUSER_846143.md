# 🔍 RCA 根因診斷報告：QZDASOINIT/QUSER/846143 資源異常分析

**主機**：clark75 (172.16.12.126) ／ Library：QPFRDATA
**診斷對象**：Job `QZDASOINIT/QUSER/846143`
**發生時間**：08/07 17:00
**異常現象**：CPU、磁碟 I/O、Page Faults 三項系統層級指標同時衝上**當日絕對峰值**（Total CPU 94%、Disk I/O 8%、Page Faults 557 次/秒）

---

## 1. 為什麼鎖定這個 Job，而非 `npm run anomaly` 建議的 Job

`npm run anomaly` 依「全天登頂總次數」排序，第一名是 `Q1ACPDST/QBRMS/819266`（全天登頂 330 次），但比對明細後發現：BRMS 的 CPU_MS 全天穩定在 307～340 之間，是一個**長時間跑、耗用量平穩的背景工作**，只是在大多數時段沒有更大的工作出現時自然排第一，**從未達到過當日絕對峰值**。

真正在 17:00 這一刻把系統指標推上當日最高的，是 `QZDASOINIT/QUSER/846143`——這個 Job 全天只登頂 8 次，但**這 8 次全部都是當日絕對峰值**，且集中在 17:00 這一個時段內同時發生：

| 維度 | 17:00 數值 | 是否為當日絕對峰值 |
| :--- | ---: | :--- |
| Total / Interactive / Batch CPU | 161,037.25 ms | ✅ 是 |
| 磁碟 I/O | 410,093 次 | ✅ 是 |
| Page Faults（分頁缺失） | 391,755 次 | ✅ 是 |
| Seize/Wait（鎖定等待） | 9.54 ms | 否 |
| Transaction Count / Response Time | 0 | — |

（前一份 `daily_digest_report_0807.md` 將 BRMS 判定為當天 CPU/Page Faults 超標的主因，經本次逐時段比對後**應予更正**：BRMS 是全天背景負載，`QZDASOINIT/QUSER/846143` 才是 17:00 尖峰的真正成因。）

---

## 2. Job 負載解讀

`QZDASOINIT` 是 IBM i 標準的**預啟動資料庫伺服器工作（Prestart Job for ODBC/JDBC/DRDA 遠端 SQL 連線）**，`QUSER` 是該工作預設的作業描述使用者，不代表實際發起查詢的終端使用者。

- **Transaction Count / Response Time 皆為 0**：代表這不是一般互動式交易，而是單一長時間執行的批次型 SQL 查詢或資料處理，17:00 這 15 分鐘區間內沒有完成任何一筆「交易」計數。
- **CPU 161,037 ms（約 161 秒 CPU 時間）**：在一個 15 分鐘區間內消耗超過 160 秒 CPU，強度相當高。
- **磁碟 I/O 410,093 次、Page Faults 391,755 次**：兩者數值幾乎同等量級且都是當日最高，典型特徵是**大量資料掃描超出記憶體集區容量**，導致資料不斷從磁碟換入換出（thrashing）。

三者同時飆高、且互為同一數量級，指向同一個根因：**這個時段執行了一個未受索引優化或資料量過大的 SQL 查詢/批次處理，導致全資料表掃描，記憶體集區裝不下，被迫大量存取磁碟並觸發分頁缺失。**

### 連線來源（Remote Address）

從 `QAPMJOBL.JBIPAF`/`JBIPAD`/`JBIPPT` 查得這個 Job 全天觀測到兩組不同的遠端連線（`QZDASOINIT` 為預啟動工作，同一 Job Number 會被系統重複用於不相關的用戶端連線，因此不能只看第一筆）：

| 遠端位址 (IP:Port) | 出現時段 | 涵蓋範圍 |
| :--- | :--- | :--- |
| **10.255.0.197:52225** | 16:45 ~ 17:00（含造成峰值的 17:00） | 12 筆上榜紀錄 |
| N/A（連線已中斷或未建立） | 19:30 | 5 筆上榜紀錄 |

**17:00 造成峰值的連線來自 `10.255.0.197`**，port 52225。這是一個內部私有網段（`10.x.x.x`）位址。以下第 3 節透過交叉比對主機的系統歷史紀錄（QHST），把這個 IP 進一步確認為**真實使用者身分**，而非停留在「應為某台內部機器」的推測。

---

## 3. 交叉比對系統歷史紀錄（QHST）：確認真實使用者身分

使用者提供了 clark75 08/07 全天的 `DSPLOG` 輸出（`data/172.16.12.126/QPFRDATA/QPDSPLOG_IBMECS_QPADEV0001_846560_1.txt`），對照 Job Number `846143` 逐筆檢索，找到比 Collection Services 數據更明確的身分證據：

### 3.1 完整連線時間軸

| 時間 | 事件 |
| :--- | :--- |
| 16:40:29 | Job `QPADEV0001/CLARK/846338`（互動式 5250 工作階段，subsystem `QINTER`）從 `10.255.0.197` 啟動 |
| 16:40:50 | *SIGNON 伺服器處理使用者 **CLARK** 的登入請求；同一時刻、同一個 client `10.255.0.197` 連上兩個新的預啟動工作：`QZDASOINIT/QUSER/846143`（本次診斷對象）與 `QZRCSRVS/QUSER/846339` |
| **17:00** | Job 846143 的 CPU/磁碟 I/O/Page Faults **同時衝上全天絕對峰值**（見上表） |
| 17:01:59 | 同一使用者 CLARK、同一 client `10.255.0.197` **再開一組**連線：`QZDASOINIT/QUSER/846079` + `QZRCSRVS/QUSER/846340`（後者秒開秒關） |
| 19:25:15 | Job 846143（原始連線）正常結束，**end code 10（controlled ending，使用者主動關閉，非異常終止）** |
| 19:48:36 | 互動式工作階段 846338 結束（全程僅用 2.194 秒 CPU，證實真正的運算幾乎全發生在 ODBC/JDBC 連線 846143，5250 畫面本身只是操作介面） |

> `CPIAD09` 這則系統訊息（`User CLARK from client 10.255.0.197 connected to job ...`）就是精確指認使用者身分的關鍵——QAPMJOBL 只能查到匿名的預設作業使用者 `QUSER`，QHST 才記錄了「哪個真人帳號、從哪台機器」建立了這個連線。

### 3.2 「互動 + ODBC/JDBC 成對啟動」訊號：使用者用的是 IBM i Access 用戶端

16:40:29 先啟動 5250 互動工作階段、20 秒後（16:40:50）同一 client 立刻補上 `QZDASOINIT`+`QZRCSRVS` 這對資料庫伺服器工作，是 **IBM i Access Client Solutions（ACS）／System i Navigator** 典型的連線特徵：使用者開啟 ACS 用戶端登入後，若接著開啟「Run SQL Scripts」或資料庫瀏覽功能，該工具就會在背景另外建立 ODBC/JDBC 連線。17:01:59 那組新連線幾乎確定是使用者在 ACS 內**開了第二個 SQL Scripts 分頁**，或原本的查詢視窗重新整理連線。

### 3.3 CPU 集中度：一次性重查詢，不是持續性負擔

Job 846143 整段生命週期（16:40:50 ~ 19:25:15，共 2 小時 44 分）總計用了 **210.744 秒**CPU（QHST 結束訊息 `CPF1164` 記錄），而光是 17:00 這一個 15 分鐘區間就用掉 **161.037 秒**——**單一區間佔了整段連線全部 CPU 用量的 76%**。這代表使用者這 2 小時 44 分的連線期間，絕大部分時間是**閒置（連線保持開啟但沒在執行東西）**，真正的運算集中在 17:00 前後極短的一次性重查詢，而非長時間持續消耗資源。

### 3.4 排除的可能性

- **非錯誤/當機**：QHST 在 16:55~17:10 這個窗口內沒有任何鎖定逾時、儲存空間門檻、SQL 錯誤等級（severity ≥ 30）的訊息，Job 846143 最終也是正常結束（end code 10），排除是程式異常或系統故障造成。
- **QHST 沒有記錄實際 SQL 陳述式**：`DSPLOG`／QHST 只記錄 Job 生命週期與系統事件，不含 SQL 文字本身。若要知道 17:00 那次查詢具體做了什麼，仍需要 `STRDBMON` 或請 CLARK 本人/其 ACS 操作記錄確認。

### 3.5 原始 LOG 佐證（登入 / 登出紀錄）

以下逐字引用自 `QPDSPLOG_IBMECS_QPADEV0001_846560_1.txt`（已省略每筆訊息重複的「job ending codes 說明」樣板段落），供交叉核對：

**① 登入 — 5250 互動工作階段啟動（第 1431~1434 行）**
```
CPF1124  00  INFO         Message . . . . :   Job 846338/CLARK/QPADEV0001 started on 26/08/07 at 16:40:29 in subsystem QINTER in
                            QSYS. Job entered system on 26/08/07 at 16:40:29.
                      QPADEV0001 CLARK      846338 QWTPIIPP     0000 26/08/07 16:40:29.919794 CLARK
```

**② 登入 — CLARK 從 10.255.0.197 連上本次診斷對象 Job 846143（第 1475~1477 行）**
```
CPIAD09  00  INFO         Message . . . . :   User CLARK from client 10.255.0.197 connected to job 846143/QUSER/QZDASOINIT in
                            subsystem QUSRWRK in QSYS on 26/08/07 16:40:50.
                      QZDASOINIT QUSER      846143 QZBSSECR     0000 26/08/07 16:40:50.484540 CLARK
```

**③ 登入 — 同一使用者 17:01:59 再開一組連線（第 1522~1524 行）**
```
CPIAD09  00  INFO         Message . . . . :   User CLARK from client 10.255.0.197 connected to job 846079/QUSER/QZDASOINIT in
                            subsystem QUSRWRK in QSYS on 26/08/07 17:01:59.
                      QZDASOINIT QUSER      846079 QZBSSECR     0000 26/08/07 17:01:59.665373 CLARK
```

**④ 登出 — Job 846143（本次診斷對象）正常結束（第 1722~1736 行）**
```
CPF1164  00  COMPLETION   Message . . . . :   Job 846143/QUSER/QZDASOINIT ended on 26/08/07 at 19:25:15; 210.744 seconds used; end
                            code 10
                          Cause . . . . . :   Job 846143/QUSER/QZDASOINIT completed on 26/08/07 at 19:25:15 after it used 210.744
                            seconds processing unit time. The maximum temporary storage used was 87 megabytes. The job had ending
                            code 10. The job ended after 1 routing steps with a secondary ending code of 0.
                      QZDASOINIT QUSER      846143 QWTMCEOJ     0000 26/08/07 19:25:15.036436 QUSER
```

**⑤ 登出 — 5250 互動工作階段結束（第 1737~1753 行）**
```
CPF1164  00  COMPLETION   Message . . . . :   Job 846338/CLARK/QPADEV0001 ended on 26/08/07 at 19:48:36; 2.194 seconds used; end
                            code 0
                          Cause . . . . . :   Job 846338/CLARK/QPADEV0001 completed on 26/08/07 at 19:48:36 after it used 2.194
                            seconds processing unit time. The maximum temporary storage used was 38 megabytes.
                      QPADEV0001 CLARK      846338 QWTMCEOJ     0000 26/08/07 19:48:36.493634 CLARK
```

> end code `0` = 正常結束；end code `10` = controlled ending（受控結束，通常是使用者主動關閉連線/工具或子系統受控結束）。兩者皆非異常終止碼（`20`/`30`/`40`/`50`/`60`/`70`/`80`/`90`），與 3.4 節的排除結論一致。

---

## 4. 建議

1. **直接找 CLARK 本人確認**：已不需要再猜測「這台機器是誰」——08/07 16:40~17:02 期間透過 `10.255.0.197`（IBM i Access 用戶端）操作 clark75 的是使用者 **CLARK**，可直接詢問當時在 Run SQL Scripts／資料庫工具執行了什麼查詢或作業。
2. **請 CLARK 下次操作前開啟 `STRDBMON`**，或請 DBA 對 `CLARK` 這個使用者設定 SQL 效能監控，補齊 QHST 拿不到的實際 SQL 陳述式，才能進一步判斷是否有索引缺失或全資料表掃描。
3. **檢查該查詢是否有適當索引**：磁碟 I/O 與 Page Faults 同時飆到全天最高，高度符合「全資料表掃描」特徵，建議用 `Visual Explain` 或 `PRTSQLINF` 檢視該查詢的存取路徑。
4. **評估記憶體集區（Memory Pool）容量**：Page Faults 與磁碟 I/O 同步惡化，代表當時的集區可能不足以容納這次查詢的工作集，可考慮暫時或永久調整集區大小，或提醒 CLARK 將此類大型查詢排程到離峰時段執行。
5. **更正 08/07 每日健康摘要的歸因**：`daily_digest_report_0807.md` 中「Q1ACPDST/QBRMS 是 CPU/Page Faults 超標主因」的推論應更新為「使用者 CLARK 於 16:40~17:02 透過 IBM i Access 執行的一次性重查詢（Job `QZDASOINIT/QUSER/846143`）」，避免後續調查方向錯置。

---

*本報告基於 `data/172.16.12.126/QPFRDATA/perf_0807.json`、`context/rca_context_QZDASOINIT_QUSER_846143.md`（08/07 17:00 單一時段 + 全天模式）交叉比對產出；異常 Job 篩選依據來自 `context/anomaly_scan_0807.md` 全天登頂排行明細。DSPLOG/QHST 登入登出紀錄最初由使用者提供的 `QPDSPLOG_IBMECS_QPADEV0001_846560_1.txt` 交叉比對確認；此功能現已自動化——`npm run rca` 預設會透過 `QSYS2.HISTORY_LOG_INFO` 即時查詢同樣的資訊（範圍縮限在該 Job 活躍時段附近，找不到結束紀錄時一小時一小時往外擴張），不再需要手動匯出整天 DSPLOG，也可用 `--dsplog=<path>` 改用離線檔案。*
