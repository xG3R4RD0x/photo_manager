import { create } from 'zustand';

export interface ThumbnailQueueConfig {
  debounceMs: number;           // Default 300ms
  bufferPixels: number;         // Lookahead buffer as multiple of viewport (default 2x)
  rawConversionTimeout: number; // Max RAW->JPEG conversion time (default 10000ms)
  enableThumbnailCache: boolean; // Enable disk cache (default true)
  batchObserveInterval: number; // Observe every Nth item (default 5)
  retryDelayMs: number;         // Retry delay for failed thumbnails (default 10000ms)
}

export const DEFAULT_CONFIG: ThumbnailQueueConfig = {
  debounceMs: 300,
  bufferPixels: 2,
  rawConversionTimeout: 10000,
  enableThumbnailCache: true,
  batchObserveInterval: 5,
  retryDelayMs: 10000,
};

export interface ThumbnailInProgress {
  startedAt: number;
  abortController: AbortController;
  tier: 'high' | 'secondary' | 'low';
}

export interface ThumbnailQueueState {
  // Visibility detection
  visiblePhotoPaths: Set<string>;
  viewportHeight: number;

  // Priority queues (file paths)
  highPriority: string[];      // JPEG/PNG in viewport
  secondaryPriority: string[]; // RAW with embedded JPEG in viewport + buffer
  lowPriority: string[];       // RAW conversion + retries

  // Tracking in-progress work
  inProgress: Map<string, ThumbnailInProgress>;

  // Generated thumbnails cache (path -> base64 data URL)
  thumbnails: Map<string, string>;

  // Failed thumbnails to retry
  failedRetries: Map<string, { failCount: number; nextRetryAt: number }>;

  // Configuration
  config: ThumbnailQueueConfig;

  // State
  isInitialized: boolean;
}

export interface ThumbnailQueueActions {
  // Initialization
  initializeStore: (config?: Partial<ThumbnailQueueConfig>) => void;
  loadCacheFromDisk: (cachePath: string) => Promise<void>;

  // Visibility updates (called by IntersectionObserver)
  setVisiblePhotoPaths: (paths: Set<string>) => void;
  setViewportHeight: (height: number) => void;

  // Queue management
  addToHighPriority: (paths: string[]) => void;
  addToSecondaryPriority: (paths: string[]) => void;
  addToLowPriority: (paths: string[]) => void;
  resortQueue: (visiblePaths: Set<string>, bufferPixels: number) => void;

  // Cancellation
  cancelOutOfViewport: (visiblePaths: Set<string>) => void;

  // Work tracking
  markInProgress: (path: string, tier: 'high' | 'secondary' | 'low') => AbortController;
  markCompleted: (path: string) => void;
  markFailed: (path: string) => void;

  // Results
  storeThumbnail: (path: string, base64: string) => void;
  getThumbnail: (path: string) => string | undefined;

  // Cache management
  clearCache: () => void;
  saveCache: (cachePath: string) => Promise<void>;
  mergeCache: (newThumbnails: Map<string, string>) => void;

  // Configuration
  updateConfig: (partial: Partial<ThumbnailQueueConfig>) => void;

  // Retry mechanism
  canRetry: (path: string) => boolean;
  scheduleRetry: (path: string) => void;
}

export type ThumbnailQueueStore = ThumbnailQueueState & ThumbnailQueueActions;

