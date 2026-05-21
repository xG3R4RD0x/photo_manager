import MetadataSection from "./MetadataSection";
import FormatSection from "./FormatSection";
import DestinationTreeSection from "./DestinationTreeSection";
import { useImportFlow } from "../hooks/useImportFlow";
import { useUIStore } from "../stores/useUIStore";
import { usePhotoStore } from "../stores/usePhotoStore";
import "./RightPanel.css";

export default function RightPanel() {
  const { setShowImportModal, isImporting } = useUIStore();
  const selectedCount = usePhotoStore((s) => s.selectedPaths.size);
  const { startImport } = useImportFlow();

  const handleImport = async () => {
    if (selectedCount === 0) {
      alert("Select photos to import");
      return;
    }
    setShowImportModal(true);
    await startImport();
  };

  return (
    <div className="right-panel">
      <MetadataSection />
      <DestinationTreeSection />
      <FormatSection />

      <div className="import-section">
        <button className="import-btn" onClick={handleImport} disabled={isImporting}>
          Import ({selectedCount} photos)
        </button>
      </div>
    </div>
  );
}
