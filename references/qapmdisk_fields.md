# QAPMDISK 完整欄位對照（官方文件）

> **來源**：IBM 官方 Collection Services 文件 "Collection Services data files: QAPMDISK"（Last Updated: 2026-07-13）。每個磁碟資源（一般對應一顆磁碟 arm；multipath 磁碟例外，見下方「Notes」）每個 interval 一筆記錄。
>
> **⚠️ 這是官方說明文字，不是實測結論**：跟 `JBPAGF` 曾經誤導過本專案一樣，「欄位存在、說明文字合理」不等於「這個欄位在本環境真的可用、語意跟你以為的一樣」。任何要拿本表欄位寫進 SQL 查詢或改動現有計算邏輯的動作，都必須先照 [field_reference.md](field_reference.md) 開頭規定的流程實測驗證，才能更新 `field_manifest.json` / `field_reference.md`。本表本身只是查找起點。
>
> 已驗證、目前實際用在報表計算的 `QAPMDISK` 欄位（`INTNUM`/`DSNBSY`/`DSSMPL`）見 [field_reference.md](field_reference.md) 第三節。

## ✅ 已驗證一致：High Disk Utilization 公式

`field_reference.md` 第三節現行公式 `CEILING((1 - DSNBSY/DSSMPL) * 100)`，與本文件官方說明的 `DSNBSY` 欄位描述——「Subtract DSNBSY from DSSMPL and divide by DSSMPL to get the disk utilization」——以及文件末尾 Note 2 的 `DSUTL = (DSSMPL - DSNBSY)/DSSMPL` 公式**完全吻合**。這次官方文件是驗證、而非推翻既有結論；`CEILING` 捨入方式官方文件未提及，仍以既有的綠屏實測結果為準。

## 💡 未來可能有用：DSSRVT 是官方建議的 service time 來源（目前未使用）

官方文件 Note 2 明確指出，用 `DSNBSY`/`DSSMPL`/`DSRDS`/`DSWRTS` 反推 service time（`DSSRVCT = DSUTL/DSAS`）是「傳統做法」，**官方建議改用 `DSSRVT`（Disk service time，已是毫秒）欄位**，因為抽樣反推法在操作頻率低時統計誤差大、結果不可靠。此建議**只針對 service time**，不影響現有 % utilization 公式（`DSUTL` 沒有替代欄位）。若未來要新增「Disk Service Time」類指標，應優先評估 `DSSRVT`/`DSWT`（wait time）而非自己反推，可省去一次可能不必要的驗證工作。

## ⚠️ Multipath 磁碟的欄位重複陷阱（若未來要做跨磁碟聚合需注意）

官方文件 Notes 3/6 提到：multipath 磁碟單元會有多筆記錄（每個路徑一筆），其中 `DSIDLC`/`DSIDLT`/`DSSK1`~`DSSK6`/`DSBUFO`/`DSBUFU`/`DSDCRH`/`DSDCPH`/`DSDCWH`/`DSDCFW` 等欄位的值**會在同一顆磁碟的每個路徑記錄中重複出現**（因為這些是裝置層級而非路徑層級的計數器）。目前 `field_reference.md` 的 High Disk 公式用 `MAX()` 取所有 ARM 中最大使用率，不涉及加總，所以不受此陷阱影響；但若未來改成「加總」或「平均」全部磁碟的某個計數器，必須先確認該欄位是路徑層級還是裝置層級，避免 multipath 磁碟的重複值把加總結果灌水。

---

## 完整欄位清單

