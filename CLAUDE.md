# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Agent Skill (not a standalone app) that lets an AI agent extract IBM i (AS/400) Collection Services performance data (`QAPM*` physical files in a `*MGTCOL` library), turn it into interactive HTML dashboards, and produce AI-authored RCA (root cause analysis) and system-level reports. `SKILL.md` is the entry point the agent reads first; it routes to `references/*.md` lazily based on task context (credential setup, RCA workflow, report catalog, HTML styling rules, field semantics, output conventions, validation).

## Commands

```bash
npm install                                                   # first-time setup only
npm run extract -- --host=<id> --date=<MM/DD>                 # single day
npm run extract -- --host=<id> --dateFrom=<MM/DD> --dateTo=<MM/DD>  # date range, one JSON
npm run rca -- --host=<id> --job=<JobName> --date=<MM/DD> [--time=<HH:MM>]  # omit --time for full-day scan
npm run anomaly -- --host=<id> --date=<MM/DD>                 # find worst-offender jobs when job is unknown
npm run digest -- --host=<id> --date=<MM/DD>                  # one-page daily executive summary
npm run trend -- --host=<id> --dateFrom=<MM/DD> --dateTo=<MM/DD>    # multi-day trend/capacity planning
npm run disk-hotspot -- --host=<id> --date=<MM/DD>             # per-ARM disk hot-spot scan
npm run validate -- --host=<id>                                # 8-area regression suite against a fixed benchmark host
npm test                                                        # runs scripts/tests/pathResolver.test.js + extractor.test.js
```

`--lib=<Library>` overrides the host's configured default library on any command. `--host` can be omitted only when `config/hosts_config.json` has exactly one host.

## Hard rules (from `.agents/AGENTS.md`, enforced project-wide)

- **No ad-hoc pipeline invocations.** Extraction/validation/reporting must always go through an `npm run <script>` entry defined in `package.json`. Never hand-roll `node ./scripts/...` calls, inline env exports, or shell pipelines to run the pipeline. If a new invocation pattern is needed, add it as an `npm run` script (and document it in `SKILL.md`) first.
- **No throwaway tooling for analysis work.** The agent's job in this repo is interpreting extracted data, not operating the shell. A genuinely one-off inspection is fine via Read/Grep/Glob; anything that recurs belongs in a permanent script or npm entry instead.
- **Redact real infrastructure details** (IPs, hostnames, user IDs, passwords) from any human-readable output — docs, READMEs, example prompts, generated reports. Use semantic placeholders (`<Host IP>`, `<HostID>`, `<UserID>`, `<UserPW>`).

## Architecture

**Deep Module pattern**: scripts do all data collection, computation, and summarization; the AI agent only reads pre-digested context files and writes human-facing prose. The agent must never write ad-hoc SQL, manually scan JSON, or use `node -e` scratch scripts to answer analysis questions — that's what `rca_extractor.js` / `anomaly_scan.js` / `daily_digest.js` / `trend_report.js` / `disk_hotspot_scan.js` are for.

**Two-tier output split**, both under `outputs/<HostId>/<Library>/`:

- `context/` — machine-readable, produced by the collector scripts (`rca_context_*.md`, `anomaly_scan_*.md`, `daily_digest_*.md`, `trend_report_*.md`, `disk_hotspot_scan_*.md`). Token-efficient summaries for the AI to read; never shared externally.
- everything else — human-readable deliverables the AI writes after reading context (`rca_report_<JOB>.md`, `daily_digest_report_*.md`, `trend_report_*.md`, `disk_hotspot_report_*.md`) plus the HTML dashboards.

**Directory layout** (see `references/output-conventions.md` for full detail):

```text
data/<HostId>/<Library>/perf_<label>.json      # raw extracted data, source of truth
outputs/<HostId>/<Library>/...                 # reports + dashboards (see above)
```

Directories are keyed by host+library only, **not** by date — date range lives in the filename (`perf_0714.json` vs `perf_0712_to_0714.json`), derived from the *actual* partitions found (not the requested range), so single-day and range runs never collide. `<HostId>` is the `host` field value from `hosts_config.json` (the IP/DNS), not the JSON key.

A host's Collection Services data can be split across more than one `*MGTCOL` library, and `hosts_config.json` only names one as the default — so when `--lib` isn't given and the default library has no data for the requested date(s), scripts auto-discover the right library instead of failing: `test_pipeline.js` queries the live host for every library holding `QAPMISUM` partitions and retries with the best match (`discoverLibrariesForDates` in `extractor.js`); the analysis scripts (`rca_extractor.js`/`anomaly_scan.js`/`daily_digest.js`/`trend_report.js`/`disk_hotspot_scan.js`) scan sibling `data/<HostId>/*/` cache directories instead (`resolveLibraryAndJsonPath` in `rcaUtils.js`). An explicit `--lib` is never overridden — it fails loudly instead. Generated reports (`outputs/.../*.md`) always show the real host/IP; the redaction rule in `.agents/AGENTS.md` applies only to docs/READMEs/example prompts, not delivered reports (see `references/output-conventions.md`).

`npm run extract` is local-first: before touching the live host, `test_pipeline.js` calls the same `resolveLibraryAndJsonPath` used by the analysis scripts to check whether a cached `perf_*.json` already covers every requested date; if so, it regenerates the HTML report from that cache and skips the DB connection (and the Python/credential/PowerShell round-trip that comes with it) entirely. Only a genuine cache miss triggers a live connection. `--forceExtract=true` bypasses the cache check when the host's data may have changed since the cache was written.

