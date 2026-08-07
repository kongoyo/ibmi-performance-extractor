# 🔍 Anomaly Scan Context

**Host**: 172.16.12.126
**Date**: 07/14
**Scope**: 全天所有時段，針對 Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O）、Page Faults（分頁缺失）、Seize/Wait Time（鎖定等待時間） 六大資源維度，each 時段各維度的排行榜第一名（消耗最高的 Job）

> 系統提示：此為異常 Job 掃描腳本產出的上下文數據，排序依據為：(1) 登上排行榜第一名的總次數、(2) 達成當日該維度絕對峰值（該維度全天所有 Job 中的最高單一數值）的次數。val1 單位依維度而異（CPU_MS／秒／IO 次數／faults 數），僅可跨時段比較同一維度，不可跨維度比較。請 AI Agent 直接依據此上下文列出異常 Job 清單並撰寫分析，不需再自行解析原始 JSON。僅前 15 名附完整明細，其餘視為長尾、影響力低，僅列於總表。

### 各維度全天最高單一數值 (day max, 供對照)

| 維度 | 全天最高值 (val1) |
| :--- | ---: |
| Response Time（回應時間） | 0.57 |
| Total CPU | 599525.4 |
| Interactive CPU | 599525.4 |
| Batch CPU | 599525.4 |
| Disk I/O（磁碟I/O） | 92830861 |
| Page Faults（分頁缺失） | 3587940 |

### 排行總表 (依影響力排序，共 153 個 Job 曾登頂)

