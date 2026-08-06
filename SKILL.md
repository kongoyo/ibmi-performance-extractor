---
name: ibmi-performance-extractor
description: Extract IBM i Collection Services performance data from custom libraries and hosts using the scratch folder scripts, perform credential pre-flight validation, and generate beautiful responsive HTML performance reports.
---

# IBM i Performance Extractor Skill

本 Skill 專門用於指導 AI Agent 與開發者使用專案中的 `scratch/` 腳本工具鏈，對任意 IBM i 主機與自訂 Library 的 `*MGTCOL` 效能資料庫進行資料提取、憑證事前點檢、JSON 串接以及 HTML 互動式儀表板的產出。

---

## 1. 觸發與提示詞規範 (Triggering Rules)

當用戶希望執行效能分析且包含自訂參數時，必須識別並擷取以下三個變數：
- **主機 (Host)**: 指定的主機 IP、DNS 名稱或設定檔中的主機 ID (預設為 `clark73`)。
- **Library**: 儲存效能實體檔案的資料庫庫名 (預設為 `QPFRDATA`)。
- **日期 (Date)**: 格式如 `MM/DD` (例如 `07/30`)，將用於計算 Julian Day。

### 提示詞觸發範例 (Example Prompts)
- 「請幫我擷取主機 `<主機ID>`、Library `<LibraryName>` 在 `<MM/DD>` 的效能資料並生成 HTML 報表。」
- 「從 IP `<YOUR_IBMI_HOST_IP>` 的 `<LibraryName>` 庫中讀取 `<MM/DD>` 效能數據，產出網頁分析圖表。」

---

## 2. 憑證與設定檔管理 (Credential Profiles)

為了避免明文憑證寫死在程式碼中，連線資料優先透過以下兩種方式載入。**此設定檔隨 skill 本身攜帶/分享**，不寫入目標專案：所有腳本一律以自己的檔案位置（`scripts/` 的上一層，即 skill 根目錄）解析 `scratch/hosts_config.json`，與執行時的工作目錄（cwd）無關，因此無論 skill 是獨立資料夾，還是被放進某專案的 `.agents/skills/ibmi-performance-extractor/`，都會讀到同一份設定。

### 2.1 主機設定檔 `<skill 根目錄>/scratch/hosts_config.json`
在 skill 根目錄下的 `scratch/` 建立此檔並登錄各主機連線設定，且在版控中忽略該檔案的實際內容（已在 `.gitignore` 中排除整個 `scratch/`）：
```json
{
  "<your_host_id_1>": {
    "host": "<YOUR_IBMI_HOST_IP_OR_DNS>",
    "port": 8076,
    "user": "<YOUR_IBMI_USER_PROFILE>",
    "password": "<YOUR_IBMI_PASSWORD>",
    "ignore-unauthorized": true,
    "library": "<預設 Library，例如 QPFRDATA>",
    "maxDays": 5,
    "outputDirs": ["scratch"]
  }
}
```
欄位說明：
- `library`：未帶 `--lib` 參數時使用的預設 Library。
- `maxDays`：未帶 `--maxDays` 參數時，最多擷取的成員（天）數，預設 5。
- `outputDirs`：報表與 JSON payload 的輸出目錄清單（可多個）。相對路徑會解析到 skill 根目錄下（預設 `["outputs/{host}/"]`）；絕對路徑（如 `"C:/Users/<you>/Downloads"`）會原樣使用。**輸出位置一律由此設定，程式碼中不得寫死任何磁碟路徑。**
  路徑字串可用以下 token，執行時會自動代換：
  - `{host}`（或範例檔中使用的 `{YOUR_IBMI_HOST_IP_OR_DNS}`）：該主機設定的 `host` 值
  - `{hostId}`：`hosts_config.json` 中的主機 id（JSON key）

