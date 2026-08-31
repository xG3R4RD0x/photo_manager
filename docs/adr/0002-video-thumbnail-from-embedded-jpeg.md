# Prefer the video's embedded JPEG thumbnail over ffmpeg frame extraction

Invoking ffmpeg for every video during a folder scan spawns a flood of
subprocesses, which is slow and (before `CREATE_NO_WINDOW`) popped up console
windows. Sony XAVC/AVCHD containers carry a small JPEG preview embedded in the
`moov` metadata atom (a contiguous `0xFFD8 ... 0xFFD9` block), which is the
video's true "camera frame" and requires no subprocess to produce.

We therefore prefer that embedded JPEG for the grid thumbnail, falling back to
ffmpeg frame extraction only when no usable embedded JPEG exists. Metadata
probing (creation date, duration, resolution, codec) still uses ffprobe.

## How the embedded thumbnail is extracted

`thumbnail::extract_video_embedded_thumbnail` reads only the first and last
16 MiB of the video file (the `moov` atom tends to sit at the start or the end
on camera-written files, so we never load the whole multi-GB clip), scans those
regions for JPEG markers, and reuses the same `scan_embedded_jpeg` decode +
resize path already used for RAW files. Any bytes inside `mdat` that coincidentally
contain `0xFFD8` are rejected because `jpeg-decoder` fails to decode them as a
valid JPEG of sufficient size.

If no embedded JPEG is found, `thumbnail::generate_video_thumbnail_bytes` falls
back to `video::extract_video_thumbnail` (ffmpeg, frame at the 1-second mark).
The ffmpeg subprocess is launched silently via `CREATE_NO_WINDOW`.

## Consequences

- Video thumbnails for Sony XAVC/AVCHD clips render from the camera's own
  preview, without launching ffmpeg — no subprocess flood, no console popups.
- No cache of video metadata exists yet; every scan re-probes durations via
  ffprobe. A follow-up could add an EXIF-like metadata cache.
- The bundled ffmpeg binary (see 0001) remains required for metadata probing
  and as the thumbnail fallback.
