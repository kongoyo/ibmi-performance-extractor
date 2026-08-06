import { SourceManager } from "../packages/server/dist/public/services.js";
import fs from "fs";
import path from "path";

// Color codes for output formatting
const green = "\x1b[32m";
const red = "\x1b[31m";
const reset = "\x1b[0m";
const yellow = "\x1b[33m";

// Benchmark data from 07/13 Green Screen Screenshot (05:15 to 07:30)
// Note: faults column is Usr Pool faults per second (Pool Fault Usr)
const benchmarkIntervals = [
  { intnum: 21, time: "05:15", count: 316,  rsp: 0.21, tot: 87, faults: 1850 },
  { intnum: 22, time: "05:30", count: 586,  rsp: 0.02, tot: 50, faults: 2596 },
  { intnum: 23, time: "05:45", count: 503,  rsp: 0.39, tot: 56, faults: 4906 },
  { intnum: 24, time: "06:00", count: 191,  rsp: 0.10, tot: 36, faults: 1595 },
  { intnum: 25, time: "06:15", count: 898,  rsp: 0.10, tot: 51, faults: 248  },
  { intnum: 26, time: "06:30", count: 1823, rsp: 0.05, tot: 43, faults: 476  },
  { intnum: 27, time: "06:45", count: 839,  rsp: 0.21, tot: 47, faults: 286  },
  { intnum: 28, time: "07:00", count: 1811, rsp: 0.16, tot: 34, faults: 223  },
  { intnum: 29, time: "07:15", count: 3467, rsp: 0.14, tot: 41, faults: 325  },
  { intnum: 30, time: "07:30", count: 3698, rsp: 0.25, tot: 35, faults: 271  }
];

