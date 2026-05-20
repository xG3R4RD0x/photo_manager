import MetadataSection from "./MetadataSection";
import FormatSection from "./FormatSection";
import DestinationTreeSection from "./DestinationTreeSection";
import { useImportFlow } from "../hooks/useImportFlow";
import { useUIStore } from "../stores/useUIStore";
import { usePhotoStore } from "../stores/usePhotoStore";
import "./RightPanel.css";

export default function RightPanel() {
  const { setShowImportModal } = useUIStore();
  const selectedCount = usePhotoStore((s) => s.selectedPaths.size);
  const { startImport, isImporting } = useImportFlow();

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
      <FormatSection />
      <DestinationTreeSection />

      <div className="panel-section" style={{ marginTop: "auto" }}>
        <button
          style={{
            width: "100%",
            padding: "10px",
            fontSize: "14px",
            fontWeight: "500",
          }}
          onClick={handleImport}
          disabled={isImporting}
        >
          📥 Import ({selectedCount} photos)
        </button>
      </div>
    </div>
  );
}
