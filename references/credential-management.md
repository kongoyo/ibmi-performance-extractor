# 憑證與設定檔管理 (Credential Profiles)

為了避免明文憑證寫死在程式碼中，連線資料優先透過以下兩種方式載入。**此設定檔隨 skill 本身攜帶/分享**，不寫入目標專案：所有腳本一律以自己的檔案位置（`scripts/` 的上一層，即 skill 根目錄）解析 `config/hosts_config.json`，與執行時的工作目錄（cwd）無關，因此無論 skill 是獨立資料夾，還是被放進某專案的 `.agents/skills/ibmi-performance-extractor/`，都會讀到同一份設定。

## 1. 主機設定檔 `<skill 根目錄>/config/hosts_config.json`
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

## 2. 環境變數備援
若未配置 JSON 檔，程式將自動嘗試從環境變數載入，變數格式為：
- `IBMI_HOST_[主機ID]`、`IBMI_USER_[主機ID]`、`IBMI_PASSWORD_[主機ID]`

也可使用環境變數覆寫其他解析路徑：
- `IBMI_HOSTS_CONFIG`：覆寫 `hosts_config.json` 路徑
- `IBMI_SERVICES_PATH`：覆寫 `@ibm/ibmi-mcp-server` 的 `services.js` 路徑

## 3. 連線資訊加密回寫 (Encryption at Rest, Windows)
`scripts/preflight.js` 載入 `hosts_config.json` 時，若偵測到某主機的 `host`/`port`/`user`/`password` 仍是明文，會在**第一次執行**時透過 Windows DPAPI（`ConvertTo-SecureString`/`ConvertFrom-SecureString`，實作於 `scripts/credentialCrypto.js`）加密這四個欄位，並回寫覆蓋 `hosts_config.json` 中對應的值（前綴 `dpapi:`）。之後每次執行都會自動、透明地解密回記憶體使用，檔案上不會再出現明文。

- DPAPI 金鑰綁定「目前 Windows 使用者 + 這台機器」，不需要另外管理金鑰檔——即使這份已被 `.gitignore` 排除的檔案意外外流，離開這台機器、這個帳號就無法解密。
- 僅在 `process.platform === "win32"` 時生效；非 Windows 平台會略過加密，維持明文。
- 只保護「來自設定檔」的憑證；若憑證是透過 `IBMI_HOST_*`/`IBMI_USER_*`/`IBMI_PASSWORD_*` 環境變數提供，則沒有檔案可回寫，不套用此機制。

---

# 事前環境與憑證點檢 (Pre-flight Validation)

所有可執行腳本（`test_pipeline.js`、`validate_metrics.js`）在連線與查詢前，都必須先呼叫 `scripts/preflight.js` 提供的檢查函式；任一項缺失都會直接輸出 `❌`/`💡` 引導訊息並 `process.exit(1)`，暫停執行、不得靜默略過：

| 檢查項目 | 對應函式 | 缺失時的行為 |
|---|---|---|
| Node.js 版本 (>=18) | `checkNodeVersion()` | 中斷並提示安裝新版 Node |
| Python 3 | `checkPython()` | 依序嘗試 `python`/`python3`，都找不到則中斷並提示安裝 |
| `@ibm/ibmi-mcp-server` 服務模組 (`SourceManager`) | `loadServices(args)` | 檢查 `services.js` 是否存在；cwd 找不到時嘗試 `require.resolve` 定位 npm 套件；皆失敗才中斷。 |
| 主機設定檔是否存在 | `loadHostConfig(hostId, args)` | 找不到 `config/hosts_config.json` 則中斷並指向 `examples/hosts_config.json.example` |
| 連線憑證是否完整 | `loadHostConfig(hostId, args)` | 中斷並提示填寫設定檔或改用環境變數 |

## Schema 欄位健檢與資料健檢 (`scripts/healthcheck.js`)

`test_pipeline.js` 會自動執行兩層健檢：
1. **連線後、查詢前 — Schema 存在性檢查 (`checkSchema`)**：對照 `references/field_manifest.json`，確認目標 library 的 4 張表及所有欄位存在。缺失則中斷。結果會快取於 `scratch/.schema_check_cache.json`。
2. **抓資料後、寫報表前 — 資料健檢 (`checkDataSanity`)**：檢查抓回來的每個指標是否全程恆為同一個常數值。有異常印出 `⚠️` 警告，並記錄於 `dataQualityWarnings` 顯示於報表最上方。
