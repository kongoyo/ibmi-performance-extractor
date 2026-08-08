export const partitionQuery = (library) => `
    SELECT TABLE_PARTITION AS PARTITION_NAME
    FROM QSYS2.SYSPARTITIONSTAT
    WHERE TABLE_SCHEMA = '${library}' AND TABLE_NAME = 'QAPMISUM'
    ORDER BY PARTITION_NAME DESC
`;

// System-wide library discovery: every library on the host holding QAPMISUM
// partitions, used to auto-locate the right library when the host's
// configured default library doesn't actually hold data for the requested
// dates (a host can have Collection Services data spread across several
// *MGTCOL libraries, and hosts_config.json only names one as the default).
export const librariesWithPartitionsQuery = () => `
    SELECT TABLE_SCHEMA AS LIBRARY, TABLE_PARTITION AS PARTITION_NAME
    FROM QSYS2.SYSPARTITIONSTAT
    WHERE TABLE_NAME = 'QAPMISUM'
    ORDER BY TABLE_SCHEMA, PARTITION_NAME DESC
`;

// System history log (QHST) via the QSYS2.HISTORY_LOG_INFO table function —
// live equivalent of DSPLOG, used by historyLogFetcher.js to auto-fetch just
// the RCA target job's own window instead of requiring a manual whole-day
// DSPLOG export. Verified live against clark75/QPFRDATA (2026-08-08):
// FROM_JOB_NAME/FROM_JOB_USER/FROM_JOB_NUMBER/FROM_USER come back as clean
// pre-split columns (no text-regex needed for job identity), START_TIME/
// END_TIME accept 'YYYY-MM-DD HH:MM:SS' literals directly.
// jobNumber MUST be caller-validated as /^\d+$/ before calling this — it is
// interpolated directly into the SQL text (this codebase's queries.js has no
// existing parameterized-query helper to route through instead).
export const historyLogQuery = (startTs, endTs, { jobNumber, messageIds } = {}) => {
  const conditions = [];
  if (jobNumber) conditions.push(`FROM_JOB_NUMBER = '${jobNumber}'`);
  if (messageIds && messageIds.length) {
    conditions.push(`MESSAGE_ID IN (${messageIds.map((id) => `'${id}'`).join(",")})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return `
    SELECT
      MESSAGE_ID, MESSAGE_TYPE, SEVERITY, MESSAGE_TIMESTAMP,
      FROM_USER, FROM_JOB_NAME, FROM_JOB_USER, FROM_JOB_NUMBER,
      MESSAGE_TEXT, MESSAGE_SECOND_LEVEL_TEXT
    FROM TABLE(QSYS2.HISTORY_LOG_INFO(START_TIME => '${startTs}', END_TIME => '${endTs}')) X
    ${where}
    ORDER BY MESSAGE_TIMESTAMP
`;
};

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

// Remote IP/port for ranked jobs, sourced from QAPMJOBL.JBIPAF/JBIPAD/JBIPPT
// (see references/qapmjobl_fields.md). JBIPAF/JBIPAD are raw binary (not
// printable text), so HEX() converts them to a safe hex string in SQL —
// jobRanker.js decodes IP_FAMILY_HEX ('02'=IPv4/'18'=IPv6/'00'=no socket)
// + IP_HEX into a dotted/colon address.
//
// ⚠️ A job can have multiple QAPMJOBL rows per interval (secondary threads,
// JBTHDF=1 — same reason JBCPU/JBTFLT/etc. need SUM() instead of a bare
// value). The three IP fields are one connection's identity and MUST come
// from the same row — taking MAX() of each column independently (as an
// earlier version of this query did) can silently pair one thread's family
// flag with a different thread's address bytes, producing a nonsensical
// "IPv6 family but all-zero address". ConnInfo picks a single row per job
// per interval instead: primary thread (JBTHDF=0) first, since the docs
// note several other per-job accumulators are "primary thread only".
export const jobsQuery = (aliasJobl) => `
    WITH ConnInfo AS (
      SELECT
        INTNUM, JBNAME, JBUSER, JBNBR,
        HEX(JBIPAF) AS IP_FAMILY_HEX,
        HEX(JBIPAD) AS IP_HEX,
        JBIPPT AS REMOTE_PORT,
        ROW_NUMBER() OVER (
          PARTITION BY INTNUM, JBNAME, JBUSER, JBNBR
          ORDER BY JBTHDF ASC, CASE WHEN HEX(JBIPAF) <> '00' THEN 0 ELSE 1 END
        ) AS conn_rank
      FROM ${aliasJobl}
    ),
    AggregatedJobs AS (
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
        ag.INTNUM,
        TRIM(ag.JBNAME) AS JOB_NAME,
        TRIM(ag.JBUSER) AS USER_NAME,
        TRIM(ag.JBNBR) AS JOB_NUMBER,
        DECIMAL(ag.TOTAL_CPU_MS, 15, 2) AS CPU_MS,
        ag.TOTAL_FAULTS AS FAULTS,
        ag.TOTAL_IO AS IO_COUNT,
        CASE WHEN ag.TOTAL_TRANS > 0 THEN DECIMAL(ag.TOTAL_RSP_SEC / (ag.TOTAL_TRANS * 1000.0), 15, 2) ELSE 0.00 END AS RESPONSE_SEC,
        ag.TOTAL_TRANS AS TRANS_COUNT,
        DECIMAL(ag.TOTAL_SZWT_MS, 15, 2) AS SZWT_MS,
        c.IP_FAMILY_HEX,
        c.IP_HEX,
        c.REMOTE_PORT,
        ROW_NUMBER() OVER(PARTITION BY ag.INTNUM ORDER BY ag.TOTAL_CPU_MS DESC) as cpu_rank,
        ROW_NUMBER() OVER(PARTITION BY ag.INTNUM ORDER BY ag.TOTAL_FAULTS DESC) as fault_rank,
        ROW_NUMBER() OVER(PARTITION BY ag.INTNUM ORDER BY ag.TOTAL_IO DESC) as io_rank,
        ROW_NUMBER() OVER(PARTITION BY ag.INTNUM ORDER BY CASE WHEN ag.TOTAL_TRANS > 0 THEN ag.TOTAL_RSP_SEC / (ag.TOTAL_TRANS * 1000.0) ELSE 0.00 END DESC) as rsp_rank,
        ROW_NUMBER() OVER(PARTITION BY ag.INTNUM ORDER BY ag.TOTAL_TRANS DESC) as trans_rank,
        ROW_NUMBER() OVER(PARTITION BY ag.INTNUM ORDER BY ag.TOTAL_SZWT_MS DESC) as szwt_rank
      FROM AggregatedJobs ag
      LEFT JOIN ConnInfo c
        ON c.INTNUM = ag.INTNUM AND c.JBNAME = ag.JBNAME AND c.JBUSER = ag.JBUSER AND c.JBNBR = ag.JBNBR AND c.conn_rank = 1
    )
    SELECT *
    FROM RankedJobs
    WHERE cpu_rank <= 10 OR fault_rank <= 10 OR io_rank <= 10 OR rsp_rank <= 10 OR trans_rank <= 10 OR szwt_rank <= 10
`;
