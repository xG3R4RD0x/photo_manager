import { create } from "zustand";

export interface PhotoInfo {
  path: string;
  filename: string;
  date: string | null;
  file_size: number;
}

export interface PhotoStore {
  photos: PhotoInfo[];
  selectedPaths: Set<string>;
  setPhotos: (photos: PhotoInfo[]) => void;
  toggleSelection: (path: string) => void;
  toggleGroup: (paths: string[]) => void;
  selectAll: () => void;
  deselectAll: () => void;
  toggleGroupSelection: (selectedOnly: boolean) => void;
}

export const usePhotoStore = create<PhotoStore>((set) => ({
  photos: [],
  selectedPaths: new Set(),
  
  setPhotos: (photos) => set({ photos }),
  
  toggleSelection: (path) => set((state) => {
    const selected = new Set(state.selectedPaths);
    if (selected.has(path)) {
      selected.delete(path);
    } else {
      selected.add(path);
    }
    return { selectedPaths: selected };
  }),

  toggleGroup: (paths) => set((state) => {
    const allSelected = paths.every((p) => state.selectedPaths.has(p));
    const selected = new Set(state.selectedPaths);
    if (allSelected) {
      for (const p of paths) selected.delete(p);
    } else {
      for (const p of paths) selected.add(p);
    }
    return { selectedPaths: selected };
  }),

  selectAll: () => set((state) => ({
    selectedPaths: new Set(state.photos.map((p) => p.path)),
  })),
  
  deselectAll: () => set({ selectedPaths: new Set() }),
  
  toggleGroupSelection: (selectedOnly) => {
    set((state) => ({
      selectedPaths: selectedOnly
        ? new Set(state.photos.map((p) => p.path))
        : new Set(),
    }));
  },
}));
