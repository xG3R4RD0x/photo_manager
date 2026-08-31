use std::path::{Path, PathBuf};
use std::process::Command;
use chrono::NaiveDateTime;
use serde::{Serialize, Deserialize};

pub const VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "mov", "avi", "mkv", "webm", "3gp", "3g2", "mts", "m2ts", "m2t",
    "ts", "m4v", "wmv", "flv", "mpg", "mpeg", "vob", "mxf", "rm", "rmvb",
    "ogv", "divx", "asf", "m2v", "mp2", "f4v", "hevc", "h264", "h265", "264", "265",
];

pub fn is_video(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .filter(|s| VIDEO_EXTENSIONS.contains(&s.as_str()))
        .is_some()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoMetadata {
    pub date: Option<String>,
    pub duration: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub codec: Option<String>,
}

fn executable_dir() -> Option<PathBuf> {
    std::env::current_exe().ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
}

/// Locate the bundled ffmpeg/ffprobe binaries.
/// Candidates, checked in order:
///   1. `<exe_dir>/binaries/ffmpeg.exe` (packaged alongside the app)
///   2. `<exe_dir>/ffmpeg.exe`
///   3. `ffmpeg.exe` on PATH
///   4. `ffmpeg` on PATH (unix)
fn locate_binary(name: &str) -> Option<PathBuf> {
    let exe_name = if cfg!(windows) {
        format!("{}.exe", name)
    } else {
        name.to_string()
    };

    if let Some(dir) = executable_dir() {
        for candidate in [
            dir.join("binaries").join(&exe_name),
            dir.join(&exe_name),
        ] {
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    // Fallback: search PATH
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let candidate = dir.join(&exe_name);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    None
}

fn locate_ffmpeg() -> Option<PathBuf> {
    locate_binary("ffmpeg")
}

fn locate_ffprobe() -> Option<PathBuf> {
    locate_binary("ffprobe")
}

/// Configure a Command so spawned processes don't flash console windows
/// on Windows (ffmpeg/ffprobe are console apps).
fn silent_cmd(program: &Path) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: run without showing a console window (Tauri apps
        // don't have one, so child console processes would pop up windows).
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Extract a JPEG thumbnail frame at the given timestamp using ffmpeg.
pub fn extract_video_thumbnail(
    source: &Path,
    dest_jpeg: &Path,
    timestamp_sec: f64,
    target_width: u32,
) -> Result<(), String> {
    let ffmpeg = locate_ffmpeg()
        .ok_or_else(|| "ffmpeg binary not found; install ffmpeg or bundle it with the app".to_string())?;

    if let Some(parent) = dest_jpeg.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let status = silent_cmd(&ffmpeg)
        .args(&[
            "-y",
            "-ss",
            &format!("{}", timestamp_sec),
            "-i",
            &source.to_string_lossy().to_string(),
            "-frames:v",
            "1",
            "-vf",
            &format!("scale='min({},iw)':-2", target_width),
            "-q:v",
            "3",
            &dest_jpeg.to_string_lossy().to_string(),
        ])
        .status()
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if status.success() && dest_jpeg.exists() {
        Ok(())
    } else {
        Err(format!("ffmpeg failed to extract thumbnail (exit: {:?})", status.code()))
    }
}

/// Extract video metadata using ffprobe.
/// Returns None (as Err) if ffprobe can't read the file or no creation date/duration found.
pub fn extract_video_metadata(path: &Path) -> Result<VideoMetadata, String> {
    let ffprobe = locate_ffprobe()
        .ok_or_else(|| "ffprobe binary not found; install ffmpeg or bundle it with the app".to_string())?;

    let output = silent_cmd(&ffprobe)
        .args(&[
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            &path.to_string_lossy().to_string(),
        ])
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;

    if !output.status.success() {
        return Err(format!("ffprobe failed (exit: {:?})", output.status.code()));
    }

    parse_ffprobe_json(&output.stdout)
}

fn parse_ffprobe_json(data: &[u8]) -> Result<VideoMetadata, String> {
    #[derive(Deserialize)]
    struct ProbeOutput {
        format: Option<ProbeFormat>,
        streams: Option<Vec<ProbeStream>>,
    }

    #[derive(Deserialize)]
    struct ProbeFormat {
        #[serde(rename = "duration")]
        duration: Option<String>,
        #[serde(rename = "tags")]
        tags: Option<ProbeTags>,
    }

    #[derive(Deserialize)]
    struct ProbeTags {
        #[serde(rename = "creation_time")]
        creation_time: Option<String>,
    }

    #[derive(Deserialize)]
    struct ProbeStream {
        #[serde(rename = "width")]
        width: Option<u32>,
        #[serde(rename = "height")]
        height: Option<u32>,
        #[serde(rename = "codec_name")]
        codec_name: Option<String>,
        #[serde(rename = "codec_type")]
        codec_type: Option<String>,
    }

    let parsed: ProbeOutput = serde_json::from_slice(data)
        .map_err(|e| format!("Failed to parse ffprobe output: {}", e))?;

    let duration = parsed.format
        .as_ref()
        .and_then(|f| f.duration.as_ref())
        .and_then(|d| d.parse::<f64>().ok());

    let date = parsed.format
        .as_ref()
        .and_then(|f| f.tags.as_ref())
        .and_then(|t| t.creation_time.as_ref())
        .and_then(|s| parse_creation_time(s));

    // Pick the first video stream for resolution/codec
    let (width, height, codec) = parsed.streams
        .as_ref()
        .and_then(|streams| {
            streams.iter().find(|s| s.codec_type.as_deref() == Some("video"))
        })
        .map(|s| (s.width, s.height, s.codec_name.clone()))
        .unwrap_or((None, None, None));

    Ok(VideoMetadata {
        date: date.map(|d| d.format("%Y-%m-%d %H:%M:%S").to_string()),
        duration,
        width,
        height,
        codec,
    })
}

fn parse_creation_time(raw: &str) -> Option<NaiveDateTime> {
    // ffprobe emits ISO-8601 like "2026-05-27T14:30:00.000000Z"
    let trimmed = raw.trim().trim_end_matches('Z');
    let cleaned = trimmed.split('.').next().unwrap_or(trimmed);
    NaiveDateTime::parse_from_str(cleaned, "%Y-%m-%dT%H:%M:%S").ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_video_extensions() {
        for ext in ["mp4", "MOV", "Mts", ".m2ts"] {
            let p = PathBuf::from(format!("file.{}", ext.trim_start_matches('.')));
            assert!(is_video(&p), "expected {} to be a video", ext);
        }
        assert!(!is_video(&PathBuf::from("photo.jpg")));
        assert!(!is_video(&PathBuf::from("photo.png")));
    }

    #[test]
    fn test_parse_creation_time() {
        let dt = parse_creation_time("2026-05-27T14:30:00.000000Z");
        assert!(dt.is_some());
        assert_eq!(dt.unwrap().format("%Y-%m-%d %H:%M:%S").to_string(), "2026-05-27 14:30:00");
    }
}
