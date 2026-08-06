# QAPMISUM 完整欄位對照（官方文件）

> **來源**：IBM 官方 Collection Services 文件 "Collection Services data files: QAPMISUM"（Last Updated: 2026-07-13）。此檔在 `CRTPFRDTA` 同時指定 `*JOBMI`、`*JOBOS`、`*SYSLVL` 三個種類時才會產出，每個 interval 一筆記錄。
>
> **⚠️ 這是官方說明文字，不是實測結論**：跟 `JBPAGF` 曾經誤導過本專案一樣，「欄位存在、說明文字合理」不等於「這個欄位在本環境真的可用、單位/語意跟你以為的一樣」。任何要拿本表欄位寫進 SQL 查詢或改動現有計算邏輯的動作，都必須先照 [field_reference.md](field_reference.md) 開頭規定的流程實測驗證，才能更新 `field_manifest.json` / `field_reference.md`。本表本身只是查找起點。
>
> 已驗證、目前實際用在報表計算的 `QAPMISUM` 欄位（`INTNUM`/`DTETIM`/`INTSEC`/`JBNTR`/`JBRSP`/`JBTFLT`）見 [field_reference.md](field_reference.md) 第一節。

## ⚠️ 待驗證追蹤項：JBRSP 的單位矛盾（三方不一致，優先度較高）

`field_reference.md` 第一節（QAPMISUM）目前記載：

> `JBRSP` | 本區間總回應時間（**已是秒**，非毫秒）| 平均回應 = `JBRSP / (JBNTR * 1000.0)` 得毫秒

但本文件下方官方欄位說明明確寫：

> `JBRSP` — Display (5250) transaction time (**in milliseconds**) for all interactive jobs within in the interval.

三方對不上：
1. `field_reference.md` 文字敘述：JBRSP 已是**秒**
2. `field_reference.md` 自己的公式：`JBRSP / (JBNTR * 1000.0)` 要得到毫秒——這在數學上只有當 JBRSP 原始單位是**微秒**時才成立（微秒 ÷ 1000 = 毫秒），跟「已是秒」的文字敘述自相矛盾
3. 官方文件：JBRSP 是**毫秒**

**在未實測前，不要**改動 `test_pipeline.js` 或 `generate_report.py` 裡任何用到 `JBRSP` 的回應時間計算。現行公式如果剛好因為「兩個錯誤互相抵銷」而在測試環境中湊出跟綠屏吻合的數字，也不能證明單位認知是對的——必須重新對照 `DSPPFRDTA` 綠屏的原始回應時間數值，用一個新的 interval 樣本從頭核算 `JBRSP` 的真實單位（建議：直接對比 `RAW JBRSP` 值本身的量級，例如綠屏顯示平均回應 200ms、`JBNTR`=50 筆交易，反推 `JBRSP` 應該落在什麼數量級，藉此判斷是秒/毫秒/微秒），而不是照抄現有除以 1000 的公式。

**交叉檢查（2026-08-06 追加）**：[qapmjobl_fields.md](qapmjobl_fields.md) 記載官方文件對 `QAPMJOBL.JBRSP`（注意是不同表）明確標示「in seconds」，與 `field_reference.md` 對 `QAPMJOBOS`/`QAPMJOBL` 既有的「秒」描述一致。但**這不能類推到本表的 `QAPMISUM.JBRSP`**——同名欄位在不同表的官方單位定義不同（`QAPMISUM` 官方標示毫秒），必須分開驗證，不能因為 `JBRSP` 這個名字在別的表上是秒，就假設這裡也是秒。

**量級初步驗證（2026-08-06 追加，尚未完成）**：實際連線 clark75（`KTB.QAPMISUM`，member `Q197000038`，2026/07/16）撈取 15 個 interval 的原始 `JBRSP`/`JBNTR`：

