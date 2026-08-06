# QAPMSYSTEM 完整欄位對照（官方文件）

> **來源**：IBM 官方 Collection Services 文件 "Collection Services data files: QAPMSYSTEM"（Last Updated: 2026-07-13）。
>
> **⚠️ 這是官方說明文字，不是實測結論**：跟 `JBPAGF` 曾經誤導過本專案一樣，「欄位存在、說明文字合理」不等於「這個欄位在本環境真的可用、語意跟你以為的一樣」。任何要拿本表欄位寫進 SQL 查詢或改動現有計算邏輯的動作，都必須先照 [field_reference.md](field_reference.md) 開頭規定的流程實測驗證（`checkSchema` 確認存在 + 對真實資料取樣核對綠屏），才能更新 `field_manifest.json` / `field_reference.md`。本表本身只是查找起點。
>
> 已驗證、目前實際用在報表計算的 `QAPMSYSTEM` 欄位（`INTNUM`/`SYSPTU`/`SYSCTA`）見 [field_reference.md](field_reference.md) 第二節。

## ⚠️ 待驗證追蹤項：SYIFUS / SYIFTE / SYIFTA 與現有 Int/Bch 計算的矛盾

`field_reference.md` 變更記錄（2026-08-06）記載：實測 `QAPMSYSTEM` 全部欄位（約 90 個）後認定「沒有任何互動／批次 CPU 拆分欄位」，因此改用 `QAPMJOBL.JBCPU`（`JBTYPE='I'`）由下而上量測 Interactive、再用 `Tot - Int` 反推 Batch。

但本表下方列出的官方欄位說明中有：
- `SYIFUS` — Interactive CPU time used（Total interactive CPU used, milliseconds）
- `SYIFTE` — Interactive CPU time used over threshold
- `SYIFTA` — Interactive CPU time available（interactive capacity/threshold）

這三個欄位名稱與說明**看起來就是「現成的 Interactive CPU 拆分欄位」**，與「90 個欄位裡沒有」的既有結論字面上矛盾。**尚未實測驗證**，原因可能是：
1. 這幾個欄位在當時的「約 90 個欄位」實測範圍內被忽略或誤判（例如恆為 0 而被歸類為無用，未特別記錄欄位名）；或
2. `SYIFUS`/`SYIFTA` 語意其實是「Interactive 效能門檻（threshold）監控」相關指標，不等同 `DSPPFRDTA` 綠屏顯示的「Interactive CPU %」概念（字面像但語意不同），需要實測分辨。

**在未實測前，不要**依此改動 `field_reference.md` 第二節 2b 現行的 `QAPMJOBL` 反推法——那套方法已用兩份綠屏截圖、20 個 interval 核對過，是目前唯一被驗證正確的做法。若未來要驗證 `SYIFUS` 是否可用，步驟建議：對同一批已核對過的 interval，比較 `SYIFUS` 算出的百分比與綠屏、以及與現行 `JBTYPE='I'` 方法算出的百分比是否一致。

---

## 完整欄位清單

