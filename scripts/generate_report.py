import json
import os
import argparse
import sys

# Add the parent directory of reporting to sys.path so we can import it
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from string import Template
from reporting.templates import get_html_template, get_css_asset, get_js_asset, get_rca_section
from reporting.data_processor import calculate_stats, get_panel_headers
from reporting.insights_engine import generate_insights

def main():
    parser = argparse.ArgumentParser(description="Generic IBM i Performance HTML Report Generator (Supports Multi-day & Job Peaks)")
    parser.add_argument("--input", required=True, help="Path to the performance JSON data file")
    parser.add_argument("--output", required=True, help="Path where the output HTML report should be written")
    parser.add_argument("--host", default="Unknown Host", help="Name or IP of the IBM i host")
    parser.add_argument("--lib", default="QPFRDATA", help="Library name containing performance data")
    parser.add_argument("--date", default="ALL", help="Date filter or ALL")
    parser.add_argument("--rca", action="store_true", default=False, help="Include the RCA (Root Cause Analysis) section.")

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: Input file '{args.input}' not found.")
        return

    with open(args.input, 'r', encoding='utf-8') as f:
        payload = json.load(f)

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

    metrics = [
        {"id": "chart-count", "key": "Count", "title": "1. Transaction Count (交易次數)", "unit": "次", "is_percent": False, "summary": "分析盤中 OLTP 交易量變化與日間高峰時段趨勢"},
        {"id": "chart-rsp", "key": "Rsp", "title": "2. Transaction Response Time (交易回應時間)", "unit": "秒", "is_percent": False, "summary": "監視線上交易響應延遲與異常 peak 時間點點檢"},
        {"id": "chart-cpu-tot", "key": "Tot", "title": "3. CPU Util Total (CPU 總使用率)", "unit": "%", "is_percent": True, "summary": "掌握 Central Processing Unit (CPU) 整體資源負載與高峰時間 (Y軸固定 0-100%)"},
        {"id": "chart-cpu-int", "key": "Int", "title": "4. CPU Util Total Interactive (互動式 CPU 使用率)", "unit": "%", "is_percent": True, "summary": "監控 5250 / Terminal 綠幕與線上互動作業資源佔用 (Y軸固定 0-100%)"},
        {"id": "chart-cpu-bch", "key": "Bch", "title": "5. CPU Util Total Batch (批次 CPU 使用率)", "unit": "%", "is_percent": True, "summary": "分析背景排程、結算批次與大量資料處理之 CPU 佔用 (Y軸固定 0-100%)"},
        {"id": "chart-disk", "key": "Dsk", "title": "6. High Disk (最高磁碟使用率)", "unit": "%", "is_percent": True, "summary": "檢測 Disk Storage Arm 負載平衡與 Input/Output (I/O) 瓶頸 (Y軸固定 0-100%)"},
        {"id": "chart-fault", "key": "Usr", "title": "7. User Pool Page Fault (User Pool Page Fault)", "unit": "次/秒", "is_percent": False, "summary": "監控使用者記憶體池實體 Page Fault 置換率"}
    ]

    stats = calculate_stats(dates, times, data_by_date, metrics)

    cards_html_list = []
    for m in metrics:
        key = m["key"]
        
        # 1. Generate Stats Table rows
        stats_rows = ""
        for d in dates:
            s = stats[key][d]
            stats_rows += f'''
            <tr>
                <td style="padding: 0.5rem; text-align: left; color: var(--accent-blue); font-weight: 500;">📅 {d}</td>
                <td style="padding: 0.5rem; font-weight: 600;">{s['max']} {m['unit']}</td>
                <td style="padding: 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">⏱️ {s['max_time']}</td>
                <td style="padding: 0.5rem; color: var(--accent-purple); font-weight: 500;">{s['avg']} {m['unit']}</td>
            </tr>
            '''

        # Define dynamic headers and panel titles
        headers = get_panel_headers(key)

        # 2. Generate Tabs for Top 10 Jobs
        tab_buttons = ""
        tab_contents = ""
        for idx, d in enumerate(dates):
            active_class = "active" if idx == 0 else ""
            display_style = "display: block;" if idx == 0 else "display: none;"
            
            tab_buttons += f'''
            <button id="{m['id']}-btn-{idx}" class="tab-btn {active_class}" onclick="switchTab(event, '{m['id']}-tab-{idx}', '{d}', '{key}')">{d}</button>
            '''
            
            peak_time_of_day = stats[key][d]['max_time']
            jobs_list = peak_jobs_by_date.get(d, {}).get(key, {}).get(peak_time_of_day, [])
            
            job_rows = ""
            if not jobs_list:
                job_rows = "<tr><td colspan='5' style='text-align: center; color: var(--text-secondary); padding: 1rem;'>無可用之 Job 負載數據</td></tr>"
            else:
                for rank, j in enumerate(jobs_list):
                    val1_val = j.get('val1')
                    val2_val = j.get('val2')
                    
                    # Rsp uses float for val1 (seconds), Count uses float for val2 (seconds)
                    if val1_val is not None:
                        if key == "Rsp":
                            val1_formatted = f"{val1_val:,.2f}"
                        else:
                            val1_formatted = f"{val1_val:,}"
                    else:
                        val1_formatted = "N/A"
                        
                    if val2_val is not None:
                        if key == "Count" or (key == "Int" and val2_val < 100): # Rsp is a float
                            val2_formatted = f"{val2_val:,.2f}"
                        else:
                            val2_formatted = f"{val2_val:,}"
                    else:
                        val2_formatted = "N/A"

                    job_rows += f'''
                    <tr>
                        <td style="padding: 0.4rem 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">#{rank + 1}</td>
                        <td style="padding: 0.4rem 0.5rem; font-family: monospace; font-weight: 600; color: var(--text-primary);">{j.get('job_name', 'N/A')}</td>
                        <td style="padding: 0.4rem 0.5rem; color: var(--text-secondary);">{j.get('user_name', 'N/A')}</td>
                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-blue); font-weight: 500;">{val1_formatted} {headers["val_unit"]}</td>
                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-purple);">{val2_formatted} {headers["last_unit"]}</td>
                    </tr>
                    '''

            tab_contents += f'''
            <div id="{m['id']}-tab-{idx}" class="tab-content {active_class}" style="{display_style}">
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;">⏱️ 當前選定時段: <strong class="peak-time-display" id="{m['id']}-time-{idx}">{peak_time_of_day}</strong> 的工作負載排行</div>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); text-align: left; color: var(--text-secondary); font-size: 0.8rem;">
                            <th style="padding: 0.4rem 0.5rem;">#</th>
                            <th style="padding: 0.4rem 0.5rem;">工作名稱 (Job Name)</th>
                            <th style="padding: 0.4rem 0.5rem;">使用者 (User)</th>
                            <th style="padding: 0.4rem 0.5rem; text-align: right;">{headers["val_header"]}</th>
                            <th style="padding: 0.4rem 0.5rem; text-align: right;">{headers["last_header"]}</th>
                        </tr>
                    </thead>
                    <tbody class="jobs-tbody" id="{m['id']}-tbody-{idx}">
                        {job_rows}
                    </tbody>
                </table>
            </div>
            '''

        # 3. Dynamic Analysis & Recommendations
        max_d = max(dates, key=lambda d: stats[key][d]['max'])
        abs_max = stats[key][max_d]['max']
        abs_max_time = stats[key][max_d]['max_time']
        
        analysis, recommendation = generate_insights(key, abs_max, max_d, abs_max_time)

        card = f'''
            <div class="chart-card">
                <div class="chart-header">
                    <h2>{m['title']}</h2>
                    <p>{m['summary']}</p>
                </div>

                <div class="card-body-grid">
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

                    <div class="card-right-col">
                        <div class="jobs-panel">
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
                                <h4 style="font-size: 0.9rem; color: var(--accent-amber); text-transform: uppercase;">{headers["title"]}</h4>
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
        '''
        cards_html_list.append(card)

    cards_html = "\n".join(cards_html_list)
    date_range_str = " ~ ".join(dates) if len(dates) > 1 else dates[0]

    if data_quality_warnings:
        warning_items = "".join(f"<li>{w}</li>" for w in data_quality_warnings)
        warnings_banner_html = f'''
        <div style="margin-bottom: 1.5rem; padding: 1rem 1.25rem; border-radius: 0.75rem; background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.35);">
            <strong style="color: #fbbf24;">⚠️ 資料健檢警告：以下指標可能不可靠，請人工確認</strong>
            <ul style="margin: 0.5rem 0 0 1.25rem; color: var(--text-secondary); font-size: 0.9rem;">{warning_items}</ul>
        </div>'''
    else:
        warnings_banner_html = ""

    html_template_str = get_html_template()
    template = Template(html_template_str)

    final_html = template.safe_substitute(
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
        rca_section=get_rca_section() if args.rca else "",
        css_content=get_css_asset(),
        js_content=get_js_asset()
    )

    out_dir = os.path.dirname(args.output)
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir)

    with open(args.output, 'w', encoding='utf-8') as f:
        f.write(final_html)

    print(f"Successfully generated HTML report at: {args.output}")

if __name__ == "__main__":
    main()
