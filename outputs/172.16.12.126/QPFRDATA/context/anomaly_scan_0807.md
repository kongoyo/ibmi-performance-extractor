# 🔍 Anomaly Scan Context

**Host**: 172.16.12.126
**Date**: 08/07
**Scope**: 全天所有時段，針對 Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O）、Page Faults（分頁缺失）、Seize/Wait Time（鎖定等待時間） 六大資源維度，each 時段各維度的排行榜第一名（消耗最高的 Job）

> 系統提示：此為異常 Job 掃描腳本產出的上下文數據，排序依據為：(1) 登上排行榜第一名的總次數、(2) 達成當日該維度絕對峰值（該維度全天所有 Job 中的最高單一數值）的次數。val1 單位依維度而異（CPU_MS／秒／IO 次數／faults 數），僅可跨時段比較同一維度，不可跨維度比較。請 AI Agent 直接依據此上下文列出異常 Job 清單並撰寫分析，不需再自行解析原始 JSON。僅前 15 名附完整明細，其餘視為長尾、影響力低，僅列於總表。

### 各維度全天最高單一數值 (day max, 供對照)

| 維度 | 全天最高值 (val1) |
| :--- | ---: |
| Response Time（回應時間） | 0 |
| Total CPU | 161037.25 |
| Interactive CPU | 161037.25 |
| Batch CPU | 161037.25 |
| Disk I/O（磁碟I/O） | 410093 |
| Page Faults（分頁缺失） | 391755 |
| Seize/Wait Time（鎖定等待時間） | 92.58 |

### 排行總表 (依影響力排序，共 53 個 Job 曾登頂)

