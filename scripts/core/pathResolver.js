/**
 * Path resolution for data/ and outputs/ directories.
 *
 * Responsibility: given a host config + library name, compute the canonical
 * on-disk paths where extracted data and generated reports should live, then
 * ensure those directories exist.
 *
 * Deliberately has NO dependency on credential management, environment
 * checks, or SourceManager — callers that only need paths should import
 * this module directly instead of dragging in the full preflight surface.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const SKILL_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/**
 * Substitutes {host}/{hostId}/{lib} template tokens in a path template.
 * {YOUR_IBMI_HOST_IP_OR_DNS} is accepted as an alias of {host} so the
 * placeholder text in hosts_config.json.example can be used verbatim.
 */
function substituteTokens(str, hostId, hostConfig, library) {
  return str
    .replace(/\{host\}/g, hostConfig.host)
    .replace(/\{YOUR_IBMI_HOST_IP_OR_DNS\}/g, hostConfig.host)
    .replace(/\{hostId\}/g, hostId)
    .replace(/\{lib\}/g, library);
}

/**
 * Resolves the data/ and outputs/ directories for a given host + library.
 *
 * Directory layout (keyed by {host}/{lib} only, NOT by date):
 *   data/<Host IP>/<Library>/      ← raw extracted JSON (source of truth)
 *   outputs/<Host IP>/<Library>/   ← HTML reports + AI RCA reports
 *
 * Date range is encoded in the *filename* (e.g. perf_0714.json vs
 * perf_0712_to_0714.json) so single-day and range runs never collide.
 *
 * See references/output-conventions.md for the full naming spec.
 */
export function resolveDataAndOutputDirs(hostConfig, hostId, library) {
  // Prefer the explicit argument, then fall back to what the host config
  // declares, so callers that omit --lib still get the right directory.
  const resolvedLib = library || hostConfig.library;
  if (!resolvedLib) {
    throw new Error(
      `[pathResolver] library is required but was not provided and ` +
      `hosts_config has no 'library' field for host "${hostId}".`
    );
  }

  const dataRaw = `data/{host}/{lib}/`;
  const outRaw = `outputs/{host}/{lib}/`;

  const dataDir = path.join(SKILL_ROOT, substituteTokens(dataRaw, hostId, hostConfig, resolvedLib));
  const outDir = path.join(SKILL_ROOT, substituteTokens(outRaw, hostId, hostConfig, resolvedLib));

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  return { dataDir, outDir };
}
