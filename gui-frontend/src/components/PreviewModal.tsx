import { useUIStore } from "../stores/useUIStore";
import "./PreviewModal.css";

export default function PreviewModal() {
  const { showPreviewModal, setShowPreviewModal, previewImagePath } =
    useUIStore();

  if (!showPreviewModal || !previewImagePath) return null;

  return (
    <div
      className="preview-overlay"
      onClick={() => setShowPreviewModal(false)}
    >
      <div
        className="preview-container"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="preview-close"
          onClick={() => setShowPreviewModal(false)}
        >
          ✕
        </button>

        <div className="preview-image">
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#1a1a1a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "60px",
            }}
          >
            📷
          </div>
        </div>

        <div className="preview-info">
          <p style={{ fontSize: "12px", color: "#888" }}>
            {previewImagePath}
          </p>
        </div>
      </div>
    </div>
  );
}
