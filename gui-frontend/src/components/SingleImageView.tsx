import { useEffect, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PhotoInfo } from "../stores/usePhotoStore";

interface SingleImageViewProps {
  photo: PhotoInfo;
  photos: PhotoInfo[];
  onNavigate: (photo: PhotoInfo) => void;
}

export default function SingleImageView({ photo, photos, onNavigate }: SingleImageViewProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
    setImgSrc(null);
    setImgError(false);
    setIsLoading(true);
    invoke<string>("get_display_image", { path: photo.path })
      .then((dataUrl) => {
        if (!cancelled) {
          setImgSrc(dataUrl);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImgError(true);
          setIsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [photo.path]);

  // Preload adjacent images
  useEffect(() => {
    const preloadPaths: string[] = [];
    if (hasPrev) preloadPaths.push(photos[currentIndex - 1].path);
    if (hasNext) preloadPaths.push(photos[currentIndex + 1].path);
    for (const p of preloadPaths) {
      invoke<string>("get_display_image", { path: p }).catch(() => {});
    }
  }, [photo.path, hasPrev, hasNext, photos, currentIndex]);

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
        {isLoading ? (
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