| 排名 | Job | 使用者 | 登頂維度 | 登頂總次數 | 達成當日絕對峰值次數 |
| ---: | :--- | :--- | :--- | ---: | ---: |
| 1 | CMPFILDTA/MIMIXOWN/925462 | MIMIXOWN | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O）、Page Faults（分頁缺失） | 166 | 1 |
| 2 | DBOP-PLANCACHE// |  | Page Faults（分頁缺失） | 40 | 0 |
| 3 | A#EPCB45HB/AP131091/719383 | AP131091 | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Page Faults（分頁缺失） | 35 | 0 |
| 4 | CMPFILDTA/MIMIXOWN/943737 | MIMIXOWN | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O）、Page Faults（分頁缺失） | 17 | 4 |
| 5 | CFE#COD/TJCOD/570634 | TJCOD | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O） | 5 | 0 |
| 6 | CFE#COD/TJCOD/623720 | TJCOD | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O） | 5 | 0 |
| 7 | TB7012203A/U180049/368589 | U180049 | Response Time（回應時間）、Page Faults（分頁缺失） | 5 | 0 |
| 8 | CFE#COD/TJCOD/824006 | TJCOD | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O） | 5 | 0 |
| 9 | CFE#COD/TJCOD/910936 | TJCOD | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O） | 5 | 0 |
| 10 | CFE#COD/TJCOD/058718 | TJCOD | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O） | 5 | 0 |
| 11 | SMPOL001// |  | Disk I/O（磁碟I/O） | 5 | 0 |
| 12 | TB6696213B/U190401/496371 | U190401 | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU | 4 | 1 |
| 13 | QZDASOINIT/QUSER/742316 | QUSER | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU | 4 | 0 |
| 14 | DHCB45H/AP131091/884737 | AP131091 | Response Time（回應時間）、Page Faults（分頁缺失） | 4 | 0 |
| 15 | QZDASOINIT/QUSER/905031 | QUSER | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU | 4 | 0 |
| 16 | QZDASOINIT/QUSER/900069 | QUSER | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU | 4 | 0 |
| 17 | QZDASOINIT/QUSER/945243 | QUSER | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU | 4 | 0 |
| 18 | QZDASOINIT/QUSER/964002 | QUSER | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU | 4 | 0 |
| 19 | QZDASOINIT/QUSER/164094 | QUSER | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU | 4 | 0 |
| 20 | QZDASOINIT/QUSER/280240 | QUSER | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU | 4 | 0 |
| 21 | QZDASOINIT/QUSER/691066 | QUSER | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU | 4 | 0 |
| 22 | QZDASOINIT/QUSER/960364 | QUSER | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU | 4 | 0 |
| 23 | QZDASOINIT/QUSER/085839 | QUSER | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU | 4 | 0 |
| 24 | QZDASOINIT/QUSER/113727 | QUSER | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU | 4 | 0 |
| 25 | DHC820N_31/AP131091/131232 | AP131091 | Response Time（回應時間）、Total CPU、Interactive CPU、Batch CPU | 4 | 0 |
| 26 | TN5452200A/U147192/344678 | U147192 | Total CPU、Interactive CPU、Batch CPU、Page Faults（分頁缺失） | 4 | 0 |
| 27 | CFE#COD/TJCOD/420038 | TJCOD | Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O） | 4 | 0 |
| 28 | CFE#COD/TJCOD/724771 | TJCOD | Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O） | 4 | 0 |
| 29 | CFE#COD/TJCOD/979448 | TJCOD | Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O） | 4 | 0 |
| 30 | CFE#COD/TJCOD/094871 | TJCOD | Total CPU、Interactive CPU、Batch CPU、Disk I/O（磁碟I/O） | 4 | 0 |
| 31 | CFE#COD/TJCOD/763198 | TJCOD | Response Time（回應時間）、Disk I/O（磁碟I/O） | 3 | 0 |
| 32 | CFE#COD/TJCOD/005909 | TJCOD | Response Time（回應時間）、Disk I/O（磁碟I/O） | 3 | 0 |
| 33 | CFE#COD/TJCOD/071840 | TJCOD | Response Time（回應時間）、Disk I/O（磁碟I/O） | 3 | 0 |
| 34 | CFE#COD/TJCOD/104178 | TJCOD | Response Time（回應時間）、Disk I/O（磁碟I/O） | 3 | 0 |
| 35 | QZDASOINIT/QUSER/001500 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 36 | QZDASOINIT/QUSER/075778 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 37 | QZDASOINIT/QUSER/226027 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 38 | QZDASOINIT/QUSER/330029 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 39 | QZDASOINIT/QUSER/407435 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 40 | CRC6631330/AP135046/427611 | AP135046 | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 41 | QZDASOINIT/QUSER/440712 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 42 | QZDASOINIT/QUSER/462626 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 43 | CRC6631430/AP135046/487331 | AP135046 | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 44 | QZDASOINIT/QUSER/513937 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 45 | QZDASOINIT/QUSER/527713 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 46 | CRC6631530/AP135046/555872 | AP135046 | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 47 | QZDASOINIT/QUSER/576982 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 48 | QDFTJOBD/AP135046/638974 | AP135046 | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 49 | QZDASOINIT/QUSER/663343 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 50 | QZDASOINIT/QUSER/735385 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 51 | QZDASOINIT/QUSER/770585 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 52 | QZDASOINIT/QUSER/794371 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 53 | CRC6631830/AP135046/836440 | AP135046 | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 54 | QZDASOINIT/QUSER/829990 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 55 | QZDASOINIT/QUSER/891504 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 56 | CRC6631930/AP135046/925281 | AP135046 | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 57 | QZDASOINIT/QUSER/890918 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 58 | CRC6632030/AP135046/989221 | AP135046 | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 59 | QZDASOINIT/QUSER/012335 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 60 | QZDASOINIT/QUSER/034813 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 61 | CRC6632130/AP135046/063762 | AP135046 | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 62 | QZDASOINIT/QUSER/080678 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 63 | CRC6632230/AP135046/098917 | AP135046 | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 64 | QZDASOINIT/QUSER/112461 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 65 | QZDASOINIT/QUSER/129346 | QUSER | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 66 | A#EPCB45HB/AP131091/150923 | AP131091 | Total CPU、Interactive CPU、Batch CPU | 3 | 0 |
| 67 | CFE#COD/TJCOD/872488 | TJCOD | Response Time（回應時間）、Disk I/O（磁碟I/O） | 2 | 0 |
| 68 | TB3034177A/U180916/128174 | U180916 | Response Time（回應時間） | 2 | 0 |
| 69 | TB7595203B/U179809/347208 | U179809 | Response Time（回應時間） | 2 | 0 |
| 70 | CFE#COD/TJCOD/366980 | TJCOD | Response Time（回應時間）、Disk I/O（磁碟I/O） | 2 | 0 |
| 71 | CFE#COD/TJCOD/773433 | TJCOD | Disk I/O（磁碟I/O） | 2 | 0 |
| 72 | CMPFILDTA/MIMIXOWN/923561 | MIMIXOWN | Disk I/O（磁碟I/O）、Page Faults（分頁缺失） | 2 | 0 |
| 73 | CFE#COD/TJCOD/655635 | TJCOD | Disk I/O（磁碟I/O） | 2 | 0 |
| 74 | CFE#COD/TJCOD/854869 | TJCOD | Disk I/O（磁碟I/O） | 2 | 0 |
| 75 | CFE#COD/TJCOD/936341 | TJCOD | Disk I/O（磁碟I/O） | 2 | 0 |
| 76 | CFE#COD/TJCOD/150516 | TJCOD | Disk I/O（磁碟I/O） | 2 | 0 |
| 77 | TB5657018B/U195498/660970 | U195498 | Page Faults（分頁缺失） | 2 | 0 |
| 78 | OBJREF/QSECOFR/148132 | QSECOFR | Page Faults（分頁缺失） | 2 | 0 |
| 79 | DHCB45HB1/AP131091/724241 | AP131091 | Response Time（回應時間） | 1 | 0 |
| 80 | KENB0067B/U180134/884790 | U180134 | Response Time（回應時間） | 1 | 0 |
| 81 | DHC820N_35/AP131091/896527 | AP131091 | Response Time（回應時間） | 1 | 0 |
| 82 | TB7277214A/U659304/957479 | U659304 | Response Time（回應時間） | 1 | 0 |
| 83 | TB7935212A/U193371/995880 | U193371 | Response Time（回應時間） | 1 | 0 |
| 84 | TB7277215B/U133183/035250 | U133183 | Response Time（回應時間） | 1 | 0 |
| 85 | TB5657014A/U192884/130961 | U192884 | Response Time（回應時間） | 1 | 0 |
| 86 | HN075101A/U401811/134594 | U401811 | Response Time（回應時間） | 1 | 0 |
| 87 | TB5657003B/U194939/206669 | U194939 | Response Time（回應時間） | 1 | 0 |
| 88 | TB7404205A/U115452/230983 | U115452 | Response Time（回應時間） | 1 | 0 |
| 89 | TB7501207B/U164984/206185 | U164984 | Response Time（回應時間） | 1 | 0 |
| 90 | TB6696213A/U190401/247918 | U190401 | Response Time（回應時間） | 1 | 0 |
| 91 | TB5754210B/U195461/330141 | U195461 | Response Time（回應時間） | 1 | 0 |
| 92 | TB5657017A/U415895/328795 | U415895 | Response Time（回應時間） | 1 | 0 |
| 93 | TB5630105A/U159751/345777 | U159751 | Response Time（回應時間） | 1 | 0 |
| 94 | TB7668205A/U176121/386714 | U176121 | Response Time（回應時間） | 1 | 0 |
| 95 | TB7501207B/U164984/340417 | U164984 | Response Time（回應時間） | 1 | 0 |
| 96 | TB7404202A/U135690/410685 | U135690 | Response Time（回應時間） | 1 | 0 |
| 97 | KE3300102A/CF098940/416852 | CF098940 | Response Time（回應時間） | 1 | 0 |
| 98 | TB7048226B/U178547/454908 | U178547 | Response Time（回應時間） | 1 | 0 |
| 99 | TB5266202B/U730092/469290 | U730092 | Response Time（回應時間） | 1 | 0 |
| 100 | TB5754206B/U190220/458850 | U190220 | Response Time（回應時間） | 1 | 0 |
| 101 | KE2700202C/CF099434/502235 | CF099434 | Response Time（回應時間） | 1 | 0 |
| 102 | TB7749202A/U195436/511904 | U195436 | Response Time（回應時間） | 1 | 0 |
| 103 | TB7064214A/U181975/502844 | U181975 | Response Time（回應時間） | 1 | 0 |
| 104 | TB7048201B/U499563/525778 | U499563 | Response Time（回應時間） | 1 | 0 |
| 105 | TB3034216A/U180916/689305 | U180916 | Response Time（回應時間） | 1 | 0 |
| 106 | TB5282187A/U411841/720262 | U411841 | Response Time（回應時間） | 1 | 0 |
| 107 | TB5312207B/U191149/497564 | U191149 | Response Time（回應時間） | 1 | 0 |
| 108 | TB642404A/U194738/554089 | U194738 | Response Time（回應時間） | 1 | 0 |
| 109 | TB7277214A/U659483/873341 | U659483 | Response Time（回應時間） | 1 | 0 |
| 110 | TB7218220A/U173967/883789 | U173967 | Response Time（回應時間） | 1 | 0 |
| 111 | TB7943209B/U177393/894221 | U177393 | Response Time（回應時間） | 1 | 0 |
| 112 | TB7706202B/U180908/839315 | U180908 | Response Time（回應時間） | 1 | 0 |
| 113 | TB5878201B/U191780/574960 | U191780 | Response Time（回應時間） | 1 | 0 |
| 114 | TB7811204A/U195349/710872 | U195349 | Response Time（回應時間） | 1 | 0 |
| 115 | TB7012203D/U180049/294152 | U180049 | Response Time（回應時間） | 1 | 0 |
| 116 | TB7012203A/U180049/792606 | U180049 | Response Time（回應時間） | 1 | 0 |
| 117 | TB5193213A/U415913/084484 | U415913 | Response Time（回應時間） | 1 | 0 |
| 118 | DHC820N_29/AP131091/098918 | AP131091 | Response Time（回應時間） | 1 | 0 |
| 119 | TB5630014A/U192838/057480 | U192838 | Response Time（回應時間） | 1 | 0 |
| 120 | TB7579207A/U135755/112280 | U135755 | Response Time（回應時間） | 1 | 0 |
| 121 | EPC9971/AP131091/725052 | AP131091 | Disk I/O（磁碟I/O） | 1 | 0 |
| 122 | CFE#COD/TJCOD/887804 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 123 | JRNMGR/MIMIXOWN/132091 | MIMIXOWN | Disk I/O（磁碟I/O） | 1 | 0 |
| 124 | A#EP820N35/AP131091/896525 | AP131091 | Disk I/O（磁碟I/O） | 1 | 0 |
| 125 | CSC527/AP107328/402621 | AP107328 | Disk I/O（磁碟I/O） | 1 | 0 |
| 126 | CFE#COD/TJCOD/347243 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 127 | DCRFC1/AP107328/440396 | AP107328 | Disk I/O（磁碟I/O） | 1 | 0 |
| 128 | CFE#COD/TJCOD/402693 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 129 | CFE#COD/TJCOD/456175 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 130 | CFE#COD/TJCOD/476058 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 131 | CFE#COD/TJCOD/498572 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 132 | CFE#COD/TJCOD/519648 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 133 | CFE#COD/TJCOD/544321 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 134 | CFE#COD/TJCOD/596493 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 135 | CFE#COD/TJCOD/690144 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 136 | CFE#COD/TJCOD/794320 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 137 | CFE#COD/TJCOD/884720 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 138 | CFE#COD/TJCOD/957079 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 139 | CFE#COD/TJCOD/034949 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 140 | CFE#COD/TJCOD/082058 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 141 | CFE#COD/TJCOD/113740 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 142 | CFE#COD/TJCOD/129919 | TJCOD | Disk I/O（磁碟I/O） | 1 | 0 |
| 143 | QZDASOINIT/QUSER/741260 | QUSER | Page Faults（分頁缺失） | 1 | 0 |
| 144 | RCV_RUNCMD/MIMIXOWN/904005 | MIMIXOWN | Page Faults（分頁缺失） | 1 | 0 |
| 145 | CMPFILA/MIMIXOWN/906094 | MIMIXOWN | Page Faults（分頁缺失） | 1 | 0 |
| 146 | DHCB81/AP131091/921337 | AP131091 | Page Faults（分頁缺失） | 1 | 0 |
| 147 | DCCDELWKF/QSECOFR/926109 | QSECOFR | Page Faults（分頁缺失） | 1 | 0 |
| 148 | EI#DSPFD/AP114812/935286 | AP114812 | Page Faults（分頁缺失） | 1 | 0 |
| 149 | QZDASOINIT/QUSER/137747 | QUSER | Page Faults（分頁缺失） | 1 | 0 |
| 150 | QDBFSTCCOL/QSYS/840124 | QSYS | Page Faults（分頁缺失） | 1 | 0 |
| 151 | SFC202/AP158348/456040 | AP158348 | Page Faults（分頁缺失） | 1 | 0 |
| 152 | TB5657002B/U195256/426941 | U195256 | Page Faults（分頁缺失） | 1 | 0 |
| 153 | TB5657003B/U194939/648648 | U194939 | Page Faults（分頁缺失） | 1 | 0 |

