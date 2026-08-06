# IBM i Collection Services 欄位對照與 SQL 公式參考手冊

> **維護規範**：當使用者回報計算錯誤或欄位缺失問題、完成除錯後，**必須立即更新本文件**，記錄正確欄位名稱、公式修正說明與修正日期。

---

## 變更記錄

| 日期 | 欄位 / 公式 | 問題描述 | 修正內容 |
|------|------------|---------|---------|
| 2026-08-06 | `QAPMISUM.Dsk` | 原寫死為常數 `1 AS "Dsk"`，完全無效 | 改為 JOIN `QAPMDISK`，用 `DSNBSY/DSSMPL` 計算各 ARM 使用率後取最大值 |
| 2026-08-06 | `QAPMJOBL.JBPAGF` | 錯誤使用 `JBPFL`（該欄位 = Files to be printed）| 正確欄位為 `JBPAGF`（PAG faults） |
| 2026-08-06 | `QAPMJOBL.JBLRD` | 錯誤使用 `JBLGR`（欄位不存在）| 正確欄位為 `JBLRD`（Logical database reads） |
| 2026-08-06 | `generate_report.py` cardId | `Dsk` → `dsk`，找不到 `chart-dsk` DOM 元素 | 新增 `mk === 'dsk' ? 'disk'` 顯式映射 |
| 2026-08-06 | `QAPMSYSTEM` JOIN 別名 | 原寫為 `V_QAPMSYSTEM_TARGET`（前綴 V_ 錯誤）| 正確別名為 `QAPMSYSTEM_TARGET` |

---

## 一、QAPMISUM（Interval Summary File）

**用途**：每 15 分鐘一筆的系統區間摘要，是計算 CPU、交易、回應時間、分頁缺失的主要來源。

### 關鍵欄位

| 欄位 | 說明 | 型別 | 計算公式 |
|------|------|------|---------|
| `INTNUM` | 區間序號（1=00:15, 2=00:30, …, 96=24:00）| INTEGER | — |
| `DTETIM` | 區間日期時間 `YYMMDDHHmm`（字串）| CHAR | `SUBSTR(DTETIM,7,2):SUBSTR(DTETIM,9,2)` = HH:mm |
| `INTSEC` | 本區間實際秒數（通常 900）| INTEGER | — |
| `JBNTR` | 本區間交易次數 | INTEGER | — |
| `JBRSP` | 本區間總回應時間（**已是秒**，非毫秒）| DECIMAL | 平均回應 = `JBRSP / (JBNTR * 1000.0)` 得毫秒 |
| `JBTFLT` | 本區間總分頁缺失次數（所有 Pool 合計）| INTEGER | 分頁缺失/秒 = `ROUND(JBTFLT / INTSEC, 0)` |

> **⚠️ High Disk 指標不在 QAPMISUM 中**，需另外 JOIN `QAPMDISK` 計算。

> **⚠️ `JBTFLT` 是系統級計數器**，統計整個系統所有 Pool 的換頁總數，無法對應到單一 Job。Job 層級的分頁缺失請查 `QAPMJOBL.JBPAGF`。

---

## 二、QAPMSYSTEM（System Configuration File）

**用途**：記錄 LPAR 分區的 CPU 容量配置，**必須** JOIN `QAPMISUM` 才能計算正確的 CPU 使用率。

### 關鍵欄位

| 欄位 | 說明 | 計算注意 |
|------|------|---------|
| `INTNUM` | 區間序號（JOIN key）| — |
| `SYSPTU` | 本分區本區間實際消耗的 CPU 毫秒數（unscaled）| — |
| `SYSCTA` | 本分區可用的總 CPU 容量（以單核毫秒為單位）| **必須以此為分母**，而非固定核心數 |

### CPU 使用率計算公式

```sql
-- ✅ 正確公式（與 DSPPFRDTA 綠色畫面完全一致）
CASE WHEN s.SYSCTA > 0
     THEN CAST((s.SYSPTU / (s.SYSCTA * 1.0)) * 100.0 AS INTEGER)
     ELSE 0
END AS "CPU_pct"
```

