import { invoke } from "@tauri-apps/api/core";
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

    useUIStore.setState({ isImporting: true, importResult: null, status: "Starting import..." });

    try {
      const result = await invoke<string>("import_photos", {
        paths: selectedPhotos,
        dest: destFolder,
        template: selectedTemplate,
      });

      useUIStore.setState({
        importResult: { success: true, message: result },
        isImporting: false,
        status: "Import complete!",
      });

      usePhotoStore.getState().deselectAll();
      useUIStore.getState().triggerDuplicateCheck();
    } catch (error) {
      useUIStore.setState({
        importResult: { success: false, message: `Import failed: ${error}` },
        isImporting: false,
        status: "Import failed",
      });
    }
  };

  return { startImport };
}