| 排名 | Job | 使用者 | 登頂維度 | 登頂總次數 | 達成當日絕對峰值次數 |
| ---: | :--- | :--- | :--- | ---: | ---: |
| 1 | Q1ACPDST/QBRMS/819266 | QBRMS | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU | 330 | 72 |
| 2 | QTMSSMTPD/QTCP/819274 | QTCP | Response Time（回應時間）、Disk I/O（磁碟I/O）、Page Faults（分頁缺失）、Seize/Wait Time（鎖定等待時間） | 84 | 1 |
| 3 | ADMIN2/QLWISVR/819247 | QLWISVR | Response Time（回應時間）、Disk I/O（磁碟I/O）、Page Faults（分頁缺失） | 30 | 3 |
| 4 | P0FSYNC00N000// |  | Seize/Wait Time（鎖定等待時間） | 26 | 0 |
| 5 | QTMSSMTPD/QTCP/819282 | QTCP | Seize/Wait Time（鎖定等待時間） | 21 | 0 |
| 6 | P0FSYNC00N001// |  | Seize/Wait Time（鎖定等待時間） | 20 | 0 |
| 7 | QTMSSMTPD/QTCP/819279 | QTCP | Seize/Wait Time（鎖定等待時間） | 17 | 0 |
| 8 | QUMECIMOM/QSECOFR/819205 | QSECOFR | Response Time（回應時間）、Page Faults（分頁缺失） | 14 | 10 |
| 9 | CRTPFRDTA/QSYS/846198 | QSYS | Disk I/O（磁碟I/O）、Page Faults（分頁缺失） | 14 | 0 |
| 10 | QPADEV0001/CLARK/846366 | CLARK | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O）、Page Faults（分頁缺失） | 13 | 2 |
| 11 | CFINT001// |  | Total CPU、Interactive CPU、Batch CPU | 12 | 0 |
| 12 | QZDASOINIT/QUSER/846143 | QUSER | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O）、Page Faults（分頁缺失）、Seize/Wait Time（鎖定等待時間） | 8 | 6 |
| 13 | ADMIN5/QLWISVR/819259 | QLWISVR | Response Time（回應時間）、Page Faults（分頁缺失） | 8 | 3 |
| 14 | QSQSRVR/QUSER/846201 | QUSER | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Page Faults（分頁缺失） | 7 | 1 |
| 15 | BACKUPAUTO/CLARK/846256 | CLARK | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O）、Page Faults（分頁缺失） | 6 | 1 |
| 16 | QCLNSYSLOG/QPGMR/846384 | QPGMR | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O）、Page Faults（分頁缺失） | 6 | 1 |
| 17 | SMPOL001// |  | Disk I/O（磁碟I/O） | 5 | 0 |
| 18 | DLTDBFJRN/DMCLUSTER/846216 | DMCLUSTER | Response Time（回應時間）、Disk I/O（磁碟I/O）、Page Faults（分頁缺失）、Seize/Wait Time（鎖定等待時間） | 4 | 1 |
| 19 | QPADEV0001/CLARK/846338 | CLARK | Disk I/O（磁碟I/O）、Page Faults（分頁缺失）、Seize/Wait Time（鎖定等待時間） | 4 | 0 |
| 20 | ADMIN1/QWEBADMIN/819248 | QWEBADMIN | Page Faults（分頁缺失） | 4 | 0 |
| 21 | MNTASK// |  | Seize/Wait Time（鎖定等待時間） | 4 | 0 |
| 22 | QYPSPFRCOL/QSYS/819175 | QSYS | Page Faults（分頁缺失）、Seize/Wait Time（鎖定等待時間） | 2 | 1 |
| 23 | DBOP-PLANCACHE// |  | Disk I/O（磁碟I/O）、Page Faults（分頁缺失） | 2 | 0 |
| 24 | QPADEV0001/CLARK/846324 | CLARK | Page Faults（分頁缺失） | 2 | 0 |
| 25 | QYPSPFRHST/QSYS/846197 | QSYS | Disk I/O（磁碟I/O） | 1 | 0 |
| 26 | LDSEGDESTRYTSK00// |  | Disk I/O（磁碟I/O） | 1 | 0 |
| 27 | QUMEPRVAGT/QSECOFR/846213 | QSECOFR | Page Faults（分頁缺失） | 1 | 0 |
| 28 | XDMCLUSTER/QSYS/819323 | QSYS | Page Faults（分頁缺失） | 1 | 0 |
| 29 | QTOCRUNPRX/QSRVAGT/839252 | QSRVAGT | Page Faults（分頁缺失） | 1 | 0 |
| 30 | QMRDBJNFY/QUSER/819163 | QUSER | Page Faults（分頁缺失） | 1 | 0 |
| 31 | QUMEPRVAGT/QSECOFR/846239 | QSECOFR | Page Faults（分頁缺失） | 1 | 0 |
| 32 | QUMEPRVAGT/QSECOFR/846248 | QSECOFR | Page Faults（分頁缺失） | 1 | 0 |
| 33 | QHST/QSYS/784465 | QSYS | Page Faults（分頁缺失） | 1 | 0 |
| 34 | QUMEPRVAGT/QSECOFR/846255 | QSECOFR | Page Faults（分頁缺失） | 1 | 0 |
| 35 | QUMEPRVAGT/QSECOFR/846258 | QSECOFR | Page Faults（分頁缺失） | 1 | 0 |
| 36 | QUMEPRVAGT/QSECOFR/846269 | QSECOFR | Page Faults（分頁缺失） | 1 | 0 |
| 37 | QUMEPRVAGT/QSECOFR/846275 | QSECOFR | Page Faults（分頁缺失） | 1 | 0 |
| 38 | QUMEPRVAGT/QSECOFR/846281 | QSECOFR | Page Faults（分頁缺失） | 1 | 0 |
| 39 | QUMEPRVAGT/QSECOFR/846287 | QSECOFR | Page Faults（分頁缺失） | 1 | 0 |
| 40 | SCPF/QSYS/000000 | QSYS | Page Faults（分頁缺失） | 1 | 0 |
| 41 | QZRCSRVS/QUSER/846099 | QUSER | Page Faults（分頁缺失） | 1 | 0 |
| 42 | QUMEPRVAGT/QSECOFR/846304 | QSECOFR | Page Faults（分頁缺失） | 1 | 0 |
| 43 | QUMEPRVAGT/QSECOFR/846310 | QSECOFR | Page Faults（分頁缺失） | 1 | 0 |
| 44 | QUMEPRVAGT/QSECOFR/846316 | QSECOFR | Page Faults（分頁缺失） | 1 | 0 |
| 45 | QUMEPRVAGT/QSECOFR/846322 | QSECOFR | Page Faults（分頁缺失） | 1 | 0 |
| 46 | DM_MONDATA/DMCLUSTER/820123 | DMCLUSTER | Page Faults（分頁缺失） | 1 | 0 |
| 47 | QPADEV0002/IBMECS/846346 | IBMECS | Page Faults（分頁缺失） | 1 | 0 |
| 48 | Q1PPMSUB/QPM400/846375 | QPM400 | Page Faults（分頁缺失） | 1 | 0 |
| 49 | QUMEPRVAGT/QSECOFR/846390 | QSECOFR | Page Faults（分頁缺失） | 1 | 0 |
| 50 | QUMEPRVAGT/QSECOFR/846397 | QSECOFR | Page Faults（分頁缺失） | 1 | 0 |
| 51 | QZRCSRVS/QUSER/846296 | QUSER | Seize/Wait Time（鎖定等待時間） | 1 | 0 |
| 52 | OUTQCLR/CLARK/846368 | CLARK | Seize/Wait Time（鎖定等待時間） | 1 | 0 |
| 53 | QDBSRVXR/QSYS/784451 | QSYS | Seize/Wait Time（鎖定等待時間） | 1 | 0 |

