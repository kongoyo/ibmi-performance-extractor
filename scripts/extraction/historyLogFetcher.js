/**
 * Live fetch of QHST (system history log) events via QSYS2.HISTORY_LOG_INFO,
 * scoped to one RCA target job's own active window — the auto-fetch
 * alternative to requiring the user to export and hand over a whole-day
 * DSPLOG dump (see dsplogParser.js for the file-based path).
 *
 * Deep Module boundary: produces events in the SAME shape dsplogParser.js's
 * parseDsplog() produces, so rca_extractor.js's buildDsplogSection() and
 * rcaUtils-adjacent helpers (findJobEvents/findNearbyConnects/describeEndCode,
 * all still owned by dsplogParser.js) work identically regardless of which
 * source the events came from.
 *
 * Verified live against clark75/QPFRDATA (2026-08-08): FROM_JOB_NAME/
 * FROM_JOB_USER/FROM_JOB_NUMBER/FROM_USER arrive as clean pre-split columns
 * (no job-identity regex needed, unlike the DSPLOG text parser). MESSAGE_TEXT
 * on this session came back pre-translated to Traditional Chinese; the field
 * extraction regexes below try an English pattern first, then a Chinese one,
 * since there is no structured column for remote IP / seconds-used / end
 * code / subsystem — only MESSAGE_TEXT carries them.
 */
import { historyLogQuery } from "./queries.js";

const IPV4_RE = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/;

function firstMatch(text, patterns) {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) return m;
  }
  return null;
}

const SECONDS_END_CODE_PATTERNS = [
  /([\d.]+) seconds used; end\s*code\s*(\d+)/,
  /使用([\d.]+)秒[；;].*?結束碼為\s*(\d+)/,
];

const SUBSYSTEM_PATTERNS = [
  /in subsystem (\S+)/i,
  /子系統(\S+?)中/,
];

/**
 * "2026-08-07 16:40:50.484540" -> { date: "08/07", time: "16:40:50" },
 * matching the MM/DD + HH:MM:SS convention used throughout this pipeline
 * (dsplogParser.js events, perf_*.json date keys).
 */
function splitTimestamp(ts) {
  const [datePart, timePart] = ts.split(" ");
  const [, mm, dd] = datePart.split("-");
  const time = timePart.split(".")[0];
  return { date: `${mm}/${dd}`, time };
}

/** Converts one QSYS2.HISTORY_LOG_INFO row into a dsplogParser-shaped event, or null if the message type isn't one this pipeline models. */
export function historyLogRowToEvent(row) {
  const { date, time } = splitTimestamp(row.MESSAGE_TIMESTAMP);
  const jobName = row.FROM_JOB_NAME;
  const jobUser = row.FROM_JOB_USER;
  const jobNumber = row.FROM_JOB_NUMBER;
  const raw = row.MESSAGE_TEXT;
  const base = { msgId: row.MESSAGE_ID, jobName, jobUser, jobNumber, date, time, raw };

  if (row.MESSAGE_ID === "CPIAD09") {
    const ipMatch = IPV4_RE.exec(row.MESSAGE_TEXT);
    return {
      ...base, kind: "connect",
      connect: { requestUser: row.FROM_USER, clientIp: ipMatch ? ipMatch[1] : null, subsystem: null, library: null },
    };
  }

  if (row.MESSAGE_ID === "CPIAD0B") {
    return { ...base, kind: "signon", signon: { requestUser: row.FROM_USER } };
  }

  if (row.MESSAGE_ID === "CPF1124") {
    const subsystemMatch = firstMatch(row.MESSAGE_TEXT, SUBSYSTEM_PATTERNS);
    return {
      ...base, kind: "jobStart",
      jobStart: { subsystem: subsystemMatch ? subsystemMatch[1] : null, library: null },
    };
  }

  if (row.MESSAGE_ID === "CPF1164") {
    const m = firstMatch(row.MESSAGE_TEXT, SECONDS_END_CODE_PATTERNS);
    if (!m) return { ...base, kind: "other", severity: row.SEVERITY };
    return { ...base, kind: "jobEnd", jobEnd: { secondsUsed: parseFloat(m[1]), endCode: m[2] } };
  }

  return { ...base, kind: "other", severity: row.SEVERITY };
}

/**
 * "08/07" -> { year, month, day }, inferring the year as the current year
 * unless that would place the date in the future (then the previous year).
 * This pipeline never tracks an absolute year (extractor.js's Julian-day
 * conversion is explicitly year-agnostic), so this is a best-effort
 * assumption — correct for the overwhelmingly common case of running RCA
 * shortly after the incident, within QHST's retention window.
 */
