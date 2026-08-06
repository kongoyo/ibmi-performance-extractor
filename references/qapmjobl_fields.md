# QAPMJOBS / QAPMJOBL 完整欄位對照（官方文件）

> **來源**：IBM 官方 Collection Services 文件 "Collection Services data files: QAPMJOBS and QAPMJOBL"（Last Updated: 2026-07-13）。`QAPMJOBL` 結合 `QAPMJOBMI` 與 `QAPMJOBOS` 的資料，每個 job/task/thread 每個 interval 一筆記錄，只有該 interval 內有消耗 CPU 的 job 才會有記錄。`QAPMJOBS` 是 `CVTPFRCOL` 轉換舊版資料時才會建立，Collection Services 本身不建立。
>
> **⚠️ 這是官方說明文字，不是實測結論**：跟 `JBPAGF` 曾經誤導過本專案一樣，「欄位存在、說明文字合理」不等於「這個欄位在本環境真的可用、單位/語意跟你以為的一樣」。任何要拿本表欄位寫進 SQL 查詢或改動現有計算邏輯的動作，都必須先照 [field_reference.md](field_reference.md) 開頭規定的流程實測驗證，才能更新 `field_manifest.json` / `field_reference.md`。本表本身只是查找起點。
>
> 已驗證、目前實際用在報表計算的 `QAPMJOBL` 欄位見 [field_reference.md](field_reference.md) 第四節。

## ✅ 重大驗證：JBPAGF 恆為 0 是官方認證的平台行為

`field_reference.md` 變更記錄（2026-08-06）記載，實測發現 `QAPMJOBL.JBPAGF` 在本環境所有資料恆為 0，是死欄位，已撤回先前誤用它的建議，改用 `JBTFLT`。本文件官方說明直接給出原因：

> `JBPAGF` — Number of PAG faults... **The Licensed Internal Code no longer uses process access groups for caching data. Because of this implementation, this field will always be 0 for more current releases.**

這代表 `JBPAGF` 恆為 0 **不是本環境（clark73/74/75）的特例，而是 IBM 平台級行為**——較新版次的 LIC 已不再使用 process access group 快取機制。這是對既有結論的獨立佐證，強化了「改用 `JBTFLT`」這個判斷的信心，不需要也不應該改動任何現有邏輯。

## ⚠️ JBRSP 單位交叉檢查：強化（而非解開）上次的懷疑

本文件明確記載 `QAPMJOBL.JBRSP`（注意：這是 **JOBL** 這張表，不是上次 [qapmisum_fields.md](qapmisum_fields.md) 討論的 QAPMISUM）：

> Total transaction time (**in seconds**.) PD (15,3)

這與 `field_reference.md` 對 `QAPMJOBOS.JBRSP`/`QAPMJOBL.JBRSP` 既有的「秒」描述一致。但這**不能**當作「所以 `QAPMISUM.JBRSP` 也該是秒」的佐證——官方文件對同名欄位 `JBRSP` 在 `QAPMISUM` 給的是毫秒、在 `QAPMJOBL` 給的是秒，兩張表要分開驗證，不能互相類推。詳見 [qapmisum_fields.md](qapmisum_fields.md) 的「JBRSP 的單位矛盾」追蹤項——該項目狀態不變，仍待實測。

---

## 完整欄位清單