### Top 15 候選 Job 明細

**#1 Q1ACPDST/QBRMS/819266**

*(共 330 筆，樣本數過多，改以每維度統計摘要呈現；僅列出達成當日絕對峰值的時刻。)*

| 維度 | 樣本數 | 時間範圍 | 最小值 | 最大值 | 平均值 |
| :--- | ---: | :--- | ---: | ---: | ---: |
| Response Time（回應時間） | 72 | 00:00 ~ 23:45 | 0 | 0 | 0 |
| Total CPU | 86 | 00:00 ~ 23:45 | 307.8 | 340.66 | 330.32 |
| Interactive CPU | 86 | 00:00 ~ 23:45 | 307.8 | 340.66 | 330.32 |
| Batch CPU | 86 | 00:00 ~ 23:45 | 307.8 | 340.66 | 330.32 |

**達成當日絕對峰值的時刻**：

| 時間 | 維度 | 數值 (val1) |
| :--- | :--- | ---: |
| 00:00 | Response Time（回應時間） | 0 |
| 00:30 | Response Time（回應時間） | 0 |
| 01:00 | Response Time（回應時間） | 0 |
| 01:30 | Response Time（回應時間） | 0 |
| 02:00 | Response Time（回應時間） | 0 |
| 02:15 | Response Time（回應時間） | 0 |
| 02:30 | Response Time（回應時間） | 0 |
| 02:45 | Response Time（回應時間） | 0 |
| 03:00 | Response Time（回應時間） | 0 |
| 03:15 | Response Time（回應時間） | 0 |
| 03:30 | Response Time（回應時間） | 0 |
| 04:00 | Response Time（回應時間） | 0 |
| 04:15 | Response Time（回應時間） | 0 |
| 04:30 | Response Time（回應時間） | 0 |
| 05:00 | Response Time（回應時間） | 0 |
| 05:30 | Response Time（回應時間） | 0 |
| 05:45 | Response Time（回應時間） | 0 |
| 06:00 | Response Time（回應時間） | 0 |
| 06:15 | Response Time（回應時間） | 0 |
| 06:30 | Response Time（回應時間） | 0 |
| 06:45 | Response Time（回應時間） | 0 |
| 07:00 | Response Time（回應時間） | 0 |
| 07:15 | Response Time（回應時間） | 0 |
| 07:30 | Response Time（回應時間） | 0 |
| 08:00 | Response Time（回應時間） | 0 |
| 08:15 | Response Time（回應時間） | 0 |
| 08:30 | Response Time（回應時間） | 0 |
| 09:00 | Response Time（回應時間） | 0 |
| 09:15 | Response Time（回應時間） | 0 |
| 09:30 | Response Time（回應時間） | 0 |
| 10:00 | Response Time（回應時間） | 0 |
| 10:15 | Response Time（回應時間） | 0 |
| 10:30 | Response Time（回應時間） | 0 |
| 11:00 | Response Time（回應時間） | 0 |
| 11:15 | Response Time（回應時間） | 0 |
| 12:00 | Response Time（回應時間） | 0 |
| 12:15 | Response Time（回應時間） | 0 |
| 12:30 | Response Time（回應時間） | 0 |
| 13:00 | Response Time（回應時間） | 0 |
| 13:15 | Response Time（回應時間） | 0 |
| 13:30 | Response Time（回應時間） | 0 |
| 14:00 | Response Time（回應時間） | 0 |
| 14:15 | Response Time（回應時間） | 0 |
| 14:30 | Response Time（回應時間） | 0 |
| 14:45 | Response Time（回應時間） | 0 |
| 15:00 | Response Time（回應時間） | 0 |
| 15:15 | Response Time（回應時間） | 0 |
| 15:30 | Response Time（回應時間） | 0 |
| 15:45 | Response Time（回應時間） | 0 |
| 16:00 | Response Time（回應時間） | 0 |
| 16:15 | Response Time（回應時間） | 0 |
| 16:30 | Response Time（回應時間） | 0 |
| 18:00 | Response Time（回應時間） | 0 |
| 18:15 | Response Time（回應時間） | 0 |
| 18:30 | Response Time（回應時間） | 0 |
| 18:45 | Response Time（回應時間） | 0 |
| 19:00 | Response Time（回應時間） | 0 |
| 19:15 | Response Time（回應時間） | 0 |
| 19:30 | Response Time（回應時間） | 0 |
| 19:45 | Response Time（回應時間） | 0 |
| 20:30 | Response Time（回應時間） | 0 |
| 21:00 | Response Time（回應時間） | 0 |
| 21:15 | Response Time（回應時間） | 0 |
| 21:30 | Response Time（回應時間） | 0 |
| 21:45 | Response Time（回應時間） | 0 |
| 22:00 | Response Time（回應時間） | 0 |
| 22:30 | Response Time（回應時間） | 0 |
| 22:45 | Response Time（回應時間） | 0 |
| 23:00 | Response Time（回應時間） | 0 |
| 23:15 | Response Time（回應時間） | 0 |
| 23:30 | Response Time（回應時間） | 0 |
| 23:45 | Response Time（回應時間） | 0 |

