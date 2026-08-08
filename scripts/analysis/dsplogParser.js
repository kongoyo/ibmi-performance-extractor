/**
 * Parser for QPDSPLOG/QHST (system history log) text exports, e.g. output
 * from DSPLOG OUTPUT(*PRINT) spooled to a text file.
 *
 * Deep Module boundary: this module turns the raw green-screen-style dump
 * into structured events; callers (rca_extractor.js) only read the
 * structured result, never re-parse or regex the raw log themselves.
 *
 * Format notes (observed from real V7R5 QHST dumps):
 *   - Each message is a "header" line (MSGID, severity, type, "Message . . . . :"
 *     + first line of text), zero or more continuation lines, an optional
 *     "Cause . . . . . :" sub-section (ignored — never needed for the fields
 *     this parser extracts), and a trailing fixed-width "detail" line
 *     (job name/user/number/program/date/time/message-user).
 *   - Page breaks inject a "5770SS1 ... History Log ... Page NNNN" banner
 *     line followed by a "MSGID  SEV  MSG TYPE" column-header line, which
 *     can land in the middle of a message's continuation lines. Both are
 *     stripped before parsing.
 */

const PAGE_BANNER_RE = /^\s*5770SS1\b/;
const COLUMN_HEADER_RE = /^MSGID\s+SEV\s+MSG TYPE\s*$/;
const HEADER_LINE_RE = /^([A-Z0-9]{6,7})\s+(\d{2})\s+(\S+)\s+Message(?:\s*\.)+\s*:\s*(.*)$/;
const CAUSE_LINE_RE = /^\s*Cause(?:\s*\.)+\s*:/;
const DETAIL_LINE_RE = /^\s{6,}(\S+)\s+(\S+)\s+(\d{6})\s+(\S+)\s+\d{4}\s+(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d+)\s+(\S+)\s*$/;

/** "26/08/07" (YY/MM/DD) -> "08/07", matching the rest of the pipeline's date convention. */
function toMMDD(yyMMdd) {
  const parts = yyMMdd.split("/");
  return `${parts[1]}/${parts[2]}`;
}

const CONNECT_TEXT_RE = /User (\S+) from client (\S+) connected to job (\d+)\/(\S+)\/(\S+) in subsystem (\S+) in (\S+) on (\d{2}\/\d{2}\/\d{2}) (\d{2}:\d{2}:\d{2})/;
const SIGNON_TEXT_RE = /\*SIGNON server job (\d+)\/(\S+)\/(\S+) processing request for user (\S+) on (\d{2}\/\d{2}\/\d{2}) (\d{2}:\d{2}:\d{2})/;
const JOBSTART_TEXT_RE = /Job (\d+)\/(\S+)\/(\S+) started on (\d{2}\/\d{2}\/\d{2}) at (\d{2}:\d{2}:\d{2}) in subsystem (\S+) in (\S+)/;
const JOBEND_TEXT_RE = /Job (\d+)\/(\S+)\/(\S+) ended on (\d{2}\/\d{2}\/\d{2}) at (\d{2}:\d{2}:\d{2}); ([\d.]+) seconds used; end\s*code\s*(\d+)/;

export const END_CODE_DESCRIPTIONS = {
  "0": "正常結束",
  "10": "受控結束（controlled ending，通常為使用者主動關閉或子系統受控結束）",
  "20": "超過結束嚴重度（ENDSEV job attribute）",
  "30": "異常結束",
  "40": "工作尚未啟用前就結束",
  "50": "工作階段作用中時系統結束",
  "60": "子系統在工作階段作用中時異常結束",
  "70": "系統在工作階段作用中時異常結束",
  "80": "使用者以 ENDJOBABN 指令強制結束",
  "90": "超過時間限制後被強制結束（ENDJOBABN）",
};

export function describeEndCode(code) {
  return END_CODE_DESCRIPTIONS[String(code)] || `未知結束碼（${code}）`;
}

/**
 * Parses a full QPDSPLOG/QHST text dump into structured events.
 * @param {string} text - raw file contents
 * @returns {Array<object>} events, each with at least
 *   { kind, msgId, jobName, jobUser, jobNumber, date, time, rawLines }
 *   plus kind-specific fields (see buildEvent below).
 */