- 若原始值當**秒**：平均每筆交易 8~315 秒——對 5250 顯示交易不合理（不可能等 5 分鐘）
- 若原始值當**微秒**（現行公式 `/(JBNTR*1000)` 暗示的解讀）：平均每筆交易 0.0003~0.3 **毫秒**——比實際網路/處理延遲快得不合理
- 若原始值當**毫秒**（官方文件寫法）：平均每筆交易 8~315 **毫秒**——對互動系統完全合理

同時查了 `QAPMJOBL.JBRSP`（同批 interval，job 層級）：原始值當秒，平均每筆交易 0.002~10.9 秒，同樣合理，與官方文件、與 `field_reference.md` 既有認知三方一致，**不需要改動**。

**目前傾向**：`QAPMISUM.JBRSP` 是毫秒，現行公式 `JBRSP / (JBNTR * 1000.0)` 很可能把回應時間少算了 1000 倍，正確算法應為 `JBRSP / JBNTR`（已是毫秒，不必再除）。但量級分析只能排除「秒」與「微秒」，**不能證明「毫秒」跟 `DSPPFRDTA` 顯示定義完全一致**（例如綠屏可能顯示尖峰而非平均、統計口徑可能不同），仍需綠屏截圖核對才能按規定更新 `field_reference.md` 與程式碼。

**待截圖清單**：`DSPPFRDTA` → 顯示系統活動 → 2026/07/16、member `Q197000038`（library `KTB`，host clark75）：

- INTNUM=1（00:15，`JBNTR`=683）：驗證用 `215183/683≈315ms` 對比綠屏平均回應時間
- INTNUM=6（01:30，`JBNTR`=6165）：驗證用 `51945/6165≈8.4ms` 對比綠屏平均回應時間（挑一個交易量大、數值小的樣本做對照組）

---

## 完整欄位清單

