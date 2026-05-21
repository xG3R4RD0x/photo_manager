import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useUIStore } from "../stores/useUIStore";
import { useFolderBrowse } from "../hooks/useFolderBrowse";
import "./SourceTree.css";

interface RemovableDrive {
  mount_point: string;
  label: string;
  is_camera: boolean;
}

export default function SourceTree() {
  const [devices, setDevices] = useState<RemovableDrive[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const sourceFolder = useUIStore((s) => s.sourceFolder);
  const { scanPhotosWithMetadata } = useFolderBrowse();

  const loadDevices = async () => {
    try {
      setIsRefreshing(true);
      const devs = await invoke<RemovableDrive[]>("list_all_removable_drives");
      setDevices(devs);
    } catch (error) {
      console.error("Failed to load devices:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleDeviceSelect = async (device: RemovableDrive) => {
    try {
      const photoFolder = await invoke<string | null>("find_photo_folder", {
        drive: device.mount_point,
      });

      if (photoFolder) {
        await scanPhotosWithMetadata(photoFolder);
      }
    } catch (error) {
      console.error("Error scanning device:", error);
    }
  };

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select photo folder",
      });

      if (selected && typeof selected === "string") {
        await scanPhotosWithMetadata(selected);
      }
    } catch (error) {
      console.error("Browse error:", error);
    }
  };

  return (
    <div className="source-tree">
      <div
        className="tree-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>📁 Source</span>
        <button
          onClick={loadDevices}
          disabled={isRefreshing}
          style={{
            padding: "4px 8px",
            fontSize: "12px",
            cursor: isRefreshing ? "default" : "pointer",
            opacity: isRefreshing ? 0.6 : 1,
          }}
          title="Refresh device list"
        >
          ↻
        </button>
      </div>

      <div className="tree-content">
        {devices.length > 0 ? (
          <div className="devices-list">
            {devices.map((device) => (
              <button
                key={device.mount_point}
                onClick={() => handleDeviceSelect(device)}
                className={`device-btn ${
                  sourceFolder === device.mount_point ? "active" : ""
                }`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px",
                  margin: "4px 0",
                  textAlign: "left",
                  border: sourceFolder === device.mount_point ? "1px solid #0066cc" : "1px solid #ccc",
                  borderRadius: "4px",
                  backgroundColor:
                    sourceFolder === device.mount_point ? "#f0f7ff" : "white",
                  cursor: "pointer",
                }}
              >
                <span>{device.is_camera ? "📷" : "💾"}</span>
                <span style={{ fontSize: "12px" }}>{device.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <p style={{ color: "#666", fontSize: "12px", padding: "8px" }}>
            No external devices detected
          </p>
        )}

        <button
          onClick={handleBrowse}
          style={{ width: "90%", margin: "8px auto", display: "block" }}
        >
          📁 Browse...
        </button>
      </div>
    </div>
  );
}