### Top 15 候選 Job 明細

**#1 CMPFILDTA/MIMIXOWN/925462**

*(共 166 筆，樣本數過多，改以每維度統計摘要呈現；僅列出達成當日絕對峰值的時刻。)*

| 維度 | 樣本數 | 時間範圍 | 最小值 | 最大值 | 平均值 |
| :--- | ---: | :--- | ---: | ---: | ---: |
| Response Time（回應時間） | 16 | 03:30 ~ 11:30 | 0 | 0 | 0 |
| Total CPU | 29 | 03:30 ~ 13:00 | 167908.18 | 479139.45 | 294284.07 |
| Interactive CPU | 29 | 03:30 ~ 13:00 | 167908.18 | 479139.45 | 294284.07 |
| Batch CPU | 29 | 03:30 ~ 13:00 | 167908.18 | 479139.45 | 294284.07 |
| Disk I/O（磁碟I/O） | 37 | 03:30 ~ 13:00 | 25489856 | 92830861 | 67472880.22 |
| Page Faults（分頁缺失） | 26 | 04:45 ~ 13:00 | 204583 | 1746058 | 908122.88 |

**達成當日絕對峰值的時刻**：

| 時間 | 維度 | 數值 (val1) |
| :--- | :--- | ---: |
| 12:00 | Disk I/O（磁碟I/O） | 92830861 |