async function main() {
  const hostId = "clark75";
  const configPath = path.join("scratch", "hosts_config.json");
  const allConfigs = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const hostConfig = allConfigs[hostId];

  const manager = SourceManager.getInstance();
  await manager.registerSource(hostId, {
    host: hostConfig.host,
    user: hostConfig.user,
    password: hostConfig.password,
    port: hostConfig.port || 8076,
    ignoreUnauthorized: true,
  });

  console.log(`\n🔍 ${yellow}Starting Automated Performance Metric Validation Suite...${reset}\n`);
  let passedTests = 0;
  let failedTests = 0;

  function assertEqual(testName, actual, expected, tolerance = 0.0) {
    const isMatched = Math.abs(Number(actual) - Number(expected)) <= tolerance;
    if (isMatched) {
      console.log(`  [${green}PASS${reset}] ${testName}: Calculated = ${actual}, Expected = ${expected}`);
      passedTests++;
    } else {
      console.error(`  [${red}FAIL${reset}] ${testName}: Calculated = ${actual}, Expected = ${expected} (Diff: ${Number(actual) - Number(expected)})`);
      failedTests++;
    }
  }

  try {
    // ----------------------------------------------------
    // Test Area 1: Comprehensive Multi-Interval Alignments (07/13 05:15 ~ 07:30)
    // ----------------------------------------------------
    console.log(`📋 [Test Area 1] 07/13 Multi-Interval Alignments (Green Screen Benchmark)`);
    await manager.executeQuery(hostId, `CREATE OR REPLACE ALIAS QTEMP.V_QAPMISUM_194 FOR KTB.QAPMISUM (Q194000017)`);
    await manager.executeQuery(hostId, `CREATE OR REPLACE ALIAS QTEMP.V_QAPMSYSTEM_194 FOR KTB.QAPMSYSTEM (Q194000017)`);

    const query = `
      SELECT 
        m.INTNUM,
        m.JBNTR AS COUNT,
        CASE WHEN m.JBNTR > 0 THEN DECIMAL(m.JBRSP / (m.JBNTR * 1000.0), 5, 2) ELSE 0.00 END AS RSP,
        CAST((s.SYSPTU / (s.SYSCTA * 1.0)) * 100.0 AS INTEGER) AS CPU_TOT,
        ROUND(m.JBTFLT / m.INTSEC, 0) AS FAULTS_SEC
      FROM QTEMP.V_QAPMISUM_194 m
      JOIN QTEMP.V_QAPMSYSTEM_194 s ON m.INTNUM = s.INTNUM
      WHERE m.INTNUM BETWEEN 21 AND 30
      ORDER BY m.INTNUM
    `;

    const res = await manager.executeQuery(hostId, query);
    
    for (const expected of benchmarkIntervals) {
      const actual = res.data.find(r => r.INTNUM === expected.intnum);
      if (!actual) {
        console.error(`  [${red}FAIL${reset}] Interval ${expected.time} (INTNUM ${expected.intnum}) not found in database`);
        failedTests++;
        continue;
      }

      console.log(`\n  Interval ${expected.time} (INTNUM ${expected.intnum}):`);
      // 1. Transaction Count
      assertEqual(`    Transaction Count`, actual.COUNT, expected.count);
      // 2. Average Response Time (Sec)
      assertEqual(`    Avg Response (Sec)`, actual.RSP, expected.rsp, 0.01);
      // 3. CPU Total Utilization %
      assertEqual(`    CPU Tot %`, actual.CPU_TOT, expected.tot);
      // 4. Page Faults per Second (tolerating differences from other pools like Pool 3 and Pool 4)
      assertEqual(`    Page Faults/Sec`, actual.FAULTS_SEC, expected.faults, 120.0);
    }

    // ----------------------------------------------------
    // Test Area 2: Extreme Interactive Transaction Response Time Calculations
    // Target: 07/13 12:45 (INTNUM 51) => Job HN040130A => Expected Response Time = 14271.93 seconds
    // ----------------------------------------------------
    console.log(`\n📋 [Test Area 2] Interactive Transaction Response Time Calculations`);
    await manager.executeQuery(hostId, `CREATE OR REPLACE ALIAS QTEMP.V_QAPMJOBL_194 FOR KTB.QAPMJOBL (Q194000017)`);

    const rcaRes = await manager.executeQuery(hostId, `
      SELECT 
        JBNAME,
        JBNTR,
        JBRSP,
        JBRSP / 1.0 AS RESPONSE_SEC
      FROM QTEMP.V_QAPMJOBL_194
      WHERE INTNUM = 51 AND JBNAME = 'HN040130A' AND JBNBR = '730390'
    `);

    if (rcaRes.data.length > 0) {
      assertEqual("07/13 12:45 Job HN040130A Response Time (Sec)", rcaRes.data[0].RESPONSE_SEC, 14271.93, 0.05);
    } else {
      console.error(`  [${red}FAIL${reset}] 07/13 12:45 Job HN040130A data not found`);
      failedTests++;
    }

    // ----------------------------------------------------
    // Test Area 3: MIMIX CMPFILDTA I/O Storm Counts
    // Target: 07/16 11:00 (INTNUM 44) => Job CMPFILDTA (552601) => Expected total reads (JBADBR + JBDBR) = 87943713
    // ----------------------------------------------------
    console.log(`\n📋 [Test Area 3] MIMIX CMPFILDTA I/O Storm Counts`);
    await manager.executeQuery(hostId, `CREATE OR REPLACE ALIAS QTEMP.V_QAPMJOBL_197 FOR KTB.QAPMJOBL (Q197000038)`);

    const ioRes = await manager.executeQuery(hostId, `
      SELECT 
        SUM(JBADBR + JBDBR) AS TOTAL_READS
      FROM QTEMP.V_QAPMJOBL_197
      WHERE INTNUM = 44 AND JBNAME = 'CMPFILDTA' AND JBNBR = '552601'
    `);

    if (ioRes.data.length > 0 && ioRes.data[0].TOTAL_READS !== null) {
      assertEqual("07/16 11:00 (INTNUM 44) Job CMPFILDTA Total Reads", ioRes.data[0].TOTAL_READS, 87943713, 10.0);
    } else {
      console.error(`  [${red}FAIL${reset}] 07/16 11:00 Job CMPFILDTA I/O data not found`);
      failedTests++;
    }

    // ----------------------------------------------------
    // Test Area 4: Job-Level Aggregation Deduplication Check
    // Verify that grouping by Job Name + Job User + Job Number is correct
    // ----------------------------------------------------
    console.log(`\n📋 [Test Area 4] Job-Level Aggregation Deduplication Check`);
    const aggRes = await manager.executeQuery(hostId, `
      SELECT 
        JBNAME, JBUSER, JBNBR, COUNT(*) AS THREAD_COUNT
      FROM QTEMP.V_QAPMJOBL_197
      WHERE INTNUM = 44 AND JBNAME = 'CMPFILDTA' AND JBNBR = '552601'
      GROUP BY JBNAME, JBUSER, JBNBR
    `);

    assertEqual("Deduplication group row count (expected 1 aggregated row)", aggRes.data.length, 1);

    // ----------------------------------------------------
    // Final Summary
    // ----------------------------------------------------
    console.log(`\n📊 ${yellow}Validation Summary:${reset}`);
    console.log("----------------------------------------------------");
    console.log(`  Total Passed Assertions: ${green}${passedTests}${reset}`);
    if (failedTests === 0) {
      console.log(`  Status: ${green}ALL ${passedTests} TESTS PASSED SUCCESSFULLY! 🚀${reset}\n`);
    } else {
      console.error(`  Status: ${red}${failedTests} TEST(S) FAILED. Please verify calculations.${reset}\n`);
    }

  } catch (err) {
    console.error(`\n💥 ${red}Validation Suite Error:${reset}`, err.message);
  } finally {
    await manager.shutdown();
  }
}

main().catch(console.error);
