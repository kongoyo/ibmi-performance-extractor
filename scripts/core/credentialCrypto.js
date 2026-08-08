/**
 * At-rest protection for the connection fields in hosts_config.json.
 *
 * Uses Windows DPAPI (via ConvertTo-SecureString / ConvertFrom-SecureString)
 * so a value can only be decrypted by the same Windows user account on the
 * same machine — no separate key file to manage or accidentally leak
 * alongside the config. This is Windows-only; on other platforms encryption
 * is skipped and values are left as plain text (see checkPython-style
 * degrade pattern in preflight.js).
 *
 * Plaintext values are passed to powershell.exe via a scoped env var
 * (never as a -Command argument or on argv) to avoid shell-quoting issues
 * and keeping secrets out of the process command line.
 */
import { execFileSync } from "child_process";

const PREFIX = "dpapi:";

export const PROTECTED_HOST_FIELDS = ["host", "port", "user", "password"];

export function isWindows() {
  return process.platform === "win32";
}

export function isEncryptedValue(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

// Windows PowerShell 5.1 (powershell.exe) auto-loads modules by scanning
// $env:PSModulePath. On machines that also have PowerShell 7 installed,
// PSModulePath commonly picks up PS7's module directory ahead of the
// built-in Windows PowerShell path; PS7's Microsoft.PowerShell.Security
// build is incompatible with powershell.exe's .NET Framework runtime, so
// auto-load silently fails and ConvertTo-SecureString becomes unavailable.
// Pinning PSModulePath to the standard Windows PowerShell 5.1 locations
// avoids that collision and is a no-op on machines without the pollution.
const WINDOWS_POWERSHELL_MODULE_PATH = [
  "C:\\Program Files\\WindowsPowerShell\\Modules",
  "C:\\WINDOWS\\system32\\WindowsPowerShell\\v1.0\\Modules",
].join(";");

function runPowerShell(script, envVar, envValue) {
  return execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        [envVar]: envValue,
        PSModulePath: WINDOWS_POWERSHELL_MODULE_PATH,
      },
    },
  ).trim();
}

export function encryptValue(plainText) {
  const cipher = runPowerShell(
    "$s = ConvertTo-SecureString -String $env:__IBMI_EPLAIN -AsPlainText -Force; ConvertFrom-SecureString -SecureString $s",
    "__IBMI_EPLAIN",
    String(plainText),
  );
  return PREFIX + cipher;
}

export function decryptValue(cipherText) {
  if (!isEncryptedValue(cipherText)) return cipherText;
  const blob = cipherText.slice(PREFIX.length);
  return runPowerShell(
    "$s = ConvertTo-SecureString -String $env:__IBMI_ECIPHER; " +
      "$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); " +
      "[Runtime.InteropServices.Marshal]::PtrToStringAuto($b)",
    "__IBMI_ECIPHER",
    blob,
  );
}
