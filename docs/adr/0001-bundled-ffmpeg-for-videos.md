# Bundled ffmpeg for video thumbnail extraction and metadata probing

The app supports importing videos alongside photos, but the existing `image` /
`jpeg-decoder` crates can only decode still images. We bundle a static ffmpeg
(and ffprobe) binary with the app and invoke it as a subprocess to extract a
thumbnail frame at the 1-second mark and to probe creation date, duration,
resolution, and codec.

We chose a bundled binary over a link-time integration (`ffmpeg-next`) because
the latter requires complex build setups and system libraries, and over
requiring a system ffmpeg because that fails when ffmpeg is absent or the wrong
version — unreliable on end-user machines, especially for AVCHD `.mts` files
from Sony cameras. The binary is shipped next to the executable under
`binaries/` (declared via `bundle.externalBin`), with a PATH fallback in dev.

## Status: Superceded

Replaced by [0002](0002-video-thumbnail-from-embedded-jpeg.md). ffmpeg remains
the fallback for video metadata probing and for videos without an embedded
preview, but it is no longer the primary thumbnail path.
