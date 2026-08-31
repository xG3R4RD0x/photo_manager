import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { usePhotoStore } from "../stores/usePhotoStore";
import { useUIStore } from "../stores/useUIStore";

export function useImportFlow() {
  const startImport = async () => {
    const selectedPhotos = Array.from(usePhotoStore.getState().selectedPaths);
    const { destFolder, selectedTemplate } = useUIStore.getState();

    if (!destFolder) {
      useUIStore.setState({
        importResult: { success: false, message: "Please select a destination folder" },
      });
      return;
    }

    if (selectedPhotos.length === 0) {
      useUIStore.setState({
        importResult: { success: false, message: "Select photos to import" },
      });
      return;
    }

    useUIStore.setState({
      isImporting: true,
      importResult: null,
      status: "Starting import...",
      importProgress: 0,
      importTotal: selectedPhotos.length,
    });

    const unlistenProgress = await listen<{ current: number; total: number }>(
      "import_progress",
      (event) => {
        useUIStore.getState().setImportProgress(event.payload.current, event.payload.total);
      }
    );

    const unlistenDone = await listen<string>("import_done", (event) => {
      useUIStore.setState({
        importResult: { success: true, message: event.payload },
        isImporting: false,
        status: "Import complete!",
      });
      usePhotoStore.getState().deselectAll();
      useUIStore.getState().triggerDuplicateCheck();
      useUIStore.getState().triggerThumbnailGeneration();
      unlistenProgress();
      unlistenDone();
      unlistenError();
    });

    const unlistenError = await listen("import_error", () => {
      useUIStore.setState({
        importResult: { success: false, message: "Import failed" },
        isImporting: false,
        status: "Import failed",
      });
      unlistenProgress();
      unlistenDone();
      unlistenError();
    });

    try {
      await invoke("import_photos", {
        paths: selectedPhotos,
        dest: destFolder,
        template: selectedTemplate,
      });
    } catch (error) {
      useUIStore.setState({
        importResult: { success: false, message: `Import failed: ${error}` },
        isImporting: false,
        status: "Import failed",
      });
      unlistenProgress();
      unlistenDone();
      unlistenError();
    }
  };

  return { startImport };
}
