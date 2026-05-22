import { useThumbnailQueueStore } from '../stores/useThumbnailQueueStore';

export interface UseThumbnailResult {
  thumbnail: string | undefined;
  isLoading: boolean;
  isFailed: boolean;
  failCount: number;
}

export function useThumbnail(photoPath: string): UseThumbnailResult {
  const thumbnail = useThumbnailQueueStore((s) => s.thumbnails.get(photoPath));
  const isLoading = useThumbnailQueueStore((s) => s.inProgress.has(photoPath));
  const failedRetry = useThumbnailQueueStore((s) => s.failedRetries.get(photoPath));

  return {
    thumbnail,
    isLoading,
    isFailed: !!failedRetry,
    failCount: failedRetry?.failCount ?? 0,
  };
}