export function parseDsplog(text) {
  const lines = text.split(/\r?\n/).filter((line, i, arr) => {
    if (PAGE_BANNER_RE.test(line)) return false;
    if (COLUMN_HEADER_RE.test(line)) return false;
    return true;
  });

  const events = [];
  let block = null; // { msgId, textParts: [], inCause: false, rawLines: [] }

  const finalizeBlock = (detailMatch, detailLine) => {
    if (!block) return;
    block.rawLines.push(detailLine);
    const text = block.textParts.join(" ").replace(/\s+/g, " ").trim();
    const event = buildEvent(block.msgId, text, block.rawLines);
    if (event) events.push(event);
    block = null;
  };

  for (const line of lines) {
    const headerMatch = HEADER_LINE_RE.exec(line);
    if (headerMatch) {
      // A new message started before the previous one found its detail line
      // (shouldn't normally happen in a well-formed dump) — drop the
      // incomplete block rather than mis-attributing its detail line.
      block = { msgId: headerMatch[1], textParts: [headerMatch[4]], inCause: false, rawLines: [line] };
      continue;
    }

    if (!block) continue; // line outside any recognized message block

    const detailMatch = DETAIL_LINE_RE.exec(line);
    if (detailMatch) {
      finalizeBlock(detailMatch, line);
      continue;
    }

    block.rawLines.push(line);
    if (CAUSE_LINE_RE.test(line)) {
      block.inCause = true;
      continue;
    }
    if (!block.inCause) {
      block.textParts.push(line.trim());
    }
  }

  return events;
}

function buildEvent(msgId, text, rawLines) {
  const raw = rawLines.join("\n");

  if (msgId === "CPIAD09") {
    const m = CONNECT_TEXT_RE.exec(text);
    if (!m) return null;
    const [, requestUser, clientIp, jobNumber, jobUser, jobName, subsystem, library, date, time] = m;
    return {
      kind: "connect", msgId, jobName, jobUser, jobNumber,
      date: toMMDD(date), time, raw,
      connect: { requestUser, clientIp, subsystem, library },
    };
  }

  if (msgId === "CPIAD0B") {
    const m = SIGNON_TEXT_RE.exec(text);
    if (!m) return null;
    const [, jobNumber, jobUser, jobName, requestUser, date, time] = m;
    return {
      kind: "signon", msgId, jobName, jobUser, jobNumber,
      date: toMMDD(date), time, raw,
      signon: { requestUser },
    };
  }

  if (msgId === "CPF1124") {
    const m = JOBSTART_TEXT_RE.exec(text);
    if (!m) return null;
    const [, jobNumber, jobUser, jobName, date, time, subsystem, library] = m;
    return {
      kind: "jobStart", msgId, jobName, jobUser, jobNumber,
      date: toMMDD(date), time, raw,
      jobStart: { subsystem, library },
    };
  }

  if (msgId === "CPF1164") {
    const m = JOBEND_TEXT_RE.exec(text);
    if (!m) return null;
    const [, jobNumber, jobUser, jobName, date, time, secondsUsed, endCode] = m;
    return {
      kind: "jobEnd", msgId, jobName, jobUser, jobNumber,
      date: toMMDD(date), time, raw,
      jobEnd: { secondsUsed: parseFloat(secondsUsed), endCode },
    };
  }

  return null;
}

/** Exact-identity lookup: all events referencing one specific job instance. */
export function findJobEvents(events, jobName, jobUser, jobNumber) {
  return events.filter(
    (e) => e.jobName === jobName && e.jobUser === jobUser && e.jobNumber === jobNumber,
  );
}

function timeToMinutes(hhmmss) {
  const [h, m, s] = hhmmss.split(":").map(Number);
  return h * 60 + m + s / 60;
}

/**
 * Finds other "connect" events from the same requesting user and/or client
 * IP, within windowMinutes of a reference date+time — surfaces paired
 * sessions (e.g. an interactive 5250 job launched alongside an ODBC/JDBC
 * prestart job from the same client) that a single job's own lifecycle
 * can't show on its own.
 */
export function findNearbyConnects(events, { requestUser, clientIp, date, time, windowMinutes = 30 }) {
  const refMinutes = timeToMinutes(time);
  return events.filter((e) => {
    if (e.kind !== "connect") return false;
    if (e.date !== date) return false;
    const matchesUser = requestUser && e.connect.requestUser === requestUser;
    const matchesIp = clientIp && e.connect.clientIp === clientIp;
    if (!matchesUser && !matchesIp) return false;
    return Math.abs(timeToMinutes(e.time) - refMinutes) <= windowMinutes;
  });
}
