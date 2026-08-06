# QAPMJOBWT 完整欄位對照（官方文件）

> **來源**：IBM 官方 Collection Services 文件 "Collection Services data files: QAPMJOBWT"（Last Updated: 2026-07-13）。記錄每個 job/task/thread 在該 interval 內的等待狀況，只有該 interval 內消耗過 CPU 的 job 才會有記錄（可能多筆，尤其是 service activity 期間）。壽命短於回報門檻、且在同一 interval 內啟動並結束的 task/secondary thread 不會個別列出，而是依 job/node 彙總記錄（用 `QAPMJOBMI.JBSLTCNT` 識別）。
>
> **目前完全沒用到這張表**：不在 `test_pipeline.js` 建立別名的四張表（`QAPMISUM`/`QAPMSYSTEM`/`QAPMJOBL`/`QAPMDISK`）或隨選的 `QAPMJOBOS` 之列。本檔案純粹是查找起點，若未來要做等待狀況分析（例如新增 Wait Analysis 面板），從這裡開始。
>
> **⚠️ 這是官方說明文字，不是實測結論**：任何要實際使用的欄位，都必須先照 [field_reference.md](field_reference.md) 開頭規定的流程實測驗證，才能寫進 `field_manifest.json` / `field_reference.md`。

## ⚠️ 使用前必讀：counter set（bucket）是動態的，不可寫死語意

官方文件明確警告：

> Counter sets can be added or redefined by the new release of the operating system. In addition, IBM service representatives can define new counter sets or redefine existing counter sets... **user cannot assume that the content of this file is always the same.**

也就是說 `JWCT01`/`JWTM01`~`JWCT32`/`JWTM32` 這 32 組 counter set，各組實際代表哪種等待類型（例如磁碟等待、鎖定等待、通訊等待）**不是固定的**，必須搭配 `QAPMJOBWTD` 檔案（描述每個 counter set 語意）在**每個環境、每次收集**動態解析，不能像 `QAPMJOBL.JBTYPE` 那樣寫死一份對照表放進程式碼。若未來要用這張表，第一步一定是先查 `QAPMJOBWTD`，不是直接猜 `JWCT01` 是什麼——完整解析方式（`JWDSEQ` JOIN 鍵、正確使用流程）見 [qapmjobwtd_qapmjobwtg_fields.md](qapmjobwtd_qapmjobwtg_fields.md)。

另外，V5R4 收集的資料只提供前 16 組 counter set（`JWCT17`~`JWCT32`/`JWTM17`~`JWTM32` 不存在）；本專案目前連線的環境（7.3/7.4/7.5）理論上應有完整 32 組，但若未來連到更舊版本主機需留意。

一個 job 若整個 interval 都沒有處理過（沒耗用 CPU），不會出現在本檔案，這種「完全閒置中的等待」記錄在另一張 `QAPMJOBWTG`（wait gap file）。

---

## 完整欄位清單

| 欄位 | 說明 | 型別 |
| ---- | ---- | ---- |
| `INTNUM` | Interval number。 | PD (5,0) |
| `JWTDE` | System task identifier。 | X (8) |
| `JWCURT` | Current Wait Time（微秒）：目前正在進行的等待已耗費的時間；等待完成時才會計入 `JWCURB` 指定的 counter set（此時間不計入其他 counter set）。 | B (9,0) |
| `JWCURE` | Reserved。 | B (9,0) |
| `JWCURB` | Current Counter Set（bucket）：若非 0，代表目前等待完成時會更新的 counter set 編號。 | B (4,0) |
| `JWDSEQ` | Description sequence number：對應 `QAPMJOBWTD` 中描述本筆等待資料的記錄。 | B (4,0) |
| `JWCT01` | Count 1：該 job 遇到此 group 等待狀況的次數。 | B (9,0) |
| `JWTM01` | Time 1：該 job 在此 group 花費的等待時間（微秒）。 | B (9,0) |
| `JWCT02`~`JWCT32` / `JWTM02`~`JWTM32` | 同上，重複至 32 組 counter set（V5R4 資料只有前 16 組）。⚠️ 各組實際語意見上方「counter set 是動態的」警語，須搭配 `QAPMJOBWTD` 解析。 | B (9,0) |