**#2 QTMSSMTPD/QTCP/819274**

*(共 84 筆，樣本數過多，改以每維度統計摘要呈現；僅列出達成當日絕對峰值的時刻。)*

| 維度 | 樣本數 | 時間範圍 | 最小值 | 最大值 | 平均值 |
| :--- | ---: | :--- | ---: | ---: | ---: |
| Disk I/O（磁碟I/O） | 78 | 00:00 ~ 23:45 | 691 | 788 | 731.04 |
| Page Faults（分頁缺失） | 4 | 00:00 ~ 23:30 | 29 | 33 | 30.5 |
| Response Time（回應時間） | 1 | 11:30 ~ 11:30 | 0 | 0 | 0 |
| Seize/Wait Time（鎖定等待時間） | 1 | 20:30 ~ 20:30 | 1.42 | 1.42 | 1.42 |

**達成當日絕對峰值的時刻**：

| 時間 | 維度 | 數值 (val1) |
| :--- | :--- | ---: |
| 11:30 | Response Time（回應時間） | 0 |

**#3 ADMIN2/QLWISVR/819247**

*(共 30 筆，樣本數過多，改以每維度統計摘要呈現；僅列出達成當日絕對峰值的時刻。)*

| 維度 | 樣本數 | 時間範圍 | 最小值 | 最大值 | 平均值 |
| :--- | ---: | :--- | ---: | ---: | ---: |
| Page Faults（分頁缺失） | 26 | 03:15 ~ 19:45 | 4 | 1454 | 109.92 |
| Response Time（回應時間） | 3 | 03:45 ~ 07:45 | 0 | 0 | 0 |
| Disk I/O（磁碟I/O） | 1 | 19:45 ~ 19:45 | 1454 | 1454 | 1454 |

**達成當日絕對峰值的時刻**：

| 時間 | 維度 | 數值 (val1) |
| :--- | :--- | ---: |
| 03:45 | Response Time（回應時間） | 0 |
| 04:45 | Response Time（回應時間） | 0 |
| 07:45 | Response Time（回應時間） | 0 |

**#4 P0FSYNC00N000//**

*(共 26 筆，樣本數過多，改以每維度統計摘要呈現；僅列出達成當日絕對峰值的時刻。)*

| 維度 | 樣本數 | 時間範圍 | 最小值 | 最大值 | 平均值 |
| :--- | ---: | :--- | ---: | ---: | ---: |
| Seize/Wait Time（鎖定等待時間） | 26 | 01:00 ~ 23:45 | 0.28 | 31.66 | 5.6 |

**#5 QTMSSMTPD/QTCP/819282**

*(共 21 筆，樣本數過多，改以每維度統計摘要呈現；僅列出達成當日絕對峰值的時刻。)*

| 維度 | 樣本數 | 時間範圍 | 最小值 | 最大值 | 平均值 |
| :--- | ---: | :--- | ---: | ---: | ---: |
| Seize/Wait Time（鎖定等待時間） | 21 | 03:15 ~ 23:30 | 0.04 | 0.11 | 0.07 |

