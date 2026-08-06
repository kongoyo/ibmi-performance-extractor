# IBM i Collection Services 欄位對照與 SQL 公式參考手冊

> **維護規範**：當使用者回報計算錯誤或欄位缺失問題、完成除錯後，**必須立即更新本文件**，記錄正確欄位名稱、公式修正說明與修正日期。
>
> **查證規範（2026-08-06 起）**：每一條修正記錄都必須附上**查證方式**——是對哪個 host/library/member 實測、跑了什麼 SQL、看到什麼實際結果，不能只憑欄位名稱、`COLUMN_TEXT` 說明文字或直覺判斷就下修正結論。原因：本文件曾經真的犯過這個錯——`JBPAGF` 這個欄位名稱、型別、說明文字（"PAG faults"）看起來完全正確，過去因此被記錄為「正確欄位」，但實測真實資料後發現它恆為 0，是死欄位；`Dsk` 的捨入方式（`ROUND` vs `CEILING`）也是先憑直覺寫、後來拿綠屏截圖核對才發現用錯函式。「欄位存在」「型別正確」「說明文字合理」都不等於「這個欄位在這個環境真的可用」，任何修正建議在被別人或未來的自己信任之前，都必須有實測證據。

---

## 變更記錄

| 日期 | 欄位 / 公式 | 問題描述 | 修正內容 |
|------|------------|---------|---------|
| 2026-08-06 | `QAPMISUM.Dsk` | 原寫死為常數 `1 AS "Dsk"`，完全無效 | 改為 JOIN `QAPMDISK`，用 `DSNBSY/DSSMPL` 計算各 ARM 使用率後取最大值 |
| 2026-08-06 | `QAPMJOBL.JBPAGF` | 錯誤使用 `JBPFL`（該欄位 = Files to be printed）| 正確欄位為 `JBPAGF`（PAG faults） |
| 2026-08-06 | `QAPMJOBL.JBLRD` | 錯誤使用 `JBLGR`（欄位不存在）| 正確欄位為 `JBLRD`（Logical database reads） |
| 2026-08-06 | `generate_report.py` cardId | `Dsk` → `dsk`，找不到 `chart-dsk` DOM 元素 | 新增 `mk === 'dsk' ? 'disk'` 顯式映射 |
| 2026-08-06 | `QAPMSYSTEM` JOIN 別名 | 原寫為 `V_QAPMSYSTEM_TARGET`（前綴 V_ 錯誤）| 正確別名為 `QAPMSYSTEM_TARGET` |
| 2026-08-06 | **本行撤回上面「`JBPAGF` 為正確欄位」的結論** | 針對 `KTB` library 實測驗證（`QSYS2.SYSCOLUMNS` 確認欄位存在、並對真實 `QAPMJOBL` 資料取樣比對）：`JBPAGF` 型別與欄位名稱都正確，**但在本環境中所有 Job/Interval 的值恆為 0**，是無法使用的死欄位；`JBTFLT`（QAPMJOBL 版本，非 QAPMISUM 版本，欄位說明為 "Total page faults"）反而有真實非零資料（實測樣本最高達 235,395）。`scripts/test_pipeline.js` 目前的 Top Job 分頁缺失排行**本來就用 `JBTFLT`（正確）**，本表過去建議改用 `JBPAGF` 的說法是錯的，不要照做。教訓：欄位「存在」不代表「有意義」，任何修正建議都必須對真實資料實測驗證，不能只憑欄位名稱與說明文字判斷。 | 撤回，維持使用 `JBTFLT` |
| 2026-08-06 | `QAPMISUM.Int` / `QAPMISUM.Bch` | 原分別寫死為常數 `0 AS "Int"` 與 `Tot` 公式的複製品（`Bch` 從未真正代表批次 CPU）| 實測 `QAPMSYSTEM` 全部欄位（約 90 個）**沒有任何互動／批次 CPU 拆分欄位**。改為：`Int` = `SUM(QAPMJOBL.JBCPU WHERE JBTYPE='I') / SYSCTA * 100`（由下而上獨立量測，且必須拆成獨立查詢執行，見第二節 2b 的效能陷阱）；`Bch` = `Tot - Int`（用減法反推，確保恆等於 `Tot`，符合 `DSPPFRDTA` 慣例的「Total = Interactive + Batch」）。實測 `JBTYPE` 除 `I`/`B` 外還有 `V`/`S`/`M`/`W`/`A`/`X` 等值，用減法反推可避免漏掉這些非 `B` 但仍屬非互動的類型。已用兩份綠屏截圖（07/13 00:15~05:00 全 0、07/13 07:45~10:00 有真實非零值）共 20 個 interval 逐筆核對，全部吻合，並收錄進 `validate_metrics.js` Test Area 5。詳見下方「CPU 使用率計算公式」。 |
| 2026-08-06 | `QAPMDISK` High Disk 捨入方式 | 原用 `INTEGER(...)` 對百分比**無條件捨去**（truncate），與綠屏系統性地少 1（實測 20/20 樣本全部少 1，例如原始值 7.28% 綠屏顯示 8、9.17% 顯示 10）| 改用 `CEILING(...)`（無條件進位），不是 `ROUND`（四捨五入在 7.28%→7、9.17%→9 兩個樣本仍會算錯，證實不是單純捨入方式問題，而是 DSPPFRDTA 本身對磁碟使用率一律無條件進位）。已用兩份綠屏截圖（07/13 07:45~10:00、07/15 05:15~07:30）共 20 個 interval 核對，全部吻合，並收錄進 `validate_metrics.js` Test Area 6。 |
| 2026-08-06 | Schema 跨版本驗證（非修正，記錄一次完整比對）| 使用者新增 `clark74`（IBM i 7.4）主機，連同既有 `clark75` 的 `KTB`（7.3）、`QPFRDATA`（7.5），三個環境比對本文件用到的 26 個欄位 | 26 個欄位在三個環境（7.3/7.4/7.5）**名稱、型別、長度完全一致**，零差異。唯一差異：`QAPMISUM` 總欄位數 7.4/7.5 是 153、7.3 是 152（多的那 1 欄不是本文件用到的）。記錄於 `field_manifest.json` 的 `_schemaVerifiedEnvironments`。另外意外重現了 `QPFRDATA.QAPMJOBL` 的 `SYSPARTITIONSTAT` 目錄失準問題（見 `memory/field-mapping-hardening-plan.md`）——這次在 clark74 這台不同的物理主機上一樣重現，代表這不是單一主機的巧合，較可能是 `QPFRDATA`（系統預設收集庫）這個層級的普遍特性。 |
| 2026-08-06 | `QAPMISUM.JBRSP` 單位描述（文件錯誤，公式與程式碼皆正確）| 本文件原寫「`JBRSP` 已是秒，`/(JBNTR*1000.0)` 得毫秒」，經 IBM 官方文件（`references/qapmisum_fields.md`）比對發現與此矛盾（官方標示 `JBRSP` 是毫秒）。連線 clark75 `KTB.QAPMISUM`（member `Q197000038`，2026/07/16）撈取 INTNUM 1~10 的原始 `JBRSP`/`JBNTR`，並取得使用者提供的 `DSPPFRDTA` 選取時間間隔畫面（同一 member，含 `Rsp` 欄位 `.31`/`.06`/`.14`/`.02`/`.06`/`.00`/`.02`/`.10`/`.19`/`.06`）逐筆核對：`JBRSP/(JBNTR*1000.0)`（無條件捨去至小數點後兩位）與綠屏 `Rsp` 欄位 10/10 完全吻合（例如 INTNUM=1：`215183/(683*1000)=0.315`→截斷 `0.31`，螢幕顯示 `.31`）。 | 證實 `JBRSP` 原始值確實是**毫秒**（官方文件正確，本文件原「已是秒」的敘述錯誤），但**公式本身沒有 bug**——`JBRSP/(JBNTR*1000.0)` 算出來的結果單位是**秒**，不是文件原寫的「毫秒」；`generate_report.py` 也早已正確把 `Rsp` 這個 metric 標記為「秒」（第 223/273/280/802 行），不是 `ms`，程式碼沒有需要修正的地方。已修正下方「關鍵欄位」表格對 `JBRSP` 的單位描述與公式說明文字。 |

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
| `JBRSP` | 本區間總回應時間，原始值為**毫秒**（2026-08-06 綠屏截圖逐筆驗證，見上方變更記錄）| DECIMAL | 平均回應 = `JBRSP / (JBNTR * 1000.0)`，結果單位為**秒**（對應 `DSPPFRDTA` 的 `Rsp` 欄位，`generate_report.py` 也標記為「秒」，非毫秒） |
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

