import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import {
  SKILL_ROOT,
  parseArgs,
  checkNodeVersion,
  checkPython,
  loadServices,
  loadHostConfig,
  resolveOutputDirs,
} from "./preflight.js";

// Helper to convert Julian Day of Year to MM/DD (non-leap year)
function julianToDateStr(julianStr) {
  const ddd = parseInt(julianStr, 10);
  const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let daysLeft = ddd;
  let month = 1;
  for (let i = 0; i < 12; i++) {
    if (daysLeft <= monthDays[i]) {
      month = i + 1;
      break;
    }
    daysLeft -= monthDays[i];
  }
  return `${String(month).padStart(2, '0')}/${String(daysLeft).padStart(2, '0')}`;
}

async function main() {
  console.log(`🚀 Starting Optimized Performance Data Extraction Pipeline...`);

  console.log(`\n🔍 執行環境事前點檢...`);
  checkNodeVersion();
  const pythonCmd = checkPython();

  const args = parseArgs();
  const { SourceManager } = await loadServices(args);
  const { hostId, hostConfig, configPath } = loadHostConfig(args.host, args);
  const library = args.lib || hostConfig.library || "QPFRDATA";
  const maxDays = args.maxDays ? parseInt(args.maxDays, 10) : (hostConfig.maxDays || 5);
  const outputDirs = resolveOutputDirs(hostConfig, hostId);

  console.log(`📌 Host: ${hostConfig.host} (id: ${hostId})`);
  console.log(`📌 Library: ${library}`);
  console.log(`📌 Config: ${configPath}`);
  console.log(`📌 Output dirs: ${outputDirs.join(", ")}`);

  const manager = SourceManager.getInstance();
  await manager.registerSource(hostId, {
    host: hostConfig.host,
    user: hostConfig.user,
    password: hostConfig.password,
    port: hostConfig.port || 8076,
    ignoreUnauthorized: true,
  });

  try {
    // Step 1: Query all partitions (members) of QAPMISUM in the target library
    console.log(`\n🔍 Querying members (partitions) for ${library}.QAPMISUM...`);
    const partitionRes = await manager.executeQuery(hostId, `
      SELECT TABLE_PARTITION AS PARTITION_NAME
      FROM QSYS2.SYSPARTITIONSTAT
      WHERE TABLE_SCHEMA = '${library}' AND TABLE_NAME = 'QAPMISUM'
      ORDER BY PARTITION_NAME DESC
    `);

    let partitions = partitionRes.data.map(r => r.PARTITION_NAME.trim());
    console.log(`Found ${partitions.length} partitions:`, partitions);

    if (partitions.length === 0) {
      console.error("❌ No partitions found!");
      process.exit(1);
    }

    // Limit to latest N partitions to avoid chart overcrowding and excessive query time
    if (partitions.length > maxDays) {
      console.log(`Limiting extraction to the latest ${maxDays} partitions.`);
      partitions = partitions.slice(0, maxDays);
    }

    const dates = [];
    const standardTimes = [];
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0');
      for (let m = 0; m < 60; m += 15) {
        const mm = String(m).padStart(2, '0');
        standardTimes.push(`${hh}:${mm}`);
      }
    }
    const dataByDate = {};
    const peakJobsByDate = {};

    // Step 2: Loop through each partition and query performance data
    for (const part of partitions) {
      const julianMatch = part.match(/Q(\d{3})/);
      if (!julianMatch) {
        console.warn(`⚠️ Warning: Skipping partition with invalid name pattern: ${part}`);
        continue;
      }

      const julian = julianMatch[1];
      const dateStr = julianToDateStr(julian);
      console.log(`\n--------------------------------------------------`);
      console.log(`📅 Processing Date: ${dateStr} (Julian: ${julian}, Member: ${part})`);

      dates.push(dateStr);
      dataByDate[dateStr] = {
        Count: new Array(96).fill(0),
        Rsp: new Array(96).fill(0.0),
        Tot: new Array(96).fill(0),
        Int: new Array(96).fill(0),
        Bch: new Array(96).fill(0),
        Dsk: new Array(96).fill(0),
        Usr: new Array(96).fill(0)
      };
      peakJobsByDate[dateStr] = {};

      const aliasMisum = `QTEMP.QAPMISUM_${julian}`;
      const aliasJobl = `QTEMP.QAPMJOBL_${julian}`;
      const aliasSystem = `QTEMP.QAPMSYSTEM_${julian}`;

      console.log(`Creating aliases in QTEMP for ${part}...`);
      await manager.executeQuery(hostId, `CREATE OR REPLACE ALIAS ${aliasMisum} FOR ${library}.QAPMISUM (${part})`);
      await manager.executeQuery(hostId, `CREATE OR REPLACE ALIAS ${aliasJobl} FOR ${library}.QAPMJOBL (${part})`);
      await manager.executeQuery(hostId, `CREATE OR REPLACE ALIAS ${aliasSystem} FOR ${library}.QAPMSYSTEM (${part})`);
      await manager.executeQuery(hostId, `CREATE OR REPLACE ALIAS QTEMP.QAPMDISK_${julian} FOR ${library}.QAPMDISK (${part})`);
      const aliasDisk = `QTEMP.QAPMDISK_${julian}`;

      console.log(`Querying 14-column Interval Summary...`);
      const misumRes = await manager.executeQuery(hostId, `
        SELECT
          m.INTNUM,
          SUBSTR(m.DTETIM, 3, 2) CONCAT '/' CONCAT SUBSTR(m.DTETIM, 5, 2) AS "Date",
          SUBSTR(m.DTETIM, 7, 2) CONCAT ':' CONCAT SUBSTR(m.DTETIM, 9, 2) AS "Time",
          m.DTETIM AS "RawTime",
          m.JBNTR AS "Count",
          CASE WHEN m.JBNTR > 0 THEN DECIMAL(m.JBRSP / (m.JBNTR * 1000.0), 5, 2) ELSE 0.00 END AS "Rsp",
          CASE WHEN s.SYSCTA > 0 THEN CAST((s.SYSPTU / (s.SYSCTA * 1.0)) * 100.0 AS INTEGER) ELSE 0 END AS "Tot",
          0 AS "Int",
          CASE WHEN s.SYSCTA > 0 THEN CAST((s.SYSPTU / (s.SYSCTA * 1.0)) * 100.0 AS INTEGER) ELSE 0 END AS "Bch",
          0 AS "Util",
          COALESCE((
            SELECT MAX(CASE WHEN d.DSSMPL > 0 THEN INTEGER((1.0 - d.DSNBSY * 1.0 / d.DSSMPL) * 100) ELSE 0 END)
            FROM ${aliasDisk} d WHERE d.INTNUM = m.INTNUM
          ), 0) AS "Dsk",
          '0002' AS "Unit",
          0 AS "Mch",
          ROUND(m.JBTFLT / m.INTSEC, 0) AS "Usr",
          '02' AS "ID",
          0 AS "Util1"
        FROM ${aliasMisum} m
        JOIN ${aliasSystem} s ON m.INTNUM = s.INTNUM
        ORDER BY m.DTETIM
      `);

      const intervals = misumRes.data;
      console.log(`Fetched ${intervals.length} intervals for ${dateStr}.`);

      // Populate interval datasets and build INTNUM to HH:MM time map
      const intnumToTime = {};
      intervals.forEach(r => {
        const intVal = parseInt(r.INTNUM, 10);
        intnumToTime[intVal] = r.Time;

        const idx = standardTimes.indexOf(r.Time);
        if (idx !== -1) {
          dataByDate[dateStr].Count[idx] = r.Count || 0;
          dataByDate[dateStr].Rsp[idx] = parseFloat(r.Rsp) || 0.0;
          dataByDate[dateStr].Tot[idx] = r.Tot || 0;
          dataByDate[dateStr].Int[idx] = r.Int || 0;
          dataByDate[dateStr].Bch[idx] = r.Bch || 0;
          dataByDate[dateStr].Dsk[idx] = r.Dsk || 0;
          dataByDate[dateStr].Usr[idx] = r.Usr || 0;
        }
      });

      console.log(`Querying Top 10 Jobs for all 96 intervals (Optimized Single Query)...`);
      const jobsQuery = `
        WITH AggregatedJobs AS (
          SELECT
            INTNUM,
            JBNAME,
            JBUSER,
            JBNBR,
            SUM(JBCPU) AS TOTAL_CPU_MS,
            SUM(JBTFLT) AS TOTAL_FAULTS,
            SUM(JBDBR + JBNDB + JBWRT + JBADBR + JBADBW) AS TOTAL_IO,
            SUM(JBRSP) AS TOTAL_RSP_SEC,
            SUM(JBNTR) AS TOTAL_TRANS
          FROM ${aliasJobl}
          GROUP BY INTNUM, JBNAME, JBUSER, JBNBR
        ),
        RankedJobs AS (
          SELECT
            INTNUM,
            TRIM(JBNAME) AS JOB_NAME,
            TRIM(JBUSER) AS USER_NAME,
            TRIM(JBNBR) AS JOB_NUMBER,
            DECIMAL(TOTAL_CPU_MS, 15, 2) AS CPU_MS,
            TOTAL_FAULTS AS FAULTS,
            TOTAL_IO AS IO_COUNT,
            CASE WHEN TOTAL_TRANS > 0 THEN DECIMAL(TOTAL_RSP_SEC / (TOTAL_TRANS * 1.0), 15, 2) ELSE 0.00 END AS RESPONSE_SEC,
            TOTAL_TRANS AS TRANS_COUNT,
            ROW_NUMBER() OVER(PARTITION BY INTNUM ORDER BY TOTAL_CPU_MS DESC) as cpu_rank,
            ROW_NUMBER() OVER(PARTITION BY INTNUM ORDER BY TOTAL_FAULTS DESC) as fault_rank,
            ROW_NUMBER() OVER(PARTITION BY INTNUM ORDER BY TOTAL_IO DESC) as io_rank,
            ROW_NUMBER() OVER(PARTITION BY INTNUM ORDER BY CASE WHEN TOTAL_TRANS > 0 THEN TOTAL_RSP_SEC / (TOTAL_TRANS * 1.0) ELSE 0.00 END DESC) as rsp_rank,
            ROW_NUMBER() OVER(PARTITION BY INTNUM ORDER BY TOTAL_TRANS DESC) as trans_rank
          FROM AggregatedJobs
        )
        SELECT *
        FROM RankedJobs
        WHERE cpu_rank <= 10 OR fault_rank <= 10 OR io_rank <= 10 OR rsp_rank <= 10 OR trans_rank <= 10
      `;

      const jobsRes = await manager.executeQuery(hostId, jobsQuery, [], undefined, undefined, 10000);
      const allJobs = jobsRes.data;
      console.log(`Fetched ${allJobs.length} ranked job records.`);

      // Group jobs by metric and time
      const metrics = ["Count", "Rsp", "Tot", "Int", "Bch", "Dsk", "Usr"];
      metrics.forEach(m => {
        peakJobsByDate[dateStr][m] = {};
      });

      allJobs.forEach(j => {
        const intVal = parseInt(j.INTNUM, 10);
        const timeKey = intnumToTime[intVal];
        if (!timeKey) return; // Skip if no matching interval summary time

        // Tot, Int, Bch (CPU rank)
        if (parseInt(j.CPU_RANK, 10) <= 10) {
          ["Tot", "Int", "Bch"].forEach(m => {
            if (!peakJobsByDate[dateStr][m][timeKey]) peakJobsByDate[dateStr][m][timeKey] = [];
            const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
            if (!peakJobsByDate[dateStr][m][timeKey].some(x => x.job_name === jobFull)) {
              peakJobsByDate[dateStr][m][timeKey].push({
                job_name: jobFull,
                user_name: j.USER_NAME,
                cpu_ms: parseFloat(j.CPU_MS),
                faults: parseInt(j.FAULTS, 10)
              });
            }
          });
        }

        // Count (Transaction count rank)
        if (parseInt(j.TRANS_RANK, 10) <= 10) {
          const m = "Count";
          if (!peakJobsByDate[dateStr][m][timeKey]) peakJobsByDate[dateStr][m][timeKey] = [];
          const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
          if (!peakJobsByDate[dateStr][m][timeKey].some(x => x.job_name === jobFull)) {
            peakJobsByDate[dateStr][m][timeKey].push({
              job_name: jobFull,
              user_name: j.USER_NAME,
              cpu_ms: parseInt(j.TRANS_COUNT, 10),
              faults: parseFloat(j.RESPONSE_SEC)
            });
          }
        }

        // Rsp (Response time rank)
        if (parseInt(j.RSP_RANK, 10) <= 10) {
          const m = "Rsp";
          if (!peakJobsByDate[dateStr][m][timeKey]) peakJobsByDate[dateStr][m][timeKey] = [];
          const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
          if (!peakJobsByDate[dateStr][m][timeKey].some(x => x.job_name === jobFull)) {
            peakJobsByDate[dateStr][m][timeKey].push({
              job_name: jobFull,
              user_name: j.USER_NAME,
              cpu_ms: parseFloat(j.RESPONSE_SEC),
              faults: parseInt(j.TRANS_COUNT, 10)
            });
          }
        }

        // Dsk (IO rank)
        if (parseInt(j.IO_RANK, 10) <= 10) {
          const m = "Dsk";
          if (!peakJobsByDate[dateStr][m][timeKey]) peakJobsByDate[dateStr][m][timeKey] = [];
          const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
          if (!peakJobsByDate[dateStr][m][timeKey].some(x => x.job_name === jobFull)) {
            peakJobsByDate[dateStr][m][timeKey].push({
              job_name: jobFull,
              user_name: j.USER_NAME,
              cpu_ms: parseFloat(j.CPU_MS),
              faults: parseInt(j.IO_COUNT, 10)
            });
          }
        }

        // Usr (Page fault rank)
        if (parseInt(j.FAULT_RANK, 10) <= 10) {
          const m = "Usr";
          if (!peakJobsByDate[dateStr][m][timeKey]) peakJobsByDate[dateStr][m][timeKey] = [];
          const jobFull = `${j.JOB_NAME}/${j.USER_NAME}/${j.JOB_NUMBER}`;
          if (!peakJobsByDate[dateStr][m][timeKey].some(x => x.job_name === jobFull)) {
            peakJobsByDate[dateStr][m][timeKey].push({
              job_name: jobFull,
              user_name: j.USER_NAME,
              cpu_ms: parseFloat(j.CPU_MS),
              faults: parseInt(j.FAULTS, 10)
            });
          }
        }
      });

      // Sort arrays in descending order in JS to guarantee correctness
      metrics.forEach(m => {
        for (const timeKey in peakJobsByDate[dateStr][m]) {
          const arr = peakJobsByDate[dateStr][m][timeKey];
          if (m === "Dsk" || m === "Usr") {
            arr.sort((a, b) => b.faults - a.faults);
          } else {
            arr.sort((a, b) => b.cpu_ms - a.cpu_ms);
          }
          // Slice to top 10
          peakJobsByDate[dateStr][m][timeKey] = arr.slice(0, 10);
        }
      });
    }

    // Step 3: Write payload JSON
    const payload = {
      host: hostId,
      lib: library,
      dates: dates.reverse(), // Show in chronological order
      times: standardTimes,
      data: dataByDate,
      peakJobs: peakJobsByDate
    };

    const jsonPath = path.join(outputDirs[0], `${hostId}_perf_all.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
    console.log(`\n✔ Saved consolidated performance JSON payload to: ${jsonPath}`);

    // Step 4: Run generate_report.py (the reporter script itself travels with the skill)
    const hostUpper = hostId.toUpperCase();
    const libUpper = library.toUpperCase();
    const reporterScript = path.join(SKILL_ROOT, "scripts", "generate_report.py");

    console.log(`\n📊 Generating HTML Report...`);
    const generatedPaths = [];
    for (const dir of outputDirs) {
      const outPath = path.join(dir, `${hostUpper}_${libUpper}_Performance_Report.html`);
      const cmd = `${pythonCmd} "${reporterScript}" --input "${jsonPath}" --output "${outPath}" --host ${hostId} --lib ${library}`;
      console.log(`Executing: ${cmd}`);
      execSync(cmd, { encoding: "utf8" });
      generatedPaths.push(outPath);
    }

    console.log(`\n🎉 Success!`);
    generatedPaths.forEach(p => console.log(`📄 Report: ${p}`));

  } finally {
    await manager.shutdown();
  }
}

main().catch(e => {
  console.error(`❌ Pipeline failed:`, e.message);
  process.exit(1);
});
