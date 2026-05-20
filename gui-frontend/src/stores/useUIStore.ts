import { create } from "zustand";
import { usePhotoStore } from "./usePhotoStore";

export interface UIStore {
  sourceFolder: string | null;
  destFolder: string | null;
  selectedTemplate: string;
  showImportModal: boolean;
  showPreviewModal: boolean;
  previewImagePath: string | null;
  importProgress: number;
  importTotal: number;
  status: string;
  
  setSourceFolder: (folder: string | null) => void;
  setDestFolder: (folder: string | null) => void;
  setSelectedTemplate: (template: string) => void;
  setShowImportModal: (show: boolean) => void;
  setShowPreviewModal: (show: boolean, path?: string) => void;
  setImportProgress: (current: number, total: number) => void;
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
  status: "Ready",
  
  setSourceFolder: (folder) => set({ sourceFolder: folder }),
  setDestFolder: (folder) => set({ destFolder: folder }),
  setSelectedTemplate: (template) => set({ selectedTemplate: template }),
  setShowImportModal: (show) => set({ showImportModal: show }),
  setShowPreviewModal: (show, path) =>
    set({ showPreviewModal: show, previewImagePath: path || null }),
  setImportProgress: (current, total) =>
    set({ importProgress: current, importTotal: total }),
  setStatus: (status) => set({ status }),
  deselectAll: () => {
    usePhotoStore.setState({ selectedPaths: new Set() });
  },
}));
