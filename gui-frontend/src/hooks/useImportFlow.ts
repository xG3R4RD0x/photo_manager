import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePhotoStore } from "../stores/usePhotoStore";
import { useUIStore } from "../stores/useUIStore";

export function useImportFlow() {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const startImport = async () => {
    const selectedPhotos = Array.from(usePhotoStore.getState().selectedPaths);
    const { destFolder, selectedTemplate, setStatus } =
      useUIStore.getState();

    if (!destFolder) {
      setImportResult({
        success: false,
        message: "Please select a destination folder",
      });
      return;
    }

    if (selectedPhotos.length === 0) {
      setImportResult({
        success: false,
        message: "Select photos to import",
      });
      return;
    }

    setIsImporting(true);
    setImportResult(null);
    setStatus("Starting import...");

    try {
      const result = await invoke<string>("import_photos", {
        paths: selectedPhotos,
        dest: destFolder,
        template: selectedTemplate,
      });

      setImportResult({
        success: true,
        message: result,
      });
      setStatus("Import complete!");

      // Clear selection after successful import
      usePhotoStore.getState().deselectAll();
    } catch (error) {
      setImportResult({
        success: false,
        message: `Import failed: ${error}`,
      });
      setStatus("Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  return { startImport, isImporting, importResult, setImportResult };
}

