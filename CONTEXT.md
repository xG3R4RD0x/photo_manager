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

## Media Item

A file that the app can discover, display, and import. There are two kinds:

- **Photo**: an image file (jpg, jpeg, png, cr2, nef, arw, raf) shown in the grid and viewable full-size.
- **Video**: a video file (mp4, mov, avi, mkv, webm, 3gp, mts, m2ts, and others) shown in the grid with a thumbnail and a video icon. Videos are never played; only a static thumbnail is shown.

_Avoid_: file, asset

## Import Destination Structure

Photos and videos imported together share one date-based folder tree. Within each date folder, photos land at the root and videos land in a `video/` subfolder:

```
dest/YYYY/MM-DD/photo.jpg
dest/YYYY/MM-DD/video/video.mp4
```

_Avoid_: flat structure, mixed folder

## Video Thumbnail

A JPEG image shown as a video's grid preview (display only — there is no playback). Priority: the JPEG thumbnail embedded in the video's `moov` atom (XAVC/AVCHD carry one), extracted by scanning the first/last 16 MiB of the clip; falls back to an ffmpeg frame extraction at the 1-second mark. Resized and cached in the same temp cache as photo thumbnails.

_Avoid_: video preview, video player

## Video Metadata

Metadata read from a video via bundled ffprobe: creation date (from QuickTime/MP4 atoms), duration, resolution, and codec. Used for date-based folder organization and shown in the metadata panel.

_Avoid_: video info, video properties
