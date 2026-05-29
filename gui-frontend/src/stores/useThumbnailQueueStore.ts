import { create } from 'zustand';

export type ThumbnailKind = 'tiny' | 'full';

export interface ThumbnailRequest {
  path: string;
  size: number;
  kind: ThumbnailKind;
}

export const getThumbnailKey = (path: string, size: number) => `${path}::${size}`;
const getRequestKey = (request: ThumbnailRequest) => getThumbnailKey(request.path, request.size);

export interface ThumbnailQueueConfig {
  debounceMs: number;           // Default 300ms
  bufferPixels: number;         // Lookahead buffer as multiple of viewport (default 2x)
  rawConversionTimeout: number; // Max RAW thumbnail generation time (default 10000ms)
  retryDelayMs: number;         // Retry delay for failed thumbnails (default 10000ms)
  tinySize: number;             // Tiny thumbnail size (default 96px)
  fullSize: number;             // Full thumbnail size (default 200px)
  maxConcurrent: number;        // Max concurrent thumbnail tasks
  initialBatch: number;         // Initial batch size for load
}

export const DEFAULT_CONFIG: ThumbnailQueueConfig = {
  debounceMs: 300,
  bufferPixels: 2,
  rawConversionTimeout: 10000,
  retryDelayMs: 10000,
  tinySize: 96,
  fullSize: 200,
  maxConcurrent: 4,
  initialBatch: 120,
};

export interface ThumbnailInProgress {
  startedAt: number;
  abortController: AbortController;
  tier: 'high' | 'secondary' | 'low';
  request: ThumbnailRequest;
}

export interface ThumbnailQueueState {
  // Visibility detection
  visiblePhotoPaths: Set<string>;
  viewportHeight: number;

  // Priority queues (file paths)
  highPriority: ThumbnailRequest[];      // Tiny thumbnails in viewport
  secondaryPriority: ThumbnailRequest[]; // Full thumbnails in viewport
  lowPriority: ThumbnailRequest[];       // Retries

  // Tracking in-progress work
  inProgress: Map<string, ThumbnailInProgress>;

  // Generated thumbnails cache (path -> base64 data URL)
  thumbnails: Map<string, string>;

  // Failed thumbnails to retry
  failedRetries: Map<string, { failCount: number; nextRetryAt: number; request: ThumbnailRequest }>;

  // Configuration
  config: ThumbnailQueueConfig;

  // State
  isInitialized: boolean;
}

export interface ThumbnailQueueActions {
  // Initialization
  initializeStore: (config?: Partial<ThumbnailQueueConfig>) => void;

  // Visibility updates (called by IntersectionObserver)
  setVisiblePhotoPaths: (paths: Set<string>) => void;
  setViewportHeight: (height: number) => void;

  // Queue management
  addToHighPriority: (requests: ThumbnailRequest[]) => void;
  addToSecondaryPriority: (requests: ThumbnailRequest[]) => void;
  addToLowPriority: (requests: ThumbnailRequest[]) => void;
  resortQueue: (visiblePaths: Set<string>, bufferPixels: number) => void;

  // Cancellation
  cancelOutOfViewport: (visiblePaths: Set<string>) => void;

  // Queue management
  clearQueues: () => void;
  fullReset: () => void;

  // Work tracking
  markInProgress: (request: ThumbnailRequest, tier: 'high' | 'secondary' | 'low') => AbortController;
  markCompleted: (path: string, size: number) => void;
  markFailed: (request: ThumbnailRequest) => void;

  // Results
  storeThumbnail: (path: string, size: number, thumbnailPath: string) => void;
  getThumbnail: (path: string, size: number) => string | undefined;

  // Configuration
  updateConfig: (partial: Partial<ThumbnailQueueConfig>) => void;

  // Retry mechanism
  canRetry: (request: ThumbnailRequest) => boolean;
  scheduleRetry: (request: ThumbnailRequest) => void;
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
  addToHighPriority: (requests) => {
    set((state) => {
      const newRequests = requests.filter((request) => {
        const key = getRequestKey(request);
        if (state.thumbnails.has(key) || state.inProgress.has(key)) return false;
        if (state.highPriority.some((r) => getRequestKey(r) === key)) return false;
        if (state.secondaryPriority.some((r) => getRequestKey(r) === key)) return false;
        if (state.lowPriority.some((r) => getRequestKey(r) === key)) return false;
        return true;
      });

      if (newRequests.length === 0) return {};
      return {
        highPriority: [...state.highPriority, ...newRequests],
      };
    });
  },

  addToSecondaryPriority: (requests) => {
    set((state) => {
      const newRequests = requests.filter((request) => {
        const key = getRequestKey(request);
        if (state.thumbnails.has(key) || state.inProgress.has(key)) return false;
        if (state.highPriority.some((r) => getRequestKey(r) === key)) return false;
        if (state.secondaryPriority.some((r) => getRequestKey(r) === key)) return false;
        if (state.lowPriority.some((r) => getRequestKey(r) === key)) return false;
        return true;
      });

      if (newRequests.length === 0) return {};
      return {
        secondaryPriority: [...state.secondaryPriority, ...newRequests],
      };
    });
  },

  addToLowPriority: (requests) => {
    set((state) => {
      const newRequests = requests.filter((request) => {
        const key = getRequestKey(request);
        if (state.thumbnails.has(key) || state.inProgress.has(key)) return false;
        if (state.highPriority.some((r) => getRequestKey(r) === key)) return false;
        if (state.secondaryPriority.some((r) => getRequestKey(r) === key)) return false;
        if (state.lowPriority.some((r) => getRequestKey(r) === key)) return false;
        return true;
      });

      if (newRequests.length === 0) return {};
      return {
        lowPriority: [...state.lowPriority, ...newRequests],
      };
    });
  },

