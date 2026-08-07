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