### 2.2 環境變數備援
若未配置 JSON 檔，程式將自動嘗試從環境變數載入，變數格式為：
- `IBMI_HOST_[主機ID]`、`IBMI_USER_[主機ID]`、`IBMI_PASSWORD_[主機ID]`

也可用環境變數覆寫其他解析路徑（詳見第 3 節）：
- `IBMI_HOSTS_CONFIG`：覆寫 `hosts_config.json` 路徑
- `IBMI_SERVICES_PATH`：覆寫 `@ibm/ibmi-mcp-server` 的 `services.js` 路徑

### 2.3 連線資訊加密回寫 (Encryption at Rest, Windows)
`scripts/preflight.js` 載入 `hosts_config.json` 時，若偵測到某主機的 `host`/`port`/`user`/`password` 仍是明文，會在**第一次執行**時透過 Windows DPAPI（`ConvertTo-SecureString`/`ConvertFrom-SecureString`，實作於 `scripts/credentialCrypto.js`）加密這四個欄位，並回寫覆蓋 `hosts_config.json` 中對應的值（前綴 `dpapi:`）。之後每次執行都會自動、透明地解密回記憶體使用，檔案上不會再出現明文。

- DPAPI 金鑰綁定「目前 Windows 使用者 + 這台機器」，不需要另外管理金鑰檔——即使這份已被 `.gitignore` 排除的檔案意外外流，離開這台機器、這個帳號就無法解密。
- 僅在 `process.platform === "win32"` 時生效；非 Windows 平台會略過加密，維持明文（不影響既有流程，但也不提供保護）。
- 只保護「來自設定檔」的憑證；若憑證是透過 `IBMI_HOST_*`/`IBMI_USER_*`/`IBMI_PASSWORD_*` 環境變數提供，則沒有檔案可回寫，不套用此機制。

---

## 3. 事前環境與憑證點檢 (Pre-flight Validation)

所有可執行腳本（`test_pipeline.js`、`validate_metrics.js`）在連線與查詢前，都必須先呼叫 `scripts/preflight.js` 提供的檢查函式；任一項缺失都會直接輸出 `❌`/`💡` 引導訊息並 `process.exit(1)`，暫停執行、不得靜默略過：

| 檢查項目 | 對應函式 | 缺失時的行為 |
|---|---|---|
| Node.js 版本 (>=18) | `checkNodeVersion()` | 中斷並提示安裝新版 Node |
| Python 3（僅 `test_pipeline.js` 需要，用於產生 HTML） | `checkPython()` | 依序嘗試 `python`/`python3`，都找不到則中斷並提示安裝 |
| `@ibm/ibmi-mcp-server` 服務模組 (`SourceManager`) | `loadServices(args)` | 檢查 `packages/server/dist/public/services.js`（可由 `--services=` 或 `IBMI_SERVICES_PATH` 覆寫）是否存在；cwd 下找不到時，會再嘗試以 `require.resolve('@ibm/ibmi-mcp-server/package.json', { paths: [cwd] })` 解析該套件在 `node_modules` 中的實際安裝位置（適用於它是以 npm 套件安裝、而非 monorepo 兄弟目錄的情境）；兩者皆失敗才中斷並提示確認工作目錄或建置該專案 |
| 主機設定檔是否存在 | `loadHostConfig(hostId, args)` | 找不到 `scratch/hosts_config.json` 則中斷並指向 `examples/hosts_config.json.example` |
| 連線憑證是否完整、密碼是否仍為預留字 | `loadHostConfig(hostId, args)` | 中斷並提示填寫設定檔或改用 `IBMI_HOST_*`/`IBMI_USER_*`/`IBMI_PASSWORD_*` 環境變數 |