> **⚠️ 嚴禁用 `SYSPTU / [固定核心數]` 計算 CPU**，因為 LPAR 的 CPU 容量是動態的。`SYSCTA` 才是唯一正確的分母。

---

## 三、QAPMDISK（Disk Unit File）

**用途**：每個磁碟 ARM 每個區間一筆記錄，用於計算 High Disk ARM Utilization。

### 關鍵欄位

| 欄位 | 說明 |
|------|------|
| `INTNUM` | 區間序號（JOIN key）|
| `DSARM` | 磁碟 ARM 編號 |
| `DSNBSY` | 本區間磁碟閒置次數（Not Busy count）|
| `DSSMPL` | 本區間取樣總次數（Sample count）|
| `DSRDS` | Read operations |
| `DSWRTS` | Write operations |
| `DSSRVT` | Disk service time (ms) |
| `DSWT` | Disk wait time (ms) |
| `DSDCFW` | Device cache fast writes（高值表示快取保護有效）|
| `DSCCWH` | Controller cache write hits |
| `DSCAP` | Disk capacity in bytes |
| `DSAVL` | Disk available space |
| `DSASP` | ASP number |

### High Disk Utilization 計算公式

```sql
-- ✅ 正確公式：取所有 ARM 中最大使用率（對應 WRKDSKSTS 的 %Util）
COALESCE((
  SELECT MAX(
    CASE WHEN d.DSSMPL > 0
         THEN INTEGER((1.0 - d.DSNBSY * 1.0 / d.DSSMPL) * 100)
         ELSE 0
    END
  )
  FROM QTEMP.QAPMDISK_TARGET d
  WHERE d.INTNUM = m.INTNUM
), 0) AS "Dsk"
```

> **注意**：即使 I/O 次數很高（如 MIMIX CMPFILDTA 單 Interval 8,700 萬次），ARM Utilization 也可能偏低（僅 4–12%），因為 SAN 控制器的 `DSDCFW` 大量吸收了 I/O，使實體 ARM 未真正飽和。

---

## 四、QAPMJOBL（Job Loop File）

**用途**：每個 Job / Thread 每個區間一筆記錄，用於 Top 10 Job 排行（CPU、I/O、分頁缺失等）。

### 關鍵欄位對照表

| 欄位 | 說明 | ⚠️ 常見錯誤 |
|------|------|-----------|
| `JBPAGF` | PAG faults（分頁缺失次數）| ❌ **不是 `JBPFL`**（`JBPFL` = Files to be printed）|
| `JBCPU` | Thread unscaled CPU 毫秒數 | — |
| `JBNTR` | Transactions（交易次數）| — |
| `JBRSP` | Total response seconds（**秒**，非毫秒）| — |
| `JBDBR` | Physical database reads | ❌ **不是 `JBPHY`**（欄位不存在）|
| `JBNDB` | Physical non-database reads | — |
| `JBLRD` | Logical database reads | ❌ **不是 `JBLGR`**（欄位不存在）|
| `JBLWT` | Logical database writes | — |
| `JBADBR` | Asynchronous database reads（非同步預讀）| MIMIX CMPFILDTA 診斷關鍵欄位 |
| `JBADBW` | Asynchronous database writes | — |
| `JBNAME` | Job name（含尾端空格，需 `TRIM()`）| — |
| `JBUSER` | Job user profile | — |
| `JBNBR` | Job number | — |
| `JBSSYS` | Subsystem name | — |
| `JBTYPE` | Job type：`I`=Interactive, `B`=Batch, `S`=System | — |
| `JBSTYP` | Job subtype：`D`=DDM, `J`=Pre-start Job 等 | — |
| `JBPOOL` | Job pool number | — |
| `JBSZWT` | Seize/Wait 時間（毫秒）| 資源鎖定競爭指標 |

### Top N Job 查詢範本

