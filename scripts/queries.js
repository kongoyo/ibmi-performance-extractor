export const partitionQuery = (library) => `
    SELECT TABLE_PARTITION AS PARTITION_NAME
    FROM QSYS2.SYSPARTITIONSTAT
    WHERE TABLE_SCHEMA = '${library}' AND TABLE_NAME = 'QAPMISUM'
    ORDER BY PARTITION_NAME DESC
`;

export const intCpuQuery = (aliasJobl) => `
    SELECT INTNUM, SUM(JBCPU) AS INT_CPU_MS
    FROM ${aliasJobl}
    WHERE TRIM(JBTYPE) = 'I'
    GROUP BY INTNUM
`;

export const misumSummaryQuery = (aliasMisum, aliasSystem, aliasDisk) => `
    SELECT
      m.INTNUM,
      SUBSTR(m.DTETIM, 3, 2) CONCAT '/' CONCAT SUBSTR(m.DTETIM, 5, 2) AS "Date",
      SUBSTR(m.DTETIM, 7, 2) CONCAT ':' CONCAT SUBSTR(m.DTETIM, 9, 2) AS "Time",
      m.DTETIM AS "RawTime",
      m.JBNTR AS "Count",
      CASE WHEN m.JBNTR > 0 THEN DECIMAL(m.JBRSP / (m.JBNTR * 1000.0), 5, 2) ELSE 0.00 END AS "Rsp",
      CASE WHEN s.SYSCTA > 0 THEN CAST((s.SYSPTU / (s.SYSCTA * 1.0)) * 100.0 AS INTEGER) ELSE 0 END AS "Tot",
      s.SYSCTA AS "SysCta",
      0 AS "Util",
      COALESCE((
        SELECT MAX(CASE WHEN d.DSSMPL > 0 THEN CAST(CEILING((1.0 - d.DSNBSY * 1.0 / d.DSSMPL) * 100) AS INTEGER) ELSE 0 END)
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
`;

// Per-disk-unit detail, ranked to the top-5 busiest units per interval (mirrors
// jobsQuery's rank-CTE pattern). The system-wide "Dsk" metric in
// misumSummaryQuery collapses this down to a single MAX(busy%) across all units
// for the day-level dashboard — this query keeps per-unit identity for hot-spot
// detection. Busy% formula is the same CEILING(...) already validated in
// field_reference.md §3; do not swap in ROUND/truncate.
//
// ⚠️ DSDRN (device resource name), NOT DSARM, is the unique per-disk-unit key.
// Empirically verified 2026-08-08 on clark75/KTB (INTNUM 31, member Q194000017):
// DSARM repeats exactly 4x per interval per value (280 rows / 70 distinct DSARM
// values that interval) while DSDRN is unique across all 280 rows — e.g. DSARM
// '0028' covers 4 physically distinct disks (DMP560/DMP553/DMP556/DMP557) with
// different DSSRVT each. DSARM appears to identify a RAID array/rank shared by
// multiple physical units in this (SAN-attached) environment, not a single disk.
// Kept as a secondary "array/rank" grouping field for context, but grouping or
// deduping by DSARM alone silently conflates unrelated physical disks.
export const diskArmQuery = (aliasDisk) => `
    WITH RankedArms AS (
      SELECT
        INTNUM,
        TRIM(DSDRN) AS DRN,
        TRIM(DSARM) AS ARM_ID,
        CASE WHEN DSSMPL > 0 THEN CAST(CEILING((1.0 - DSNBSY * 1.0 / DSSMPL) * 100) AS INTEGER) ELSE 0 END AS BUSY_PCT,
        DSRDS AS READS,
        DSWRTS AS WRITES,
        DSSRVT AS SRVT_MS,
        DSWT AS WAIT_MS,
        DSDCFW AS CACHE_FAST_WRITES,
        ROW_NUMBER() OVER(
          PARTITION BY INTNUM
          ORDER BY CASE WHEN DSSMPL > 0 THEN CAST(CEILING((1.0 - DSNBSY * 1.0 / DSSMPL) * 100) AS INTEGER) ELSE 0 END DESC
        ) as arm_rank
      FROM ${aliasDisk}
    )
    SELECT *
    FROM RankedArms
    WHERE arm_rank <= 5
    ORDER BY INTNUM, BUSY_PCT DESC
`;

export const jobsQuery = (aliasJobl) => `
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
        SUM(JBNTR) AS TOTAL_TRANS,
        SUM(JBSZWT) AS TOTAL_SZWT_MS
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
        CASE WHEN TOTAL_TRANS > 0 THEN DECIMAL(TOTAL_RSP_SEC / (TOTAL_TRANS * 1000.0), 15, 2) ELSE 0.00 END AS RESPONSE_SEC,
        TOTAL_TRANS AS TRANS_COUNT,
        DECIMAL(TOTAL_SZWT_MS, 15, 2) AS SZWT_MS,
        ROW_NUMBER() OVER(PARTITION BY INTNUM ORDER BY TOTAL_CPU_MS DESC) as cpu_rank,
        ROW_NUMBER() OVER(PARTITION BY INTNUM ORDER BY TOTAL_FAULTS DESC) as fault_rank,
        ROW_NUMBER() OVER(PARTITION BY INTNUM ORDER BY TOTAL_IO DESC) as io_rank,
        ROW_NUMBER() OVER(PARTITION BY INTNUM ORDER BY CASE WHEN TOTAL_TRANS > 0 THEN TOTAL_RSP_SEC / (TOTAL_TRANS * 1000.0) ELSE 0.00 END DESC) as rsp_rank,
        ROW_NUMBER() OVER(PARTITION BY INTNUM ORDER BY TOTAL_TRANS DESC) as trans_rank,
        ROW_NUMBER() OVER(PARTITION BY INTNUM ORDER BY TOTAL_SZWT_MS DESC) as szwt_rank
      FROM AggregatedJobs
    )
    SELECT *
    FROM RankedJobs
    WHERE cpu_rank <= 10 OR fault_rank <= 10 OR io_rank <= 10 OR rsp_rank <= 10 OR trans_rank <= 10 OR szwt_rank <= 10
`;
