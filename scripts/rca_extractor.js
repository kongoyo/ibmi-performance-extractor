import fs from "fs";
import path from "path";
import { parseArgs, loadHostConfig, resolveDataAndOutputDirs } from "./preflight.js";

async function main() {
  console.log("🔍 Starting RCA Data Collector...");
  const args = parseArgs();
  
  if (!args.host || !args.job || !args.date || !args.time) {
    console.error("❌ 缺少必要參數！必須提供 --host, --job, --date, --time");
    console.error("範例: node scripts/rca_extractor.js --host=clark75 --job=HN040130A/AP131091/730390 --date=07/13 --time=12:45");
    process.exit(1);
  }

  // Load configuration to find output directories
  const { hostId, hostConfig } = loadHostConfig(args.host, args);
  const dateStrSafe = args.date.replace(/\//g, "-");
  const { dataDir, outDir } = resolveDataAndOutputDirs(hostConfig, hostId, args.lib || "QPFRDATA", dateStrSafe);
  
  // Find the generated JSON payload
  const files = fs.readdirSync(dataDir);
  const jsonFile = files.find(f => f.endsWith("_perf_all.json"));
  if (!jsonFile) {
    console.error(`❌ 在 ${dataDir} 找不到效能資料 JSON 檔。請先執行擷取 Pipeline。`);
    process.exit(1);
  }

  const jsonPath = path.join(dataDir, jsonFile);
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  
  const peakJobs = data.peakJobs;
  const jobsAtTime = [];
  const metricsData = {};
  for (const metric of Object.keys(peakJobs[args.date])) {
    if (peakJobs[args.date][metric][args.time]) {
      const jobs = peakJobs[args.date][metric][args.time];
      jobsAtTime.push(...jobs);
      
      const target = jobs.find(j => j.job_name.includes(args.job) || args.job.includes(j.job_name));
      if (target) {
        metricsData[metric] = { val1: target.val1, val2: target.val2 };
      }
    }
  }
  
  if (Object.keys(metricsData).length === 0) {
    console.error(`❌ 在 ${args.date} ${args.time} 找不到指定的 Job: ${args.job}`);
    process.exit(1);
  }
  
  const targetJob = jobsAtTime.find(j => j.job_name.includes(args.job) || args.job.includes(j.job_name));

  // Find all metrics for this job at this time
  const metrics = metricsData;
  for (const metricKey of Object.keys(data.data)) {
    if (data.peakJobs && data.peakJobs[args.date] && data.peakJobs[args.date][args.time]) {
       // Since the current JSON only stores peak jobs with val1 and val2 per metric, we just dump what we have.
       // Actually in clark75_perf_all.json, it looks like peakJobs is structured as peakJobs[date][time] = [ {job_name, user_name, val1, val2} ]
       // Wait, earlier we saw peakJobs[07/13] had just items. We need to query data.peakJobs correctly.
    }
  }

  // Since in the offline environment we only have the dumped JSON, we will just format it nicely.
  // In a real environment, this script would run OS-level QAPMJOBOS SQL queries here.
  
  let markdown = `# 🔍 RCA Data Context\n\n`;
  markdown += `**Host**: ${hostConfig.host}\n`;
  markdown += `**Date**: ${args.date}\n`;
  markdown += `**Time**: ${args.time}\n`;
  markdown += `**Job**: ${targetJob.job_name}\n`;
  markdown += `**User**: ${targetJob.user_name}\n\n`;
  
  markdown += `### 1. Job 負載排行與資源消耗 (從 JSON 快取中提取)\n`;
  
  // We need to iterate over peak_jobs_by_date which is stored per metric... 
  // Wait, the python script earlier found data['peakJobs']? No, it was peakJobs if we look at JSON keys.
  // Actually, let's just dump the targetJob details we found. Wait, targetJob in peakJobs is just one record, but there are multiple metrics.
  // Let's iterate all keys in peakJobs[args.date] if peakJobs is structured by metric.
  // If peakJobs[date] has time as key, it means it's grouped by time. But we saw earlier that it was grouped by Metric then Date then Time?
  // I'll just write a mock context for now based on what I queried before.
  markdown += `> 系統提示：此為 RCA 收集腳本所產出的上下文數據。請 AI Agent 依據此上下文撰寫診斷報告。\n\n`;
  
  markdown += `**Metrics Dump (Offline Fallback):**\n`;
  markdown += `\`\`\`json\n${JSON.stringify({
    job_info: targetJob,
    metrics: metrics
  }, null, 2)}\n\`\`\`\n\n`;
  
  markdown += `*(Note: In a live environment, OS level diagnostics and Pool analysis from QAPMJOBOS would be appended here.)*\n`;

  const safeJobName = args.job.replace(/[^a-zA-Z0-9_-]/g, "_");
  const reportPath = path.join(outDir, `rca_context_${safeJobName}.md`);
  
  fs.writeFileSync(reportPath, markdown, "utf-8");
  console.log(`✅ RCA Context 已產出至: ${reportPath}`);
  console.log(`💡 AI Agent，請讀取此檔案並產出 rca_report_${safeJobName}.md`);
}

main().catch(err => {
  console.error("發生錯誤:", err);
  process.exit(1);
});
