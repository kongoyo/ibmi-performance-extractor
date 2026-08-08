import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  getHtmlTemplate,
  getCssAsset,
  getJsAsset,
  getRcaSection,
} from "./templates.js";
import { calculateStats, getPanelHeaders } from "./dataProcessor.js";
import { generateInsights } from "./insightsEngine.js";

/**
 * Safe substitute for placeholder replacement.
 * Simulates Python's string.Template.safe_substitute.
 *
 * @param {string} template
 * @param {Object} mapping
 * @returns {string}
 */
export function safeSubstitute(template, mapping) {
  return template.replace(
    /\$\$(?!\$)|\$(?:{([^}]+)}|([a-zA-Z0-9_]+))/g,
    (match, p1, p2) => {
      if (match === "$$") {
        return "$";
      }
      const key = p1 || p2;
      return key in mapping ? String(mapping[key]) : match;
    }
  );
}

/**
 * Formats a value with thousands separators and optional decimals.
 * Matches Python f-string formats: `,` or `,.2f`.
 *
 * @param {number|null|undefined} val
 * @param {string} key
 * @param {string} type - 'val1' or 'val2'
 * @returns {string}
 */
export function formatVal(val, key, type) {
  if (val === undefined || val === null) {
    return "N/A";
  }
  if (typeof val !== "number") {
    return val;
  }

  if (type === "val1") {
    if (key === "Rsp") {
      return val.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else {
      return val.toLocaleString("en-US");
    }
  } else if (type === "val2") {
    if (key === "Count" || (key === "Int" && val < 100)) {
      return val.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else {
      return val.toLocaleString("en-US");
    }
  }
  return val.toLocaleString("en-US");
}

/**
 * Generates the IBM i performance HTML report.
 *
 * @param {Object} options
 * @param {string} options.input - Path to performance JSON data
 * @param {string} options.output - Output HTML path
 * @param {string} [options.host] - Host ID/name
 * @param {string} [options.lib] - Library name
 * @param {boolean} [options.rca] - Include RCA section
 */
export function generateHtmlReport({ input, output, host, lib, rca = false }) {
  if (!fs.existsSync(input)) {
    throw new Error(`Input file '${input}' not found.`);
  }

  const rawPayload = fs.readFileSync(input, "utf-8");
  const payload = JSON.parse(rawPayload);

  if (!payload || !Array.isArray(payload.dates)) {
    throw new Error("Input JSON must match the consolidated multi-day schema.");
  }

  const finalHost = payload.host || host || "Unknown Host";
  const finalLib = payload.lib || lib || "QPFRDATA";
  const dates = payload.dates || [];
  const times = payload.times || [];
  const dataByDate = payload.data || {};
  const peakJobsByDate = payload.peakJobs || {};
  const dataQualityWarnings = payload.dataQualityWarnings || [];

  if (dates.length === 0) {
    throw new Error("No dates found in the payload.");
  }

  const metrics = [
    {
      id: "chart-count",
      key: "Count",
      title: "1. Transaction Count (交易次數)",
      unit: "次",
      is_percent: false,
      summary: "分析盤中 OLTP 交易量變化與日間高峰時段趨勢",
    },
    {
      id: "chart-rsp",
      key: "Rsp",
      title: "2. Transaction Response Time (交易回應時間)",
      unit: "秒",
      is_percent: false,
      summary: "監視線上交易響應延遲與異常 peak 時間點點檢",
    },
    {
      id: "chart-cpu-tot",
      key: "Tot",
      title: "3. CPU Util Total (CPU 總使用率)",
      unit: "%",
      is_percent: true,
      summary:
        "掌握 Central Processing Unit (CPU) 整體資源負載與高峰時間 (Y軸固定 0-100%)",
    },
    {
      id: "chart-cpu-int",
      key: "Int",
      title: "4. CPU Util Total Interactive (互動式 CPU 使用率)",
      unit: "%",
      is_percent: true,
      summary:
        "監控 5250 / Terminal 綠幕與線上互動作業資源佔用 (Y軸固定 0-100%)",
    },
    {
      id: "chart-cpu-bch",
      key: "Bch",
      title: "5. CPU Util Total Batch (批次 CPU 使用率)",
      unit: "%",
      is_percent: true,
      summary: "分析背景排程、結算批次與大量資料處理之 CPU 佔用 (Y軸固定 0-100%)",
    },
    {
      id: "chart-disk",
      key: "Dsk",
      title: "6. High Disk (最高磁碟使用率)",
      unit: "%",
      is_percent: true,
      summary:
        "檢測 Disk Storage Arm 負載平衡與 Input/Output (I/O) 瓶頸 (Y軸固定 0-100%)",
    },
    {
      id: "chart-fault",
      key: "Usr",
      title: "7. User Pool Page Fault (User Pool Page Fault)",
      unit: "次/秒",
      is_percent: false,
      summary: "監控使用者記憶體池實體 Page Fault 置換率",
    },
  ];

  const stats = calculateStats(dates, times, dataByDate, metrics);

  const cardsHtmlList = [];
  for (const m of metrics) {
    const key = m.key;

    // 1. Generate Stats Table rows
    let statsRows = "";
    for (const d of dates) {
      const s = stats[key][d];
      statsRows += `
            <tr>
                <td style="padding: 0.5rem; text-align: left; color: var(--accent-blue); font-weight: 500;">📅 ${d}</td>
                <td style="padding: 0.5rem; font-weight: 600;">${s.max} ${m.unit}</td>
                <td style="padding: 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">⏱️ ${s.max_time}</td>
                <td style="padding: 0.5rem; color: var(--accent-purple); font-weight: 500;">${s.avg} ${m.unit}</td>
            </tr>
            `;
    }

    // Define dynamic headers and panel titles
    const headers = getPanelHeaders(key);

    // 2. Generate Tabs for Top 10 Jobs
    let tabButtons = "";
    let tabContents = "";
    for (let idx = 0; idx < dates.length; idx++) {
      const d = dates[idx];
      const activeClass = idx === 0 ? "active" : "";
      const displayStyle = idx === 0 ? "display: block;" : "display: none;";

      tabButtons += `
            <button id="${m.id}-btn-${idx}" class="tab-btn ${activeClass}" onclick="switchTab(event, '${m.id}-tab-${idx}', '${d}', '${key}')">${d}</button>
            `;

      const peakTimeOfDay = stats[key][d].max_time;
      const jobsList =
        (peakJobsByDate[d] &&
          peakJobsByDate[d][key] &&
          peakJobsByDate[d][key][peakTimeOfDay]) ||
        [];

      let jobRows = "";
      if (jobsList.length === 0) {
        jobRows =
          "<tr><td colspan='5' style='text-align: center; color: var(--text-secondary); padding: 1rem;'>無可用之 Job 負載數據</td></tr>";
      } else {
        for (let rank = 0; rank < jobsList.length; rank++) {
          const j = jobsList[rank];
          const val1Formatted = formatVal(j.val1, key, "val1");
          const val2Formatted = formatVal(j.val2, key, "val2");

          jobRows += `
                    <tr>
                        <td style="padding: 0.4rem 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">#${
                          rank + 1
                        }</td>
                        <td style="padding: 0.4rem 0.5rem; font-family: monospace; font-weight: 600; color: var(--text-primary);">${
                          j.job_name || "N/A"
                        }</td>
                        <td style="padding: 0.4rem 0.5rem; color: var(--text-secondary);">${
                          j.user_name || "N/A"
                        }</td>
                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-blue); font-weight: 500;">${val1Formatted} ${
            headers.val_unit
          }</td>
                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-purple);">${val2Formatted} ${
            headers.last_unit
          }</td>
                    </tr>
                    `;
        }
      }

      tabContents += `
            <div id="${m.id}-tab-${idx}" class="tab-content ${activeClass}" style="${displayStyle}">
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;">⏱️ 當前選定時段: <strong class="peak-time-display" id="${m.id}-time-${idx}">${peakTimeOfDay}</strong> 的工作負載排行</div>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); text-align: left; color: var(--text-secondary); font-size: 0.8rem;">
                            <th style="padding: 0.4rem 0.5rem;">#</th>
                            <th style="padding: 0.4rem 0.5rem;">工作名稱 (Job Name)</th>
                            <th style="padding: 0.4rem 0.5rem;">使用者 (User)</th>
                            <th style="padding: 0.4rem 0.5rem; text-align: right;">${
                              headers.val_header
                            }</th>
                            <th style="padding: 0.4rem 0.5rem; text-align: right;">${
                              headers.last_header
                            }</th>
                        </tr>
                    </thead>
                    <tbody class="jobs-tbody" id="${m.id}-tbody-${idx}">
                        ${jobRows}
                    </tbody>
                </table>
            </div>
            `;
    }

    // 3. Dynamic Analysis & Recommendations
    let maxD = dates[0];
    let absMax = stats[key][maxD].max;
    for (const d of dates) {
      if (stats[key][d].max > absMax) {
        absMax = stats[key][d].max;
        maxD = d;
      }
    }
    const absMaxTime = stats[key][maxD].max_time;

    const [analysis, recommendation] = generateInsights(
      key,
      absMax,
      maxD,
      absMaxTime
    );

    const card = `
            <div class="chart-card">
                <div class="chart-header">
                    <h2>${m.title}</h2>
                    <p>${m.summary}</p>
                </div>

                <div class="card-body-grid">
                    <div class="card-left-col">
                        <div class="chart-wrapper">
                            <canvas id="${m.id}"></canvas>
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
                                    ${statsRows}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="card-right-col">
                        <div class="jobs-panel">
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
                                <h4 style="font-size: 0.9rem; color: var(--accent-amber); text-transform: uppercase;">${
                                  headers.title
                                }</h4>
                                <div class="tab-buttons-container">
                                    ${tabButtons}
                                </div>
                            </div>
                            ${tabContents}
                        </div>

                        <div class="insights-section">
                            <div class="insight-box analysis">
                                <h3>📊 效能分析與診斷 (Analysis & Insights)</h3>
                                <div>${analysis}</div>
                            </div>
                            <div class="insight-box recommendation">
                                <h3>💡 系統優化與改善建議 (Optimization Recommendations)</h3>
                                <div>${recommendation}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    cardsHtmlList.push(card);
  }

  const cardsHtml = cardsHtmlList.join("\n");
  const dateRangeStr = dates.length > 1 ? `${dates[0]} ~ ${dates[dates.length - 1]}` : dates[0];

  let warningsBannerHtml = "";
  if (dataQualityWarnings.length > 0) {
    const warningItems = dataQualityWarnings
      .map((w) => `<li>${w}</li>`)
      .join("");
    warningsBannerHtml = `
        <div style="margin-bottom: 1.5rem; padding: 1rem 1.25rem; border-radius: 0.75rem; background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.35);">
            <strong style="color: #fbbf24;">⚠️ 資料健檢警告：以下指標可能不可靠，請人工確認</strong>
            <ul style="margin: 0.5rem 0 0 1.25rem; color: var(--text-secondary); font-size: 0.9rem;">${warningItems}</ul>
        </div>`;
  }

  const htmlTemplateStr = getHtmlTemplate();
  const finalHtml = safeSubstitute(htmlTemplateStr, {
    host: finalHost,
    lib: finalLib,
    date_range: dateRangeStr,
    warnings_banner: warningsBannerHtml,
    cards_html: cardsHtml,
    times_js: JSON.stringify(times),
    dates_js: JSON.stringify(dates),
    raw_data_js: JSON.stringify(dataByDate),
    peak_jobs_js: JSON.stringify(peakJobsByDate),
    metrics_config_js: JSON.stringify(metrics),
    rca_section: rca ? getRcaSection() : "",
    css_content: getCssAsset(),
    js_content: getJsAsset(),
  });

  const outDir = path.dirname(output);
  if (outDir && !fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(output, finalHtml, "utf-8");
  console.log(`Successfully generated HTML report at: ${output}`);
}

/**
 * Command line argument parser.
 * Supports both space-separated and equal-separated arguments:
 * --input=<path> or --input <path>
 *
 * @param {string[]} argv
 * @returns {Object}
 */
export function parseCliArgs(argv) {
  const args = {
    input: "",
    output: "",
    host: "Unknown Host",
    lib: "QPFRDATA",
    date: "ALL",
    rca: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input") {
      args.input = argv[++i];
    } else if (arg.startsWith("--input=")) {
      args.input = arg.split("=")[1];
    } else if (arg === "--output") {
      args.output = argv[++i];
    } else if (arg.startsWith("--output=")) {
      args.output = arg.split("=")[1];
    } else if (arg === "--host") {
      args.host = argv[++i];
    } else if (arg.startsWith("--host=")) {
      args.host = arg.split("=")[1];
    } else if (arg === "--lib") {
      args.lib = argv[++i];
    } else if (arg.startsWith("--lib=")) {
      args.lib = arg.split("=")[1];
    } else if (arg === "--date") {
      args.date = argv[++i];
    } else if (arg.startsWith("--date=")) {
      args.date = arg.split("=")[1];
    } else if (arg === "--rca") {
      args.rca = true;
    }
  }
  return args;
}

// CLI entry point
const isMain = () => {
  if (!process.argv[1]) return false;
  try {
    const mainPath = fs.realpathSync(process.argv[1]);
    const modulePath = fs.realpathSync(fileURLToPath(import.meta.url));
    return mainPath === modulePath;
  } catch {
    return false;
  }
};

if (isMain()) {
  try {
    const cliArgs = parseCliArgs(process.argv.slice(2));
    if (!cliArgs.input || !cliArgs.output) {
      console.error(
        "Usage: node generateReport.js --input <input_json> --output <output_html> [--host <host>] [--lib <lib>] [--rca]"
      );
      process.exit(1);
    }
    generateHtmlReport({
      input: cliArgs.input,
      output: cliArgs.output,
      host: cliArgs.host,
      lib: cliArgs.lib,
      rca: cliArgs.rca,
    });
  } catch (err) {
    console.error("Error generating report:", err.message);
    process.exit(1);
  }
}
