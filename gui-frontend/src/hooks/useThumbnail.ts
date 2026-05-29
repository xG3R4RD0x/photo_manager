import { convertFileSrc } from '@tauri-apps/api/core';
import { useThumbnailQueueStore } from '../stores/useThumbnailQueueStore';

export interface UseThumbnailResult {
  thumbnail: string | undefined;
  isLoading: boolean;
  isFailed: boolean;
  failCount: number;
  hasTiny: boolean;
  hasFull: boolean;
}

export function useThumbnail(photoPath: string): UseThumbnailResult {
  const tinySize = useThumbnailQueueStore((s) => s.config.tinySize);
  const fullSize = useThumbnailQueueStore((s) => s.config.fullSize);
  const thumbnail = useThumbnailQueueStore((s) => {
    const full = s.getThumbnail(photoPath, fullSize);
    if (full) return convertFileSrc(full);
    const tiny = s.getThumbnail(photoPath, tinySize);
    return tiny ? convertFileSrc(tiny) : undefined;
  });
  const isLoading = useThumbnailQueueStore((s) => {
    const fullKey = `${photoPath}::${fullSize}`;
    const tinyKey = `${photoPath}::${tinySize}`;
    return s.inProgress.has(fullKey) || s.inProgress.has(tinyKey);
  });
  const failedRetry = useThumbnailQueueStore((s) => {
    const fullKey = `${photoPath}::${fullSize}`;
    const tinyKey = `${photoPath}::${tinySize}`;
    return s.failedRetries.get(fullKey) || s.failedRetries.get(tinyKey);
  });
  const hasTiny = useThumbnailQueueStore((s) => !!s.getThumbnail(photoPath, tinySize));
  const hasFull = useThumbnailQueueStore((s) => !!s.getThumbnail(photoPath, fullSize));

  return {
    thumbnail,
    isLoading,
    isFailed: !!failedRetry,
    failCount: failedRetry?.failCount ?? 0,
    hasTiny,
    hasFull,
  };
}
