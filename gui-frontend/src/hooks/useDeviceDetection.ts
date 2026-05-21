import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUIStore } from "../stores/useUIStore";
import { useFolderBrowse } from "./useFolderBrowse";

interface RemovableDrive {
  mount_point: string;
  label: string;
  total_size: number;
  used_size: number;
  is_camera: boolean;
}

export function useDeviceDetection() {
  const { setSourceFolder } = useUIStore();
  const { scanPhotosWithMetadata } = useFolderBrowse();

  useEffect(() => {
    const detectDevices = async () => {
      try {
        const devices = await invoke<RemovableDrive[]>(
          "list_all_removable_drives"
        );

        if (devices.length > 0) {
          // Auto-select first camera, or first device overall
          const camera = devices.find((d) => d.is_camera);
          const device = camera || devices[0];

          setSourceFolder(device.mount_point);

          // Auto-find photo folder and scan
          const photoFolder = await invoke<string | null>(
            "find_photo_folder",
            { drive: device.mount_point }
          );

          if (photoFolder) {
            await scanPhotosWithMetadata(photoFolder);
          }
        }
      } catch (error) {
        console.error("Device detection error:", error);
      }
    };

    detectDevices();
  }, []);

  return {};
}