### 2b. Interactive / Batch CPU 拆分（`Int` / `Bch`）

`QAPMSYSTEM` **沒有**現成的互動／批次 CPU 拆分欄位（2026-08-06 已實測全表約 90 個欄位確認，見上方變更記錄）。必須改由 `QAPMJOBL` 由下而上獨立量測 Interactive，再用減法反推 Batch。

> **⚠️ 效能陷阱**：一開始把 Interactive CPU 的聚合寫成 `LEFT JOIN (SELECT INTNUM, SUM(JBCPU)... GROUP BY INTNUM)` 直接併進 Interval Summary 主查詢裡，在資料量較大的日期（如 07/13，`QAPMJOBL` 該日 member 有 143 萬筆）觸發 30 秒查詢逾時；但這條聚合單獨執行只要 2～3 秒。**必須拆成兩條獨立查詢**，不要合併進同一個 SQL 陳述式：

```sql
-- ✅ 查詢 1：獨立執行，聚合每個 Interval 的 Interactive CPU（毫秒）
SELECT INTNUM, SUM(JBCPU) AS INT_CPU_MS
FROM [ALIAS_QAPMJOBL]
WHERE TRIM(JBTYPE) = 'I'
GROUP BY INTNUM
```

```sql
-- ✅ 查詢 2：Interval Summary 主查詢維持原樣，只多選出 SYSCTA
CASE WHEN s.SYSCTA > 0 THEN CAST((s.SYSPTU / (s.SYSCTA * 1.0)) * 100.0 AS INTEGER) ELSE 0 END AS "Tot",
s.SYSCTA AS "SysCta",
...
```

