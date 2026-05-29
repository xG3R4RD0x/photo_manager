import { create } from "zustand";
import { usePhotoStore } from "./usePhotoStore";

export interface ImportResult {
  success: boolean;
  message: string;
}

export interface UIStore {
  sourceFolder: string | null;
  destFolder: string | null;
  defaultDestFolder: string | null;
  selectedTemplate: string;
  showImportModal: boolean;
  duplicateCheckProgress: { current: number; total: number } | null;
  duplicateCheckTrigger: number;
  importProgress: number;
  importTotal: number;
  importResult: ImportResult | null;
  isImporting: boolean;
  status: string;
  thumbnailGenerationTrigger: number;
  viewMode: 'grid' | 'single';
  lastInspectedPath: string | null;

  setSourceFolder: (folder: string | null) => void;
  setDestFolder: (folder: string | null) => void;
  setDefaultDestFolder: (folder: string) => void;
  resetDestFolder: () => void;
  setSelectedTemplate: (template: string) => void;
  setShowImportModal: (show: boolean) => void;
  setImportProgress: (current: number, total: number) => void;
  setDuplicateCheckProgress: (progress: { current: number; total: number } | null) => void;
  triggerDuplicateCheck: () => void;
  triggerThumbnailGeneration: () => void;
  setImportResult: (result: ImportResult | null) => void;
  setIsImporting: (importing: boolean) => void;
  setStatus: (status: string) => void;
  deselectAll: () => void;
  setViewMode: (mode: 'grid' | 'single') => void;
  setLastInspectedPath: (path: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sourceFolder: null,
  destFolder: null,
  defaultDestFolder: null,
  selectedTemplate: "YYYY/YYYY-MM-DD/",
  showImportModal: false,
  duplicateCheckProgress: null,
  duplicateCheckTrigger: 0,
  importProgress: 0,
  importTotal: 0,
  importResult: null,
  isImporting: false,
  status: "Ready",
  thumbnailGenerationTrigger: 0,
  viewMode: 'grid',
  lastInspectedPath: null,

  setSourceFolder: (folder) => set({ sourceFolder: folder }),
  setDestFolder: (folder) => set({ destFolder: folder }),
  setDefaultDestFolder: (folder) => set({ defaultDestFolder: folder, destFolder: folder }),
  resetDestFolder: () => set((state) => ({ destFolder: state.defaultDestFolder })),
  setSelectedTemplate: (template) => set({ selectedTemplate: template }),
  setShowImportModal: (show) => set({ showImportModal: show }),
  setImportProgress: (current, total) =>
    set({ importProgress: current, importTotal: total }),
  setDuplicateCheckProgress: (progress) => set({ duplicateCheckProgress: progress }),
  triggerDuplicateCheck: () => set((s) => ({ duplicateCheckTrigger: s.duplicateCheckTrigger + 1 })),
  triggerThumbnailGeneration: () => set((s) => ({ thumbnailGenerationTrigger: s.thumbnailGenerationTrigger + 1 })),
  setImportResult: (result) => set({ importResult: result }),
  setIsImporting: (importing) => set({ isImporting: importing }),
  setStatus: (status) => set({ status }),
  deselectAll: () => {
    usePhotoStore.setState({ selectedPaths: new Set() });
  },
  setViewMode: (mode) => set({ viewMode: mode }),
  setLastInspectedPath: (path) => set({ lastInspectedPath: path }),
}));