**RCA remote address**: `jobsQuery` (`queries.js`) also captures each ranked job's remote socket (`QAPMJOBL.JBIPAF`/`JBIPAD`/`JBIPPT`), decoded by `decodeRemoteAddress()` in `jobRanker.js` into a plain `ip:port` string (including collapsing IPv4-mapped IPv6 down to IPv4). Since a job can have multiple `QAPMJOBL` rows per interval (secondary threads), the query picks a single row's family+address+port together via `JBTHDF`-ordered `ROW_NUMBER()` rather than taking `MAX()` per column independently — mixing columns from different rows silently produces nonsense addresses (see `references/field_reference.md`'s 2026-08-08 entry). RCA context files (`rca_extractor.js`) surface this per time-slot or, in full-day mode, grouped by distinct address — useful because prestart jobs like `QZDASOINIT` reuse the same job number across unrelated client connections.

**RCA DSPLOG/QHST cross-reference** (`rca_extractor.js`): resolves the target job's real requesting user + client IP + full lifecycle (connect → end, CPU seconds, end code) by cross-referencing system history log events, surfaced as both prose and quotable raw-text evidence in the Context file. Two interchangeable event sources feed the same renderer (`buildDsplogSection`) and share one event shape (`kind`/`jobName`/`jobUser`/`jobNumber`/`date`/`time`/`raw` + kind-specific fields): `dsplogParser.js` parses an offline `DSPLOG OUTPUT(*PRINT)` text export (`--dsplog=<path>`) by regexing message header/detail lines, handling page-break banners landing mid-message; `historyLogFetcher.js` is the default — a brief live connection querying `QSYS2.HISTORY_LOG_INFO` (structured columns, no text regex needed for job identity, only for remote IP/seconds-used/end-code/subsystem which have no dedicated column and come back pre-translated to the session's locale). The live path scopes its query window to the job's own known-active time range from the perf data (not the whole day), widening by one hour at a time — via `fetchJobHistoryContext`'s loop — until the job's `jobEnd` event is captured or the window is clipped to the full calendar day. `--fetchLog=false` skips cross-referencing entirely; any failure (unreachable host, missing file, unsupported IBM i release) degrades gracefully rather than failing the RCA, since the perf-data analysis must work standalone.

**Path resolution** (`scripts/pathResolver.js`) is deliberately dependency-free (no credential/env logic) — it only computes `data/`/`outputs/` paths from a host config + library and creates them. `scripts/preflight.js` re-exports `SKILL_ROOT`/`resolveDataAndOutputDirs` from it for backward compatibility and owns everything else: Node/Python version guards, dynamic loading of `@ibm/ibmi-mcp-server`'s `SourceManager`, and `hosts_config.json` loading. New scripts should call `runPreflight()` from `preflight.js` rather than sequencing these guards by hand.

**Credentials**: `config/hosts_config.json` (gitignored) holds per-host connection info, or env vars `IBMI_HOST_<id>`/`IBMI_USER_<id>`/`IBMI_PASSWORD_<id>` as fallback. On Windows, `preflight.js` transparently encrypts plaintext `host`/`port`/`user`/`password` fields at rest via DPAPI (`scripts/credentialCrypto.js`) on first run, writing `dpapi:`-prefixed ciphertext back to the file; later runs decrypt transparently into memory. This only applies to file-sourced config, not env-var-sourced config, and only on `win32`.

**Preflight/healthcheck chain** every entry script runs before querying: Node version → (optional) Python availability → (optional) `SourceManager` load → host config/credential load → schema existence check (`scripts/healthcheck.js` `checkSchema`, against `references/field_manifest.json`, cached in `scratch/.schema_check_cache.json`) → after extraction, data-sanity check (`checkDataSanity`, flags metrics that are constant across the whole run).

**RCA workflow** (`references/rca-diagnostics.md`): if the job is already known, call `npm run rca` (single time point via `--time`, or full-day scan omitting it, which also detects job restarts via changed Job Number). If the job is unknown, call `npm run anomaly` first to rank candidates by how often they top the per-interval leaderboards across five dimensions (Response Time, CPU, Disk I/O, Page Faults, Seize/Wait) — it prints the suggested follow-up `npm run rca` command. Both scripts auto-locate the right cached `data/<HostId>/<Library>/perf_*.json`. Large result sets (>20 samples) auto-collapse to statistical summaries + peak-only detail to keep context files small; raw values need `--debug=true`.

**Report generation**: `scripts/generate_report.py` (Python, invoked from Node scripts) renders the HTML dashboards; `scripts/reporting/` holds its supporting modules (`data_processor.py`, `insights_engine.py`, `templates.py`). `scripts/reportingThresholds.js` centralizes the alert thresholds (Tot>70%, Rsp>2.0s, Usr>50/s) shared across the HTML dashboard, `daily_digest.js`, and `trend_report.js`.

**Validation** (`scripts/validate_metrics.js`, see `references/validate-workflow.md`): 8 fixed Test Areas assert extraction/calculation logic against hardcoded green-screen benchmark values (from one specific historical library snapshot, independent of `--lib`). Must be rerun after any change to `scripts/queries.js` SQL or `scripts/extractor.js` metric conversion logic — any `[FAIL]` means the formula diverged from the benchmark and must be fixed before proceeding. Some areas (7, 8c — `JBSZWT` Seize/Wait, `DSSRVT`/`DSWT`/`DSDCFW` disk fields) are unverified fields that only dump raw values for manual cross-check against `WRKACTJOB`/`WRKDSKSTS`; promoting one to a real assertion means editing the benchmark arrays in `validate_metrics.js` and logging the verification in `references/field_reference.md`.

**Field semantics**: `references/field_reference.md` plus per-table files (`references/qapm*_fields.md`) document what each QAPM column means and the formulas used (e.g. disk busy% uses `CEILING`, not `TRUNC`, to match `DSPPFRDTA`). Consult these before touching SQL in `scripts/queries.js`.