export const useThumbnailQueueStore = create<ThumbnailQueueStore>((set, get) => ({
  // Initial state
  visiblePhotoPaths: new Set(),
  viewportHeight: 0,
  highPriority: [],
  secondaryPriority: [],
  lowPriority: [],
  inProgress: new Map(),
  thumbnails: new Map(),
  failedRetries: new Map(),
  config: DEFAULT_CONFIG,
  isInitialized: false,

  // Initialization
  initializeStore: (config?) => {
    set((state) => ({
      ...state,
      config: { ...DEFAULT_CONFIG, ...config },
      isInitialized: true,
    }));
  },

  loadCacheFromDisk: async (cachePath) => {
    try {
      // TODO: Implement cache loading from destination/.photo_manager_cache/
      console.log('[ThumbnailQueue] Loading cache from:', cachePath);
    } catch (error) {
      console.error('[ThumbnailQueue] Failed to load cache:', error);
    }
  },

  // Visibility updates
  setVisiblePhotoPaths: (paths) => {
    const prev = get().visiblePhotoPaths;
    if (prev.size === paths.size && [...prev].every((p) => paths.has(p))) return;
    set({ visiblePhotoPaths: paths });
  },

  setViewportHeight: (height) => {
    const prev = get().viewportHeight;
    if (prev === height) return;
    set({ viewportHeight: height });
  },

  // Queue management
  addToHighPriority: (paths) => {
    set((state) => {
      const newPaths = paths.filter((p) => !state.highPriority.includes(p));
      return {
        highPriority: [...state.highPriority, ...newPaths],
      };
    });
  },

  addToSecondaryPriority: (paths) => {
    set((state) => {
      const newPaths = paths.filter((p) => !state.secondaryPriority.includes(p));
      return {
        secondaryPriority: [...state.secondaryPriority, ...newPaths],
      };
    });
  },

  addToLowPriority: (paths) => {
    set((state) => {
      const newPaths = paths.filter((p) => !state.lowPriority.includes(p));
      return {
        lowPriority: [...state.lowPriority, ...newPaths],
      };
    });
  },

  resortQueue: (visiblePaths, bufferPixels) => {
    // TODO: Implement intelligent re-sorting based on viewport and buffer
    // This should reorganize all three queues based on current visibility
    // For now, just return the state unchanged
    console.log('[ThumbnailQueue] Resort queue - visible:', visiblePaths.size, 'buffer:', bufferPixels);
    return;
  },

  // Cancellation
  cancelOutOfViewport: (visiblePaths) => {
    set((state) => {
      const newInProgress = new Map(state.inProgress);
      
      for (const [path, task] of newInProgress.entries()) {
        if (!visiblePaths.has(path)) {
          task.abortController.abort();
          newInProgress.delete(path);
        }
      }

      return { inProgress: newInProgress };
    });
  },

  // Work tracking
  markInProgress: (path, tier) => {
    const abortController = new AbortController();
    set((state) => {
      const newInProgress = new Map(state.inProgress);
      newInProgress.set(path, {
        startedAt: Date.now(),
        abortController,
        tier,
      });
      return { inProgress: newInProgress };
    });
    return abortController;
  },

  markCompleted: (path) => {
    set((state) => {
      const newInProgress = new Map(state.inProgress);
      newInProgress.delete(path);
      
      // Remove from all queues
      return {
        inProgress: newInProgress,
        highPriority: state.highPriority.filter((p) => p !== path),
        secondaryPriority: state.secondaryPriority.filter((p) => p !== path),
        lowPriority: state.lowPriority.filter((p) => p !== path),
      };
    });
  },

  markFailed: (path) => {
    set((state) => {
      const newInProgress = new Map(state.inProgress);
      newInProgress.delete(path);
      
      const failCount = (state.failedRetries.get(path)?.failCount ?? 0) + 1;
      const newFailedRetries = new Map(state.failedRetries);
      newFailedRetries.set(path, {
        failCount,
        nextRetryAt: Date.now() + state.config.retryDelayMs,
      });

      return {
        inProgress: newInProgress,
        failedRetries: newFailedRetries,
      };
    });
  },

  // Results
  storeThumbnail: (path, base64) => {
    set((state) => {
      const newThumbnails = new Map(state.thumbnails);
      newThumbnails.set(path, base64);
      return { thumbnails: newThumbnails };
    });
  },

  getThumbnail: (path) => {
    return get().thumbnails.get(path);
  },

  // Cache management
  clearCache: () => {
    set({
      thumbnails: new Map(),
      failedRetries: new Map(),
    });
  },

  saveCache: async (cachePath) => {
    try {
      // TODO: Implement cache saving to destination/.photo_manager_cache/
      console.log('[ThumbnailQueue] Saving cache to:', cachePath);
      // Placeholder for now
    } catch (error) {
      console.error('[ThumbnailQueue] Failed to save cache:', error);
    }
  },

  mergeCache: (newThumbnails) => {
    set((state) => {
      const merged = new Map(state.thumbnails);
      for (const [path, base64] of newThumbnails.entries()) {
        merged.set(path, base64);
      }
      return { thumbnails: merged };
    });
  },

  // Configuration
  updateConfig: (partial) => {
    set((state) => ({
      config: { ...state.config, ...partial },
    }));
  },

  // Retry mechanism
  canRetry: (path) => {
    const failedRetry = get().failedRetries.get(path);
    if (!failedRetry) return false;
    return Date.now() >= failedRetry.nextRetryAt && failedRetry.failCount < 3;
  },

  scheduleRetry: (path) => {
    const state = get();
    if (state.canRetry(path)) {
      state.addToLowPriority([path]);
    }
  },
}));