`services.js` 的解析基準優先是**目前工作目錄（cwd）**（假設腳本從目標專案根目錄被呼叫），找不到時會回退嘗試以 Node 模組解析（`require.resolve`，搜尋路徑含 cwd）定位 `node_modules` 中實際安裝的 `@ibm/ibmi-mcp-server` 套件位置；`hosts_config.json` 的解析基準則是**skill 自身所在目錄**（見第 2 節）——兩者刻意使用不同基準，因為前者屬於「消費此 skill 的專案」、後者屬於「skill 本身」，程式碼中兩者皆不得寫死絕對路徑。

### 3b. Schema 欄位健檢與資料健檢 (`scripts/healthcheck.js`)

背景：`Int`/`Bch` 曾經被寫死為假資料好幾個月都沒被發現（見 `memory/field-mapping-hardening-plan.md`），根因是完全沒有機制去驗證「程式碼假設的欄位真的存在」與「抓回來的資料看起來合理」。`test_pipeline.js` 現在會自動執行兩層健檢：

1. **連線後、查詢前 — Schema 存在性檢查 (`checkSchema`)**：對照 `references/field_manifest.json`（與 `field_reference.md` 同步維護的機器可讀版本），用 `QSYS2.SYSTABLES`／`QSYS2.SYSCOLUMNS` 確認目標 library 的 `QAPMISUM`/`QAPMSYSTEM`/`QAPMJOBL`/`QAPMDISK` 四張表、以及程式碼實際用到的每一個欄位都存在。任一張表或欄位缺失就中斷並列出缺什麼（`❌`/`💡` 格式，同第 3 節風格），不會讓查詢帶著錯誤假設繼續跑到後面才用一句難懂的 SQL 錯誤訊息炸掉。
   - 結果依 `(host, library)` 快取在 `scratch/.schema_check_cache.json`，預設 7 天內不重複檢查，避免每次執行都增加額外的網路來回；可用 `--forceSchemaCheck=true` 強制重新檢查。
   - **只驗證「欄位存在」，不保證「欄位有意義」**——`QAPMJOBL.JBPAGF` 就是欄位存在、型別正確，但值恆為 0 的反例（見 `field_manifest.json` 的 `knownDeadFields`）。這是下一層健檢要抓的。
2. **抓資料後、寫報表前 — 資料健檢 (`checkDataSanity`)**：對抓回來的每個指標（Count/Rsp/Tot/Int/Bch/Dsk/Usr），檢查是否全程（所有已抓到的天數、interval）恆為同一個常數值——這正是 `Int` 曾經恆為 `0`、`Bch` 曾經恆等於 `Tot` 的模式。不是硬性中斷（因為某個指標剛好整段時間都是 0 也可能是真的），而是印出 `⚠️` 警告，並把警告清單寫進 JSON payload 的 `dataQualityWarnings`，`generate_report.py` 會在報表最上方顯示黃色警示卡，提醒使用者人工確認、而不是照單全收。

`references/field_manifest.json` 與 `field_reference.md` 是同一份知識的兩種呈現（前者給程式碼讀、後者給人看），修改欄位對照時兩份都要同步更新。

---

## 4. 資料來源與成員解析原則

1. **Julian Day 成員識別**：依 `MM/DD` 計算一年中的第幾天（`ddd`），映射至 `Qddd000002` 格式的成員名稱，詳細換算邏輯實作於 `scripts/test_pipeline.js`。
2. **QTEMP 別名**：對每個成員在 `QTEMP` 動態建立 `ALIAS`。批次報表產出（`test_pipeline.js`）只需要 `QAPMISUM`、`QAPMSYSTEM`、`QAPMJOBL`、`QAPMDISK` 四張表（`generate_report.py` 的 7 個指標都不需要 `QAPMJOBOS`）。`QAPMJOBOS` **刻意不在** `test_pipeline.js` 的批次流程裡預先建立別名——它只用於第 9 節的 RCA 根因分析，是 agent 針對特定 Interval 隨選（on-demand）查詢時才建立，範圍窄（單一 member/interval），不需要也不該為了「以防萬一」而在每天的批次抓取都多建一次（2026-08-06 已釐清此點：曾經是文件寫「五張表」但程式碼只建四個別名的落差，並非程式碼漏做，是文件描述錯誤，已修正為此段）。
3. **CPU 使用率對齊原則**：CPU 指標必須以 LPAR 分區整體容量為基準計算，而非單一核心，以確保與綠色畫面 `DSPPFRDTA` 的數值一致。
4. **高磁碟使用率 (High Disk)**：此指標不存在於 `QAPMISUM`，需透過 `QAPMDISK` 中各 ARM 的閒置/取樣計數動態推算後，取所有 ARM 中的最大值。
5. **分頁缺失欄位**：`QAPMJOBL` 中的分頁缺失欄位名稱與直覺不同，必須使用正確欄位，詳見 `references/field_reference.md`。

