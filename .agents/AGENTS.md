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
