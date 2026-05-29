import { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useThumbnailQueueStore } from '../stores/useThumbnailQueueStore';
import { usePhotoStore } from '../stores/usePhotoStore';

export function useThumbnailGenerator() {
  const isInitialized = useThumbnailQueueStore((s) => s.isInitialized);
  const initializeStore = useThumbnailQueueStore((s) => s.initializeStore);
  const photos = usePhotoStore((s) => s.photos);
  const hasSomeDates = photos.length > 0 && photos.some((p) => p.date !== null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const isGeneratingRef = useRef(false);
  const unlistenersRef = useRef<(() => void)[]>([]);
  const debounceTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const initialLoadRef = useRef(false);
  const prevHasDatesRef = useRef(false);

  useEffect(() => {
    if (photos.length > 0 && hasSomeDates && !prevHasDatesRef.current) {
      useThumbnailQueueStore.getState().fullReset();
      initialLoadRef.current = false;
    }
    prevHasDatesRef.current = hasSomeDates;
  }, [hasSomeDates, photos.length]);

  const prevPhotoCountRef = useRef(0);
  useEffect(() => {
    if (photos.length > 0 && prevPhotoCountRef.current !== photos.length && prevPhotoCountRef.current > 0) {
      const store = useThumbnailQueueStore.getState();
      store.fullReset();
      initialLoadRef.current = false;
    }
    prevPhotoCountRef.current = photos.length;
  }, [photos.length]);

  useEffect(() => {
    if (!isInitialized) {
      initializeStore();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const newVisiblePaths = new Set<string>();
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const photoPath = entry.target.getAttribute('data-photo-path');
            if (photoPath) newVisiblePaths.add(photoPath);
          }
        }

        const store = useThumbnailQueueStore.getState();
        const allVisible = new Set([...store.visiblePhotoPaths, ...newVisiblePaths]);

        for (const path of store.visiblePhotoPaths) {
          const element = document.querySelector(`[data-photo-path="${path}"]`);
          if (element && !entries.some((e) => e.target === element && e.isIntersecting)) {
            allVisible.delete(path);
          }
        }

        if (allVisible.size !== store.visiblePhotoPaths.size) {
          store.setVisiblePhotoPaths(allVisible);
        }
      },
      {
        root: document.querySelector('.grid-content'),
        rootMargin: '400px',
        threshold: [0.01],
      }
    );

    return () => observerRef.current?.disconnect();
  }, [isInitialized, initializeStore]);

  useEffect(() => {
    if (!observerRef.current) return;

    const observeVisibleItems = () => {
      const photoItems = document.querySelectorAll('[data-photo-path]');
      photoItems.forEach(item => observerRef.current?.observe(item));
    };

    observeVisibleItems();

    const gridContent = document.querySelector('.grid-content');
    if (gridContent) {
      mutationObserverRef.current = new MutationObserver(() => {
        observeVisibleItems();
      });
      mutationObserverRef.current.observe(gridContent, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      mutationObserverRef.current?.disconnect();
    };
  }, [isInitialized]);

  useEffect(() => {
    const container = document.querySelector('.grid-content');
    if (!container) return;

    const updateViewportHeight = () => {
      const store = useThumbnailQueueStore.getState();
      if (store.viewportHeight !== container.clientHeight) {
        store.setViewportHeight(container.clientHeight);
      }
    };

    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    container.addEventListener('scroll', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      container.removeEventListener('scroll', updateViewportHeight);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const setupListeners = async () => {
      try {
        const unlistenReady = await listen<{ path: string; preview_path: string; width: number }>(
          'thumbnail_ready',
          (event) => {
            if (!active) return;
            const store = useThumbnailQueueStore.getState();
            store.storeThumbnail(event.payload.path, event.payload.width, event.payload.preview_path);
            store.markCompleted(event.payload.path, event.payload.width);
            if (event.payload.width === store.config.tinySize) {
              store.addToSecondaryPriority([
                { path: event.payload.path, size: store.config.fullSize, kind: 'full' },
              ]);
            }
            setTimeout(() => generateNextThumbnail(), 0);
          }
        );

        const unlistenFailed = await listen<{ path: string; reason: string; width: number }>(
          'thumbnail_failed',
          (event) => {
            if (!active) return;
            const store = useThumbnailQueueStore.getState();
            store.markFailed({
              path: event.payload.path,
              size: event.payload.width,
              kind: event.payload.width === store.config.tinySize ? 'tiny' : 'full',
            });
            setTimeout(() => generateNextThumbnail(), 0);
          }
        );

        unlistenersRef.current = [unlistenReady, unlistenFailed];
      } catch (error) {
        console.error('[ThumbnailGenerator] Failed to setup event listeners:', error);
      }
    };

    setupListeners();
    return () => {
      active = false;
      unlistenersRef.current.forEach((u) => u());
    };
  }, []);

  const hasFreeSlots = () => {
    const store = useThumbnailQueueStore.getState();
    return store.inProgress.size < store.config.maxConcurrent;
  };

  const generateNextThumbnail = useCallback((): void => {
    if (isGeneratingRef.current) return;
    const store = useThumbnailQueueStore.getState();

    if (!hasFreeSlots()) return;

    const nextRequest =
      store.highPriority[0] ||
      store.secondaryPriority[0] ||
      store.lowPriority[0];

    if (!nextRequest) {
      isGeneratingRef.current = false;
      return;
    }

    const inProgressKey = `${nextRequest.path}::${nextRequest.size}`;

    if (store.getThumbnail(nextRequest.path, nextRequest.size) || store.inProgress.has(inProgressKey)) {
      store.markCompleted(nextRequest.path, nextRequest.size);
      setTimeout(() => generateNextThumbnail(), 0);
      return;
    }

    isGeneratingRef.current = true;
    store.markInProgress(nextRequest, nextRequest.kind === 'tiny' ? 'high' : 'secondary');
    invoke('generate_thumbnail', { path: nextRequest.path, width: nextRequest.size });
    isGeneratingRef.current = false;
    setTimeout(() => generateNextThumbnail(), 0);
  }, []);

  useEffect(() => {
    const scrollContainer = document.querySelector('.grid-content');
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout(() => {
        const store = useThumbnailQueueStore.getState();

        store.clearQueues();

        store.resortQueue(store.visiblePhotoPaths, store.config.bufferPixels);
        store.cancelOutOfViewport(store.visiblePhotoPaths);

        const visibleArray = Array.from(store.visiblePhotoPaths);
        if (visibleArray.length > 0) {
          const batch = visibleArray.slice(0, store.config.initialBatch);
          store.addToHighPriority(
            batch.map((path) => ({ path, size: store.config.tinySize, kind: 'tiny' }))
          );
        }

        generateNextThumbnail();
      }, useThumbnailQueueStore.getState().config.debounceMs);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
    };
  }, [generateNextThumbnail]);

  useEffect(() => {
    const checkRetries = () => {
      const store = useThumbnailQueueStore.getState();
      const failed = Array.from(store.failedRetries.values());
      for (const entry of failed) {
        if (store.canRetry(entry.request) && store.visiblePhotoPaths.has(entry.request.path)) {
          store.scheduleRetry(entry.request);
        }
      }
      retryTimerRef.current = window.setTimeout(checkRetries, 5000);
    };

    retryTimerRef.current = window.setTimeout(checkRetries, 5000);
    return () => {
      if (retryTimerRef.current !== null) clearTimeout(retryTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (hasSomeDates && !initialLoadRef.current) {
      initialLoadRef.current = true;
      requestAnimationFrame(() => {
        const store = useThumbnailQueueStore.getState();
        store.clearQueues();

        const items = document.querySelectorAll('[data-photo-path]');
        const paths = Array.from(items)
          .map(el => el.getAttribute('data-photo-path'))
          .filter((p): p is string => p !== null);

        if (paths.length > 0) {
          const batch = paths.slice(0, store.config.initialBatch);
          store.addToHighPriority(
            batch.map((path) => ({ path, size: store.config.tinySize, kind: 'tiny' }))
          );
          generateNextThumbnail();
        }
      });
    }
  }, [hasSomeDates, generateNextThumbnail]);

  useEffect(() => {
    if (photos.length > 0 && !hasSomeDates && !initialLoadRef.current) {
      fallbackTimerRef.current = window.setTimeout(() => {
        if (!initialLoadRef.current) {
          initialLoadRef.current = true;
          requestAnimationFrame(() => {
            const store = useThumbnailQueueStore.getState();
            store.clearQueues();

            const items = document.querySelectorAll('[data-photo-path]');
            const paths = Array.from(items)
              .map(el => el.getAttribute('data-photo-path'))
              .filter((p): p is string => p !== null);

            if (paths.length > 0) {
              const batch = paths.slice(0, store.config.initialBatch);
              store.addToHighPriority(
                batch.map((path) => ({ path, size: store.config.tinySize, kind: 'tiny' }))
              );
              generateNextThumbnail();
            }
          });
        }
      }, 5000);
    }
    return () => {
      if (fallbackTimerRef.current !== null) clearTimeout(fallbackTimerRef.current);
    };
  }, [photos.length, hasSomeDates, generateNextThumbnail]);

  return { startGeneration: generateNextThumbnail };
}