**#6 P0FSYNC00N001//**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 00:00 | Seize/Wait Time（鎖定等待時間） | 0.38 | 否 |
| 00:45 | Seize/Wait Time（鎖定等待時間） | 6.85 | 否 |
| 02:00 | Seize/Wait Time（鎖定等待時間） | 0.32 | 否 |
| 02:45 | Seize/Wait Time（鎖定等待時間） | 6.51 | 否 |
| 03:45 | Seize/Wait Time（鎖定等待時間） | 1.03 | 否 |
| 05:00 | Seize/Wait Time（鎖定等待時間） | 6.74 | 否 |
| 06:00 | Seize/Wait Time（鎖定等待時間） | 31.67 | 否 |
| 06:45 | Seize/Wait Time（鎖定等待時間） | 0.6 | 否 |
| 07:00 | Seize/Wait Time（鎖定等待時間） | 6.6 | 否 |
| 08:00 | Seize/Wait Time（鎖定等待時間） | 31.83 | 否 |
| 08:45 | Seize/Wait Time（鎖定等待時間） | 0.36 | 否 |
| 09:45 | Seize/Wait Time（鎖定等待時間） | 25.73 | 否 |
| 10:00 | Seize/Wait Time（鎖定等待時間） | 31.18 | 否 |
| 10:45 | Seize/Wait Time（鎖定等待時間） | 6.66 | 否 |
| 12:00 | Seize/Wait Time（鎖定等待時間） | 2.11 | 否 |
| 14:45 | Seize/Wait Time（鎖定等待時間） | 1.65 | 否 |
| 15:00 | Seize/Wait Time（鎖定等待時間） | 6.36 | 否 |
| 18:00 | Seize/Wait Time（鎖定等待時間） | 31.76 | 否 |
| 20:45 | Seize/Wait Time（鎖定等待時間） | 6.98 | 否 |
| 23:00 | Seize/Wait Time（鎖定等待時間） | 0.31 | 否 |

**#7 QTMSSMTPD/QTCP/819279**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 01:30 | Seize/Wait Time（鎖定等待時間） | 0.08 | 否 |
| 02:15 | Seize/Wait Time（鎖定等待時間） | 0.06 | 否 |
| 02:30 | Seize/Wait Time（鎖定等待時間） | 0.14 | 否 |
| 03:30 | Seize/Wait Time（鎖定等待時間） | 0.09 | 否 |
| 05:30 | Seize/Wait Time（鎖定等待時間） | 0.06 | 否 |
| 06:30 | Seize/Wait Time（鎖定等待時間） | 0.11 | 否 |
| 07:15 | Seize/Wait Time（鎖定等待時間） | 0.1 | 否 |
| 08:15 | Seize/Wait Time（鎖定等待時間） | 0.08 | 否 |
| 09:15 | Seize/Wait Time（鎖定等待時間） | 0.07 | 否 |
| 09:30 | Seize/Wait Time（鎖定等待時間） | 0.08 | 否 |
| 10:15 | Seize/Wait Time（鎖定等待時間） | 0.11 | 否 |
| 10:30 | Seize/Wait Time（鎖定等待時間） | 0.06 | 否 |
| 12:15 | Seize/Wait Time（鎖定等待時間） | 0.1 | 否 |
| 15:15 | Seize/Wait Time（鎖定等待時間） | 0.09 | 否 |
| 19:30 | Seize/Wait Time（鎖定等待時間） | 0.09 | 否 |
| 22:30 | Seize/Wait Time（鎖定等待時間） | 0.1 | 否 |
| 23:15 | Seize/Wait Time（鎖定等待時間） | 0.09 | 否 |

**#8 QUMECIMOM/QSECOFR/819205**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 00:45 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 08:45 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 09:45 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 10:45 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 11:45 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 12:45 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 13:45 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 15:45 | Page Faults（分頁缺失） | 179 | 否 |
| 16:45 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 17:45 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 17:45 | Page Faults（分頁缺失） | 2465 | 否 |
| 18:45 | Page Faults（分頁缺失） | 124 | 否 |
| 20:45 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 20:45 | Page Faults（分頁缺失） | 421 | 否 |

