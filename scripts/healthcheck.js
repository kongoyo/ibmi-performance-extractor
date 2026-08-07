/**
 * Schema and data-quality guardrails, closing the gap that let Int/Bch sit
 * hardcoded to 0 (and the Dsk rounding bug) go unnoticed for months: field
 * manifest checks run BEFORE any extraction (fail fast, not mid-pipeline),
 * and a constant-value sanity check runs AFTER extraction to flag metrics
 * that look suspiciously like a wiring bug rather than real data.
 *
 * Schema checks are cached per (host, library) with a TTL so routine runs
 * stay fast — full re-verification only happens periodically or on demand.
 */
import fs from "fs";
import path from "path";
import { SKILL_ROOT } from "./preflight.js";

const MANIFEST_PATH = path.join(SKILL_ROOT, "references", "field_manifest.json");
const CACHE_PATH = path.join(SKILL_ROOT, "scratch", ".schema_check_cache.json");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

/**
 * Verifies every table/field the pipeline's SQL assumes actually exists in
 * the target library, using QSYS2.SYSTABLES / QSYS2.SYSCOLUMNS. Exits the
 * process with a guided message on any mismatch — this is a structural
 * precondition, not a soft warning, since every query downstream assumes it.
 */
export async function checkSchema(manager, hostId, library, { force = false } = {}) {
  const manifest = loadManifest();
  const cache = loadCache();
  const cacheKey = `${hostId}:${library}`;
  const cached = cache[cacheKey];

  if (!force && cached && Date.now() - new Date(cached.verifiedAt).getTime() < CACHE_TTL_MS) {
    console.log(`✔ Schema 檢查略過(快取於 ${cached.verifiedAt.slice(0, 10)} 驗證通過,library ${library})`);
    return;
  }

  console.log(`🔍 檢查 ${library} 的效能檔案與欄位是否存在(host: ${hostId})...`);
  const tables = Object.keys(manifest.tables);
  const tableList = tables.map((t) => `'${t}'`).join(",");

  const tableRes = await manager.executeQuery(
    hostId,
    `SELECT TABLE_NAME FROM QSYS2.SYSTABLES WHERE TABLE_SCHEMA = '${library}' AND TABLE_NAME IN (${tableList})`,
    [], undefined, undefined, 1000,
  );
  const existingTables = new Set(tableRes.data.map((r) => r.TABLE_NAME.trim()));
  const missingTables = tables.filter((t) => !existingTables.has(t));

  if (missingTables.length > 0) {
    console.error(
      `\n❌ [Schema 檢查失敗] Library "${library}" 缺少以下效能檔案: ${missingTables.join(", ")}`,
    );
    
    try {
      const probeRes = await manager.executeQuery(
        hostId,
        `SELECT TABLE_NAME FROM QSYS2.SYSTABLES WHERE TABLE_SCHEMA = '${library}' AND TABLE_NAME LIKE 'QAPM%'`,
        [], undefined, undefined, 1000
      );
      const foundTables = probeRes.data.map(r => r.TABLE_NAME.trim());
      if (foundTables.length > 0) {
        console.error(`🔍 [探測結果] 您的帳號在 "${library}" 中實際只能看見以下 ${foundTables.length} 張表:`);
        console.error(`   ${foundTables.join(", ")}`);
        console.error(`   (若這是公共主機如 pub400，通常代表您沒有足夠權限存取系統級別的效能表)`);
      } else {
        console.error(`🔍 [探測結果] 您的帳號在 "${library}" 中完全找不到任何 QAPM 開頭的表。請確認 Library 名稱是否正確。`);
      }
    } catch (e) {
      console.error(`🔍 [探測結果] 無法探測現有表格: ${e.message}`);
    }

    console.error(
      `💡 [解決指引]:\n` +
        `  1. 確認 --lib 或 hosts_config.json 的 library 名稱是否正確\n` +
        `  2. 確認該主機的 Collection Services 有收集這些檔案(需要 QAPMISUM/QAPMSYSTEM/QAPMJOBL/QAPMDISK 四張都存在)\n`,
    );
    process.exit(1);
  }

  const allFields = [];
  for (const [table, def] of Object.entries(manifest.tables)) {
    for (const field of Object.keys(def.fields)) {
      allFields.push({ table, field });
    }
  }

  const colRes = await manager.executeQuery(
    hostId,
    `SELECT TABLE_NAME, COLUMN_NAME FROM QSYS2.SYSCOLUMNS WHERE TABLE_SCHEMA = '${library}' AND TABLE_NAME IN (${tableList})`,
    [], undefined, undefined, 5000,
  );
  const existingCols = new Set(
    colRes.data.map((r) => `${r.TABLE_NAME.trim()}.${r.COLUMN_NAME.trim()}`),
  );
  const missingFields = allFields.filter(({ table, field }) => !existingCols.has(`${table}.${field}`));

  if (missingFields.length > 0) {
    console.error(
      `\n❌ [Schema 檢查失敗] Library "${library}" 缺少以下欄位: ` +
        missingFields.map((f) => `${f.table}.${f.field}`).join(", "),
    );
    console.error(
      `💡 [解決指引]: 可能是不同 IBM i 版本欄位有差異。請對照 references/field_manifest.json,\n` +
        `   確認是否需要更新欄位對照,或這個 library 的資料來源版本不符合預期。\n`,
    );
    process.exit(1);
  }

  console.log(`✔ Schema 檢查通過:${tables.length} 張表、${allFields.length} 個欄位皆存在。`);
  cache[cacheKey] = { verifiedAt: new Date().toISOString() };
  saveCache(cache);
}

/**
 * Flags metrics that came back constant across every real fetched value —
 * exactly the pattern that hid the Int=0 and Bch=Tot-duplicate bugs. This
 * is a warning, not a hard failure: a metric can legitimately be constant
 * (e.g. Int really is 0 for hours with no interactive users), so this is
 * meant to prompt a human look, not block the report.
 *
 * @param {Record<string, number[]>} metricSamples - metric name -> every
 *   real fetched value across all processed days (NOT the zero-padded
 *   96-slot display arrays, which would false-positive on a still-in-progress day).
 */
export function checkDataSanity(metricSamples) {
  const warnings = [];
  for (const [metric, values] of Object.entries(metricSamples)) {
    if (values.length === 0) continue;
    const uniq = new Set(values);
    if (uniq.size === 1) {
      warnings.push(
        `指標 "${metric}" 在全部 ${values.length} 筆抓取到的資料中恆為常數 ${[...uniq][0]},` +
          `可能是欄位沒接對(如同 Int/Bch 曾經發生過的情況),也可能是這段時間本來就沒有這項負載,請人工確認。`,
      );
    }
  }

  if (warnings.length > 0) {
    console.warn(`\n⚠️  [資料健檢警告] 以下指標看起來可疑:`);
    warnings.forEach((w) => console.warn(`  - ${w}`));
  } else {
    console.log(`✔ 資料健檢通過:抓取到的指標都不是全程恆定常數。`);
  }

  return warnings;
}