```sql
WITH AggJobs AS (
  SELECT INTNUM,
         TRIM(JBNAME) AS JOB_NAME,
         TRIM(JBUSER) AS USER_NAME,
         TRIM(JBNBR)  AS JOB_NUMBER,
         TRIM(JBTYPE) AS JOB_TYPE,
         TRIM(JBSTYP) AS SUB_TYPE,
         TRIM(JBSSYS) AS SUBSYSTEM,
         SUM(JBPAGF)  AS TOTAL_PAGF,     -- ✅ 分頁缺失
         SUM(JBCPU)   AS TOTAL_CPU_MS,
         SUM(JBDBR)   AS DB_PHYS_READS,  -- ✅ 實體 DB 讀取
         SUM(JBNDB)   AS NDB_PHYS_READS,
         SUM(JBLRD)   AS LOGICAL_READS,  -- ✅ 邏輯讀取
         SUM(JBADBR)  AS ASYNC_DB_READS  -- ✅ MIMIX 非同步預讀
  FROM [ALIAS_QAPMJOBL]
  WHERE INTNUM = [TARGET_INTNUM]
  GROUP BY INTNUM, TRIM(JBNAME), TRIM(JBUSER), TRIM(JBNBR),
           TRIM(JBTYPE), TRIM(JBSTYP), TRIM(JBSSYS)
)
SELECT * FROM AggJobs ORDER BY TOTAL_PAGF DESC FETCH FIRST 15 ROWS ONLY;
```

---

## 五、QAPMJOBOS（Job OS File）

**用途**：Job 的作業系統層次統計，提供 SQL 語句數、Commit、邏輯 I/O 等維度。不含分頁缺失相關欄位。

### 關鍵欄位對照表

| 欄位 | 說明 | ⚠️ 注意 |
|------|------|--------|
| `JBLRD` | Logical database reads | — |
| `JBLWT` | Logical database writes | — |
| `JBNTR` | Transactions | — |
| `JBRSP` | Total response seconds（**秒**）| — |
| `JBSQLSTMT` | SQL statements count | `= 0` 代表純 Native I/O（RPG/COBOL 直接開檔）|
| `JBBCO` | Database commit operations | — |
| `JBBRO` | Database rollback operations | — |
| `JBDBU` | Miscellaneous database operations | — |
| `JBNUS` | Full opens（完整開檔次數）| 高值可能表示缺乏 ODP 重用 |
| `JBSSYS` | Subsystem name | — |
| `JBTYPE` | Job type | — |
| `JBSTYP` | Job subtype | — |

> **⚠️ `QAPMJOBOS` 不含以下欄位**（這些僅存在於 `QAPMJOBL`）：
> `JBPAGF`（分頁缺失）、`JBADBR`（Async Pre-read）、`JBCPU`（CPU 時間）

### OS 層次 I/O Profile 查詢範本

```sql
SELECT TRIM(JBNAME)  AS JOB_NAME,
       TRIM(JBUSER)  AS USER_NAME,
       TRIM(JBNBR)   AS JOB_NUMBER,
       TRIM(JBTYPE)  AS JOB_TYPE,
       TRIM(JBSTYP)  AS SUB_TYPE,
       TRIM(JBSSYS)  AS SUBSYSTEM,
       JBNTR         AS TRANS_COUNT,
       JBRSP         AS TOTAL_RSP_SEC,
       JBLRD         AS LOGICAL_READS,
       JBLWT         AS LOGICAL_WRITES,
       JBSQLSTMT     AS SQL_STMTS,
       JBBCO         AS DB_COMMITS
FROM [ALIAS_QAPMJOBOS]
WHERE INTNUM = [TARGET_INTNUM]
ORDER BY JBLRD DESC
FETCH FIRST 15 ROWS ONLY;
```

---

## 六、INTNUM ↔ 時間對照速查表

`INTNUM = 1` 對應 `00:15`，每 15 分鐘加 1，共 96 個 Interval / 天。

計算公式：
- `HH = FLOOR((INTNUM * 15) / 60)`
- `mm = (INTNUM * 15) % 60`

常用對照：

| INTNUM | 時間 | 備註 |
|--------|------|------|
| 1 | 00:15 | — |
| 32 | 08:00 | 業務開盤 |
| 40 | 10:00 | — |
| 44 | 11:00 | MIMIX CMPFILDTA 高峰（本案例）|
| 48 | 12:00 | — |
| 51 | 12:45 | HN040130A 極端回應時間異常（本案例）|
| 96 | 24:00 | — |

---

## 七、generate_report.py 中 metricKey → cardId 映射規則

