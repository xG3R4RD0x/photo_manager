import { create } from "zustand";
import { usePhotoStore } from "./usePhotoStore";

export interface ImportResult {
  success: boolean;
  message: string;
}

export interface UIStore {
  sourceFolder: string | null;
  destFolder: string | null;
  selectedTemplate: string;
  showImportModal: boolean;
  showPreviewModal: boolean;
  previewImagePath: string | null;
  importProgress: number;
  importTotal: number;
  importResult: ImportResult | null;
  isImporting: boolean;
  status: string;
  
  setSourceFolder: (folder: string | null) => void;
  setDestFolder: (folder: string | null) => void;
  setSelectedTemplate: (template: string) => void;
  setShowImportModal: (show: boolean) => void;
  setShowPreviewModal: (show: boolean, path?: string) => void;
  setImportProgress: (current: number, total: number) => void;
  setImportResult: (result: ImportResult | null) => void;
  setIsImporting: (importing: boolean) => void;
  setStatus: (status: string) => void;
  deselectAll: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sourceFolder: null,
  destFolder: null,
  selectedTemplate: "YYYY/YYYY-MM-DD/",
  showImportModal: false,
  showPreviewModal: false,
  previewImagePath: null,
  importProgress: 0,
  importTotal: 0,
  importResult: null,
  isImporting: false,
  status: "Ready",
  
  setSourceFolder: (folder) => set({ sourceFolder: folder }),
  setDestFolder: (folder) => set({ destFolder: folder }),
  setSelectedTemplate: (template) => set({ selectedTemplate: template }),
  setShowImportModal: (show) => set({ showImportModal: show }),
  setShowPreviewModal: (show, path) =>
    set({ showPreviewModal: show, previewImagePath: path || null }),
  setImportProgress: (current, total) =>
    set({ importProgress: current, importTotal: total }),
  setImportResult: (result) => set({ importResult: result }),
  setIsImporting: (importing) => set({ isImporting: importing }),
  setStatus: (status) => set({ status }),
  deselectAll: () => {
    usePhotoStore.setState({ selectedPaths: new Set() });
  },
}));
