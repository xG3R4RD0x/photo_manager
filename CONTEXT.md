# photo_manager — Domain Glossary

## Date Template

A string used to organize photos into date-based folder paths during import. Supports tokens that are replaced with date components at render time.

### Tokens

| Token | Replacement | Example (May 27, 2026 14:30:00) |
|-------|-------------|----------------------------------|
| `YYYY` | 4-digit year | 2026 |
| `YY` | 2-digit year | 26 |
| `MM` | 2-digit month | 05 |
| `DD` | 2-digit day | 27 |
| `HH` | 2-digit hour (24h) | 14 |
| `mm` | 2-digit minute | 30 |
| `ss` | 2-digit second | 00 |
| `MONTH` | Full month name (English) | May |
| `MONTH_EN` | Full month name (English) | May |
| `MONTH_ES` | Full month name (Spanish) | Mayo |
| `YYYY-MM-DD` | ISO date | 2026-05-27 |
| `YYYYMMDD` | Compact date | 20260527 |

Tokens are resolved longest-first so compound tokens (`YYYY-MM-DD`) take priority over their components.
