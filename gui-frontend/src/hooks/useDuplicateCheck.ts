import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import { usePhotoStore } from "../stores/usePhotoStore";
import { useUIStore } from "../stores/useUIStore";
import { applyTemplate } from "../utils/applyTemplate";

export function useDuplicateCheck() {
  const photos = usePhotoStore((s) => s.photos);
  const destFolder = useUIStore((s) => s.destFolder);
  const selectedTemplate = useUIStore((s) => s.selectedTemplate);
  const duplicateCheckTrigger = useUIStore((s) => s.duplicateCheckTrigger);
  const setDuplicatePaths = usePhotoStore((s) => s.setDuplicatePaths);
  const setDuplicateCheckProgress = useUIStore((s) => s.setDuplicateCheckProgress);
  const unlistenRef = useRef<(() => void) | null>(null);
  const prevKeyRef = useRef<string>("");

  useEffect(() => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }

    if (!destFolder || photos.length === 0) {
      setDuplicatePaths(new Set());
      setDuplicateCheckProgress(null);
      return;
    }

    // Compare paths + dates to detect meaningful changes
    const currentKey = photos
      .map((p) => `${p.path}|${p.date ?? ""}`)
      .sort()
      .join(",");

    if (!duplicateCheckTrigger) {
      return;
    }

    prevKeyRef.current = currentKey;

    setDuplicatePaths(new Set());

    const paths = photos.map((p) => p.path);
    const subfolders = photos.map((p) =>
      p.date
        ? applyTemplate(selectedTemplate, p.date).replace(/\/+$/, "")
        : "SinFecha"
    );

    const init = async () => {
      const unlistenProgress = await listen<{ current: number; total: number }>(
        "duplicate_check_progress",
        (event) => {
          setDuplicateCheckProgress(event.payload);
        }
      );

      const unlistenBatch = await listen<string[]>("duplicate_found_batch", (event) => {
        setDuplicatePaths(new Set(event.payload));
      });

      const unlistenDone = await listen("duplicate_check_done", () => {
        setDuplicateCheckProgress(null);
        unlistenProgress();
        unlistenBatch();
        unlistenDone();
      });

      unlistenRef.current = () => {
        unlistenProgress();
        unlistenBatch();
        unlistenDone();
      };

      invoke("start_duplicate_check", { paths, subfolders, dest: destFolder }).catch(
        (err) => console.error("Duplicate check failed:", err)
      );
    };

    init();

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [
    destFolder,
    photos,
    selectedTemplate,
    duplicateCheckTrigger,
    setDuplicatePaths,
    setDuplicateCheckProgress,
  ]);
}
