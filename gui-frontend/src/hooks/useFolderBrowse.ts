import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { usePhotoStore } from "../stores/usePhotoStore";
import { useUIStore } from "../stores/useUIStore";

export function useFolderBrowse() {
  const [isLoading, setIsLoading] = useState(false);
  const { setPhotos } = usePhotoStore();
  const { setSourceFolder, setStatus } = useUIStore();

  const scanPhotosWithMetadata = async (folderPath: string) => {
    setIsLoading(true);
    setStatus("Loading photos...");

    try {
      // 1. Quick scan (instant - no EXIF yet)
      const quickPhotos = await invoke<any[]>("scan_photos_quick", {
        folder: folderPath,
      });

      setPhotos(quickPhotos);
      setStatus(`Found ${quickPhotos.length} photos. Processing metadata...`);

      // 2. Setup metadata_ready listener (fires when enrichment completes)
      const unlistenMetadata = await listen<any[]>("metadata_ready", (event) => {
        setPhotos(event.payload);
        setStatus(`Loaded ${event.payload.length} photos`);
        unlistenMetadata();
      });

      // 3. Start enrichment in background (no await - fires event when done)
      invoke("enrich_photos_metadata_fast", { folder: folderPath }).catch((e) =>
        console.error("Enrichment error:", e)
      );
    } catch (error) {
      setStatus(`Error: ${error}`);
      console.error("Scan error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const browseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select photo folder",
      });

      if (selected && typeof selected === "string") {
        setSourceFolder(selected);
        await scanPhotosWithMetadata(selected);
      }
    } catch (error) {
      console.error("Browse error:", error);
      setStatus(`Browse error: ${error}`);
    }
  };

  return {
    browseFolder,
    isLoading,
    scanPhotosWithMetadata,
  };
}