export function inferFullDate(mmdd, now = new Date()) {
  const [month, day] = mmdd.split("/").map(Number);
  let year = now.getFullYear();
  if (new Date(year, month - 1, day) > now) year -= 1;
  return { year, month, day };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

/**
 * Builds a bounded {startTs, endTs} window (HISTORY_LOG_INFO's accepted
 * 'YYYY-MM-DD HH:MM:SS' format) around a reference time, clipped to the
 * target calendar day — deliberately NOT the whole day, so the live fetch
 * stays scoped to the job's own anomalous window.
 */
export function buildLogWindow(mmdd, hhmmss, bufferMinutes) {
  const { year, month, day } = inferFullDate(mmdd);
  const [h, m, s] = hhmmss.split(":").map(Number);
  const ref = new Date(year, month - 1, day, h, m, s || 0);

  const dayStart = new Date(year, month - 1, day, 0, 0, 0);
  const dayEnd = new Date(year, month - 1, day, 23, 59, 59);
  const start = new Date(Math.max(dayStart.getTime(), ref.getTime() - bufferMinutes * 60000));
  const end = new Date(Math.min(dayEnd.getTime(), ref.getTime() + bufferMinutes * 60000));

  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return { startTs: fmt(start), endTs: fmt(end) };
}

async function runHistoryLogQuery(dbManager, hostId, startTs, endTs, opts) {
  const res = await dbManager.executeQuery(hostId, historyLogQuery(startTs, endTs, opts));
  return res.data.map(historyLogRowToEvent).filter(Boolean);
}

/**
 * Fetches this one job's own lifecycle events (connect/start/end/other),
 * scoped to a window derived from `referenceTimes` (the job's known active
 * interval(s) from the perf data) plus a buffer — then, if a connect event
 * was found, also fetches other CPIAD09 connects from the same requesting
 * user within +/-30 minutes of that connect (sibling-session detection,
 * e.g. a paired interactive + ODBC/JDBC login), merging both sets into one
 * events array usable exactly like parseDsplog()'s output.
 *
 * If the initial window doesn't capture this job's completion (jobEnd —
 * a narrow window can easily catch the connect but miss a long-running
 * job's end), the window widens incrementally by `stepMinutes` (default:
 * one hour at a time, not straight to the whole day) until jobEnd is
 * found, the window stops growing (already clipped to the full calendar
 * day), or `maxBufferMinutes` is reached.
 *
 * @param {object} dbManager - injected SourceManager adapter
 * @param {string} hostId
 * @param {{jobName: string, jobUser: string, jobNumber: string, referenceTimes: string[]}} target
 *   referenceTimes: one or more "HH:MM" strings this job was observed active at.
 * @param {string} mmddDate - "MM/DD" of the target date
 * @param {object} [options]
 * @param {number} [options.initialBufferMinutes=60]
 * @param {number} [options.stepMinutes=60] - widening increment per empty attempt
 * @param {number} [options.maxBufferMinutes=720] - stop widening beyond this (12h)
 * @param {(fromMinutes: number, toMinutes: number) => void} [options.onExpand] - called before each widening attempt
 * @returns {Promise<Array<object>|null>} events, or null if the job number is invalid
 */
export async function fetchJobHistoryContext(
  dbManager, hostId, { jobName, jobUser, jobNumber, referenceTimes }, mmddDate,
  { initialBufferMinutes = 60, stepMinutes = 60, maxBufferMinutes = 720, onExpand } = {},
) {
  if (!/^\d+$/.test(jobNumber)) return null; // defensive: jobNumber is interpolated into SQL text
  if (!referenceTimes || referenceTimes.length === 0) return [];

  const sorted = [...referenceTimes].sort();
  const earliest = `${sorted[0]}:00`;
  const latest = `${sorted[sorted.length - 1]}:00`;

  let ownEvents = [];
  let bufferMinutes = initialBufferMinutes;
  let lastWindow = null;
  for (;;) {
    const { startTs } = buildLogWindow(mmddDate, earliest, bufferMinutes);
    const { endTs } = buildLogWindow(mmddDate, latest, bufferMinutes);
    if (lastWindow && lastWindow.startTs === startTs && lastWindow.endTs === endTs) break; // clipped to the full day already — widening further is pointless

    lastWindow = { startTs, endTs };
    ownEvents = await runHistoryLogQuery(dbManager, hostId, startTs, endTs, { jobNumber });

    // Keep widening until the job's completion (jobEnd) is captured, not
    // merely until *something* shows up — a narrow window can easily catch
    // the connect but miss the end (a long-running job's end can land well
    // outside the initial buffer), which is the gap this loop exists to close.
    const hasEnd = ownEvents.some((e) => e.kind === "jobEnd");
    if (hasEnd || bufferMinutes >= maxBufferMinutes) break;

    if (onExpand) onExpand(bufferMinutes, bufferMinutes + stepMinutes);
    bufferMinutes += stepMinutes;
  }

  const connectEv = ownEvents.find((e) => e.kind === "connect");
  if (!connectEv || !connectEv.connect.requestUser) return ownEvents;

  const { startTs: nearStart, endTs: nearEnd } = buildLogWindow(connectEv.date, connectEv.time, 30);
  const nearbyEvents = await runHistoryLogQuery(dbManager, hostId, nearStart, nearEnd, { messageIds: ["CPIAD09"] });
  const nearbySameUser = nearbyEvents.filter(
    (e) => e.connect.requestUser === connectEv.connect.requestUser && e.jobNumber !== jobNumber,
  );

  return [...ownEvents, ...nearbySameUser];
}