**#9 CRTPFRDTA/QSYS/846198**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 00:30 | Disk I/O（磁碟I/O） | 6647 | 否 |
| 00:30 | Page Faults（分頁缺失） | 484 | 否 |
| 11:00 | Page Faults（分頁缺失） | 18 | 否 |
| 11:15 | Page Faults（分頁缺失） | 7 | 否 |
| 12:15 | Page Faults（分頁缺失） | 8 | 否 |
| 12:30 | Page Faults（分頁缺失） | 7 | 否 |
| 13:00 | Page Faults（分頁缺失） | 13 | 否 |
| 13:30 | Page Faults（分頁缺失） | 4 | 否 |
| 14:00 | Page Faults（分頁缺失） | 13 | 否 |
| 14:15 | Page Faults（分頁缺失） | 8 | 否 |
| 15:30 | Disk I/O（磁碟I/O） | 783 | 否 |
| 15:30 | Page Faults（分頁缺失） | 214 | 否 |
| 16:30 | Page Faults（分頁缺失） | 9 | 否 |
| 22:30 | Page Faults（分頁缺失） | 65 | 否 |

**#10 QPADEV0001/CLARK/846366**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 20:00 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 20:00 | Total CPU | 30611.01 | 否 |
| 20:00 | Interactive CPU | 30611.01 | 否 |
| 20:00 | Batch CPU | 30611.01 | 否 |
| 20:00 | Disk I/O（磁碟I/O） | 95239 | 否 |
| 20:00 | Page Faults（分頁缺失） | 95203 | 否 |
| 20:15 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 20:15 | Total CPU | 39852.11 | 否 |
| 20:15 | Interactive CPU | 39852.11 | 否 |
| 20:15 | Batch CPU | 39852.11 | 否 |
| 20:15 | Disk I/O（磁碟I/O） | 56336 | 否 |
| 20:15 | Page Faults（分頁缺失） | 56334 | 否 |
| 20:30 | Page Faults（分頁缺失） | 340 | 否 |

**#11 CFINT001//**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 01:15 | Total CPU | 341.81 | 否 |
| 01:15 | Interactive CPU | 341.81 | 否 |
| 01:15 | Batch CPU | 341.81 | 否 |
| 16:45 | Total CPU | 427.06 | 否 |
| 16:45 | Interactive CPU | 427.06 | 否 |
| 16:45 | Batch CPU | 427.06 | 否 |
| 17:15 | Total CPU | 424.85 | 否 |
| 17:15 | Interactive CPU | 424.85 | 否 |
| 17:15 | Batch CPU | 424.85 | 否 |
| 17:30 | Total CPU | 378.28 | 否 |
| 17:30 | Interactive CPU | 378.28 | 否 |
| 17:30 | Batch CPU | 378.28 | 否 |

**#12 QZDASOINIT/QUSER/846143**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 17:00 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 17:00 | Total CPU | 161037.25 | ✅ 是（全天最高峰，161037.25） |
| 17:00 | Interactive CPU | 161037.25 | ✅ 是（全天最高峰，161037.25） |
| 17:00 | Batch CPU | 161037.25 | ✅ 是（全天最高峰，161037.25） |
| 17:00 | Disk I/O（磁碟I/O） | 410093 | ✅ 是（全天最高峰，410093） |
| 17:00 | Page Faults（分頁缺失） | 391755 | ✅ 是（全天最高峰，391755） |
| 17:00 | Seize/Wait Time（鎖定等待時間） | 9.54 | 否 |
| 19:30 | Page Faults（分頁缺失） | 680 | 否 |

**#13 ADMIN5/QLWISVR/819259**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 01:30 | Page Faults（分頁缺失） | 52 | 否 |
| 01:45 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 01:45 | Page Faults（分頁缺失） | 439 | 否 |
| 17:15 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 17:30 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 21:30 | Page Faults（分頁缺失） | 565 | 否 |
| 21:45 | Page Faults（分頁缺失） | 60 | 否 |
| 22:00 | Page Faults（分頁缺失） | 56 | 否 |

**#14 QSQSRVR/QUSER/846201**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 00:15 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 00:15 | Total CPU | 4162.55 | 否 |
| 00:15 | Interactive CPU | 4162.55 | 否 |
| 00:15 | Batch CPU | 4162.55 | 否 |
| 00:15 | Page Faults（分頁缺失） | 6741 | 否 |
| 16:00 | Page Faults（分頁缺失） | 308 | 否 |
| 21:00 | Page Faults（分頁缺失） | 321 | 否 |

**#15 BACKUPAUTO/CLARK/846256**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 05:15 | Response Time（回應時間） | 0 | ✅ 是（全天最高峰，0） |
| 05:15 | Total CPU | 1676.06 | 否 |
| 05:15 | Interactive CPU | 1676.06 | 否 |
| 05:15 | Batch CPU | 1676.06 | 否 |
| 05:15 | Disk I/O（磁碟I/O） | 59197 | 否 |
| 05:15 | Page Faults（分頁缺失） | 54077 | 否 |

