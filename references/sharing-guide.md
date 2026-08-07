# 分享與打包指引 (How to Share)

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
           │   ├── healthcheck.js (Schema 欄位存在性檢查 + 資料健檢)
           │   ├── test_pipeline.js
           │   ├── generate_report.py
           │   └── validate_metrics.js
           ├── references/
           │   ├── field_reference.md  (欄位對照、公式細節，給人看)
           │   └── field_manifest.json (機器可讀欄位清單，供 healthcheck 讀取)
           └── examples/
               └── hosts_config.json.example
   ```
2. **自動載入**：同事只要使用 Git 拉取此專案，Antigravity IDE 就會**自動識別並載入**本 Skill，不需要手動在全域配置。
3. **設定連線**：同事在 `.agents/skills/ibmi-performance-extractor/scratch/hosts_config.json` 建立自己的憑證（此檔案已被 skill 自帶的 `.gitignore` 排除，不會被提交）。
4. **執行**：腳本不需要、也不應該被複製到專案的 `scratch/` 目錄下——直接在**專案根目錄**執行 skill 自身位置的腳本即可：
   ```bash
   node .agents/skills/ibmi-performance-extractor/scripts/test_pipeline.js --host=<主機ID>
   ```
   AI 即可自動讀取此 Skill 來輔助引導與故障診斷。