在 `updateJobsList()` 與 `triggerTabSwitch()` 函式中的完整映射：

| metricKey | cardId | 說明 |
|-----------|--------|------|
| `Tot` | `chart-cpu-tot` | CPU Total |
| `Int` | `chart-cpu-int` | CPU Interactive |
| `Bch` | `chart-cpu-bch` | CPU Batch |
| `Rsp` | `chart-rsp` | Response Time |
| `Count` | `chart-count` | Transaction Count |
| `Usr` | `chart-fault` | Page Fault（key=`Usr`，但 cardId=`fault`）|
| `Dsk` | `chart-disk` | High Disk（⚠️ `dsk` ≠ `disk`，必須顯式映射）|

```javascript
// ✅ 兩個函式都必須使用此完整版本
const mk = metricKey.toLowerCase();
const cardId = `chart-${
  mk === 'usr' ? 'fault'   :
  mk === 'tot' ? 'cpu-tot' :
  mk === 'int' ? 'cpu-int' :
  mk === 'bch' ? 'cpu-bch' :
  mk === 'dsk' ? 'disk'    :  // ⚠️ 必須顯式映射
  mk
}`;
```

---

## 八、完整 Interval Summary 查詢範本

```sql
SELECT
  m.INTNUM,
  SUBSTR(m.DTETIM, 3, 2) CONCAT '/' CONCAT SUBSTR(m.DTETIM, 5, 2)  AS "Date",
  SUBSTR(m.DTETIM, 7, 2) CONCAT ':' CONCAT SUBSTR(m.DTETIM, 9, 2)  AS "Time",
  m.DTETIM                                                           AS "RawTime",
  m.JBNTR                                                            AS "Count",
  CASE WHEN m.JBNTR > 0
       THEN DECIMAL(m.JBRSP / (m.JBNTR * 1000.0), 5, 2)
       ELSE 0.00
  END                                                                AS "Rsp",
  CASE WHEN s.SYSCTA > 0
       THEN CAST((s.SYSPTU / (s.SYSCTA * 1.0)) * 100.0 AS INTEGER)
       ELSE 0
  END                                                                AS "Tot",
  0                                                                  AS "Int",
  CASE WHEN s.SYSCTA > 0
       THEN CAST((s.SYSPTU / (s.SYSCTA * 1.0)) * 100.0 AS INTEGER)
       ELSE 0
  END                                                                AS "Bch",
  0                                                                  AS "Util",
  COALESCE((
    SELECT MAX(
      CASE WHEN d.DSSMPL > 0
           THEN INTEGER((1.0 - d.DSNBSY * 1.0 / d.DSSMPL) * 100)
           ELSE 0
      END
    )
    FROM [ALIAS_QAPMDISK] d WHERE d.INTNUM = m.INTNUM
  ), 0)                                                              AS "Dsk",
  '0002'                                                             AS "Unit",
  0                                                                  AS "Mch",
  ROUND(m.JBTFLT / m.INTSEC, 0)                                     AS "Usr",
  '02'                                                               AS "ID",
  0                                                                  AS "Util1"
FROM [ALIAS_QAPMISUM] m
JOIN [ALIAS_QAPMSYSTEM] s ON m.INTNUM = s.INTNUM
ORDER BY m.DTETIM;
```

---

## 九、QTEMP 別名建立順序

每個成員（日期）查詢前，必須依序建立五個別名：

```sql
CREATE OR REPLACE ALIAS QTEMP.QAPMISUM_[julian]   FOR [Library].QAPMISUM   ([MemberName]);
CREATE OR REPLACE ALIAS QTEMP.QAPMSYSTEM_[julian] FOR [Library].QAPMSYSTEM ([MemberName]);
CREATE OR REPLACE ALIAS QTEMP.QAPMJOBL_[julian]   FOR [Library].QAPMJOBL   ([MemberName]);
CREATE OR REPLACE ALIAS QTEMP.QAPMJOBOS_[julian]  FOR [Library].QAPMJOBOS  ([MemberName]);
CREATE OR REPLACE ALIAS QTEMP.QAPMDISK_[julian]   FOR [Library].QAPMDISK   ([MemberName]);
```
