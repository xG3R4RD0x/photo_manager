# Bundled ffmpeg / ffprobe

This directory ships the static ffmpeg and ffprobe binaries used for video
thumbnail extraction and metadata probing.

## Required files

- `ffmpeg.exe` (Windows) / `ffmpeg` (macOS/Linux)
- `ffprobe.exe` (Windows) / `ffprobe` (macOS/Linux)

Download a static build (e.g. from
https://www.gyan.dev/ffmpeg/builds/ or https://johnvansickle.com/ffmpeg/)
and place the binaries here before packaging. The names must match exactly.

The runtime locates the binaries (in order): `<exe_dir>/binaries/<name>`.
In development, the app also falls back to any `ffmpeg`/`ffprobe` already
available on `PATH`, so the feature works without these files being present.

## Packaging

When building an installer, add these entries under `bundle.externalBin` in
`tauri.conf.json`:

```json
"externalBin": ["binaries/ffmpeg.exe", "binaries/ffprobe.exe"]
```

Tauri copies them next to the application executable as `binaries/` on the
target machine, where the runtime lookup expects them.
