# IBM i Performance Extractor

這個專案 / Agent Skill 專門用於指導 AI Agent 與開發者自動擷取 IBM i (AS/400) 的 Collection Services 效能數據，並將其視覺化為精美的 HTML 互動式報表，甚至進行自動化的 RCA (Root Cause Analysis) 根因診斷。

本 Skill 採用 **Deep Module (深度模組)** 設計架構，具備高度的擴充性與極簡的操作介面。

## 🌟 核心功能情境 (Functional Scenarios)

### 情境一：基礎效能擷取與 HTML 報表產出
這是最常見的使用情境。當您想要查看某個主機、特定日期的效能趨勢圖時，可以呼叫此功能。Agent 會自動幫您登入 IBM i、擷取效能實體檔案 (QAPMISUM 等)，並輸出帶有互動式圖表與 Job 排名的 HTML。
*   **範例提示詞 (Example Prompts):**
    *   `「請幫我擷取主機 <HostID> 在 07/30 的效能資料並生成 HTML 報表。」`
    *   `「從 IP <Host IP> 的 QPFRDATA 庫中讀取 08/01 效能數據，產出網頁分析圖表。」`

### 情境二：RCA 根因診斷分析
當您在某個特定時段發現 CPU 飆高、或 Response Time (回應時間) 過長，您可以請 Agent 針對該時段或全天深入追查。Agent 會自動載入 `rca-diagnostics` 擴充模組：已知是哪個 Job 就直接查它（單一時段或全天），不知道是哪個 Job 就先跑全天異常掃描找出影響最大的候選，涵蓋 CPU、Response Time、Disk I/O、Page Faults、Seize/Wait (鎖定等待) 五大資源維度。
*   **範例提示詞 (Example Prompts):**
    *   `「我發現 <HostID> 在 07/16 的 14:15 時段 CPU 異常高，請幫我對該時段執行 RCA 根因診斷。」`
    *   `「請幫我查 <HostID> 的 Job ABC123/USER1/012345 在 07/16 全天的使用情況。」`
    *   `「請查詢 <HostID> <LibraryName> 07/16 是否有異常的 Job，請列表並針對影響最大的那個 Job 產生 RCA 報告。」`
    *   `「這個 Job 是不是被鎖定拖慢了，不是真的在算資料？」`

### 情境三：每日健康摘要／多日趨勢與容量規劃／磁碟熱點報告
除了針對單一 Job 的 RCA，Agent 也能產出不以 Job 為中心的分析報告：一頁式的每日健康總結（給主管/晨會快速閱讀）、跨多天的趨勢與容量規劃分析（判斷資源使用是否逐日惡化），以及找出哪一顆實體磁碟 ARM 在拖速度的熱點報告。
*   **範例提示詞 (Example Prompts):**
    *   `「請幫我產出 <HostID> 07/16 的每日健康摘要報告。」`
    *   `「請比較 <HostID> 07/12 到 07/16 這幾天的 CPU 與回應時間趨勢，判斷是否需要擴充資源。」`
    *   `「整體磁碟使用率偏高，請幫我查是哪一顆磁碟 ARM 在拖速度。」`

### 情境四：憑證管理與環境設定
若您是第一次使用，或是在 Windows 機器上希望將明文密碼透過 DPAPI (Data Protection API) 進行加密存放，可以要求 Agent 幫您除錯連線問題。
*   **範例提示詞 (Example Prompts):**
    *   `「我新增了一台 host 在設定檔，請幫我測試連線，並確認密碼是否已經自動以 DPAPI 加密。」`
    *   `「執行 test_pipeline.js 時發生 Pre-flight Check 失敗，請幫我修復環境問題。」`

### 情境五：客製化 HTML 報表視覺
若您想要更改報表的配色、圖表行為，或是在報表底下新增新的診斷區塊，Agent 會載入 `html-visual-rules` 來幫助您符合規範地修改報表程式 (`generateReport.js`)。
*   **範例提示詞 (Example Prompts):**
    *   `「請幫我把 HTML 報表的 CPU 折線圖顏色改成漸層藍色，並確保 Y 軸依然固定在 0-100%。」`

---

## 🚀 給 AI Agent 的執行提示 (For AI Agents)

此專案已實作延遲加載 (Lazy Loading) 的 **References Routing** 機制。如果您是 AI Agent，請一率先讀取本目錄下的 `SKILL.md`，並根據其底部的 Routing Table 來讀取您需要的特定實作細節 (`references/*.md`)。
