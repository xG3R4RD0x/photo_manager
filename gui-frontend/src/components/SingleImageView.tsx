import { useEffect, useCallback, useRef, useState } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { PhotoInfo } from "../stores/usePhotoStore";

const RAW_EXTS = new Set([".cr2", ".nef", ".arw", ".raf", ".dng", ".orf", ".rw2", ".pef", ".srw", ".cr3", ".crw"]);

function isRaw(path: string): boolean {
  const dot = path.lastIndexOf(".");
  return dot !== -1 && RAW_EXTS.has(path.slice(dot).toLowerCase());
}

interface SingleImageViewProps {
  photo: PhotoInfo;
  photos: PhotoInfo[];
  onNavigate: (photo: PhotoInfo) => void;
}

export default function SingleImageView({ photo, photos, onNavigate }: SingleImageViewProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const requestIdRef = useRef(0);
  const bestLevelRef = useRef<"none" | "low" | "medium" | "full">("none");
  const currentIndex = photos.findIndex((p) => p.path === photo.path);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(photos[currentIndex - 1]);
  }, [hasPrev, photos, currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(photos[currentIndex + 1]);
  }, [hasNext, photos, currentIndex, onNavigate]);

  useEffect(() => {
    let cancelled = false;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setImgSrc(null);
    setImgError(false);
    setIsLoading(true);
    bestLevelRef.current = "none";

    const path = photo.path;

    let lowTimer: number | null = null;

    if (isRaw(path)) {
      const setPreview = (level: "low" | "medium" | "full", previewPath: string) => {
        if (cancelled || requestIdRef.current !== requestId) return;
        const rank = { none: 0, low: 1, medium: 2, full: 3 } as const;
        if (rank[level] <= rank[bestLevelRef.current]) return;
        bestLevelRef.current = level;
        if (lowTimer !== null) window.clearTimeout(lowTimer);
        setImgSrc(convertFileSrc(previewPath));
        setIsLoading(false);
      };

      invoke<string>("get_display_image_medium", { path })
        .then((previewPath) => setPreview("medium", previewPath))
        .catch(() => {});

      invoke<string>("get_display_image", { path, allowScan: true })
        .then((previewPath) => setPreview("full", previewPath))
        .catch(() => {
          if (!cancelled && requestIdRef.current === requestId && bestLevelRef.current === "none") {
            setImgError(true);
            setIsLoading(false);
          }
        });

      lowTimer = window.setTimeout(() => {
        if (cancelled) return;
        invoke<string>("get_display_image_low", { path })
          .then((previewPath) => {
            setPreview("low", previewPath);
          })
          .catch(() => {});
      }, 220);
    } else {
      // JPEG/PNG: load directly via asset protocol — instant, no Rust involvement
      setImgSrc(convertFileSrc(path));
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
      if (lowTimer !== null) window.clearTimeout(lowTimer);
    };
  }, [photo.path]);

  // Preload adjacent RAW photos into disk cache (JPEG/PNG are instant, no preload needed)
  useEffect(() => {
    for (let offset = 1; offset <= 2; offset++) {
      if (currentIndex - offset >= 0 && isRaw(photos[currentIndex - offset].path)) {
        invoke<string>("get_display_image_low", { path: photos[currentIndex - offset].path }).catch(() => {});
        invoke<string>("get_display_image_medium", { path: photos[currentIndex - offset].path }).catch(() => {});
      }
      if (currentIndex + offset < photos.length && isRaw(photos[currentIndex + offset].path)) {
        invoke<string>("get_display_image_low", { path: photos[currentIndex + offset].path }).catch(() => {});
        invoke<string>("get_display_image_medium", { path: photos[currentIndex + offset].path }).catch(() => {});
      }
    }
  }, [photo.path, currentIndex, photos]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goPrev, goNext]);

  return (
    <div className="single-view">
      {hasPrev && (
        <button className="nav-arrow nav-arrow--prev" onClick={goPrev} title="Previous">
          ‹
        </button>
      )}
      <div className="single-view-image-wrapper">
        {isLoading && !imgSrc ? (
          <div className="single-view-placeholder">
            <div className="spinner"></div>
            <span className="single-view-placeholder-text">Loading...</span>
          </div>
        ) : imgError ? (
          <div className="single-view-placeholder">
            <span className="single-view-placeholder-icon">✕</span>
            <span className="single-view-placeholder-text">Failed to load image</span>
          </div>
        ) : imgSrc ? (
          <img
            src={imgSrc}
            alt={photo.filename}
            className="single-view-image"
            onError={() => setImgError(true)}
          />
        ) : null}
      </div>
      {hasNext && (
        <button className="nav-arrow nav-arrow--next" onClick={goNext} title="Next">
          ›
        </button>
      )}
      <div className="single-view-filename">{photo.filename}</div>
    </div>
  );
}
