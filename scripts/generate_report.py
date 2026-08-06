import json
import os
import argparse

# Static demo content (2026-08-06): describes two specific historical KTB-library
# incidents (07/13 HN040130A, 07/16 CMPFILDTA). NOT generated from the input JSON —
# including it in a report about a different host/library/date will misrepresent
# what actually happened. Only included when --rca is passed. See SKILL.md section 9
# for what real, data-driven RCA should look like; this is a placeholder pending that.
RCA_SECTION_HTML = """        <!-- Root Cause Analysis (RCA) Section Container -->
        <div style="margin-top: 3rem; display: flex; flex-direction: column; gap: 2rem;">
            <div style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 1rem;">
                <h2 style="font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 700; color: #fbbf24; display: flex; align-items: center; gap: 0.5rem; margin: 0;">
                    🔍 核心異常效能根因診斷報告 (Root Cause Analysis - RCA)
                </h2>
                <p style="color: var(--text-secondary); font-size: 0.95rem; margin-top: 0.25rem;">
                    針對採樣區間內偵測到的極端效能偏離與系統資源暴增事件進行底層狀態剖析與最佳化建議
                </p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <!-- Case 1: 07/13 HN040130A (Response Time) -->
                <div class="rca-card" style="background: var(--card-bg); backdrop-filter: blur(12px); border-radius: 20px; border: 1px solid var(--card-border); padding: 1.75rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <div style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.75rem; margin-bottom: 1.25rem;">
                            <span style="background: rgba(244, 63, 94, 0.1); color: #f43f5e; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">Case 01: 交易回應極端延遲</span>
                            <h3 style="font-size: 1.3rem; font-weight: 700; color: var(--text-primary); margin-top: 0.5rem; margin-bottom: 0;">
                                Job: HN040130A (730390) | 07/13 12:45
                            </h3>
                            <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.25rem;">
                                交易次數: 1 次 | 回應時間: 14,271.93 秒 (約 3.96 小時) | I/O: 7,103,535 次
                            </p>
                        </div>
                        
                        <div style="margin-bottom: 1.25rem;">
                            <h4 style="font-size: 0.95rem; color: var(--accent-blue); margin-bottom: 0.5rem; font-weight: 600;">📊 生命週期等待時間拆解</h4>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; background: rgba(0,0,0,0.2); border-radius: 8px; overflow: hidden; margin-bottom: 1rem;">
                                <thead>
                                    <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.08); text-align: left; color: var(--text-secondary); font-size: 0.75rem;">
                                        <th style="padding: 0.5rem;">等待狀態</th>
                                        <th style="padding: 0.5rem; text-align: right;">累積時間</th>
                                        <th style="padding: 0.5rem; text-align: right;">佔比 (%)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                        <td style="padding: 0.4rem 0.5rem; font-weight: 600;">⏱️ 總交易回應時間</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right; font-weight: 600;">14,271.93 秒</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right; font-weight: 600;">100.0%</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                        <td style="padding: 0.4rem 0.5rem; color: var(--text-secondary);">💾 記憶體分頁置入等待 (Page Wait)</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-purple); font-weight: 600;">4,674.48 秒</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-purple); font-weight: 600;">32.75%</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                        <td style="padding: 0.4rem 0.5rem; color: var(--text-secondary);">⚙️ 非資料庫系統等待 (Non-DB Wait)</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right;">1,277.93 秒</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right;">8.95%</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                        <td style="padding: 0.4rem 0.5rem; color: var(--text-secondary);">🗄️ 資料庫引擎等待 (DB Wait)</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right;">1,065.12 秒</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right;">7.46%</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                        <td style="padding: 0.4rem 0.5rem; color: var(--text-secondary);">🔒 物件與行鎖定等待 (Lock Wait)</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right;">216.04 秒</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right;">1.51%</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                        <td style="padding: 0.4rem 0.5rem; color: var(--text-secondary);">⚡ CPU 運算時間 (CPU Time)</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right;">50.96 秒</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right;">0.36%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <div style="background: rgba(56, 189, 248, 0.02); border-left: 3px solid var(--accent-blue); padding: 0.75rem; border-radius: 6px;">
                                <h5 style="color: var(--accent-blue); font-size: 0.85rem; font-weight: 600; margin-bottom: 0.15rem;">📌 診斷與根本原因</h5>
                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
                                    此工作確認為<strong>互動式作業 (Interactive Job, Subsystem: QINTER, 終端裝置: QVIRCD0023)</strong>，且底層監控顯示 <strong>SQL 執行次數為 0</strong>，證實其並非執行 SQL 查詢，而是傳統的 <strong>Native I/O (RPG/COBOL 傳統資料庫讀寫)</strong>。該交易執行了 80.9 萬次邏輯讀取與 21.2 萬次邏輯更新，但伴隨了高達 **7,007,825 次實體寫入 (JBWRT + JBADBW)**，極可能是使用者在 5250 前台直接執行了大型資料拷貝 (CPYF)、檔案重組 (RGZPFM) 或存取路徑重建。<br>
                                    此外，實體讀取次數 (58,510) 與 Page Faults (58,486) 呈 1:1 的強關聯，導致高達 1.3 小時的 Page Wait (JBPW)，說明前台互動式記憶體池 (Pool) 對此作業的實體讀寫缺乏快取，形成嚴重的分頁阻塞。
                                </p>
                            </div>
                            <div style="background: rgba(74, 222, 128, 0.02); border-left: 3px solid var(--accent-green); padding: 0.75rem; border-radius: 6px;">
                                <h5 style="color: var(--accent-green); font-size: 0.85rem; font-weight: 600; margin-bottom: 0.15rem;">💡 優化與改善建議</h5>
                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
                                    1. <strong>禁止於互動式會話中執行重度批次作業</strong>：此為 IBM i 之維運反模式，應宣導使用 <code>SBMJOB</code> 提交至批次子系統 (如 QBATH) 執行，以釋放 QINTER 互動式資源。<br>
                                    2. <strong>Native I/O 程式碼優化</strong>：檢查 RPG/CL 程式是否啟用 Block I/O (如 <code>BLOCK(*YES)</code>) 來減少實體磁碟呼叫次數，並確保善用邏輯檔案 (LF) 與合適的主鍵排序。<br>
                                    3. <strong>記憶體池效能調校</strong>：持續觀察 <code>QPFRADJ</code> 系統值對記憶體池大小的微調狀態，若 Page Fault 持續高企，應評估手動增加交互式儲存池的配置大小。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Case 2: 07/16 CMPFILDTA (Disk I/O Storm) -->
                <div class="rca-card" style="background: var(--card-bg); backdrop-filter: blur(12px); border-radius: 20px; border: 1px solid var(--card-border); padding: 1.75rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <div style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.75rem; margin-bottom: 1.25rem;">
                            <span style="background: rgba(251, 191, 36, 0.1); color: #fbbf24; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">Case 02: 磁碟 I/O 暴風雨</span>
                            <h3 style="font-size: 1.3rem; font-weight: 700; color: var(--text-primary); margin-top: 0.5rem; margin-bottom: 0;">
                                Job: CMPFILDTA (552601) | 07/16 11:00
                            </h3>
                            <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.25rem;">
                                執行緒狀態: 多執行緒並行比對 | 單一區間 I/O: 87,943,713 次 | 累計 CPU: 334.1 秒
                            </p>
                        </div>
                        
                        <div style="margin-bottom: 1.25rem;">
                            <h4 style="font-size: 0.95rem; color: var(--accent-blue); margin-bottom: 0.5rem; font-weight: 600;">📊 多日尖峰區間負載分佈 (07/16 早上)</h4>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; background: rgba(0,0,0,0.2); border-radius: 8px; overflow: hidden; margin-bottom: 1rem;">
                                <thead>
                                    <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.08); text-align: left; color: var(--text-secondary); font-size: 0.75rem;">
                                        <th style="padding: 0.5rem;">區間時間 (15-min Intervals)</th>
                                        <th style="padding: 0.5rem; text-align: right;">執行緒累計 CPU 時間</th>
                                        <th style="padding: 0.5rem; text-align: right;">執行緒總 I/O 次數</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                        <td style="padding: 0.4rem 0.5rem;">⏱️ 07/16 10:45 (INTNUM 44)</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right;">289.9 秒</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-purple);">79,160,157 次</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); background: rgba(251, 191, 36, 0.03);">
                                        <td style="padding: 0.4rem 0.5rem; font-weight: 600;">⏱️ 07/16 11:00 (INTNUM 45 - Peak)</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right; font-weight: 600;">334.1 秒</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: #fbbf24; font-weight: 600;">87,943,713 次</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                        <td style="padding: 0.4rem 0.5rem;">⏱️ 07/16 11:15 (INTNUM 46)</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right;">269.8 秒</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-purple);">72,304,776 次</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                        <td style="padding: 0.4rem 0.5rem;">⏱️ 07/16 11:30 (INTNUM 47)</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right;">307.1 秒</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-purple);">81,561,382 次</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                        <td style="padding: 0.4rem 0.5rem;">⏱️ 07/16 11:45 (INTNUM 48)</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right;">302.6 秒</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-purple);">81,086,848 次</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                        <td style="padding: 0.4rem 0.5rem;">⏱️ 07/16 12:00 (INTNUM 49)</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right;">302.8 秒</td>
                                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-purple);">79,900,912 次</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <div style="background: rgba(251, 191, 36, 0.02); border-left: 3px solid #fbbf24; padding: 0.75rem; border-radius: 6px;">
                                <h5 style="color: #fbbf24; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.15rem;">📌 診斷與根本原因</h5>
                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
                                    此工作確認為 <strong>MIMIX 批次比對作業 (Batch Job, Subsystem: MIMIXSBS, Job Subtype: D - DDM 雙機通訊)</strong>，監控顯示其 <strong>SQL 執行次數為 0</strong>，說明其並非執行 SQL 查詢，而是透過傳統的 <strong>Native RLA (Record-Level Access)</strong> 與 <strong>DDM (Distributed Data Management)</strong> 來跨機讀取與比對資料。<br>
                                    在 10:45 ~ 12:15 間，該 Job 衍生出數十個平行執行緒 (Parallel Threads) 同步工作。各執行緒的寫入量皆為 0 (JBWRT=0, JBADBW=0)，但讀取量極大，且幾乎全部走 **JBADBR (非同步資料庫物理預讀, Asynchronous Database Reads)**。每個執行緒每區間預讀了 400 萬至 900 萬次，累計形成了單一 15 分鐘區間內高達 **87,943,713 次實體讀取**的 I/O 暴風雨。雖然透過非同步預讀實現了 Page Wait 為 0 的高效能讀取，但極限的吞吐量依然會導致磁碟子系統與快取飽和。
                                </p>
                            </div>
                            <div style="background: rgba(74, 222, 128, 0.02); border-left: 3px solid var(--accent-green); padding: 0.75rem; border-radius: 6px;">
                                <h5 style="color: var(--accent-green); font-size: 0.85rem; font-weight: 600; margin-bottom: 0.15rem;">💡 優化與改善建議</h5>
                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
                                    1. <strong>調整比對排程至業務低谷期</strong>：強烈建議將 MIMIX <code>CMPFILDTA</code> 大規模資料比對（特別是涉及大表的比對）安排至**凌晨業務低谷時段** (如 02:00 ~ 05:00) 執行，以避免白天線上聯機交易受到磁碟 Subsystem 延遲波動的波及。<br>
                                    2. <strong>調整並行執行緒上限 (Concurrency Limits)</strong>：在 MIMIX 組態中配置合適的並行執行緒上限，限制單次比對作業的最大並發 Threads 數量。這能平滑物理磁碟預讀 (JBADBR) 的峰值流量，保護即時交易的 I/O 通道寬度。<br>
                                    3. <strong>善用 DDM 網路頻寬配置</strong>：由於此作業屬於 DDM 通訊工作，在大流量讀取時應結合網絡帶寬控流 (Bandwidth throttling)，防止 DDM 數據流同步擠占正常的網絡主通道。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>"""