---

## 5. HTML 報告視覺化原則

生成的 HTML 報告需符合以下設計規範，具體實作於 `scripts/generate_report.py`：

1. **百分比 Y 軸固定**：CPU 及 High Disk 等百分比圖表的 Y 軸必須固定在 0–100%，嚴禁自動縮放。
2. **互動式 Job 排行面板**：每個圖表卡片右側需配置 Tab 式日期切換的 Top 10 Job 列表，且 hover 圖表時自動更新對應時段排行。
3. **雙欄 RCA 診斷卡片**：報告底部保留根因分析區塊，以雙欄卡片格式並列系統異常診斷結果。

---

## 6. 自動化驗證原則

每次修改 SQL 欄位或計算邏輯後，必須執行 `scripts/validate_metrics.js` 進行基準值對比驗證，以確保報告數據與綠色畫面完全一致。腳本一律從**目標專案根目錄**執行（`services.js` 以 cwd 解析），並以 `--host=` 指定 `hosts_config.json` 中的主機 id：

```bash
node <skill 路徑>/scripts/validate_metrics.js --host=<主機ID>
```

---

## 7. Pipeline 執行與測試指南

使用 `scripts/test_pipeline.js` 進行端到端驗證。所有參數皆可省略，省略時依序 fallback 到 `hosts_config.json` 對應欄位、再到程式內建預設值；`hosts_config.json` 中若剛好只有一組主機設定，`--host` 也可省略。

可用參數：
- `--host=<主機ID>`：`hosts_config.json` 中的 key（設定檔僅一組主機時可省略）
- `--lib=<LibraryName>`：覆寫該主機設定的 `library`
- `--maxDays=<N>`：覆寫該主機設定的 `maxDays`
- `--config=<path>`：覆寫 `hosts_config.json` 路徑（預設為 skill 根目錄下的 `scratch/hosts_config.json`）
- `--services=<path>`：覆寫 `@ibm/ibmi-mcp-server` 的 `services.js` 路徑（預設為 cwd 下的 `packages/server/dist/public/services.js`）
- `--forceSchemaCheck=true`：略過第 3b 節 Schema 檢查的 7 天快取，強制重新驗證欄位
- `--rca=true`：額外輸出 RCA 根因診斷區塊（預設不輸出）。⚠️ 該區塊目前是**寫死的靜態內容**（固定描述 07/13 `HN040130A`、07/16 `CMPFILDTA` 這兩個 `KTB` library 的歷史案例），並非根據這次實際分析的資料產生——對任何其他 host/library/日期的報表輸出它，畫面上的案例內容都會是錯的、與這次資料無關，只是尚未有真正動態產生 RCA 的實作前的佔位內容

### 7.1 事前環境/憑證點檢（負向測試）
```bash
node <skill 路徑>/scripts/test_pipeline.js --host=<不存在或未填密碼的主機ID>
```
*預期結果*：偵測到 Node/Python/`services.js`/憑證任一項缺失，顯示引導說明並中斷執行（見第 3 節）。