| 欄位 | 說明 | 型別 |
| ---- | ---- | ---- |
| `INTNUM` | Interval number。✅ 已用於 JOIN key，見 `field_reference.md`。 | PD (5,0) |
| `DTETIM` | Interval date/time，本機系統時間。 | C (12) |
| `INTSEC` | Elapsed interval seconds。 | PD (7,0) |
| `IOPRN` | IOP resource name。 | C (10) |
| `DIOPID` | Reserved。 | C (1) |
| `DSARM` | Disk unit (arm) number：唯一識別碼，系統分配。✅ 已用於磁碟識別，見 `field_reference.md`。 | C (4) |
| `DSTYPE` | Disk unit type（如 4326、2105）。 | C (4) |
| `DSDRN` | Device resource name（multipath 磁碟例外，見 Notes）。 | C (10) |
| `DSSCAN` | Search string commands 數；不支援的磁碟類型恆為 0。 | PD (5,0) |
| `DSBLKR`/`DSBLKW` | Blocks read / written（block = 一個磁區）。 | PD (11,0) |
| `DSIDLC`/`DSIDLT` | Processor idle loop counter / time（百分之一微秒）；無專屬磁碟處理器的類型恆為 0；同控制器下的磁碟間會重複（見 Multipath 陷阱）。 | PD (11,0) |
| `DSSK1`~`DSSK6` | 不同距離級距的 seek 次數（>2/3、1/3~2/3、1/6~1/3、1/12~1/6、<1/12、zero seek）。 | PD (11,0) |
| `DSQUEL` | Total queue elements；`DSQUEL/DSSMPL` = 平均佇列長度。 | PD (11,0) |
| `DSNBSY` | Number of times arm not busy。✅ 已用於 High Disk Utilization 公式，見 `field_reference.md`。 | PD (11,0) |
| `DSSMPL` | Number of samples taken（`DSQUEL`/`DSNBSY` 的取樣基數）。✅ 已用於 High Disk Utilization 公式，見 `field_reference.md`。 | PD (11,0) |
| `DSCAP` | Drive capacity（bytes，已扣除系統保留空間）。 | PD (15,0) |
| `DSAVL` | Drive available space（bytes）。 | PD (15,0) |
| `DSASP` | ASP number（0=未分配, 1=系統 ASP, 2-32=basic ASP, 33-255=independent ASP）。 | PD (5,0) |
| `DSCSS`/`DSPCAP`/`DSPAVL` | Reserved。 | C(2)/PD(11,0)/PD(11,0) |
| `DMFLAG` | 本機鏡射狀態（' '=非鏡射, 'A'=鏡射對第一顆, 'B'=鏡射對第二顆）。 | C (1) |
| `DMSTS` | Local mirroring status（1=active, 2=resuming, 3=suspended）。 | PD (1,0) |
| `DMIRN`/`DMDRN` | 鏡射對應的 IOP/device resource name。 | C (10) |
| `DSRDS`/`DSWRTS` | Read data commands / write data commands 數。 | PD (11,0) |
| `DSBUFO`/`DSBUFU` | Buffer overrun / underrun 次數（磁碟控制器緩衝區沒跟上導致多轉一圈）。 | PD (11,0) |
| `DSMDLN` | Model number。 | C (4) |
| `DSDCRH`/`DSDCPH`/`DSDCWH`/`DSDCFW` | Device cache read hits / partial read hits / write hits / fast writes。 | PD (11,0) |
| `DSDROP`/`DSDWOP` | Device read/write operations（含 RAID/壓縮產生的操作；IOP-less 裝置為裝置層級計數，IOP 管理裝置則為路徑層級，見 Notes）。 | PD (11,0) |
| `DSCCRH`/`DSPCPH`/`DSCCWH`/`DSCCFW` | Controller cache read hits / partial read hits / write hits / fast writes（控制器層級，非裝置層級）。 | PD (11,0) |
| `DSCOMP` | Compressed unit indicator（'0'=未壓縮, '1'=已壓縮）。 | C (1) |
| `DSPBU`/`DSPBA` | Physical blocks used / allocated（僅壓縮單元有值，非壓縮恆為 0）。 | PD (11,0) |
| `DSLBW`/`DSLBA` | Logical blocks written / allocated（僅壓縮單元有值）。 | PD (11,0) |
| `DSPBCO` | Physical blocks for compression overhead（僅壓縮單元有值）。 | PD (11,0) |
| `DSFGDR`/`DSFGDW`/`DSBGDR`/`DSBGDW` | Foreground/Background directory reads/writes（僅壓縮單元有值）。 | PD (11,0) |
| `DSFGRE`/`DSFGWE` | Foreground read/write exceptions（僅壓縮單元有值）。 | PD (11,0) |
| `DSFGS`/`DSBGS` | Foreground/Background sweeps（壓縮群組重整次數，僅壓縮單元有值）。 | PD (11,0) |
| `DSCERC` | Controller simulated read cache hits（僅 Extended Adaptive Cache Simulator 啟用時更新）。 | PD (11,0) |
| `DSASPN` | ASP resource name（空白=系統 ASP 或 basic ASP）。 | C (10) |
| `DSPS`/`DSHAPS` | Parity set / High availability parity set 標記（'1'=是, '0'=否）。 | C (1) |
| `DSMU`/`DSIP` | Multipath unit / Initial path 標記。 | C (1) |
| `DSPC`/`DSMC` | 遠端鏡射 independent ASP 的 production copy / mirror copy 標記。 | C (1) |
| `DSRDT` | RAID type（僅 `DSPS`='1' 時有意義：'0'=RAID5, '1'=RAID6, '2'=RAID10）。 | C (1) |
| `DSIOPF` | Managed by IOP 標記（V5R4 前資料恆為 '1'）。 | C (1) |
| `DSCAT` | Disk unit category bitmask（外部儲存媒體/加密/虛擬磁碟/替代路徑/SSD/非偏好路徑）。 | C (1) |
| `DSSRVT` | **Disk service time（毫秒）**：自上次取樣以來所有磁碟操作的合計服務時間；除以讀寫命令數得平均服務時間。💡 官方建議的 service time 來源，見上方說明。資料不可用時為 0。 | B(9,0) |
| `DSWT` | Disk wait time（毫秒，queue time）：加上 `DSSRVT` 得 disk response time。資料不可用時為 0。 | B(9,0) |
| `DSBKCT1`~`DSBKCT6` | 6 個回應時間 bucket 的操作次數（依 `QAPMCONF` 的 B1-B5 邊界分級）。 | B(9,0) |
| `DSBKRT1`~`DSBKRT6` | 對應 bucket 的合計回應時間（毫秒）。 | B(9,0) |
| `DSBKST1`~`DSBKST6` | 對應 bucket 的合計服務時間（毫秒）。 | B(9,0) |
| `DSSECT` | Disk unit sector size。 | B(4,0) |
| `DSIOARN` | Disk storage adapter (IOA) resource name。 | C(10) |
| `DSSRLN` | Disk unit serial number（multipath 磁碟間會重複）。 | C(15) |
| `DSVAL01`~`DSVAL04` | Reserved。 | B(18,0) |
| `DSPTROP`/`DSPTWOP` | Path read/write commands（internal machine functions 收到的請求數）。 | B(18,0) |
| `DSWWNN` | World wide node name（外部儲存子系統識別碼；非外部磁碟為 null）。 | BINCHAR(8) |
| `DSLVLMP` | Level of mirrored protection（十六進位保護等級）。 | BINCHAR(2) |
| `DSLSCMDS` | Log sense commands 數（自上次取樣）。 | B (9,0) |
| `DSLSRT` | Log sense response time（微秒，自上次取樣）。 | B (18,0) |
| `DATETIME`/`UTCTIME` | Interval date/time（本機／UTC，timestamp）。 | Timestamp |
| `DSQUEOPS` | Deferred queue operations 數（該 interval 內被放進 deferred queue 的 I/O 數）。 | B (9,0) |
| `DSFSMAPSZ` | Free Space Map Size（4K page 數）。 | B (18,0) |
| `DSFSCLEAN` | Clean Free Space Size（4K page 數，全為 binary 0）。 | B (18,0) |
| `DSFSCLEAN0`~`DSFSCLEAN6` | 各級距（1-7/8/16/32/64/128/256 個 4K page 為一區塊）的 clean page 區塊數。 | B (18,0) |
| `DSFSFRAGIX` | Free Space Fragmentation Index（1~255，255 為最破碎）。 | PD (11,6) |
| `DSFSDIRTY` | Dirty Free Space Size（4K page 數，非全為 binary 0）。 | B (18,0) |
| `DSFSDIRTY0`~`DSFSDIRTY6` | 各級距的 dirty page 區塊數。 | B (18,0) |
