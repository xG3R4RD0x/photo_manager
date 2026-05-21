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
  setPhotos: (photos: PhotoInfo[]) => void;
  setDuplicatePaths: (paths: Set<string>) => void;
  addDuplicatePath: (path: string) => void;
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
  
  setPhotos: (photos) => set({ photos }),
  
  setDuplicatePaths: (paths) => set((state) => {
    const selected = new Set(state.selectedPaths);
    for (const p of paths) {
      selected.delete(p);
    }
    return { duplicatePaths: paths, selectedPaths: selected };
  }),

  addDuplicatePath: (path) => set((state) => {
    if (state.duplicatePaths.has(path)) return state;
    const newDups = new Set(state.duplicatePaths);
    newDups.add(path);
    const selected = new Set(state.selectedPaths);
    selected.delete(path);
    return { duplicatePaths: newDups, selectedPaths: selected };
  }),
  
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