`Int`/`Bch` 的百分比改在應用端（JavaScript）用查詢 1 的結果計算，除以與 `Tot` 相同的分母 `SYSCTA`：

```javascript
const intPct = sysCta > 0 ? Math.trunc((intCpuMs / sysCta) * 100.0) : 0;
const bchPct = Math.max(0, totPct - intPct); // 用 Tot 減 Int 反推，確保恆等於 Tot
```

> **為什麼用減法反推 Batch，而不是直接 `SUM(JBCPU) WHERE JBTYPE='B'`？** 實測 `JBTYPE` 除 `I`/`B` 外還有 `V`（約占大宗）、`S`、`M`、`W`、`A`、`X` 等值（各代表不同 Job 子類型，如系統、MRT、Writer 等）。只加總 `JBTYPE='B'` 會漏掉這些非互動但也非傳統 Batch 的類型，導致 `Int + Bch ≠ Tot`。用 `Tot - Int` 反推可確保兩者恆等於已驗證正確的 `Tot`，符合 `DSPPFRDTA` 綠屏「Total = Interactive + Batch」的顯示慣例。

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
-- ⚠️ 務必用 CEILING，不是 INTEGER（truncate）也不是 ROUND！
COALESCE((
  SELECT MAX(
    CASE WHEN d.DSSMPL > 0
         THEN CAST(CEILING((1.0 - d.DSNBSY * 1.0 / d.DSSMPL) * 100) AS INTEGER)
         ELSE 0
    END
  )
  FROM QTEMP.QAPMDISK_TARGET d
  WHERE d.INTNUM = m.INTNUM
), 0) AS "Dsk"
```

> **⚠️ 捨入方式實測結論（2026-08-06）**：`DSPPFRDTA` 綠屏對磁碟使用率一律**無條件進位**，不是四捨五入、更不是截斷。實測樣本：原始值 `5.98%` 綠屏顯示 `6`（截斷/四捨五入都對）；但 `7.28%` 綠屏顯示 `8`（截斷給 `7`✗，四捨五入給 `7`✗，只有 `CEILING` 給 `8`✓）；`9.17%` 綠屏顯示 `10`（同樣只有 `CEILING` 正確）。用 20 個 interval（橫跨兩個不同 member）核對過，`CEILING` 全部吻合，收錄於 `validate_metrics.js` Test Area 6。
>
> **注意**：即使 I/O 次數很高（如 MIMIX CMPFILDTA 單 Interval 8,700 萬次），ARM Utilization 也可能偏低（僅 4–12%），因為 SAN 控制器的 `DSDCFW` 大量吸收了 I/O，使實體 ARM 未真正飽和。

---

## 四、QAPMJOBL（Job Loop File）

**用途**：每個 Job / Thread 每個區間一筆記錄，用於 Top 10 Job 排行（CPU、I/O、分頁缺失等）。

### 關鍵欄位對照表

| 欄位 | 說明 | ⚠️ 常見錯誤 |
|------|------|-----------|
| `JBTFLT` | Total page faults（每 Job/Thread 每 Interval 的分頁缺失總數）| ✅ **這才是 Top Job 分頁缺失排行該用的欄位** |
| `JBPAGF` | PAG faults | ❌ **2026-08-06 實測：本環境所有資料恆為 0，是死欄位，不要用**（欄位確實存在、型別正確，但沒有被填值；之前文件曾誤導改用此欄位，已撤回，見上方變更記錄） |
| `JBCPU` | Thread unscaled CPU 毫秒數 | 亦用於 `Int`/`Bch` 計算，見第二節 2b |
| `JBWRT` | Physical writes | — |
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
| `JBTYPE` | Job type | ⚠️ 實測本環境除 `I`=Interactive、`B`=Batch、`S`=System 外，還有 `V`（大宗）、`M`、`W`、`A`、`X` 等值；計算 Batch CPU 時不要只加總 `JBTYPE='B'`，會漏掉這些類型（見第二節 2b） |
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
  s.SYSCTA                                                           AS "SysCta",
  0                                                                  AS "Util",
  COALESCE((
    SELECT MAX(
      CASE WHEN d.DSSMPL > 0
           THEN CAST(CEILING((1.0 - d.DSNBSY * 1.0 / d.DSSMPL) * 100) AS INTEGER)
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

`"Int"`/`"Bch"` **不在這條查詢裡計算**——`SysCta` 只是原樣選出來，交給應用端配合第 2b 節的獨立 Interactive CPU 查詢結果做除法。原因與寫法見第二節 2b（效能陷阱：合併進本查詢在大資料量的日期會逾時）。

---

## 九、QTEMP 別名建立順序

**批次報表產出**（`test_pipeline.js`，每個成員/日期查詢前）只需要四個別名：

```sql
CREATE OR REPLACE ALIAS QTEMP.QAPMISUM_[julian]   FOR [Library].QAPMISUM   ([MemberName]);
CREATE OR REPLACE ALIAS QTEMP.QAPMSYSTEM_[julian] FOR [Library].QAPMSYSTEM ([MemberName]);
CREATE OR REPLACE ALIAS QTEMP.QAPMJOBL_[julian]   FOR [Library].QAPMJOBL   ([MemberName]);
CREATE OR REPLACE ALIAS QTEMP.QAPMDISK_[julian]   FOR [Library].QAPMDISK   ([MemberName]);
```

`QAPMJOBOS` 不在這組裡——它只用於第九節「RCA 根因診斷」，由 agent 針對使用者指定的特定 Interval 隨選建立（範圍窄，單一 member 即可），不屬於批次流程：

```sql
CREATE OR REPLACE ALIAS QTEMP.QAPMJOBOS_[julian]  FOR [Library].QAPMJOBOS  ([MemberName]);
```
