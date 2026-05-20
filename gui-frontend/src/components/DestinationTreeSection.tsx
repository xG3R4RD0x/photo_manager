import { ReactNode, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useUIStore } from "../stores/useUIStore";
import { usePhotoStore } from "../stores/usePhotoStore";

interface TreeNode {
  name: string;
  count: number;
  isNew: boolean;
  children: TreeNode[];
}

export default function DestinationTreeSection() {
  const { destFolder, setDestFolder } = useUIStore();
  const selectedCount = usePhotoStore((s) => s.selectedPaths.size);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  const toggleFolder = (path: string) => {
    const updated = new Set(expandedFolders);
    if (updated.has(path)) {
      updated.delete(path);
    } else {
      updated.add(path);
    }
    setExpandedFolders(updated);
  };

  const selectDestination = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select destination folder for imports",
    });

    if (selected && typeof selected === "string") {
      setDestFolder(selected);
    }
  };

  // Mock destination tree structure based on template
  const mockTree: TreeNode = {
    name: destFolder || "D:/Photos",
    count: selectedCount,
    isNew: false,
    children: selectedCount > 0 
      ? [
          {
            name: "2026",
            count: selectedCount,
            isNew: true,
            children: [
              {
                name: "2026-05-20",
                count: Math.floor(selectedCount / 2),
                isNew: true,
                children: [],
              },
              {
                name: "2026-05-21",
                count: Math.ceil(selectedCount / 2),
                isNew: true,
                children: [],
              },
            ],
          },
          {
            name: "SinFecha",
            count: 0,
            isNew: true,
            children: [],
          },
        ]
      : [],
  };

  const renderNode = (node: TreeNode, level: number = 0): ReactNode => {
    const nodeKey = `${level}-${node.name}`;
    const isExpanded = expandedFolders.has(nodeKey);

    return (
      <div key={nodeKey} style={{ marginLeft: `${level * 16}px`, fontSize: "12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            cursor: node.children.length > 0 ? "pointer" : "default",
            padding: "4px 0",
            color: node.isNew ? "#999" : "#ccc",
            fontStyle: node.isNew ? "italic" : "normal",
          }}
          onClick={() => {
            if (node.children.length > 0) {
              toggleFolder(nodeKey);
            }
          }}
        >
          {node.children.length > 0 && (
            <span>{isExpanded ? "▼" : "▶"}</span>
          )}
          <span>📁 {node.name}</span>
          <span style={{ marginLeft: "auto", color: "#666" }}>
            ({node.count})
          </span>
        </div>
        {isExpanded &&
          node.children.map((child) => renderNode(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="destination-section">
      <h3>📂 Destination</h3>
      <button
        style={{ width: "100%", marginBottom: "8px" }}
        onClick={selectDestination}
      >
        📁 Change...
      </button>
      <div
        style={{
          background: "#2a2a2a",
          padding: "8px",
          borderRadius: "4px",
          fontSize: "12px",
          maxHeight: "200px",
          overflowY: "auto",
        }}
      >
        {renderNode(mockTree)}
      </div>
    </div>
  );
}
