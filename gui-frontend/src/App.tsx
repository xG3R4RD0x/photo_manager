import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUIStore } from "./stores/useUIStore";
import { useDeviceDetection } from "./hooks/useDeviceDetection";
import { useDuplicateCheck } from "./hooks/useDuplicateCheck";
import Toolbar from "./components/Toolbar";
import SourceTree from "./components/SourceTree";
import PhotoGrid from "./components/PhotoGrid";
import RightPanel from "./components/RightPanel";
import ImportModal from "./components/ImportModal";
import PreviewModal from "./components/PreviewModal";
import DuplicateCheckBar from "./components/DuplicateCheckBar";
import "./App.css";

export default function App() {
  // Auto-detect devices on startup
  useDeviceDetection();
  useDuplicateCheck();
  const { setDefaultDestFolder } = useUIStore();

  // Initialize default pictures folder on startup
  useEffect(() => {
    invoke<string>("get_pictures_folder")
      .then(setDefaultDestFolder)
      .catch(() => setDefaultDestFolder("/Pictures"));
  }, [setDefaultDestFolder]);

  return (
    <div className="app-container">
      <Toolbar />
      <DuplicateCheckBar />
      <div className="main-content">
        <SourceTree />
        <PhotoGrid />
        <RightPanel />
      </div>
      <ImportModal />
      <PreviewModal />
    </div>
  );
}
