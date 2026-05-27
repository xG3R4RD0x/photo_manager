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

## Thumbnail Cache

Thumbnails (200×200 JPEG) are stored in a `.thumbnails/` folder **alongside the original photos**, not in a global system cache.

For a photo at `D:/Fotos/2026/05-27/photo.jpg`, the thumbnail is at `D:/Fotos/2026/05-27/.thumbnails/<blake3_hash>_200.jpg`.

Two cache layers:
- **Memory**: `HashMap<blake3_path_hash, Vec<u8>>` in `ThumbnailCache` struct, session-only
- **Disk**: `.thumbnails/` subdirectory per photo folder, persistent

Lookup order: memory → disk → generate → insert into both.
