import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePhotoStore } from "../stores/usePhotoStore";

interface EXIFData {
  camera?: string;
  lens?: string;
  aperture?: string;
  shutter?: string;
  iso?: string;
  focal_length?: string;
  date?: string;
  file_type: string;
  file_size: number;
  gps?: [number, number];
}

interface VideoData {
  file_type: string;
  file_size: number;
  date?: string;
  duration?: number;
  width?: number;
  height?: number;
  codec?: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function MetadataSection() {
  const inspectedPath = usePhotoStore((s) => s.inspectedPath);
  const inspectedPhoto = usePhotoStore((s) =>
    s.inspectedPath ? s.photos.find((p) => p.path === s.inspectedPath) : undefined
  );
  const [exif, setExif] = useState<EXIFData | null>(null);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(false);

  const isVideo = inspectedPhoto?.media_type === "video";

  useEffect(() => {
    if (inspectedPath) {
      setLoading(true);
      if (isVideo) {
        invoke<VideoData>("get_video_metadata", { path: inspectedPath })
          .then(setVideoData)
          .catch((err) => console.error("Video metadata fetch failed:", err))
          .finally(() => setLoading(false));
      } else {
        invoke<EXIFData>("get_exif", { path: inspectedPath })
          .then(setExif)
          .catch((err) => console.error("EXIF fetch failed:", err))
          .finally(() => setLoading(false));
      }
    } else {
      setExif(null);
      setVideoData(null);
    }
  }, [inspectedPath, isVideo]);

  if (!inspectedPath) {
    return (
      <div className="metadata-section">
        <h3>📷 Metadata</h3>
        <p style={{ color: "#666", fontSize: "12px" }}>
          Select a photo to view EXIF data
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="metadata-section">
        <h3>📷 Metadata</h3>
        <p style={{ color: "#888", fontSize: "12px" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="metadata-section">
      <h3>{isVideo ? "🎬 Metadata" : "📷 Metadata"}</h3>
      {isVideo && videoData && (
        <div className="metadata-content">
          {videoData.date && <p>📅 {videoData.date}</p>}
          {videoData.duration !== undefined && videoData.duration !== null && (
            <p>⏱️ {formatDuration(videoData.duration)}</p>
          )}
          {videoData.width && videoData.height && (
            <p>📐 {videoData.width}x{videoData.height}</p>
          )}
          {videoData.codec && <p>💾 {videoData.codec}</p>}
          <p>📁 {videoData.file_type} ({(videoData.file_size / 1024 / 1024).toFixed(1)}MB)</p>
        </div>
      )}
      {!isVideo && exif && (
        <div className="metadata-content">
          {exif.camera && <p>📷 {exif.camera}</p>}
          {exif.lens && <p>🔍 {exif.lens}</p>}
          {exif.aperture && <p>⚙️ f/{exif.aperture}</p>}
          {exif.shutter && <p>⏱️ {exif.shutter}</p>}
          {exif.iso && <p>📊 ISO {exif.iso}</p>}
          {exif.focal_length && <p>📐 {exif.focal_length}mm</p>}
          {exif.date && <p>📅 {exif.date}</p>}
          <p>📁 {exif.file_type} ({(exif.file_size / 1024 / 1024).toFixed(1)}MB)</p>
          {exif.gps && (
            <p>📍 {exif.gps[0].toFixed(4)}, {exif.gps[1].toFixed(4)}</p>
          )}
        </div>
      )}
    </div>
  );
}
