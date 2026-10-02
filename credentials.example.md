# Local credentials template (safe to commit: contains NO real values)

Copy this file to `.credentials.local.md` in the repo root ON YOUR OWN COMPUTER and fill it in.
`.credentials.local.md` is gitignored, so it never reaches GitHub (this repo and its Pages site are public).
Agents (e.g. Claude Code) may read it locally; they must never print, copy, or commit the values.

## GitHub
- Fine-grained personal access token (repo: platypuggames/platypug, Contents: read/write, set an expiry):
  GITHUB_TOKEN=

## Notes
- Apple / App Store Connect API key (.p8), signing certificate (.p12) and its password stay in Codemagic
  and in your password manager, not here. Agents never need them.
- Firebase web config is already public in the code by design; nothing to store.