  resortQueue: (visiblePaths, _bufferPixels) => {
    set((state) => {
      const visible = Array.from(visiblePaths);

      const toRequest = (path: string, size: number, kind: ThumbnailKind): ThumbnailRequest => ({
        path,
        size,
        kind,
      });

      const buildQueue = (paths: string[], size: number, kind: ThumbnailKind) => {
        const requests: ThumbnailRequest[] = [];
        for (const path of paths) {
          const key = getThumbnailKey(path, size);
          if (state.thumbnails.has(key) || state.inProgress.has(key)) continue;
          if (requests.some((r) => getRequestKey(r) === key)) continue;
          requests.push(toRequest(path, size, kind));
        }
        return requests;
      };

      const highPriority = buildQueue(visible, state.config.tinySize, 'tiny');
      const secondaryPriority = buildQueue(visible, state.config.fullSize, 'full');
      const lowPriority: ThumbnailRequest[] = [];

      return {
        highPriority,
        secondaryPriority,
        lowPriority,
      };
    });
  },

  // Cancellation
  cancelOutOfViewport: (visiblePaths) => {
    set((state) => {
      const newInProgress = new Map(state.inProgress);
      
      for (const [key, task] of newInProgress.entries()) {
        if (!visiblePaths.has(task.request.path)) {
          task.abortController.abort();
          newInProgress.delete(key);
        }
      }

      return { inProgress: newInProgress };
    });
  },

  // Queue management
  clearQueues: () => {
    // Clear pending queues but keep in-progress items running
    set({
      highPriority: [],
      secondaryPriority: [],
      lowPriority: [],
    });
  },

  fullReset: () => {
    set((state) => {
      // Abort all in-progress
      for (const [, task] of state.inProgress) {
        task.abortController.abort();
      }
      return {
        highPriority: [],
        secondaryPriority: [],
        lowPriority: [],
        inProgress: new Map(),
        thumbnails: new Map(),
        failedRetries: new Map(),
        visiblePhotoPaths: new Set(),
      };
    });
  },

  // Work tracking
  markInProgress: (request, tier) => {
    const abortController = new AbortController();
    const key = getRequestKey(request);
    set((state) => {
      const newInProgress = new Map(state.inProgress);
      newInProgress.set(key, {
        startedAt: Date.now(),
        abortController,
        tier,
        request,
      });
      return { inProgress: newInProgress };
    });
    set((state) => ({
      highPriority: state.highPriority.filter((r) => getRequestKey(r) !== key),
      secondaryPriority: state.secondaryPriority.filter((r) => getRequestKey(r) !== key),
      lowPriority: state.lowPriority.filter((r) => getRequestKey(r) !== key),
    }));
    return abortController;
  },

  markCompleted: (path, size) => {
    const key = getThumbnailKey(path, size);
    set((state) => {
      const newInProgress = new Map(state.inProgress);
      newInProgress.delete(key);
      
      // Remove from all queues
      return {
        inProgress: newInProgress,
        failedRetries: (() => {
          const newFailed = new Map(state.failedRetries);
          newFailed.delete(key);
          return newFailed;
        })(),
        highPriority: state.highPriority.filter((r) => getRequestKey(r) !== key),
        secondaryPriority: state.secondaryPriority.filter((r) => getRequestKey(r) !== key),
        lowPriority: state.lowPriority.filter((r) => getRequestKey(r) !== key),
      };
    });
  },

  markFailed: (request) => {
    const key = getRequestKey(request);
    set((state) => {
      const newInProgress = new Map(state.inProgress);
      newInProgress.delete(key);
      
      const failCount = (state.failedRetries.get(key)?.failCount ?? 0) + 1;
      const newFailedRetries = new Map(state.failedRetries);
      newFailedRetries.set(key, {
        failCount,
        nextRetryAt: Date.now() + state.config.retryDelayMs,
        request,
      });

      return {
        inProgress: newInProgress,
        failedRetries: newFailedRetries,
        highPriority: state.highPriority.filter((r) => getRequestKey(r) !== key),
        secondaryPriority: state.secondaryPriority.filter((r) => getRequestKey(r) !== key),
        lowPriority: state.lowPriority.filter((r) => getRequestKey(r) !== key),
      };
    });
  },

  // Results
  storeThumbnail: (path, size, thumbnailPath) => {
    const key = getThumbnailKey(path, size);
    set((state) => {
      const newThumbnails = new Map(state.thumbnails);
      newThumbnails.set(key, thumbnailPath);
      return { thumbnails: newThumbnails };
    });
  },

  getThumbnail: (path, size) => {
    return get().thumbnails.get(getThumbnailKey(path, size));
  },

  // Configuration
  updateConfig: (partial) => {
    set((state) => ({
      config: { ...state.config, ...partial },
    }));
  },

  // Retry mechanism
  canRetry: (request) => {
    const failedRetry = get().failedRetries.get(getRequestKey(request));
    if (!failedRetry) return false;
    return Date.now() >= failedRetry.nextRetryAt && failedRetry.failCount < 3;
  },

  scheduleRetry: (request) => {
    const state = get();
    if (state.canRetry(request)) {
      state.addToLowPriority([request]);
    }
  },
}));