| 欄位 | 說明 | 型別 |
| ---- | ---- | ---- |
| `INTNUM` | Interval number。 | PD (5,0) |
| `DTETIM` | Interval date/time（job interval entry 為取樣時間，job completion entry 為工作結束時間）。 | C (12) |
| `INTSEC` | Elapsed interval seconds。 | PD (7,0) |
| `JBSSYS` | Subsystem name。✅ 已用於 Top Job 查詢，見 `field_reference.md`。 | C (10) |
| `JBSLIB` | Subsystem description 所在 library。 | C (10) |
| `JBNAME` | Job name / workstation name。✅ 已用於 Top Job 查詢（需 `TRIM()`），見 `field_reference.md`。 | C (16) |
| `JBUSER` | Job user。✅ 已用於 Top Job 查詢，見 `field_reference.md`。 | C (10) |
| `JBNBR` | Job number。✅ 已用於 Top Job 查詢，見 `field_reference.md`。 | C (6) |
| `JBACCO` | Job accounting code（無法顯示）。 | C (15) |
| `JBTYPE` | Job type：`A`=Autostart, `B`=Batch, `I`=Interactive, `M`=Subsystem monitor, `R`=Spool reader, `S`=System, `V`=SLIC task, `W`=Spool writer, `X`=SCPF job。✅ 與 `field_reference.md` 實測發現的 `I`/`B`/`S`/`V`/`M`/`W`/`A`/`X` 幾乎完全對得上（官方多列了 `R`=Spool reader），驗證了「不能只加總 `JBTYPE='B'`，須用 `Tot-Int` 反推 Batch」的既有判斷。 | C (1) |
| `JBSTYP` | Job subtype：`T`=MRT(S/36), `E`=Evoke, `P`=Print driver, `J`=Prestart, `F`=M36, `D`=Batch immediate, `U`=Alternative spool user。 | C (1) |
| `JBTTYP` | Task type：`01`=Resident, `02`=Supervisor, `03`=MI process, `04`=S36 emulation。 | C (2) |
| `JBTTYE` | Task type extender（見官方文件 task type extender definitions）。 | C (2) |
| `JBFLAG` | Job flag bitmask（pass-through/emulation/IBM i Access/DDM/MRT，無法顯示）。 | C (2) |
| `JBS36E` | 是否運行於 System/36 環境（Y/N）。 | C (1) |
| `JBPOOL` | Job pool。 | C (2) |
| `JBPRTY` | Job priority。 | C (3) |
| `JBCPU` | Thread unscaled interval CPU time charged（**毫秒**）；含此 thread 使用及代其工作的 server task 時間；server task 本身恆為 0。✅ 與 `field_reference.md` 既有認知（毫秒）一致，用於 `Int`/`Bch` 計算，見第二節 2b。 | PD (15,3) |
| `JBRSP` | Total transaction time（**秒**）；不同 job 類型「交易」定義不同，互動 job 為 5250 顯示 I/O 交易。✅ 與 `field_reference.md` 既有認知（秒）一致；⚠️ 見上方「JBRSP 單位交叉檢查」，不可類推到 `QAPMISUM.JBRSP`。 | PD (15,3) |
| `JBSLC` | Time-slice value（毫秒）。 | PD (11,0) |
| `JBNTR` | Number of transactions（定義同 `JBRSP`）。✅ 已用於 Top Job 查詢，見 `field_reference.md`。 | PD (11,0) |
| `JBDBR` | Synchronous database reads（實體同步 DB 讀取）。✅ 已用於 Top Job 查詢（`DB_PHYS_READS`），見 `field_reference.md`；官方強調「synchronous」，比既有「Physical database reads」描述更精確一點，語意不衝突。 | PD (11,0) |
| `JBNDB` | Synchronous nondatabase reads。✅ 已用於 Top Job 查詢，見 `field_reference.md`。 | PD (11,0) |
| `JBWRT` | Total physical writes（DB + non-DB）。✅ 已用於 Top Job 查詢，見 `field_reference.md`。 | PD (11,0) |
| `JBAW`/`JBWI`/`JBAI` | active→wait / wait→ineligible / active→ineligible 狀態轉換次數。 | PD (11,0) |
| `JBPLN`/`JBPPG`/`JBPFL` | Print lines / pages / files 數（不反映實際列印結果）。 | PD (11,0) |
| `JBLWT` | Logical database writes（不含 reader/writer I/O、`CPYSPLF`/`DSPSPLF`）。 | PD (11,0) |
| `JBLRD` | Logical database reads（同上排除範圍）。✅ 已用於 Top Job 查詢（`LOGICAL_READS`），見 `field_reference.md`。 | PD (11,0) |
| `JBDBU` | Miscellaneous logical database operations（update/delete/force-end-of-data/commit/rollback/release）。 | PD (11,0) |
| `JBCPT`/`JBCGT` | Communications writes/reads（僅 ICF device，不含 remote workstation）。 | PD (11,0) |
| `JBSPD` | Total suspended time（毫秒）。 | PD (11,0) |
| `JBRRT` | Total reroute wait time（毫秒）。 | PD (11,0) |
| `JBLND`/`JBCUD` | Line description / Controller description（僅 remote workstation）。 | C (10) |
| `JB2LND`/`JB2CUD` | Secondary line/controller description（僅 pass-through/emulation）。 | C (10) |
| `JBBRG`/`JBPRG` | Reserved。 | PD (9,0) |
| `JBNDW`/`JBDBW` | Synchronous nondatabase/database writes。 | PD (11,0) |
| `JBANDW`/`JBADBW` | Asynchronous nondatabase/database writes。✅ `JBADBW` 已用於 Top Job 查詢（`ASYNC_DB_READS` 的寫入對應），見 `field_reference.md`。 | PD (11,0) |
| `JBANDR`/`JBADBR` | Asynchronous nondatabase/database reads。✅ `JBADBR` 已用於 Top Job 查詢（MIMIX 非同步預讀診斷），見 `field_reference.md`。 | PD (11,0) |
| `JBPW` | Synchronous permanent writes。 | PD (11,0) |
| `JBCS` | Reserved。 | PD (11,0) |
| `JBPAGF` | Number of PAG faults。⚠️ **官方文件明確標示：因 LIC 不再使用 process access group 快取，較新版次此欄位恆為 0**。✅ 完全對應 `field_reference.md` 的實測結論（死欄位），見上方「重大驗證」。 | PD (11,0) |
| `JBEAO` | Reserved。 | PD (11,0) |
| `JBOBIN`/`JBODEC`/`JBOFLP` | Binary/Decimal/Floating point overflow 次數。 | PD (11,0) |
| `JBIPF` | I/O pending faults（page fault 發生在正在進行輔助儲存體 I/O 的位址上）。 | PD (11,0) |
| `JBWIO` | 明確等待非同步 I/O 完成的次數。 | PD (11,0) |
| `JBIRN`/`JBDRN` | IOP / Device resource name。 | C (10) |
| `JIOPB`/`JIOPA` | Reserved。 | PD (3,0) |
| `JBPORT`/`JBSTN` | Workstation port number / station number。 | PD (3,0) |
| `JBPTSF`/`JBPTTF`/`JBEAF`/`JBPCSF`/`JBDDMF`/`JBMRTF` | Pass-through source/target、Emulation active、IBM i Access、Target DDM、MRT 旗標。 | PD (1,0) |
| `JBROUT` | 該 job 所在 subsystem 的 routing entry index。 | PD (5,0) |
| `JBAPT`/`JBNSW`/`JBSST`/`JBQT2`/`JBCDR`/`JBCDS` | Reserved。 | PD (11,0) |
| `JBAIQT`/`JBNAIQ` | 應用程式輸入排隊總時間（1/100 秒）/ 交易數。 | PD (15,1) / PD (11,0) |
| `JBRUT`/`JBNRU` | Resource usage 總時間（秒）/ 交易數。 | PD (15,3) / PD (11,0) |
| `JBQT`/`JBMMT`/`JBNEQT` | MRT 排隊時間（1/100 秒）/ MRTMAX 停留時間（秒）/ 進入 MRT 次數。 | PD (11,0) |
| `JBPUTN`/`JBPUTA`/`JBGETN`/`JBGETA` | ACPUT/ACGET 呼叫次數與資料量。 | PD (11,0) |
| `JBPGIN`/`JBPGIL`/`JBGGIL` | Put chain / Get chain 相關 interval 次數與時間（毫秒）。 | PD (11,0) |
| `JBRTI`/`JBRRI` | REQIO 傳送/接收次數。 | PD (11,0) |
| `JBSZWT` | Total seize wait time（毫秒）。✅ 已用於資源鎖定競爭指標，見 `field_reference.md`（`JBSZWT` 說明一致）。 | PD (15,3) |
| `JBSKSC`/`JBSKBS`/`JBSKRC`/`JBSKBR` | Socket sends/bytes sent/receives/bytes received。 | PD (11,0) |
| `JBXRFR`/`JBXRFW` | Stream file reads/writes。 | PD (11,0) |
| `JBXSLR`/`JBXDYR` | File system symbolic link reads / directory reads。 | PD (11,0) |
| `JBDLCH`/`JBDLCM` | File system directory lookup cache hits/misses。 | PD (11,0) |
| `JBSJNM`/`JBSJUS`/`JBSJNB`/`JBSJFG` | Submitter's job name/user/number/flag（僅本機提交工作）。 | C 各異 |
| `JBRSYS`/`JBDEVN`/`JBRLNM`/`JBLLNM`/`JBMODE`/`JBRMNT`/`JBINSX`/`JBBUP`/`JBBDL`/`JBBFE` | Reserved。 | 各異 |
| `JBBCO`/`JBBRO` | Database commit / rollback operations。✅ 已用於 QAPMJOBOS 查詢範本，見 `field_reference.md`。 | PD (11,0) |
| `JBLBO` | SQL cursors full opened（累計）。 | PD (11,0) |
| `JBLBC`/`JBLBI` | Reserved。 | PD (11,0) |
| `JBLBS` | SQL cursors pseudo-opened（reused，累計）。 | PD (11,0) |
| `JBDQS`/`JBDQR`/`JBNDA` | Reserved。 | PD (11,0) |
| `JBNUS` | Full opens（native + SQL cursor；`JBNUS - JBLBO` = 非 SQL full opens）。 | PD (11,0) |
| `JBSIT1`~`JBSIT3` | Reserved。 | PD (11,0) |
| `JBTCPU` | Job unscaled interval CPU time charged（毫秒，全部 thread 加總）；⚠️ 官方註記：可能不等於所有 thread `JBCPU` 加總（時間差異），僅 primary thread 提供。 | PD (15,3) |
| `JBTHDF` | Secondary thread flag（0=task/primary thread, 1=secondary thread）。 | PD (1,0) |
| `JBTHID` | Thread identifier（4-byte 十六進位字串，task 或舊版資料為空白）。 | C (8) |
| `JBTHAC`/`JBTHCT` | Active threads（含 primary）/ Threads created（含已終止）。 | PD (11,0) |
| `JBMTXT` | Mutex wait time（毫秒，累計）。 | PD (15,3) |
| `JBIBM1` | Reserved。 | PD (11,0) |
| `JBSTSF` | Status flag：0=正常收集, 1=該 interval 內啟動, 2=該 interval 內結束, 3=啟動且結束；reroute/transfer 會產生一筆結束記錄(2)+一筆新記錄(1)。 | PD (1,0) |
| `JBSVIF` | Server interactive flag（'1'=該功能消耗的資源計入系統 interactive 容量）。 | C (1) |
| `JBTFLT` | Total page faults。✅ **這才是 Top Job 分頁缺失排行該用的欄位**，見 `field_reference.md`。 | PD (11,0) |
| `JBEDBC`/`JBTDBC` | Reserved。 | P (15,3) |
| `JBSVRT` | Server type（空白=非 server 工作）。 | C (30) |
| `JBCOP`/`JBCOS` | Primary/Secondary commit operations（secondary 含系統參照完整性 commit）。 | PD (11,0) |
| `JBDOP`/`JBDOS` | Primary/Secondary decommit operations。 | PD (11,0) |
| `JBPJE` | Physical journal write operations to disk。 | PD (11,0) |
| `JBNSJE` | 非 SMAPP 相關的 journal entries 數。 | PD (11,0) |
| `JBUJD`/`JBSJD` | SMAPP-induced journal entries（存入 user/system journal）。 | PD (11,0) |
| `JBBFW`/`JBBFA` | Journal bytes written to disk / deposited in permanent area（含 cache 中尚未寫盤者）。 | PD (15,0) |
| `JBBTW`/`JBBTA` | Journal receiver transient area bytes written to disk / generated（僅 `*RmvIntEnt` 設定時使用）。 | PD (15,0) |
| `JBTWT`/`JBTNW` | 等待 journal bundle 寫盤的時間（毫秒）/ 次數。 | PD (11,0) |
| `JBXRRR`/`JBXRRW` | Random stream file read/write operations（Root/QOpenSys/QDLS/QOPT/user-defined file systems）。 | PD (11,0) |
| `JBXRFS` | fsync operations 數。 | PD (11,0) |
| `JBXRBR`/`JBXRBW` | Stream file bytes read/written。 | PD (15,0) |
| `JBFSH`/`JBASH`/`JBFSHA`/`JBASHA` | Full/Abbreviated SSL handshakes（server-only / server+client authentication）。 | PD (11,0) |
| `JBPGA`/`JBPGD` | 該 thread 啟動以來配置/解除配置的 4096-byte 單位暫存+永久儲存體數。 | P (11,0) |
| `JBCUSR` | 取樣當下該 job 運行使用的 user profile。 | C (10) |
| `JBFSOPN`/`JBFSDC`/`JBFSNDC`/`JBFSDD`/`JBFSNDD` | File system opens / directory creates / non-directory creates / directory deletes / non-directory deletes（Root/QOpenSys/user-defined）。 | PD (11,0) |
| `JBACPU` | Accumulated job unscaled CPU time charged（毫秒，自 job 啟動以來累計）；僅 primary thread 提供。 | PD (15,3) |
| `JBIPAF` | Remote IP address family flag（X'00'=未設定, X'02'=IPv4, X'18'=IPv6）。 | C (1) |
| `JBIPAD` | Remote IP address 二進位形式（IPv4 4 bytes / IPv6 16 bytes）。 | C (16) |
| `JBIPPT` | Remote port number。 | Z (5,0) |
| `JBUAUF` | Reserved。 | C (1) |
| `JBPGRQ`/`JBPGRL` | Page frames requested / released。 | B (9,0) |
| `JBMSLR`/`JBMDYR`/`JBMLCH`/`JBMLCM`/`JBMOPN`/`JBMNDC`/`JBMNDD` | File system symbolic link reads / directory reads / lookup cache hits/misses / opens / non-directory creates/deletes（Root/QOpenSys/user-defined；與 `JBXSLR` 等欄位類似但為不同計數口徑）。 | B (9,0) |
| `JBSCPU` | Thread scaled interval CPU time charged（**微秒**）；`JBSCPU/JBCPU` 比值反映當前處理器相對額定速度；server task 恆為 0。 | B (18,0) |
| `JBSTCPU` | Job scaled interval CPU time charged（微秒，全部 thread 加總）；僅 primary thread 提供，可能不等於所有 thread `JBSCPU` 加總。 | B (18,0) |
| `JBSQLCPU` | Thread unscaled SQL CPU time used（微秒）。 | B (18,0) |