### 7.2 實機完整擷取
在目標專案根目錄下執行（讓 `services.js` 能以 cwd 正確解析）：
```bash
node <skill 路徑>/scripts/test_pipeline.js --host=<主機ID>
```
*預期結果*：連線 IBM i、自動識別成員、查詢效能資料，並依 `hosts_config.json` 中該主機的 `outputDirs` 輸出命名格式為 `[HOST]_[LIB]_Performance_Report.html` 的報告（預設輸出到 skill 根目錄的 `scratch/`）。

---

## 8. 分享與打包指引 (How to Share)

若要將此項 Skill 與腳本打包分享給同事，最推薦的方式是**專案級配置 (Project-level Customization)**：
1. **目錄結構**：在專案根目錄下建立 `.agents/` 目錄，結構如下：
   ```text
   .agents/
   └── skills/
       └── ibmi-performance-extractor/
           ├── SKILL.md (即本文件)
           ├── scripts/
           │   ├── preflight.js (依賴/憑證事前點檢，供其他腳本共用)
           │   ├── credentialCrypto.js (Windows DPAPI 加密/解密，供 preflight.js 使用)
           │   ├── healthcheck.js (Schema 欄位存在性檢查 + 資料健檢，見第 3b 節)
           │   ├── test_pipeline.js
           │   ├── generate_report.py
           │   └── validate_metrics.js
           ├── references/
           │   ├── field_reference.md  (欄位對照、公式細節，給人看)
           │   └── field_manifest.json (與上面同步的機器可讀欄位清單，供 healthcheck.js 讀取)
           └── examples/
               └── hosts_config.json.example
   ```
2. **自動載入**：同事只要使用 Git 拉取此專案，Antigravity IDE 就會**自動識別並載入**本 Skill，不需要手動在全域配置。
3. **設定連線**：同事在 `.agents/skills/ibmi-performance-extractor/scratch/hosts_config.json` 建立自己的憑證（此檔案已被 skill 自帶的 `.gitignore` 排除，不會被提交）。
4. **執行**：腳本不需要、也不應該被複製到專案的 `scratch/` 目錄下——直接在**專案根目錄**執行 skill 自身位置的腳本即可（`hosts_config.json` 走 skill 相對路徑解析，`packages/server/services.js` 走 cwd 解析，見第 2、3 節）：
   ```bash
   node .agents/skills/ibmi-performance-extractor/scripts/test_pipeline.js --host=<主機ID>
   ```
   AI 即可自動讀取此 Skill 來輔助引導與故障診斷。

---

## 9. RCA 根因診斷執行原則

當使用者要求對特定時段進行根因分析時，AI 應主動透過 `SourceManager` 連線至 IBM i，依序從以下五個維度取得佐證證據，並以「時間、Job、影響時段」為三個必要敘述要素組成 RCA 報告：

1. **系統層次時序**：查詢目標 Interval 前後 ±2 個區間的系統摘要（交易數、回應時間、CPU、分頁缺失），建立時序背景。
2. **Job 負載排行**：對目標 Interval 查詢 Top 15 高負載 Job，依目標指標（I/O 次數、分頁缺失、CPU）排序。
3. **OS 層次診斷**：對排行前列的 Job 查詢 OS 層次統計，識別 Native I/O vs SQL、子系統歸屬、交易模式。
4. **Pool 聚合分析**：按記憶體 Pool 彙總資源消耗，識別哪個 Pool 正在承受壓力。
5. **跨時段趨勢**：查詢前後 10 個 Interval 的 Job 趨勢，判斷異常是突發性還是持續性。

> 詳細的查詢 SQL 範本與欄位對照，請參閱 `references/field_reference.md`。


1. **Julian Day 轉換公式 (非閏年)**：
   - 依據 `MM/DD` 累加月份天數，算出是一年中的第幾天 `ddd`（填補至三位數）。
   - 映射實體檔案成員名為：`Qddd000002` (例如 `07/30` ➔ `211` ➔ `Q211000002`)。
