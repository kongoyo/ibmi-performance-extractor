import fs from "fs";
import path from "path";
import { parseArgs, loadHostConfig, resolveDataAndOutputDirs } from "./preflight.js";
import { METRIC_LABELS, resolveContextDir, resolveRangeJsonPath } from "./rcaUtils.js";
import { THRESHOLDS } from "./reportingThresholds.js";

/** Simple least-squares slope of dayMax against day index (0,1,2,...). */
function linearSlope(points) {
  const n = points.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  points.forEach((y, x) => {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function buildTrend(data) {
  const dates = data.dates;
  const trends = [];

  for (const metric of Object.keys(METRIC_LABELS)) {
    const perDate = dates.map(date => {
      const series = data.data[date] && data.data[date][metric];
      if (!series || series.length === 0) return null;
      const maxVal = Math.max(...series);
      const maxTime = data.times[series.indexOf(maxVal)];
      return { date, maxVal, maxTime };
    }).filter(Boolean);

    if (perDate.length === 0) continue;

    const slope = linearSlope(perDate.map(p => p.maxVal));
    const first = perDate[0].maxVal;
    const last = perDate[perDate.length - 1].maxVal;
    const delta = Number((last - first).toFixed(2));

    const threshold = THRESHOLDS[metric];
    let thresholdFlag = null;
    if (threshold != null) {
      const breached = last > threshold;
      const proximityRatio = last / threshold;
      const daysToThreshold = slope > 0 ? (threshold - last) / slope : null;
      const trendingUp = slope > 0 && (breached || proximityRatio >= 0.8 || (daysToThreshold != null && daysToThreshold <= 7 && daysToThreshold >= 0));
      thresholdFlag = { threshold, breached, trendingUp, daysToThreshold };
    }

    trends.push({ metric, perDate, slope: Number(slope.toFixed(3)), delta, thresholdFlag });
  }

  return trends;
}

function buildMarkdown(trends, data, args, hostConfig) {
  let md = `# 🔍 Trend Report Context\n\n`;
  md += `**Host**: ${hostConfig.host}\n`;
  md += `**Date Range**: ${args.dateFrom} ~ ${args.dateTo}（共 ${data.dates.length} 天）\n\n`;
  md += `> 系統提示：此為多日趨勢報告腳本產出的上下文數據，每個維度的「當日最高值」序列、線性趨勢斜率（slope，每日變化量）、首末差值（delta）與門檻趨勢判斷已預先計算完畢。請 AI Agent 直接依據此上下文撰寫容量規劃分析報告，不需再自行解析原始 JSON 或重新計算統計量。\n\n`;

  for (const t of trends) {
    const label = METRIC_LABELS[t.metric] || t.metric;
    md += `### ${label}\n\n`;
    md += `| 日期 | 當日最高值 | 發生時間 |\n`;
    md += `| :--- | ---: | :--- |\n`;
    for (const p of t.perDate) {
      md += `| ${p.date} | ${p.maxVal} | ${p.maxTime} |\n`;
    }
    md += `\n`;
    md += `**趨勢**：每日變化量（線性斜率）= ${t.slope}，首末差值 = ${t.delta >= 0 ? "+" : ""}${t.delta}\n\n`;

    if (t.thresholdFlag) {
      const { threshold, breached, trendingUp, daysToThreshold } = t.thresholdFlag;
      md += `**門檻**：${threshold}（對齊 HTML 儀表板既有警戒標準）\n`;
      md += `- 最新一天是否已超標：${breached ? "⚠️ 是" : "否"}\n`;
      if (!breached) {
        md += `- 是否正朝門檻惡化：${trendingUp ? "⚠️ 是" : "否"}`;
        if (trendingUp && daysToThreshold != null) {
          md += `（依目前斜率推算約 ${Math.ceil(daysToThreshold)} 天後可能觸及門檻，純線性外推僅供參考）`;
        }
        md += `\n`;
      }
    } else {
      md += `**門檻**：N/A（此維度無設定門檻）\n`;
    }
    md += `\n`;
  }

  if (args.debug) {
    md += `**Raw Data (--debug)**:\n`;
    md += `\`\`\`json\n${JSON.stringify(trends, null, 2)}\n\`\`\`\n`;
  }

  return md;
}

async function main() {
  console.log("🔍 Starting Trend Report...");
  const args = parseArgs();

  if (!args.host || !args.dateFrom || !args.dateTo) {
    console.error("❌ 缺少必要參數！必須提供 --host, --dateFrom, --dateTo");
    console.error("範例: node scripts/trend_report.js --host=clark75 --dateFrom=07/12 --dateTo=07/14");
    console.error("僅支援單一已涵蓋整個區間的多日 perf_*.json（先用 npm run extract -- --dateFrom/--dateTo 一次擷取），不支援自動合併多個單日檔案。");
    process.exit(1);
  }

  const { hostId, hostConfig } = loadHostConfig(args.host, args);
  const library = args.lib || hostConfig.library || "QPFRDATA";
  const { dataDir, outDir } = resolveDataAndOutputDirs(hostConfig, hostId, library);
  const contextDir = resolveContextDir(outDir);

  const jsonPath = resolveRangeJsonPath(dataDir, args.dateFrom, args.dateTo);
  if (!jsonPath) {
    console.error(`❌ 在 ${dataDir} 找不到完整涵蓋 ${args.dateFrom} ~ ${args.dateTo} 的效能資料 JSON 檔。請先執行 npm run extract -- --host=${args.host} --dateFrom=${args.dateFrom} --dateTo=${args.dateTo}。`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const trends = buildTrend(data);
  const markdown = buildMarkdown(trends, data, args, hostConfig);

  const label = `${args.dateFrom.replace(/\//g, "")}_to_${args.dateTo.replace(/\//g, "")}`;
  const contextPath = path.join(contextDir, `trend_report_${label}.md`);
  fs.writeFileSync(contextPath, markdown, "utf-8");

  console.log(`✅ Trend Report Context 已產出至: ${contextPath}`);
  console.log(`💡 AI Agent，請讀取此檔案並將趨勢與容量規劃報告寫入 ${path.join(outDir, `trend_report_${label}.md`)}`);
}

main().catch(err => {
  console.error("發生錯誤:", err);
  process.exit(1);
});
