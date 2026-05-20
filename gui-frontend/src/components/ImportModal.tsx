import { useUIStore } from "../stores/useUIStore";
import { useImportFlow } from "../hooks/useImportFlow";
import "./ImportModal.css";

export default function ImportModal() {
  const { showImportModal, setShowImportModal, importProgress, importTotal } =
    useUIStore();
  const { importResult, setImportResult } = useImportFlow();

  if (!showImportModal) return null;

  const progressPercent =
    importTotal > 0 ? (importProgress / importTotal) * 100 : 0;
  const isResult = importResult !== null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {isResult ? (
          <>
            <h2>
              {importResult.success ? "✅ Import Complete" : "❌ Import Failed"}
            </h2>
            <div className="import-result">
              <p>{importResult.message}</p>
            </div>
            <div className="modal-actions">
              <button
                onClick={() => {
                  setImportResult(null);
                  setShowImportModal(false);
                }}
                style={{ flex: 1 }}
              >
                ✓ Close
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>📥 Importing Photos</h2>

            <div className="import-info">
              <p className="progress-text">
                {importProgress} / {importTotal} files
              </p>
            </div>

            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            <p style={{ fontSize: "12px", color: "#888", marginTop: "8px" }}>
              {progressPercent.toFixed(0)}%
            </p>

            <div className="modal-actions">
              <button
                onClick={() => setShowImportModal(false)}
                style={{ flex: 1 }}
              >
                ✕ Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