**#2 DBOP-PLANCACHE//**

*(共 40 筆，樣本數過多，改以每維度統計摘要呈現；僅列出達成當日絕對峰值的時刻。)*

| 維度 | 樣本數 | 時間範圍 | 最小值 | 最大值 | 平均值 |
| :--- | ---: | :--- | ---: | ---: | ---: |
| Page Faults（分頁缺失） | 40 | 00:15 ~ 23:30 | 43002 | 276958 | 142097.23 |

**#3 A#EPCB45HB/AP131091/719383**

*(共 35 筆，樣本數過多，改以每維度統計摘要呈現；僅列出達成當日絕對峰值的時刻。)*

| 維度 | 樣本數 | 時間範圍 | 最小值 | 最大值 | 平均值 |
| :--- | ---: | :--- | ---: | ---: | ---: |
| Total CPU | 10 | 00:30 ~ 03:00 | 172158.54 | 280869.16 | 242311.39 |
| Interactive CPU | 10 | 00:30 ~ 03:00 | 172158.54 | 280869.16 | 242311.39 |
| Batch CPU | 10 | 00:30 ~ 03:00 | 172158.54 | 280869.16 | 242311.39 |
| Response Time（回應時間） | 4 | 02:00 ~ 03:00 | 0 | 0 | 0 |
| Page Faults（分頁缺失） | 1 | 02:45 ~ 02:45 | 367681 | 367681 | 367681 |

