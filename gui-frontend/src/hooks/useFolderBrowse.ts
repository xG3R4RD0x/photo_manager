import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { usePhotoStore } from "../stores/usePhotoStore";
import { useUIStore } from "../stores/useUIStore";

export function useFolderBrowse() {
  const [isLoading, setIsLoading] = useState(false);
  const { setPhotos } = usePhotoStore();
  const { setStatus } = useUIStore();

  const detectCamera = async () => {
    setIsLoading(true);
    setStatus("Detecting camera...");
    try {
      const result = await invoke<string | null>("detect_camera");
      if (result) {
        setStatus(`Camera found at: ${result}`);
        // Now find photo folder
        const photoFolder = await invoke<string | null>("find_photo_folder", {
          drive: result,
        });
        if (photoFolder) {
          await scanPhotos(photoFolder);
        }
      } else {
        setStatus("No camera detected");
      }
    } catch (error) {
      setStatus(`Error detecting camera: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const browseFolder = async () => {
    setIsLoading(true);
    setStatus("Browsing folder...");
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select photo folder",
      });

      if (selected && typeof selected === "string") {
        await scanPhotos(selected);
      } else {
        setStatus("No folder selected");
      }
    } catch (error) {
      setStatus(`Error browsing folder: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const scanPhotos = async (folderPath: string) => {
    setStatus("Scanning photos...");
    try {
      const photos = await invoke<any[]>("scan_photos", {
        folder: folderPath,
      });
      setPhotos(photos);
      setStatus(`Found ${photos.length} photos`);
    } catch (error) {
      setStatus(`Error scanning folder: ${error}`);
    }
  };

  return { detectCamera, browseFolder, isLoading };
}
