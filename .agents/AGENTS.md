# 🔒 隱私與資安遮蔽規則 (Privacy & Security Redaction)

<RULE>
When generating, updating, or reviewing any documentation, READMEs, artifacts, or plain-text files meant for human readability, the Agent MUST proactively redact sensitive connection information.
- Specifically, if you encounter real IPs, Hostnames, User IDs, or Passwords, they MUST be replaced with semantic placeholders.
- Example: `172.16.12.124` -> `<Host IP>`
- Example: `clark73` -> `<HostID>` or `<HostName>`
- Example: `QSECOFR` -> `<UserID>`
- Example: `mysecretpwd` -> `<UserPW>`
Do NOT leak real infrastructure details into markdown documentation or example prompts.
</RULE>

# 🚫 禁止即興產生 Bash 指令 (No Ad-hoc Bash Commands)

<RULE>
Executing this skill's pipeline (extraction, validation, report generation, etc.) MUST go through a predefined `npm run <script>` entry already declared in `package.json` (e.g. `npm run extract -- --host=<id> --date=<MM/DD>`, `npm run validate -- --host=<id>`).
- The Agent must NOT improvise one-off bash/PowerShell invocations (inline env var exports, manual `node ./scripts/...` calls, piping through `tail`/`Select-Object`, etc.) to run the pipeline.
- If a new invocation pattern is needed (new flag, new env var, new wrapper), add it as a proper `npm run` script in `package.json` (and document it in `SKILL.md`) FIRST, then invoke that script — don't hand-generate the equivalent one-liner instead.
- This keeps every way of running the pipeline reviewable, reproducible, and documented in one place instead of reinvented per session.
</RULE>

# 🎯 以資料分析為主，臨時指令須併入流程 (Analysis-First, No Throwaway Tooling)

<RULE>
Within this skill, the Agent's primary job during a session is analyzing the extracted performance data (trends, anomalies, RCA) — not operating the shell.
- If debugging, environment setup, or any other reason genuinely requires a temporary bash command or piece of code, don't just run it as a one-off: evaluate whether it should be folded into the skill's permanent workflow first (a new/updated `npm run` script in `package.json`, a fix in `scripts/`, or a note in `SKILL.md`/`references/`).
- Only fall back to a truly throwaway command when the need is one-time/exploratory and clearly out of scope for the permanent pipeline (e.g. inspecting a file once) — and prefer dedicated tools (Read/Grep/Glob) over Bash for that even then.
- The default posture is: fix/extend the skill's scripts so the same problem doesn't require improvised commands next time, then move on to interpreting the data.
</RULE>