**#4 CMPFILDTA/MIMIXOWN/943737**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 04:30 | Response Time（回應時間） | 0 | 否 |
| 04:30 | Total CPU | 599525.4 | ✅ 是（全天最高峰，599525.4） |
| 04:30 | Interactive CPU | 599525.4 | ✅ 是（全天最高峰，599525.4） |
| 04:30 | Batch CPU | 599525.4 | ✅ 是（全天最高峰，599525.4） |
| 04:30 | Disk I/O（磁碟I/O） | 52498743 | 否 |
| 04:45 | Response Time（回應時間） | 0 | 否 |
| 04:45 | Total CPU | 449991.44 | 否 |
| 04:45 | Interactive CPU | 449991.44 | 否 |
| 04:45 | Batch CPU | 449991.44 | 否 |
| 05:00 | Page Faults（分頁缺失） | 305496 | 否 |
| 05:15 | Disk I/O（磁碟I/O） | 43264828 | 否 |
| 05:15 | Page Faults（分頁缺失） | 574441 | 否 |
| 05:45 | Page Faults（分頁缺失） | 1865050 | 否 |
| 06:00 | Page Faults（分頁缺失） | 2360194 | 否 |
| 06:15 | Page Faults（分頁缺失） | 3587940 | ✅ 是（全天最高峰，3587940） |
| 06:30 | Page Faults（分頁缺失） | 3203463 | 否 |
| 06:45 | Page Faults（分頁缺失） | 2690762 | 否 |

