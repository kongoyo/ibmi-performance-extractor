# QAPMJOBWTD / QAPMJOBWTG 完整欄位對照（官方文件）

> **來源**：IBM 官方 Collection Services 文件 "Collection Services data files: QAPMJOBWTD" 與 "QAPMJOBWTG"（Last Updated: 2026-07-13）。兩者都是 [qapmjobwt_fields.md](qapmjobwt_fields.md)（`QAPMJOBWT`）的補充表，目前完全沒用到，純粹是查找起點。
>
> **⚠️ 這是官方說明文字，不是實測結論**：任何要實際使用的欄位，都必須先照 [field_reference.md](field_reference.md) 開頭規定的流程實測驗證，才能寫進 `field_manifest.json` / `field_reference.md`。

## QAPMJOBWTD：解答上次留下的「counter set 怎麼解析」問題

`qapmjobwt_fields.md` 警告過 `QAPMJOBWT` 的 32 組 counter set（`JWCT01`~`JWCT32`）語意是動態的，新版次或 IBM 服務人員可能新增/重新定義，不能寫死對照表。`QAPMJOBWTD` 正是用來動態解析這件事的描述表：每當偵測到第一筆等待資料時（通常是收集開始時）會為每個活躍 counter set 寫入一筆記錄，透過 `JWDSEQ` 這個 key 與 `QAPMJOBWT.JWDSEQ` JOIN，用 `JWSNBR`（counter set 編號）對應到 `QAPMJOBWT` 的 `JWCTnn`/`JWTMnn`，再用 `JWDESC`（Unicode 文字說明）得知該組實際代表什麼等待類型。

**正確使用流程**（若未來要做等待分析）：每次收集先讀該 member 的 `QAPMJOBWTD`，動態建立「本次收集」的 counter set 對照表，再用它解讀 `QAPMJOBWT` 的數字——不能跨環境、跨收集沿用同一份寫死的 bucket 對照，因為 service activity 期間可能有多組不同時間點的描述記錄（`JWDSEQ` 會換新值）。

## QAPMJOBWTG：QAPMJOBWT 的補集（閒置中 job 的即時等待狀態）

`QAPMJOBWT` 只收錄「該 interval 有消耗 CPU」的 job/task/thread。`QAPMJOBWTG` 專門補上**沒消耗 CPU**的 job 目前卡在什麼等待狀態——用 `JWTDE`（System task identifier）JOIN `QAPMJOBMI.JBTDE` 可取得對應 job 資訊。`JWCURB` 欄位：非 0 正值代表目前正在等待中及其 counter set；0 代表無法取得等待資訊（例如該 interval 已結束的 job）；罕見情況 -1 代表取樣當下資料無法取得。

**⚠️ V6R1 之前收集的資料精確度較低**（官方 Note）：
1. 只收錄「這次收集期間曾經跑過」的 job，從未跑過的 job 不會出現。
2. `JWCURT`（Total wait in this wait state）是估計值，不應視為精確量測。

---

## QAPMJOBWTD 完整欄位清單

| 欄位 | 說明 | 型別 |
| ---- | ---- | ---- |
| `DTETIM` | 提供這些描述的取樣間隔日期時間（通常是 `*MGTCOL` object 的第一個 interval）。 | C (12) |
| `DTECEN` | Century digit（0=19XX, 1=20XX）。 | C (1) |
| `JWDSEQ` | Description sequence number：這組描述的唯一識別碼，對應 `QAPMJOBWT.JWDSEQ`；每次寫入新的描述集合時會換新值。 | B (4,0) |
| `JWTNUM` | 本次回報的 wait counter set 總數。 | B (4,0) |
| `JWSNBR` | 本筆記錄描述的 counter set 編號（對應 `QAPMJOBWT` 的 `JWCTnn`/`JWTMnn`）。 | B (4,0) |
| `JWDESC` | `JWCTnn`/`JWTMnn` 所回報資料類型的文字說明（Unicode）。 | G (50) |
| `DATETIME`/`UTCTIME` | 本機／UTC 取樣間隔日期時間（timestamp）。 | Timestamp |

## QAPMJOBWTG 完整欄位清單

| 欄位 | 說明 | 型別 |
| ---- | ---- | ---- |
| `INTNUM` | Interval number。 | PD (5,0) |
| `JWTDE` | System task identifier；可 JOIN `QAPMJOBMI.JBTDE` 取得對應 job 資訊。 | X (8) |
| `JWCURE` | Reserved。 | B (9,0) |
| `JWCURT` | Current Wait Time（微秒）：自等待開始以來的總時間（V6R1 前資料為估計值，見上方 Note）。 | B (18,0) |
| `JWCURINT` | Current Wait Time this interval（微秒）：該 job 在本 interval 內花費的等待時間。 | B (9,0) |
| `JWDSEQ` | Description sequence number，對應 `QAPMJOBWTD`。 | B (4,0) |
| `JWCURB` | Current Counter Set（bucket）：>0＝目前等待中及其 counter set；0＝無等待資訊可用（如該 interval 已結束的 job）；-1＝取樣當下資料無法取得（罕見）。 | B (4,0) |
