/**
 * Shared preflight checks for the IBM i performance extractor scripts.
 *
 * Resolution convention:
 * - hosts_config.json and generate_report.py travel WITH the skill package,
 *   so they resolve relative to this file's location (SKILL_ROOT) — this
 *   keeps working no matter where the skill is dropped (standalone folder,
 *   or nested under a project's .agents/skills/ibmi-performance-extractor/).
 * - packages/server/dist/public/services.js belongs to the consuming
 *   project, so it resolves relative to the current working directory
 *   (the caller is expected to run the script from the project root).
 * Both are overridable via CLI flags / env vars for edge cases.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath, pathToFileURL } from "url";
import {
  PROTECTED_HOST_FIELDS,
  isWindows,
  isEncryptedValue,
  encryptValue,
  decryptValue,
} from "./credentialCrypto.js";

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

export const SKILL_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function fail(message, hint) {
  console.error(`\n${RED}❌ [環境檢查失敗]${RESET} ${message}`);
  if (hint) console.error(`${YELLOW}💡 [解決指引]${RESET}\n${hint}\n`);
  process.exit(1);
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

export function checkNodeVersion(minMajor = 18) {
  const major = parseInt(process.version.slice(1).split(".")[0], 10);
  if (Number.isNaN(major) || major < minMajor) {
    fail(
      `Node.js 版本過舊 (目前 ${process.version},需要 >= ${minMajor})。`,
      `  請安裝 Node.js ${minMajor}+: https://nodejs.org/`,
    );
  }
}

export function checkPython() {
  for (const cmd of ["python", "python3"]) {
    try {
      execSync(`${cmd} --version`, { stdio: "ignore" });
      return cmd;
    } catch {
      // try next candidate
    }
  }
  fail(
    "找不到可用的 Python 3 執行環境 (generate_report.py 需要它產生 HTML 報表)。",
    "  1. 請安裝 Python 3.8 以上版本並確認已加入 PATH\n" +
      "  2. 驗證方式: 於終端機執行 `python --version` 或 `python3 --version`",
  );
}

// Monorepo checkout: services.js sits under packages/server/... relative to
// the project root. Installed-as-npm-dependency layout: the package root
// itself IS packages/server's published output, so services.js sits closer
// to the package root. Both are checked when falling back to node_modules
// resolution.
const SERVICES_RELATIVE_CANDIDATES = [
  ["packages", "server", "dist", "public", "services.js"],
  ["dist", "public", "services.js"],
];

function resolveServicesFromNpmPackage() {
  let require;
  try {
    require = createRequire(path.join(process.cwd(), "package.json"));
  } catch {
    return null;
  }

  let pkgJsonPath;
  try {
    pkgJsonPath = require.resolve("@ibm/ibmi-mcp-server/package.json", {
      paths: [process.cwd()],
    });
  } catch {
    return null;
  }

  const pkgRoot = path.dirname(pkgJsonPath);
  for (const parts of SERVICES_RELATIVE_CANDIDATES) {
    const candidate = path.join(pkgRoot, ...parts);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export async function loadServices(args = {}) {
  const explicit = args.services || process.env.IBMI_SERVICES_PATH;
  const cwdCandidate = path.join(
    process.cwd(),
    ...SERVICES_RELATIVE_CANDIDATES[0],
  );

  let resolved = path.resolve(explicit || cwdCandidate);

  if (!explicit && !fs.existsSync(resolved)) {
    const npmResolved = resolveServicesFromNpmPackage();
    if (npmResolved) resolved = npmResolved;
  }

  if (!fs.existsSync(resolved)) {
    fail(
      `找不到 @ibm/ibmi-mcp-server 服務模組 (SourceManager): ${resolved}`,
      `  1. 請確認目前工作目錄是已 build 好 packages/server 的 ibmi-mcp-server 專案根目錄\n` +
        `     (目前工作目錄: ${process.cwd()})\n` +
        `  2. 若 @ibm/ibmi-mcp-server 是以 npm 套件形式安裝於 node_modules,請確認已從專案根目錄執行\n` +
        `     (腳本會嘗試以 require.resolve 解析套件實際安裝位置,失敗則回退顯示上述路徑)\n` +
        `  3. 或使用 --services=<絕對路徑> 參數,或設定環境變數 IBMI_SERVICES_PATH 指向 services.js\n` +
        `  4. 若尚未建置該專案,請於 packages/server 內執行其建置指令`,
    );
  }

  return import(pathToFileURL(resolved).href);
}

export function loadHostConfig(hostIdArg, args = {}) {
  const configPath =
    args.config ||
    process.env.IBMI_HOSTS_CONFIG ||
    path.join(SKILL_ROOT, "scratch", "hosts_config.json");
  const resolvedConfig = path.resolve(configPath);

  if (!fs.existsSync(resolvedConfig)) {
    fail(
      `找不到主機設定檔: ${resolvedConfig}`,
      `  請參考 ${path.join(SKILL_ROOT, "examples", "hosts_config.json.example")} 建立 scratch/hosts_config.json\n` +
        `  (此檔案放在 skill 資料夾下的 scratch/,會隨 skill 一起分享/攜帶,且已被 .gitignore 排除)`,
    );
  }

  const allConfigs = JSON.parse(fs.readFileSync(resolvedConfig, "utf8"));
  let hostId = hostIdArg;

  if (!hostId) {
    const hostIds = Object.keys(allConfigs);
    if (hostIds.length === 1) {
      hostId = hostIds[0];
      console.log(`ℹ️  未指定 --host,自動使用設定檔中唯一的主機: ${hostId}`);
    } else {
      fail(
        `未指定 --host,且設定檔中有 ${hostIds.length} 個主機設定。`,
        `  請使用 --host=<主機ID> 指定其中一個: ${hostIds.join(", ") || "(設定檔為空)"}`,
      );
    }
  }

  let hostConfig = allConfigs[hostId];
  const hostConfigFromFile = !!hostConfig;
  if (!hostConfig) {
    const h = process.env[`IBMI_HOST_${hostId}`];
    const u = process.env[`IBMI_USER_${hostId}`];
    const p = process.env[`IBMI_PASSWORD_${hostId}`];
    if (h && u && p) {
      hostConfig = {
        host: h,
        user: u,
        password: p,
        port: process.env[`IBMI_PORT_${hostId}`]
          ? Number(process.env[`IBMI_PORT_${hostId}`])
          : 8076,
        "ignore-unauthorized": true,
      };
    }
  }

  const placeholderPasswords = new Set([
    "YOUR_PASSWORD_HERE",
    "<YOUR_IBMI_PASSWORD>",
  ]);
  if (
    !hostConfig ||
    !hostConfig.host ||
    !hostConfig.user ||
    !hostConfig.password ||
    placeholderPasswords.has(hostConfig.password)
  ) {
    fail(
      `找不到主機 "${hostId}" 的連線憑證,或密碼仍為預留字。`,
      `  1. 請檢查並填寫 ${resolvedConfig}\n` +
        `  2. 或設定環境變數:\n` +
        `     IBMI_HOST_${hostId}=主機IP\n     IBMI_USER_${hostId}=帳號\n     IBMI_PASSWORD_${hostId}=密碼`,
    );
  }

  // At-rest protection: on the first run against a host with plaintext
  // host/port/user/password, encrypt those fields with Windows DPAPI and
  // write the ciphertext back to hosts_config.json. On later runs the
  // ciphertext is transparently decrypted here for use, but the file on
  // disk never holds plaintext again. Skipped for env-var-sourced configs
  // (nothing on disk to protect) and on non-Windows platforms.
  if (hostConfigFromFile && isWindows()) {
    const runtimeConfig = { ...hostConfig };
    let mutated = false;
    const encryptedHosts = [];

    for (const key of Object.keys(allConfigs)) {
      const config = allConfigs[key];
      let hostMutated = false;

      for (const field of PROTECTED_HOST_FIELDS) {
        const raw = config[field];
        if (raw === undefined || raw === null || raw === "") continue;

        if (isEncryptedValue(raw)) {
          if (key === hostId) {
            const plain = decryptValue(raw);
            runtimeConfig[field] = field === "port" ? Number(plain) : plain;
          }
        } else {
          // Skip placeholder values from being encrypted
          if (typeof raw === "string" && (raw.includes("YOUR_") || raw.includes("PASSWORD_HERE"))) {
            continue;
          }
          
          allConfigs[key][field] = encryptValue(raw);
          hostMutated = true;
          mutated = true;
        }
      }

      if (hostMutated) {
        encryptedHosts.push(key);
      }
    }

    if (mutated) {
      fs.writeFileSync(resolvedConfig, JSON.stringify(allConfigs, null, 2));
      console.log(
        `🔒 已將主機 "${encryptedHosts.join(", ")}" 的 host/port/user/password 以 Windows DPAPI 加密並回寫至 ${resolvedConfig}`,
      );
    }

    hostConfig = runtimeConfig;
  }

  return { hostId, hostConfig, configPath: resolvedConfig };
}

/**
 * Substitutes {host}/{hostId} template tokens in an outputDirs entry.
 * {YOUR_IBMI_HOST_IP_OR_DNS} is accepted as an alias of {host} so the
 * placeholder text in hosts_config.json.example can be used verbatim.
 */
function substituteTokens(str, hostId, hostConfig) {
  return str
    .replace(/\{host\}/g, hostConfig.host)
    .replace(/\{YOUR_IBMI_HOST_IP_OR_DNS\}/g, hostConfig.host)
    .replace(/\{hostId\}/g, hostId);
}

/**
 * Resolves the report/JSON output directories for a host. Relative entries
 * resolve against SKILL_ROOT (so the default stays self-contained inside
 * the skill package); absolute entries pass through unchanged. Entries may
 * contain {host}/{hostId} tokens to split output per target machine.
 */
export function resolveOutputDirs(hostConfig, hostId) {
  const raw =
    Array.isArray(hostConfig.outputDirs) && hostConfig.outputDirs.length
      ? hostConfig.outputDirs
      : ["outputs/{host}/"];
  const dirs = raw.map((d) => {
    const substituted = substituteTokens(d, hostId, hostConfig);
    return path.isAbsolute(substituted)
      ? substituted
      : path.join(SKILL_ROOT, substituted);
  });
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dirs;
}