**#5 CFE#COD/TJCOD/570634**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 16:00 | Response Time（回應時間） | 0 | 否 |
| 16:00 | Total CPU | 76186.9 | 否 |
| 16:00 | Interactive CPU | 76186.9 | 否 |
| 16:00 | Batch CPU | 76186.9 | 否 |
| 16:00 | Disk I/O（磁碟I/O） | 8486094 | 否 |

**#6 CFE#COD/TJCOD/623720**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 16:30 | Response Time（回應時間） | 0 | 否 |
| 16:30 | Total CPU | 69824.77 | 否 |
| 16:30 | Interactive CPU | 69824.77 | 否 |
| 16:30 | Batch CPU | 69824.77 | 否 |
| 16:30 | Disk I/O（磁碟I/O） | 6538690 | 否 |

**#7 TB7012203A/U180049/368589**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 14:45 | Page Faults（分頁缺失） | 167987 | 否 |
| 15:45 | Page Faults（分頁缺失） | 124245 | 否 |
| 16:45 | Response Time（回應時間） | 0 | 否 |
| 16:45 | Page Faults（分頁缺失） | 131673 | 否 |
| 17:00 | Response Time（回應時間） | 0.34 | 否 |

**#8 CFE#COD/TJCOD/824006**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 18:30 | Response Time（回應時間） | 0 | 否 |
| 18:30 | Total CPU | 71390.25 | 否 |
| 18:30 | Interactive CPU | 71390.25 | 否 |
| 18:30 | Batch CPU | 71390.25 | 否 |
| 18:30 | Disk I/O（磁碟I/O） | 6582127 | 否 |

**#9 CFE#COD/TJCOD/910936**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 19:30 | Response Time（回應時間） | 0 | 否 |
| 19:30 | Total CPU | 68827.77 | 否 |
| 19:30 | Interactive CPU | 68827.77 | 否 |
| 19:30 | Batch CPU | 68827.77 | 否 |
| 19:30 | Disk I/O（磁碟I/O） | 6370205 | 否 |

**#10 CFE#COD/TJCOD/058718**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 21:30 | Response Time（回應時間） | 0 | 否 |
| 21:30 | Total CPU | 75086.57 | 否 |
| 21:30 | Interactive CPU | 75086.57 | 否 |
| 21:30 | Batch CPU | 75086.57 | 否 |
| 21:30 | Disk I/O（磁碟I/O） | 7627561 | 否 |

**#11 SMPOL001//**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 02:00 | Disk I/O（磁碟I/O） | 1816153 | 否 |
| 02:15 | Disk I/O（磁碟I/O） | 2260728 | 否 |
| 02:30 | Disk I/O（磁碟I/O） | 3235019 | 否 |
| 02:45 | Disk I/O（磁碟I/O） | 1910421 | 否 |
| 03:00 | Disk I/O（磁碟I/O） | 2413479 | 否 |

**#12 TB6696213B/U190401/496371**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 15:30 | Response Time（回應時間） | 0.57 | ✅ 是（全天最高峰，0.57） |
| 15:30 | Total CPU | 120130.19 | 否 |
| 15:30 | Interactive CPU | 120130.19 | 否 |
| 15:30 | Batch CPU | 120130.19 | 否 |

**#13 QZDASOINIT/QUSER/742316**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 00:15 | Response Time（回應時間） | 0 | 否 |
| 00:15 | Total CPU | 233675.27 | 否 |
| 00:15 | Interactive CPU | 233675.27 | 否 |
| 00:15 | Batch CPU | 233675.27 | 否 |

**#14 DHCB45H/AP131091/884737**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 01:00 | Response Time（回應時間） | 0 | 否 |
| 01:00 | Page Faults（分頁缺失） | 155503 | 否 |
| 01:30 | Response Time（回應時間） | 0 | 否 |
| 01:30 | Page Faults（分頁缺失） | 212856 | 否 |

**#15 QZDASOINIT/QUSER/905031**

| 時間 | 維度 | 數值 (val1) | 是否為當日該維度最高峰 |
| :--- | :--- | ---: | :--- |
| 02:15 | Response Time（回應時間） | 0 | 否 |
| 02:15 | Total CPU | 227831.83 | 否 |
| 02:15 | Interactive CPU | 227831.83 | 否 |
| 02:15 | Batch CPU | 227831.83 | 否 |

