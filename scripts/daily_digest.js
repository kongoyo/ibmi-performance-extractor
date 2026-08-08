import fs from "fs";
import path from "path";
import { runPreflight } from "./preflight.js";
import { METRIC_LABELS, resolveContextDir, resolveLibraryAndJsonPath } from "./rcaUtils.js";
import { scanAnomalies } from "./anomaly_scan.js";
import { THRESHOLDS } from "./reportingThresholds.js";

/**
 * One-pass system health summary for `date`: per-metric day-max + when it
 * happened, which of those breach the same warning thresholds the HTML
 * dashboard's insights_engine.py uses, and the anomaly-scan Top 5 job list
 * (reusing scanAnomalies() directly rather than shelling out to anomaly_scan.js).
 */
function buildDigest(data, date) {
  const seriesByMetric = data.data[date] || {};
  const metricSummaries = [];

  for (const metric of Object.keys(METRIC_LABELS)) {
    const series = seriesByMetric[metric];
    if (!series || series.length === 0) continue;
    const maxVal = Math.max(...series);
    const maxTime = data.times[series.indexOf(maxVal)];
    const threshold = THRESHOLDS[metric];
    const breached = threshold != null && maxVal > threshold;
    metricSummaries.push({ metric, maxVal, maxTime, threshold: threshold ?? null, breached });
  }

  const { ranking } = scanAnomalies(data, date);
  const topJobs = ranking.slice(0, 5);

  return { metricSummaries, topJobs };
}

function buildMarkdown(digest, args, hostConfig) {
  const { metricSummaries, topJobs } = digest;

  let md = `# 🔍 Daily Digest Context\n\n`;
  md += `**Host**: ${hostConfig.host}\n`;
  md += `**Date**: ${args.date}\n\n`;
  md += `> 系統提示：此為每日健康摘要腳本產出的上下文數據，各維度當日最高值與門檻超標判斷已預先計算完畢，異常 Job Top 5 直接重用 anomaly_scan.js 的排名邏輯。請 AI Agent 直接依據此上下文撰寫一頁式健康摘要報告，不需再自行解析原始 JSON。\n\n`;

  md += `### 1. 各維度當日最高值\n\n`;
  md += `| 維度 | 當日最高值 | 發生時間 | 警戒門檻 | 是否超標 |\n`;
  md += `| :--- | ---: | :--- | ---: | :--- |\n`;
  for (const s of metricSummaries) {
    const label = METRIC_LABELS[s.metric] || s.metric;
    const threshold = s.threshold != null ? s.threshold : "N/A（無設定門檻）";
    const breach = s.threshold == null ? "N/A" : (s.breached ? "⚠️ 超標" : "正常");
    md += `| ${label} | ${s.maxVal} | ${s.maxTime} | ${threshold} | ${breach} |\n`;
  }
  md += `\n`;

  const breachedCount = metricSummaries.filter(s => s.breached).length;
  md += `**超標維度數**：${breachedCount} / ${metricSummaries.filter(s => s.threshold != null).length}（僅 Tot/Rsp/Usr 三個維度有設定門檻，門檻值對齊 HTML 儀表板 insights_engine.py 的既有標準）\n\n`;

  md += `### 2. 異常 Job Top 5（依全天登頂資源排行榜次數排序）\n\n`;
  if (topJobs.length === 0) {
    md += `*(全天未偵測到任何 Job 登上資源排行榜第一名，系統資源分布平均。)*\n`;
  } else {
    md += `| 排名 | Job | 使用者 | 登頂維度 | 登頂總次數 | 達成當日絕對峰值次數 |\n`;
    md += `| ---: | :--- | :--- | :--- | ---: | ---: |\n`;
    topJobs.forEach((r, i) => {
      md += `| ${i + 1} | ${r.job_name} | ${r.user_name} | ${r.metricsHit.map(m => METRIC_LABELS[m] || m).join("、")} | ${r.totalHits} | ${r.dayPeakHits} |\n`;
    });
  }
  md += `\n`;

  if (args.debug) {
    md += `**Raw Data (--debug)**:\n`;
    md += `\`\`\`json\n${JSON.stringify(digest, null, 2)}\n\`\`\`\n`;
  }

  return md;
}

async function main() {
  console.log("🔍 Starting Daily Digest...");
  const { args, hostId, hostConfig } = await runPreflight({ requireServices: false });

  if (!args.host || !args.date) {
    console.error("❌ 缺少必要參數！必須提供 --host, --date");
    console.error("範例: node scripts/daily_digest.js --host=clark75 --date=07/14");
    process.exit(1);
  }


  const { library, outDir, jsonPath, triedLibraries, autoSwitched } =
    resolveLibraryAndJsonPath(hostConfig, hostId, args, { date: args.date });
  const contextDir = resolveContextDir(outDir);

  if (autoSwitched) {
    console.log(`⚠️ 主機預設 Library 找不到 ${args.date} 的快取資料，自動改用 Library "${library}"（已在本機找到相符資料）。`);
  }
  if (!jsonPath) {
    console.error(`❌ 在 ${triedLibraries.map((l) => `data/${hostConfig.host}/${l}/`).join("、")} 都找不到包含 ${args.date} 的效能資料 JSON 檔。請先執行擷取 Pipeline。`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const digest = buildDigest(data, args.date);
  const markdown = buildMarkdown(digest, args, hostConfig);

  const label = args.date.replace(/\//g, "");
  const contextPath = path.join(contextDir, `daily_digest_${label}.md`);
  fs.writeFileSync(contextPath, markdown, "utf-8");

  console.log(`✅ Daily Digest Context 已產出至: ${contextPath}`);
  console.log(`💡 AI Agent，請讀取此檔案並將一頁式健康摘要寫入 ${path.join(outDir, `daily_digest_report_${label}.md`)}`);
}

main().catch(err => {
  console.error("發生錯誤:", err);
  process.exit(1);
});
