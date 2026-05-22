import { useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useThumbnailQueueStore } from '../stores/useThumbnailQueueStore';

export function useThumbnailGenerator() {
  const isInitialized = useThumbnailQueueStore((s) => s.isInitialized);
  const initializeStore = useThumbnailQueueStore((s) => s.initializeStore);
  const batchObserveInterval = useThumbnailQueueStore((s) => s.config.batchObserveInterval);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const isGeneratingRef = useRef(false);
  const unlistenersRef = useRef<(() => void)[]>([]);
  const debounceTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);

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

  // Observe photo items and watch for new ones via MutationObserver
  useEffect(() => {
    if (!observerRef.current) return;

    const observeVisibleItems = () => {
      const photoItems = document.querySelectorAll('[data-photo-path]');
      for (let i = 0; i < photoItems.length; i++) {
        if (i % batchObserveInterval === 0) {
          observerRef.current?.observe(photoItems[i]);
        }
      }
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
  }, [batchObserveInterval]);

  useEffect(() => {
    let active = true;
    const setupListeners = async () => {
      try {
        const unlistenReady = await listen<{ path: string; base64: string }>(
          'thumbnail_ready',
          (event) => {
            if (!active) return;
            const store = useThumbnailQueueStore.getState();
            store.storeThumbnail(event.payload.path, event.payload.base64);
            store.markCompleted(event.payload.path);
          }
        );

        const unlistenFailed = await listen<{ path: string; reason: string }>(
          'thumbnail_failed',
          (event) => {
            if (!active) return;
            const store = useThumbnailQueueStore.getState();
            store.markFailed(event.payload.path);
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

  const isRawFile = (path: string) => /\.(cr2|nef|arw|raf)$/i.test(path);

  const generateNextThumbnail = useCallback(async (): Promise<void> => {
    if (isGeneratingRef.current) return;
    const store = useThumbnailQueueStore.getState();

    // Prefer non-RAW files to keep UI fast; fall back to RAW if no JPEGs left
    let nextPath: string | null =
      store.highPriority.find((p) => !isRawFile(p)) ||
      store.highPriority[0] ||
      store.secondaryPriority[0] ||
      store.lowPriority[0];

    if (!nextPath) {
      isGeneratingRef.current = false;
      return;
    }

    const tier: 'high' | 'secondary' = isRawFile(nextPath) ? 'secondary' : 'high';

    if (store.getThumbnail(nextPath) || store.inProgress.has(nextPath)) {
      store.markCompleted(nextPath);
      setTimeout(generateNextThumbnail, 0);
      return;
    }

    isGeneratingRef.current = true;
    const abortController = store.markInProgress(nextPath, tier);

    try {
      const timeout = tier === 'secondary' ? store.config.rawConversionTimeout : 30000;
      await Promise.race([
        invoke('generate_thumbnail', { path: nextPath }),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        ),
      ]);
    } catch (error) {
      if (abortController.signal.aborted) {
        console.log('[ThumbnailGenerator] Cancelled:', nextPath);
      } else {
        console.error('[ThumbnailGenerator] Generation failed:', error);
        store.markFailed(nextPath);
      }
    } finally {
      isGeneratingRef.current = false;
      setTimeout(generateNextThumbnail, 0);
    }
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
        store.resortQueue(store.visiblePhotoPaths, store.config.bufferPixels);
        store.cancelOutOfViewport(store.visiblePhotoPaths);

        if (!isGeneratingRef.current && store.highPriority.length === 0) {
          const visibleArray = Array.from(store.visiblePhotoPaths);
          if (visibleArray.length > 0) {
            store.addToHighPriority(visibleArray);
          }
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
      const failed = Array.from(store.failedRetries.entries());
      for (const [path] of failed) {
        if (store.canRetry(path) && store.visiblePhotoPaths.has(path)) {
          store.scheduleRetry(path);
        }
      }
      retryTimerRef.current = window.setTimeout(checkRetries, 5000);
    };

    retryTimerRef.current = window.setTimeout(checkRetries, 5000);
    return () => {
      if (retryTimerRef.current !== null) clearTimeout(retryTimerRef.current);
    };
  }, []);

  // Trigger initial generation when visible items are detected
  const visibleSize = useThumbnailQueueStore((s) => s.visiblePhotoPaths.size);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (visibleSize > 0 && !initialLoadRef.current) {
      initialLoadRef.current = true;
      const store = useThumbnailQueueStore.getState();
      if (store.highPriority.length === 0) {
        const visibleArray = Array.from(store.visiblePhotoPaths);
        if (visibleArray.length > 0) {
          store.addToHighPriority(visibleArray);
        }
      }
      generateNextThumbnail();
    }
  }, [visibleSize, generateNextThumbnail]);

  return { startGeneration: generateNextThumbnail };
}
