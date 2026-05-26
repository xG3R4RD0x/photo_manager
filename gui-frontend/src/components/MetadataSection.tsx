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

export default function MetadataSection() {
  const inspectedPath = usePhotoStore((s) => s.inspectedPath);
  const [exif, setExif] = useState<EXIFData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (inspectedPath) {
      setLoading(true);
      invoke<EXIFData>("get_exif", { path: inspectedPath })
        .then(setExif)
        .catch((err) => console.error("EXIF fetch failed:", err))
        .finally(() => setLoading(false));
    } else {
      setExif(null);
    }
  }, [inspectedPath]);

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
      <h3>📷 Metadata</h3>
      {exif && (
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