| 欄位 | 說明 | 型別 |
| ---- | ---- | ---- |
| `INTNUM` | Interval number：依 `CRTPFRDTA` 指定起始時間計算出的第 n 個取樣間隔。✅ 已用於 JOIN key，見 `field_reference.md`。 | PD (5,0) |
| `DTETIM` | Interval date (yymmdd) and time (hhmmss)，本機系統時間。✅ 已用於日期/時間解析，見 `field_reference.md`。 | C (12) |
| `INTSEC` | Elapsed interval seconds：自上次取樣以來的秒數（通常 900）。✅ 已用於分頁缺失/秒計算，見 `field_reference.md`。 | PD (7,0) |
| `DTECEN` | Century digit（0=19XX，1=20XX）。 | C (1) |
| `JWDSEQ` | Description sequence number，對應 `QAPMJOBWTD` 的等待資料描述。 | B (4,0) |
| `JWCT01`/`JWTM01`/`JWJC01` | Wait group 1 的等待次數／等待時間（μs）／貢獻執行緒或工作數。 | B(9,0)/B(18,0)/B(9,0) |
| `JWCT02`~`JWCT32` 等 | 同上，重複至 32 組 wait counter set。 | 同上 |
| `JBDBR` | Synchronous database reads（同步實體 DB 讀取總數）。 | B (9,0) |
| `JBNDB` | Synchronous nondatabase reads。 | B (9,0) |
| `JBDBW` | Synchronous database writes。 | B (9,0) |
| `JBNDW` | Synchronous nondatabase writes。 | B (9,0) |
| `JBADBR` | Asynchronous database reads（非同步 DB 讀取，非同步預讀相關）。 | B (9,0) |
| `JBANDR` | Asynchronous nondatabase reads。 | B (9,0) |
| `JBADBW` | Asynchronous database writes。 | B (9,0) |
| `JBANDW` | Asynchronous nondatabase writes。 | B (9,0) |
| `JBCPU` | Unscaled CPU time charged（**微秒**）：全部 job 在該 interval 的未縮放 CPU 時間。⚠️ 注意此欄位在 `QAPMISUM` 是「微秒」，而 `QAPMJOBL` 的同名欄位 `JBCPU` 用於 `Int`/`Bch` 計算時單位認知是毫秒（見 `field_reference.md` 第二節 2b）——兩張表同名欄位單位可能不同，混用前務必分別確認。 | B (18,0) |
| `JBSCPU` | Scaled CPU time charged（微秒）。 | B (18,0) |
| `JBTFLT` | Page faults：全部 job 在該 interval 的總分頁缺失。✅ 已用於分頁缺失/秒計算，見 `field_reference.md`。 | B (9,0) |
| `JBIPF` | I/O pending faults。 | B (9,0) |
| `JBSKSC`/`JBSKBS` | Socket sends / socket bytes sent。 | B(9,0)/B(18,0) |
| `JBSKRC`/`JBSKBR` | Socket receives / socket bytes received。 | B(9,0)/B(18,0) |
| `JBTDECNT` | Total threads or tasks（含已終止、transient、interval 結束時仍活躍者）。 | B (9,0) |
| `JBTDETR` | Transient threads or tasks（該 interval 內啟動並結束）。 | B (9,0) |
| `JBJOBCNT` | Total jobs（含已終止、transient、interval 結束時仍活躍者）。 | B (9,0) |
| `JBJOBTR` | Transient jobs。 | B (9,0) |
| `JBRSP` | Display (5250) transaction time（官方標示**毫秒**）。⚠️ 見上方「待驗證追蹤項」——與 `field_reference.md` 現有「已是秒」的敘述及其自身公式矛盾，尚未實測釐清。 | B (18,0) |
| `JBNTR` | Number of display (5250) transactions。✅ 已用於平均回應時間分母，見 `field_reference.md`。 | B (9,0) |
| `JBLWT` | Logical database writes（不含 reader/writer I/O、`CPYSPLF`/`DSPSPLF`）。 | B (9,0) |
| `JBLRD` | Logical database reads（同上排除範圍）。 | B (9,0) |
| `JBDBU` | Miscellaneous logical database operations（update/delete/force-end-of-data/open/close/release）。 | B (9,0) |
| `JBBCO` | Database commit operations。 | B (9,0) |
| `JBBRO` | Database rollback operations。 | B (9,0) |
| `JBLBO` | SQL cursor count（full opened）。 | B (9,0) |
| `JBLBS` | SQL cursor reuse（pseudo-opened / reused）。 | B (9,0) |
| `JBRSVD1`~`JBRSVD4` | Reserved（保留欄位）。 | B(18,0)/B(18,0)/B(9,0)/B(9,0) |
| `DATETIME` | Interval date and time（本機時間，timestamp）。 | Timestamp |
| `UTCTIME` | UTC interval date and time。 | Timestamp |
| `JBNUS` | Full opens（native + SQL cursor）；`JBNUS - JBLBO` = 非 SQL full opens 數。 | B (9,0) |
| `JBPGA`/`JBPGD` | 4096-byte 單位的暫存+永久儲存體配置/解除配置總數。 | B (9,0) |
| `JBTMPPGA`/`JBTMPPGD` | 4096-byte 單位的暫存儲存體配置/解除配置總數。 | B (9,0) |
| `JBSQLDBR`/`JBSQLNDBR` | SQL 同步 DB／非 DB 讀取。 | B (18,0) |
| `JBSQLDBW`/`JBSQLNDBW` | SQL 同步 DB／非 DB 寫入。 | B (18,0) |
| `JBSQLADBR`/`JBSQLANDBR` | SQL 非同步 DB／非 DB 讀取。 | B (18,0) |
| `JBSQLADBW`/`JBSQLANDBW` | SQL 非同步 DB／非 DB 寫入。 | B (18,0) |
| `JBLWTSQL` | SQL 相關邏輯 DB 寫入（`JBLWT - JBLWTSQL` = 非 SQL 相關寫入）。 | B (18,0) |
| `JBLRDSQL` | SQL 相關邏輯 DB 讀取（`JBLRD - JBLRDSQL` = 非 SQL 相關讀取）。 | B (18,0) |
| `JBDBUSQL` | SQL 相關 miscellaneous DB 操作（`JBDBU - JBDBUSQL` = 非 SQL 相關）。 | B (18,0) |
