import "./SourceTree.css";

export default function SourceTree() {
  return (
    <div className="source-tree">
      <div className="tree-header">📁 Source</div>
      <div className="tree-content">
        <p style={{ color: "#666", fontSize: "12px", padding: "8px" }}>
          No camera detected
        </p>
        <button style={{ width: "90%", margin: "8px auto", display: "block" }}>
          📁 Browse...
        </button>
      </div>
    </div>
  );
}