| 欄位 | 說明 | 型別 |
| ---- | ---- | ---- |
| `INTNUM` | Interval number：依 `CRTPFRDTA` 指令指定的起始時間計算出的第 n 個取樣間隔。 | PD (5,0) |
| `DTETIM` | Interval date (yymmdd) and time (hhmmss)，以本機系統時間表示。 | C (12) |
| `INTSEC` | Elapsed interval seconds：自上次取樣間隔以來的秒數。 | PD (7,0) |
| `DTECEN` | Century digit。 | C (1) |
| `SYDPGF` | Directory page faults：輔助儲存體目錄頁面因查詢或配置而傳輸至主儲存體的次數。 | PD (11,0) |
| `SYAPGF` | Access group member page faults。 | PD (11,0) |
| `SYMPGF` | Microcode page faults：微碼頁面傳輸至主儲存體的次數。 | PD (11,0) |
| `SYMCTR` | Microtask read operations。 | PD (11,0) |
| `SYMCTW` | Microtask write operations。 | PD (11,0) |
| `SYSASP` | System ASP space available（bytes）。 | PD (15,0) |
| `SYPRMW` | Permanent data transferred from main storage（512-byte blocks）。 | PD (11,0) |
| `SYSIZC` | Size exception count。 | PD (11,0) |
| `SYDECD` | Decimal data exception count。 | PD (11,0) |
| `SYSEZC` | Seize wait exception count。 | PD (11,0) |
| `SYSZWT` | Seize/wait time（ms）。 | PD (11,0) |
| `SYSYNL` | Synchronous lock conflict count。 | PD (11,0) |
| `SYASYL` | Asynchronous lock conflict count。 | PD (11,0) |
| `SYVFYC` | Verify count。 | PD (11,0) |
| `SYAUTH` | Object authority checks。 | PD (11,0) |
| `SYEXPN` | Total number of exceptions。 | PD (11,0) |
| `SYLRT1`~`SYLRT5` | 本機工作站回應時間監控 5 個級距（boundary 1~5）的交易數。 | PD (9,0) |
| `SHCPU` | 微碼／系統作業使用的總處理單元時間（ms）。 | PD (11,0) |
| `SMPLP` | Machine pool paging。 | PD (11,0) |
| `SMUPL` | Highest user pool paging。 | PD (11,0) |
| `SUPLI` | Pool with highest paging（pool 編號）。 | C (2) |
| `SMXDU` | Maximum disk utilization（所有單一/多路徑磁碟中最大值）。 | PD (11,0) |
| `SMXDUI` | Actuator with maximum utilization。 | C (4) |
| `SMMMT` | Time at MRTMAX by all MRT requests（秒）。 | PD (11,0) |
| `SMME` | Number of requesters routed to an MRT。 | PD (11,0) |
| `SYFOPN` | Number of full opens system wide。 | PD (11,0) |
| `SYIXRB` | Number of data space index creates system wide。 | PD (11,0) |
| `SYJOXR`/`SYJOXP` | Start/Stop journal operations initiated by user。 | PD (11,0) |
| `SYJOIR`/`SYJOIP` | Start/Stop journal operations initiated by system。 | PD (11,0) |
| `SYJOXD` | Journal deposits from user-journaled objects。 | PD (11,0) |
| `SYJOID` | Journal deposits from system-journaled objects。 | PD (11,0) |
| `SYJOJP` | Journal deposits from system-journaled objects to user-created journals。 | PD (11,0) |
| `SYJOBJ` | Bundle writes to user-created journals。 | PD (11,0) |
| `SYJOBD` | Bundle writes to internal system journals。 | PD (11,0) |
| `SYJOJY`/`SYJOJN` | Exposed access paths currently being/not being journaled by system。 | PD (11,0) |
| `SYJOSE` | System-estimated access path recovery time exposure（ms）。 | PD (11,0) |
| `SYJORT` | System-managed access path tuning adjustments。 | PD (11,0) |
| `SYJOND` | 若系統未 journal access path 時的估計曝險時間（ms）。 | PD (11,0) |
| `SYHEAO` | Teraspace 16MB boundary crossing count（EAO exceptions）。 | PD (11,0) |
| `SYHFTS` | Non-teraspace false traps count。 | PD (11,0) |
| `SYHFTH` | Teraspace false traps count。 | PD (11,0) |
| `SYSDBC` | Reserved。 | PD (9,0) |
| `SYSSWC` | Secondary workload CPU time（ms）；僅 Domino 伺服器有意義，非 Domino 伺服器恆為 0。 | PD (9,0) |
| `SYJOER` | SMAPP evaluations requested count。 | PD (11,0) |
| `SYJOES` | SMAPP evaluations serviced count。 | PD (11,0) |
| `SYJOIB` | SMAPP index build time estimations count。 | PD (11,0) |
| `SYJOS1`/`SYJOC1` | 造成 journal cache 提前清空最頻繁的 journal entry type / 對應 bundle 數。 | C (2) / PD (15,0) |
| `SYJOS2`/`SYJOC2` | 同上，第二頻繁。 | C (2) / PD (15,0) |
| `SYJOS3`/`SYJOC3` | 同上，第三頻繁。 | C (2) / PD (15,0) |
| `SYSDNFE` | 已寫入但尚未 force 至永久儲存體的 stream files 數。 | PD (11,0) |
| `SYSDNFO` | 曝險時間超過目標值的 stream files 數。 | PD (11,0) |
| `SYSDTET` | Stream file 曝險總時間（ms）。 | PD (15,0) |
| `SYSDNST` | 正在強制 stream files 寫入永久儲存體的 task 數。 | PD (5,0) |
| `SYSDFAL` | 已曝險且需要 force 的 stream files 數。 | PD (11,0) |
| `SYSDFRL` | 已非同步 force 至永久儲存體的 stream files 總數。 | PD (11,0) |
| `SYSDPFD` | 已非同步 force 的 stream file pages 數（不含 fsync）。 | PD (15,0) |
| `SYSDPFF` | fsync 造成的 stream file pages force 數。 | PD (15,0) |
| `SYBTAC` | Asynchronous clear operations 數。 | PD (11,0) |
| `SYBTAP` | Asynchronous prebring operations 數。 | PD (11,0) |
| `SYBTAPP` | Parallel prebring operations 數。 | PD (11,0) |
| `SYBTAPC` | Asynchronous create operations 數。 | PD (11,0) |
| `SYBTAPD` | Asynchronous delete operations 數。 | PD (11,0) |
| `SYLPTB` | LPAR time base（用於比對不同分區系統時鐘差異）。 | B (11,0) |
| `SYNUAL` | Noncached user authority lookups。 | PD (15,0) |
| `SYIFUS` | **Interactive CPU time used**（ms）。⚠️ 見上方「待驗證追蹤項」。 | PD (9,0) |
| `SYIFTE` | Interactive CPU time used over threshold（ms）。⚠️ 見上方「待驗證追蹤項」。 | PD (9,0) |
| `SYIFTA` | **Interactive CPU time available**（threshold/capacity, ms）。⚠️ 見上方「待驗證追蹤項」。 | PD (11,0) |
| `SYSPTU` | CPU time used：分區總處理時間（ms）。✅ 已用於 `Tot` 計算，見 `field_reference.md`。 | PD (11,0) |
| `SYSCTA` | Total CPU time configured for partition（ms）。✅ 已用於 `Tot` 分母，見 `field_reference.md`。Uncapped 分區實際用量可能超過此值。 | PD (11,0) |
| `SYSUTA` | CPU time that could have been used by this partition（含 shared pool 未用容量）。 | PD (11,0) |
| `SYSUTC` | Uncapped CPU time configured（shared pool 內允許使用上限）。 | PD (11,0) |
| `SYSPLU` | Shared pool CPU time used（所有共用該 pool 的分區合計）。 | PD (11,0) |
| `SYSPLA` | Shared pool CPU time available。 | PD (11,0) |
| `SYVCPU` | Virtual processor time configured（`SYVCPU/(INTSEC*1000)` = 平均虛擬處理器數）。V5R4 前資料恆為 0。 | PD (11,0) |
| `SYDPCH` | Total Dispatch Time（ms）；僅當 `QAPMJOBWT` 資料可用時才有值。 | PD (11,0) |
| `SYSHRF` | Shared processor flag（' '=未知, '0'=不共用實體處理器, '1'=共用）。 | C (1) |
| `SYSIUL`/`SYSCIU`/`SYJDUM`/`SYJDDM`/`SYJCA4`/`SYJPAS`/`SYJMRT`/`SYJS6E`/`SYJCME`/`SYJAUT`/`SYJBCH`/`SYJINT`/`SYJSPL` | Reserved（保留欄位，無意義）。 | 各異 |
| `SYVPID` | Virtual shared pool ID。 | B (4,0) |
| `SYVPCAP` | Virtual shared pool entitled capacity（1/100 實體處理器為單位）。 | B (9,0) |
| `SYPPLU` | Physical shared pool CPU time used（ms）。 | B (18,0) |
| `SYPPLA` | Physical shared pool CPU time available（ms）；含 dedicated 分區捐贈的 CPU 週期。 | B (18,0) |
| `SYPTHV` | Hypervisor CPU time（ms，已包含在 `SYSPTU` 內）。 | B (18,0) |
| `SYPTINT` | Interrupt CPU time（ms，已包含在 `SYSPTU` 內）。 | B (18,0) |
| `SYPTWS` | Waittask time（SMT 模式，未包含在 `SYSPTU` 內）。 | B (18,0) |
| `SYPTDN` | Donated CPU time（ms，僅 dedicated 且設定捐贈的分區）。 | B (18,0) |
| `SYSSPTU` | Scaled CPU time used（ms）；`SYSSPTU/SYSPTU` 比值反映當前處理器相對額定速度。 | B (18,0) |
| `SYUCAPF` | Partition uncapped flag（' '=未知, '0'=capped/不共用, '1'=uncapped）。 | C (1) |
| `SYDONF` | Partition donation flag（' '=未知, '0'=不支援捐贈, '1'=支援捐贈）。 | C (1) |
| `SYPTWAIT` | Virtual processor thread wait event time（μs）。 | B (18,0) |
| `SYPTREADY` | Virtual processor thread wait ready time（μs，entitled capacity 耗盡時等待）。 | B (18,0) |
| `SYPTLATEN` | Virtual processor thread dispatch latency（μs，entitled capacity 未耗盡但無實體處理器可用）。 | B (18,0) |
| `SYPTACT` | Virtual processor thread active time（ms）。 | B (18,0) |
| `SYPTIDLE` | Virtual processor thread idle time（ms）。 | B (18,0) |
| `SYPTINTR` | Virtual processor thread interrupt time（ms）。 | B (18,0) |
| `SYFRMCPU` | Processor firmware time used（ms）。 | B (18,0) |
| `SYFRMSCPU` | Processor scaled firmware time used（ms）。 | B (18,0) |
| `SYPFOLDSW` | Processor folding switch state（' '=無資料, '0'=off, '1'=on, '2'=系統控制）。 | C (1) |
| `SYPFOLDST` | Processor folding state（' '=無資料, '0'=disabled, '1'=enabled）。 | C (1) |
| `SYEMMAJCDE`/`SYEMMINCDE` | Energy management major/minor code（電源管理模式：disabled/max performance/power saver/dynamic power optimizer）。 | C (1) binary |
| `SYEMMATTR` | Energy management attributes（bit 0：power draw limit type soft/hard）。 | C (1) binary |
| `SYEMPWRLMT` | Energy management power draw limit（watts）。 | B (9,1) |
| `SYSQLCPU` | Unscaled SQL CPU time used（μs）。 | B (18,0) |
| `SYSQLSCPU` | Scaled SQL CPU time used（μs）。 | B (18,0) |
| `SYOSTMP` | Non-database 目前配置的暫存空間（4096-byte 單位）。 | B (18,0) |
| `SYDBTMP` | Database 目前配置的暫存空間（4096-byte 單位）。 | B (18,0) |
| `SYAJOBTMP` | 目前活躍作業計費的暫存空間。 | B (18,0) |
| `SYEJOBTMP` | 目前已結束作業計費的暫存空間。 | B (18,0) |
| `SYUSERTMP` | 目前使用者暫存空間（未計費至任何作業）。 | B (18,0) |
| `SYPSLPU` | Physical shared pool scaled CPU time used（ms）。 | B (18,0) |
| `SYTRUNIC` | Non-idle hardware instruction count（單位 1048576 instructions；僅 Power8+ 提供）。 | B (18,0) |
| `SYTRUNVTB` | Non-idle processor virtual time（ms；僅 Power8+ 提供）。 | B (18,0) |
| `SYTITUIC` | Interrupt instruction count（單位 1048576 instructions；僅 Power8+ 提供）。 | B (18,0) |
| `SYTFRMIC` | Firmware instruction count（單位 1048576 instructions；僅 Power8+ 提供）。 | B (18,0) |
| `DATETIME` | Interval date and time（本機時間，timestamp 型別）。 | Timestamp |
| `UTCTIME` | UTC interval date and time。 | Timestamp |
| `SYPMEM` | Partition memory（MB）。 | B (18,0) |
