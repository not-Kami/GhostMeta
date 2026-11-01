<!-- atelier-pack:v1 -->
# Requirements — File Anonimity

Versioning: **semver** starting at **0.0.0**.

| Event | Todo tag | Bump |
| --- | --- | --- |
| Bug fix | `<!-- bump:fix -->` | patch · 0.1.0 → 0.1.1 |
| Feature | `<!-- bump:feat -->` | minor · 0.1.1 → 0.2.0 |
| Goal / milestone | `<!-- bump:goal -->` | 0.x → next minor · ≥1.0 → major |
| Breaking / 1.0 | `<!-- bump:major -->` | major · 0.x → 1.0.0 |

Confirming a tagged todo in The Hub updates `VERSION.md`.
Buttons Fix / Feature / Goal on the project page do the same.
CLI: `python Hub/atelier.py bump --id file-anonimity --kind feat --note "…"`.