def main():
    parser = argparse.ArgumentParser(description="Generic IBM i Performance HTML Report Generator (Supports Multi-day & Job Peaks)")
    parser.add_argument("--input", required=True, help="Path to the performance JSON data file")
    parser.add_argument("--output", required=True, help="Path where the output HTML report should be written")
    parser.add_argument("--host", default="Unknown Host", help="Name or IP of the IBM i host")
    parser.add_argument("--lib", default="QPFRDATA", help="Library name containing performance data")
    parser.add_argument("--date", default="ALL", help="Date filter or ALL")
    parser.add_argument("--rca", action="store_true", default=False,
                         help="Include the RCA (Root Cause Analysis) section. NOTE: this section's content is "
                              "currently hardcoded to two specific historical KTB library incidents (07/13 "
                              "HN040130A, 07/16 CMPFILDTA) — it is NOT generated from the input data, so it will "
                              "misrepresent whatever host/library/date this report is actually about. Off by default.")

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: Input file '{args.input}' not found.")
        return

    with open(args.input, 'r', encoding='utf-8') as f:
        payload = json.load(f)

    # Standardize payload structure
    if not isinstance(payload, dict) or "dates" not in payload:
        print("Error: Input JSON must match the consolidated multi-day schema.")
        return

    host = payload.get("host", args.host)
    lib = payload.get("lib", args.lib)
    dates = payload.get("dates", [])
    times = payload.get("times", [])
    data_by_date = payload.get("data", {})
    peak_jobs_by_date = payload.get("peakJobs", {})
    data_quality_warnings = payload.get("dataQualityWarnings", [])

    if not dates:
        print("Error: No dates found in the payload.")
        return

    # Metrics configuration
    metrics = [
        {"id": "chart-count", "key": "Count", "title": "1. Transaction Count (交易次數)", "unit": "次", "is_percent": False, "summary": "分析盤中 OLTP 交易量變化與日間高峰時段趨勢"},
        {"id": "chart-rsp", "key": "Rsp", "title": "2. Transaction Response Time (交易回應時間)", "unit": "秒", "is_percent": False, "summary": "監視線上交易響應延遲與異常 peak 時間點點檢"},
        {"id": "chart-cpu-tot", "key": "Tot", "title": "3. CPU Util Total (CPU 總使用率)", "unit": "%", "is_percent": True, "summary": "掌握 Central Processing Unit (CPU) 整體資源負載與高峰時間 (Y軸固定 0-100%)"},
        {"id": "chart-cpu-int", "key": "Int", "title": "4. CPU Util Total Interactive (互動式 CPU 使用率)", "unit": "%", "is_percent": True, "summary": "監控 5250 / Terminal 綠幕與線上互動作業資源佔用 (Y軸固定 0-100%)"},
        {"id": "chart-cpu-bch", "key": "Bch", "title": "5. CPU Util Total Batch (批次 CPU 使用率)", "unit": "%", "is_percent": True, "summary": "分析背景排程、結算批次與大量資料處理之 CPU 佔用 (Y軸固定 0-100%)"},
        {"id": "chart-disk", "key": "Dsk", "title": "6. High Disk (最高磁碟使用率)", "unit": "%", "is_percent": True, "summary": "檢測 Disk Storage Arm 負載平衡與 Input/Output (I/O) 瓶頸 (Y軸固定 0-100%)"},
        {"id": "chart-fault", "key": "Usr", "title": "7. User Pool Page Fault (User Pool Page Fault)", "unit": "次/秒", "is_percent": False, "summary": "監控使用者記憶體池實體 Page Fault 置換率"}
    ]

    # Calculate statistics for each metric for each date
    stats = {}
    for m in metrics:
        key = m["key"]
        stats[key] = {}
        for d in dates:
            arr = data_by_date.get(d, {}).get(key, [])
            if not arr:
                stats[key][d] = {"max": 0, "max_time": "N/A", "avg": 0.0}
                continue
            max_val = max(arr)
            max_idx = arr.index(max_val)
            avg_val = round(sum(arr) / len(arr), 2)
            stats[key][d] = {
                "max": max_val,
                "max_time": times[max_idx] if max_idx < len(times) else "N/A",
                "avg": avg_val
            }

    # Generate Cards HTML
    cards_html_list = []
    for m in metrics:
        key = m["key"]
        
        # 1. Generate Stats Table rows
        stats_rows = ""
        for d in dates:
            s = stats[key][d]
            stats_rows += f"""
            <tr>
                <td style="padding: 0.5rem; text-align: left; color: var(--accent-blue); font-weight: 500;">📅 {d}</td>
                <td style="padding: 0.5rem; font-weight: 600;">{s['max']} {m['unit']}</td>
                <td style="padding: 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">⏱️ {s['max_time']}</td>
                <td style="padding: 0.5rem; color: var(--accent-purple); font-weight: 500;">{s['avg']} {m['unit']}</td>
            </tr>
            """

        # Define dynamic headers and panel titles
        if key == "Rsp":
            panel_title = "🔥 尖峰時段 Top 10 Job 交易回應時間排行"
            value_col_header = "回應時間"
            last_col_header = "交易次數"
            value_unit = "秒"
            last_col_unit = "次"
        elif key == "Count":
            panel_title = "🔥 尖峰時段 Top 10 Job 交易次數排行"
            value_col_header = "交易次數"
            last_col_header = "平均回應時間"
            value_unit = "次"
            last_col_unit = "秒"
        elif key == "Dsk":
            panel_title = "🔥 尖峰時段 Top 10 Job 磁碟 I/O 排行"
            value_col_header = "CPU 時間"
            last_col_header = "磁碟 I/O 次數"
            value_unit = "ms"
            last_col_unit = "次"
        elif key == "Usr":
            panel_title = "🔥 尖峰時段 Top 10 Job 分頁缺失排行"
            value_col_header = "CPU 時間"
            last_col_header = "分頁缺失"
            value_unit = "ms"
            last_col_unit = "次"
        elif key in ["Tot", "Bch", "Int"]:
            panel_title = "🔥 尖峰時段 Top 10 Job CPU 負載排行"
            value_col_header = "CPU 時間"
            last_col_header = "分頁缺失"
            value_unit = "ms"
            last_col_unit = "次"
        else:
            panel_title = "🔥 尖峰時段 Top 10 Job 負載排行"
            value_col_header = "CPU 時間"
            last_col_header = "頁面缺失"
            value_unit = "ms"
            last_col_unit = "次"

        # 2. Generate Tabs for Top 10 Jobs
        tab_buttons = ""
        tab_contents = ""
        for idx, d in enumerate(dates):
            active_class = "active" if idx == 0 else ""
            display_style = "display: block;" if idx == 0 else "display: none;"
            
            # Button
            tab_buttons += f"""
            <button id="{m['id']}-btn-{idx}" class="tab-btn {active_class}" onclick="switchTab(event, '{m['id']}-tab-{idx}', '{d}', '{key}')">{d}</button>
            """
            
            # Content (Top 10 Jobs table for Peak time as initial render)
            peak_time_of_day = stats[key][d]['max_time']
            jobs_list = peak_jobs_by_date.get(d, {}).get(key, {}).get(peak_time_of_day, [])
            
            job_rows = ""
            if not jobs_list:
                job_rows = "<tr><td colspan='5' style='text-align: center; color: var(--text-secondary); padding: 1rem;'>無可用之 Job 負載數據</td></tr>"
            else:
                for rank, j in enumerate(jobs_list):
                    cpu_val = j.get('cpu_ms')
                    faults_val = j.get('faults')
                    
                    cpu_formatted = f"{cpu_val:,.2f}" if key == "Rsp" and cpu_val is not None else f"{cpu_val:,}" if cpu_val is not None else "N/A"
                    faults_formatted = f"{faults_val:,.2f}" if key == "Count" and faults_val is not None else f"{faults_val:,}" if faults_val is not None else "N/A"

                    job_rows += f"""
                    <tr>
                        <td style="padding: 0.4rem 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">#{rank + 1}</td>
                        <td style="padding: 0.4rem 0.5rem; font-family: monospace; font-weight: 600; color: var(--text-primary);">{j.get('job_name', 'N/A')}</td>
                        <td style="padding: 0.4rem 0.5rem; color: var(--text-secondary);">{j.get('user_name', 'N/A')}</td>
                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-blue); font-weight: 500;">{cpu_formatted} {value_unit}</td>
                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-purple);">{faults_formatted} {last_col_unit}</td>
                    </tr>
                    """

            tab_contents += f"""
            <div id="{m['id']}-tab-{idx}" class="tab-content {active_class}" style="{display_style}">
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;">⏱️ 當前選定時段: <strong class="peak-time-display" id="{m['id']}-time-{idx}">{peak_time_of_day}</strong> 的工作負載排行</div>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); text-align: left; color: var(--text-secondary); font-size: 0.8rem;">
                            <th style="padding: 0.4rem 0.5rem;">#</th>
                            <th style="padding: 0.4rem 0.5rem;">工作名稱 (Job Name)</th>
                            <th style="padding: 0.4rem 0.5rem;">使用者 (User)</th>
                            <th style="padding: 0.4rem 0.5rem; text-align: right;">{value_col_header}</th>
                            <th style="padding: 0.4rem 0.5rem; text-align: right;">{last_col_header}</th>
                        </tr>
                    </thead>
                    <tbody class="jobs-tbody" id="{m['id']}-tbody-{idx}">
                        {job_rows}
                    </tbody>
                </table>
            </div>
            """

        # 3. Dynamic Analysis & Recommendations based on absolute peak
        max_d = max(dates, key=lambda d: stats[key][d]['max'])
        abs_max = stats[key][max_d]['max']
        abs_max_time = stats[key][max_d]['max_time']
        
        # CPU
        if key == "Tot":
            if abs_max > 70:
                analysis = f"1. **運算資源吃緊警告**：跨日最大 CPU 使用率高達 {abs_max}% (於 {max_d} {abs_max_time})。已突破 70% 的安全臨界點。<br>2. **主導工作負載**：請在左圖移動滑鼠，觀察高點時段的 Top 10 Job 排行。若是由非關鍵背景批次 (QBATCH) 引發，建議進行工作優先級限制。"
                recommendation = "1. **LPAR 核心擴展**：考慮為此分割區分配更多 CPU 資源。<br>2. **錯峰批次排程**：將佔用 CPU 的重度 Job 排程調整至 22:00 以後分流執行。"
            else:
                analysis = f"1. **運算資源充沛**：跨日最大 CPU 使用率僅為 {abs_max}% (於 {max_d} {abs_max_time})，系統整體運算負載極低，運作極為順暢。<br>2. **負載分佈特徵**：全天大部分時間使用率均在 1% ~ 5% 的低水位，無任何突發性資源瓶頸。"
                recommendation = "1. **維持現有配置**：運算資源十分充足，無需進行硬體核心擴充。<br>2. **部署測試環境**：現有極大之與資源非常適合作為高負載壓力測試或新系統併行驗證的環境。"
        
        # Response Time
        elif key == "Rsp":
            if abs_max > 2.0:
                analysis = f"1. **異常交易回應延遲**：在 {max_d} {abs_max_time} 觀察到最大回應時間達 {abs_max} 秒的單點 Peak。<br>2. **潛在鎖定競爭**：當尖峰延遲大於 2 秒而交易量未暴增時，多代表有特定資料庫 Table Lock 或鎖定等待 (Lock Wait) 發生。"
                recommendation = "1. **Lock Wait 追蹤**：點擊該時段的點，查閱右側 Top 10 Job，檢查是否有如 `QZDASOVR` 等 SQL 連線正在等待鎖定釋放。<br>2. **優化逾時機制**：於程式端設定連線 Timeout，防範個別卡死拖垮整體連線池。"
            else:
                analysis = f"1. **交易響應極佳**：跨日最大回應時間僅為 {abs_max} 秒 (於 {max_d} {abs_max_time})，平均回應時間維持在 0.1~0.3 秒極佳範圍。<br>2. **系統運作順暢**：未見任何資料庫行鎖 (Record Lock) 或資源爭搶所導致的長延遲 Peak。"
                recommendation = "1. **例行索引維護**：維持現有資料庫索引結構，定期優化查詢與重置 Index。<br>2. **閥值警示設定**：於監控台配置當回應時間大於 1.5 秒時觸發警告通知。"

        # Page Faults
        elif key == "Usr":
            if abs_max > 50:
                analysis = f"1. **實體記憶體置換警告**：User Pool 頁面缺失率最大達到 {abs_max} 次/秒 (於 {max_d} {abs_max_time})。<br>2. **記憶體不足徵兆**：Page Fault 頻繁代表程式需要頻繁地進行磁碟 I/O 置換，會嚴重拖累資料庫 SQL 的執行回應時間。"
                recommendation = "1. **調整 QPFRADJ 系統值**：確認 `SYSVAL QPFRADJ` 設定為 2 或 3，由系統自動微調 Memory Pool 大小。<br>2. **手動調大 User Pool**：若該時段有大量 Java (如 `QZRCSRVS`) 或批次工作執行，手動提高主要 Subsystem 所屬 Pool 的大小。"
            else:
                analysis = f"1. **分頁分配合理**：User Pool 最大分頁缺失率為 {abs_max} 次/秒 (於 {max_d} {abs_max_time})，全天平均接近 0。<br>2. **置換開銷極低**：力求程式碼與 DB2 熱點資料皆成功快取在實體記憶體中，磁碟置換開銷極低。"
                recommendation = "1. **維持現狀**：記憶體分配合理，無需手動調整分配。<br>2. **容量規劃監控**：持續觀察未來若有新增大型應用（如 JVM）時的 Fault 波動。"
        
        # Default templates for others
        else:
            analysis = f"1. **數據趨勢**：跨日最大值為 {abs_max} {m['unit']} (發生於 {max_d} {abs_max_time})。<br>2. **系統負載正常**：各採樣點曲線變化平緩，符合日常業務的波動週期特徵。"
            recommendation = f"1. **例行點檢**：持續觀測指標是否偏離歷史基準線。<br>2. **系統值設定**：確認相關資源分配池 (Pools) 配置符合預期配置值。"

        card = f"""
            <div class="chart-card">
                <div class="chart-header">
                    <h2>{m['title']}</h2>
                    <p>{m['summary']}</p>
                </div>

                <div class="card-body-grid">
                    <!-- Column 1: Chart & Stats -->
                    <div class="card-left-col">
                        <div class="chart-wrapper">
                            <canvas id="{m['id']}"></canvas>
                        </div>
                        
                        <div style="margin-top: 1rem;">
                            <h4 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase;">📈 跨日數據點檢表</h4>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; background: rgba(0,0,0,0.2); border-radius: 8px; overflow: hidden;">
                                <thead>
                                    <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05); text-align: left; color: var(--text-secondary); font-size: 0.8rem;">
                                        <th style="padding: 0.5rem;">日期</th>
                                        <th style="padding: 0.5rem;">Peak 峰值</th>
                                        <th style="padding: 0.5rem;">峰值時間</th>
                                        <th style="padding: 0.5rem;">平均值</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats_rows}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Column 2: Peak Jobs & Insights -->
                    <div class="card-right-col">
                        <div class="jobs-panel">
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
                                <h4 style="font-size: 0.9rem; color: var(--accent-amber); text-transform: uppercase;">{panel_title}</h4>
                                <div class="tab-buttons-container">
                                    {tab_buttons}
                                </div>
                            </div>
                            {tab_contents}
                        </div>

                        <div class="insights-section">
                            <div class="insight-box analysis">
                                <h3>📊 效能分析與診斷 (Analysis & Insights)</h3>
                                <div>{analysis}</div>
                            </div>
                            <div class="insight-box recommendation">
                                <h3>💡 系統優化與改善建議 (Optimization Recommendations)</h3>
                                <div>{recommendation}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        """
        cards_html_list.append(card)

    cards_html = "\n".join(cards_html_list)

    html_template = """<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{lib} 效能分析報告</title>
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
    <!-- Chart.js CDN -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {{
            --bg-color: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --card-border: rgba(255, 255, 255, 0.08);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-blue: #38bdf8;
            --accent-purple: #c084fc;
            --accent-amber: #fbbf24;
            --accent-green: #4ade80;
        }}

        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}

        body {{
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            line-height: 1.6;
            padding: 2rem 1rem;
            background-image: 
                radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.12) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(192, 132, 252, 0.1) 0px, transparent 50%);
            background-attachment: fixed;
        }}

        .container {{
            max-width: 1600px;
            margin: 0 auto;
        }}

        header {{
            text-align: center;
            margin-bottom: 3rem;
            padding: 2rem 1rem;
            background: var(--card-bg);
            backdrop-filter: blur(12px);
            border-radius: 20px;
            border: 1px solid var(--card-border);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
        }}

        header h1 {{
            font-family: 'Outfit', sans-serif;
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #38bdf8 0%, #c084fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.5rem;
        }}

        header p {{
            color: var(--text-secondary);
            font-size: 1.1rem;
        }}

        .meta-badges {{
            display: flex;
            justify-content: center;
            gap: 1rem;
            margin-top: 1rem;
            flex-wrap: wrap;
        }}

        .badge {{
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--card-border);
            padding: 0.4rem 1rem;
            border-radius: 9999px;
            font-size: 0.875rem;
            color: var(--accent-blue);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }}

        .dashboard-grid {{
            display: grid;
            grid-template-columns: 1fr;
            gap: 3rem;
        }}

        .chart-card {{
            background: var(--card-bg);
            backdrop-filter: blur(12px);
            border-radius: 24px;
            border: 1px solid var(--card-border);
            padding: 2.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }}

        .chart-card:hover {{
            transform: translateY(-4px);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
        }}

        .chart-header {{
            border-bottom: 1px solid rgba(255,255,255,0.05);
            padding-bottom: 1rem;
            margin-bottom: 1.5rem;
        }}

        .chart-header h2 {{
            font-family: 'Outfit', sans-serif;
            font-size: 1.6rem;
            font-weight: 600;
            color: var(--text-primary);
        }}

        .chart-header p {{
            font-size: 0.92rem;
            color: var(--text-secondary);
            margin-top: 0.25rem;
        }}

        .card-body-grid {{
            display: grid;
            /* Each column (chart, Top 10 panel) needs at least 420px to render
               without cramping its own content (job names, wide headers like
               "平均回應時間"). auto-fit drops to a single stacked column
               automatically once there isn't room for both at that minimum,
               instead of a fixed pixel breakpoint squeezing the panel narrower
               than its content can actually fit. */
            grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
            gap: 2rem;
        }}

        .chart-wrapper {{
            position: relative;
            height: 380px;
            width: 100%;
            background: rgba(0, 0, 0, 0.15);
            border-radius: 16px;
            padding: 1rem;
            border: 1px solid rgba(255,255,255,0.02);
        }}

        .jobs-panel {{
            background: rgba(15, 23, 42, 0.5);
            border: 1px solid var(--card-border);
            padding: 1.5rem;
            border-radius: 16px;
            margin-bottom: 1.5rem;
        }}

        .tab-buttons-container {{
            display: flex;
            gap: 0.3rem;
            background: rgba(255,255,255,0.03);
            padding: 0.2rem;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.05);
        }}

        .tab-btn {{
            background: transparent;
            border: none;
            color: var(--text-secondary);
            padding: 0.3rem 0.8rem;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }}

        .tab-btn:hover {{
            color: var(--text-primary);
            background: rgba(255,255,255,0.02);
        }}

        .tab-btn.active {{
            background: var(--accent-blue);
            color: var(--bg-color);
            font-weight: 600;
        }}

        .tab-content {{
            display: none;
            animation: fadeIn 0.3s ease;
        }}

        .tab-content.active {{
            display: block;
        }}

        @keyframes fadeIn {{
            from {{ opacity: 0; transform: translateY(2px); }}
            to {{ opacity: 1; transform: translateY(0); }}
        }}

        .insights-section {{
            display: grid;
            grid-template-columns: 1fr;
            gap: 1rem;
        }}

        .insight-box {{
            background: rgba(15, 23, 42, 0.3);
            border-radius: 12px;
            padding: 1.25rem;
            border-left: 4px solid var(--accent-blue);
            border: 1px solid rgba(255,255,255,0.02);
            border-left: 4px solid var(--accent-blue);
        }}

        .insight-box.recommendation {{
            border-left-color: var(--accent-green);
        }}

        .insight-box h3 {{
            font-size: 1rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
        }}

        .insight-box.analysis h3 {{
            color: var(--accent-blue);
        }}

        .insight-box.recommendation h3 {{
            color: var(--accent-green);
        }}

        .insight-box div {{
            font-size: 0.9rem;
            color: var(--text-secondary);
            line-height: 1.6;
        }}

        footer {{
            text-align: center;
            margin-top: 5rem;
            color: var(--text-secondary);
            font-size: 0.9rem;
            padding: 2rem;
            border-top: 1px solid rgba(255,255,255,0.05);
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>{lib} 效能分析報告</h1>
            <p>IBM i Collection Services ({lib}) 多日趨勢與動態工作負載觀測指標</p>
            <div class="meta-badges">
                <span class="badge">💻 主機: {host}</span>
                <span class="badge">📚 Library: {lib}</span>
                <span class="badge">📅 日期範圍: {date_range}</span>
                <span class="badge">⏱️ 採樣頻率: 15 分鐘 (96 Interval/天)</span>
            </div>
        </header>

        {warnings_banner}

        <div class="dashboard-grid">
            {cards_html}
        </div>

        {rca_section}

        <footer>
            <p>本報告由 IBM i Performance Reporter 系統自動產出 | Data Source: {lib} (15-min Intervals)</p>
        </footer>
    </div>

    <script>
        const times = {times_js};
        const dates = {dates_js};
        const rawData = {raw_data_js};
        const peakJobsByDate = {peak_jobs_js};
        const metricsConfig = {metrics_config_js};

        // Track currently selected time for each metric card
        const currentTimes = {{}};
        metricsConfig.forEach(cfg => {{
            // Default to the day of absolute max value's peak time
            let absMax = -1;
            let absTime = "00:00";
            dates.forEach(d => {{
                const arr = rawData[d][cfg.key] || [];
                if (arr.length > 0) {{
                    const maxVal = Math.max(...arr);
                    if (maxVal > absMax) {{
                        absMax = maxVal;
                        const idx = arr.indexOf(maxVal);
                        absTime = times[idx] || "00:00";
                    }}
                }}
            }});
            currentTimes[cfg.key] = absTime;
        }});

        // Global switch tab helper (manual click)
        function switchTab(evt, tabId, date, metricKey) {{
            const cardElement = evt.currentTarget.closest('.jobs-panel');
            
            const contents = cardElement.querySelectorAll('.tab-content');
            contents.forEach(c => c.style.display = 'none');
            
            const buttons = cardElement.querySelectorAll('.tab-btn');
            buttons.forEach(b => b.classList.remove('active'));
            
            document.getElementById(tabId).style.display = 'block';
            evt.currentTarget.classList.add('active');
            
            // Render jobs for this new tab's date, keeping the current time
            const currentTime = currentTimes[metricKey];
            updateJobsList(metricKey, date, currentTime);
        }}

        // Dynamic jobs list renderer
        function updateJobsList(metricKey, date, time) {{
            currentTimes[metricKey] = time; // Update tracked time
            
            const dateJobs = peakJobsByDate[date];
            if (!dateJobs || !dateJobs[metricKey]) return;
            
            const timeJobs = dateJobs[metricKey][time] || [];
            
            const headers = {{
                "Rsp": {{ valHeader: "回應時間", lastHeader: "交易次數", valUnit: "秒", lastUnit: "次" }},
                "Count": {{ valHeader: "交易次數", lastHeader: "平均回應時間", valUnit: "次", lastUnit: "秒" }},
                "Dsk": {{ valHeader: "CPU 時間", lastHeader: "磁碟 I/O 次數", valUnit: "ms", lastUnit: "次" }},
                "Usr": {{ valHeader: "CPU 時間", lastHeader: "分頁缺失", valUnit: "ms", lastUnit: "次" }},
                "Tot": {{ valHeader: "CPU 時間", lastHeader: "分頁缺失", valUnit: "ms", lastUnit: "次" }},
                "Int": {{ valHeader: "CPU 時間", lastHeader: "分頁缺失", valUnit: "ms", lastUnit: "次" }},
                "Bch": {{ valHeader: "CPU 時間", lastHeader: "分頁缺失", valUnit: "ms", lastUnit: "次" }}
            }};
            const cfg = headers[metricKey] || headers["Tot"];

            let jobRows = "";
            if (timeJobs.length === 0) {{
                jobRows = `<tr><td colspan='5' style='text-align: center; color: var(--text-secondary); padding: 1rem;'>該時段 (${{time}}) 無 Job 負載數據</td></tr>`;
            }} else {{
                timeJobs.forEach((j, rank) => {{
                    let cpu_formatted = "N/A";
                    let faults_formatted = "N/A";
                    
                    if (j.cpu_ms !== null) {{
                        if (metricKey === "Rsp") {{
                            cpu_formatted = j.cpu_ms.toFixed(2);
                        }} else {{
                            cpu_formatted = j.cpu_ms.toLocaleString();
                        }}
                    }}
                    
                    if (j.faults !== null) {{
                        if (metricKey === "Count") {{
                            faults_formatted = j.faults.toFixed(2);
                        }} else {{
                            faults_formatted = j.faults.toLocaleString();
                        }}
                    }}

                    jobRows += `
                    <tr>
                        <td style="padding: 0.4rem 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">#${{rank + 1}}</td>
                        <td style="padding: 0.4rem 0.5rem; font-family: monospace; font-weight: 600; color: var(--text-primary);">${{j.job_name}}</td>
                        <td style="padding: 0.4rem 0.5rem; color: var(--text-secondary);">${{j.user_name}}</td>
                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-blue); font-weight: 500;">${{cpu_formatted}} ${{cfg.valUnit}}</td>
                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-purple);">${{faults_formatted}} ${{cfg.lastUnit}}</td>
                    </tr>
                    `;
                }});
            }}

            const dateIdx = dates.indexOf(date);
            const cardId = `chart-${{metricKey.toLowerCase() === 'usr' ? 'fault' : metricKey.toLowerCase() === 'tot' ? 'cpu-tot' : metricKey.toLowerCase() === 'int' ? 'cpu-int' : metricKey.toLowerCase() === 'bch' ? 'cpu-bch' : metricKey.toLowerCase() === 'dsk' ? 'disk' : metricKey.toLowerCase()}}`;
            
            const tbody = document.getElementById(`${{cardId}}-tbody-${{dateIdx}}`);
            if (tbody) tbody.innerHTML = jobRows;
            
            const timeSpan = document.getElementById(`${{cardId}}-time-${{dateIdx}}`);
            if (timeSpan) timeSpan.textContent = time;
        }}

        // Hover event programmatically switch tab and update data
        function triggerTabSwitch(metricKey, date, time) {{
            const dateIdx = dates.indexOf(date);
            const cardId = `chart-${{metricKey.toLowerCase() === 'usr' ? 'fault' : metricKey.toLowerCase() === 'tot' ? 'cpu-tot' : metricKey.toLowerCase() === 'int' ? 'cpu-int' : metricKey.toLowerCase() === 'bch' ? 'cpu-bch' : metricKey.toLowerCase() === 'dsk' ? 'disk' : metricKey.toLowerCase()}}`;
            const btn = document.getElementById(`${{cardId}}-btn-${{dateIdx}}`);
            
            if (btn && !btn.classList.contains('active')) {{
                const panel = btn.closest('.jobs-panel');
                
                panel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                panel.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
                
                const content = document.getElementById(`${{cardId}}-tab-${{dateIdx}}`);
                if (content) content.style.display = 'block';
            }}
            
            // Always update table contents for the active date tab
            updateJobsList(metricKey, date, time);
        }}

        const colors = ['#38bdf8', '#c084fc', '#4ade80', '#fbbf24', '#f43f5e'];

        metricsConfig.forEach(cfg => {{
            const ctx = document.getElementById(cfg.id).getContext('2d');
            
            const datasets = [];
            dates.forEach((d, idx) => {{
                const color = colors[idx % colors.length];
                
                const grad = ctx.createLinearGradient(0, 0, 0, 300);
                grad.addColorStop(0, color + '30'); // 18% opacity
                grad.addColorStop(1, color + '00'); // transparent

                datasets.push({{
                    label: `${{d}}`,
                    data: rawData[d][cfg.key],
                    borderColor: color,
                    backgroundColor: grad,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 1.5,
                    pointHoverRadius: 6
                }});
            }});

            const yScaleConfig = {{
                grid: {{ color: 'rgba(255, 255, 255, 0.04)' }},
                ticks: {{
                    color: '#94a3b8',
                    font: {{ size: 11 }}
                }},
                beginAtZero: true
            }};

            if (cfg.is_percent) {{
                yScaleConfig.min = 0;
                yScaleConfig.max = 100;
            }}

            new Chart(ctx, {{
                type: 'line',
                data: {{
                    labels: times,
                    datasets: datasets
                }},
                options: {{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {{
                        mode: 'index',
                        intersect: false,
                    }},
                    onHover: (event, elements, chart) => {{
                        const nearest = chart.getElementsAtEventForMode(event, 'nearest', {{ intersect: false }}, true);
                        if (nearest && nearest.length > 0) {{
                            const index = nearest[0].index;
                            const datasetIndex = nearest[0].datasetIndex;
                            const date = dates[datasetIndex];
                            const time = times[index];
                            triggerTabSwitch(cfg.key, date, time);
                        }}
                    }},
                    plugins: {{
                        legend: {{
                            labels: {{
                                color: '#94a3b8',
                                font: {{ family: 'Inter', size: 12 }}
                            }}
                        }},
                        tooltip: {{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#f8fafc',
                            bodyColor: '#cbd5e1',
                            borderColor: 'rgba(255, 255, 255, 0.08)',
                            borderWidth: 1,
                            padding: 12,
                            usePointStyle: true
                        }}
                    }},
                    scales: {{
                        x: {{
                            grid: {{ color: 'rgba(255, 255, 255, 0.04)' }},
                            ticks: {{
                                color: '#94a3b8',
                                font: {{ size: 10 }},
                                maxTicksLimit: 24
                            }}
                        }},
                        y: yScaleConfig
                    }}
                }}
            }});
        }});
    </script>
</body>
</html>
"""

    date_range_str = " ~ ".join(dates) if len(dates) > 1 else dates[0]

    if data_quality_warnings:
        warning_items = "".join(f"<li>{w}</li>" for w in data_quality_warnings)
        warnings_banner_html = f"""
        <div style="margin-bottom: 1.5rem; padding: 1rem 1.25rem; border-radius: 0.75rem; background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.35);">
            <strong style="color: #fbbf24;">⚠️ 資料健檢警告：以下指標可能不可靠，請人工確認</strong>
            <ul style="margin: 0.5rem 0 0 1.25rem; color: var(--text-secondary); font-size: 0.9rem;">{warning_items}</ul>
        </div>"""
    else:
        warnings_banner_html = ""

    final_html = html_template.format(
        host=host,
        lib=lib,
        date_range=date_range_str,
        warnings_banner=warnings_banner_html,
        cards_html=cards_html,
        times_js=json.dumps(times),
        dates_js=json.dumps(dates),
        raw_data_js=json.dumps(data_by_date),
        peak_jobs_js=json.dumps(peak_jobs_by_date),
        metrics_config_js=json.dumps(metrics, ensure_ascii=False),
        rca_section=RCA_SECTION_HTML if args.rca else ""
    )

    out_dir = os.path.dirname(args.output)
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir)

    with open(args.output, 'w', encoding='utf-8') as f:
        f.write(final_html)

    print(f"Successfully generated HTML report at: {args.output}")

if __name__ == "__main__":
    main()
