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
  duplicatePaths: Set<string>;
  inspectedPath: string | null;
  setPhotos: (photos: PhotoInfo[]) => void;
  setDuplicatePaths: (paths: Set<string>) => void;
  setInspectedPath: (path: string | null) => void;
  toggleSelection: (path: string) => void;
  toggleGroup: (paths: string[]) => void;
  selectAll: () => void;
  deselectAll: () => void;
  toggleGroupSelection: (selectedOnly: boolean) => void;
}

export const usePhotoStore = create<PhotoStore>((set) => ({
  photos: [],
  selectedPaths: new Set(),
  duplicatePaths: new Set(),
  inspectedPath: null,
  
  setPhotos: (photos) => set({ photos }),
  
  setDuplicatePaths: (paths) => set({ duplicatePaths: paths }),

  setInspectedPath: (path) => set({ inspectedPath: path }),

  toggleSelection: (path) => set((state) => {
    if (state.duplicatePaths.has(path)) return state;
    const selected = new Set(state.selectedPaths);
    if (selected.has(path)) {
      selected.delete(path);
    } else {
      selected.add(path);
    }
    return { selectedPaths: selected };
  }),

  toggleGroup: (paths) => set((state) => {
    const filtered = paths.filter((p) => !state.duplicatePaths.has(p));
    if (filtered.length === 0) return state;
    const allSelected = filtered.every((p) => state.selectedPaths.has(p));
    const selected = new Set(state.selectedPaths);
    if (allSelected) {
      for (const p of filtered) selected.delete(p);
    } else {
      for (const p of filtered) selected.add(p);
    }
    return { selectedPaths: selected };
  }),

  selectAll: () => set((state) => ({
    selectedPaths: new Set(
      state.photos
        .filter((p) => !state.duplicatePaths.has(p.path))
        .map((p) => p.path)
    ),
  })),
  
  deselectAll: () => set({ selectedPaths: new Set() }),
  
  toggleGroupSelection: (selectedOnly) => {
    set((state) => ({
      selectedPaths: selectedOnly
        ? new Set(
            state.photos
              .filter((p) => !state.duplicatePaths.has(p.path))
              .map((p) => p.path)
          )
        : new Set(),
    }));
  },
}));
