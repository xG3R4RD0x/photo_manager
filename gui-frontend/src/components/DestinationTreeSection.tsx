import { useState, useMemo, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useUIStore } from "../stores/useUIStore";
import { usePhotoStore } from "../stores/usePhotoStore";
import { applyTemplate, buildDestinationTree, TreeNode, DirEntry, dirEntryToNode, mergeTrees } from "../utils/applyTemplate";

export default function DestinationTreeSection() {
  const { destFolder, defaultDestFolder, setDestFolder, resetDestFolder, selectedTemplate } = useUIStore();
  const photos = usePhotoStore((s) => s.photos);
  const selectedPaths = usePhotoStore((s) => s.selectedPaths);
  const [realRoot, setRealRoot] = useState<DirEntry | null>(null);

  const selectedPhotos = useMemo(
    () => photos.filter((p) => selectedPaths.has(p.path)),
    [photos, selectedPaths],
  );

  const projectedRoot = useMemo<TreeNode | null>(
    () => selectedPhotos.length > 0 ? buildDestinationTree(selectedPhotos, selectedTemplate) : null,
    [selectedPhotos, selectedTemplate],
  );

  const fetchRealTree = useCallback(async () => {
    if (!destFolder) return;
    try {
      const root = await invoke<DirEntry>("list_directory_tree", { path: destFolder });
      setRealRoot(root);
    } catch (err) {
      console.error("Failed to list directory tree:", err);
    }
  }, [destFolder]);

  useEffect(() => {
    fetchRealTree();
  }, [fetchRealTree]);

  const mergedChildren = useMemo<TreeNode[]>(() => {
    if (!realRoot) return projectedRoot?.children || [];
    const realNodes = realRoot.children.map((c) => dirEntryToNode(c));
    if (!projectedRoot) return realNodes;
    return mergeTrees(realNodes, projectedRoot.children);
  }, [realRoot, projectedRoot, selectedPhotos]);

  const previewPath = useMemo(() => {
    if (selectedPhotos.length === 0) return "";
    const sample = selectedPhotos[0];
    const rel = sample.date ? applyTemplate(selectedTemplate, sample.date) : "SinFecha";
    return `${destFolder}/${rel}/`;
  }, [selectedPhotos, selectedTemplate, destFolder]);

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

  const collectAllProjectedPaths = (nodes: TreeNode[], basePath: string): string[] => {
    const paths: string[] = [];
    for (const node of nodes) {
      const nodePath = `${basePath}/${node.name}`;
      paths.push(nodePath);
      paths.push(...collectAllProjectedPaths(node.children, nodePath));
    }
    return paths;
  };

  const autoExpandSet = useMemo<Set<string>>(() => {
    if (!projectedRoot) return new Set();
    const paths = collectAllProjectedPaths(projectedRoot.children, destFolder || "");
    console.log("COLLECTED PATHS (from projected):", paths);
    return new Set(paths);
  }, [projectedRoot, destFolder]);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    console.log("setting expanded to:", [...autoExpandSet]);
    setExpandedFolders(new Set(autoExpandSet));
  }, [autoExpandSet]);

  const toggleFolder = (key: string) => {
    console.log("toggleFolder:", key);
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      console.log("expanded after toggle:", [...next]);
      return next;
    });
  };

  const renderNode = (node: TreeNode, path: string, level: number = 0): React.ReactNode => {
    const nodeKey = `${path}/${node.name}`;
    const isExpanded = expandedFolders.has(nodeKey);
    const hasChildren = node.children.length > 0;

    return (
      <div key={nodeKey}>
        <div
          className="tree-row"
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => hasChildren && toggleFolder(nodeKey)}
        >
          {hasChildren && (
            <span className="tree-toggle">{isExpanded ? "▼" : "▶"}</span>
          )}
          {!hasChildren && <span className="tree-toggle-spacer" />}
          <span className={`tree-name ${node.isNew ? "tree-new" : ""}`}>
            {node.name}
          </span>
          {node.count > 0 && (
            <span className="tree-count">{node.count}</span>
          )}
        </div>
        {isExpanded && hasChildren && (
          <div className="tree-children">
            {node.children.map((child) => renderNode(child, nodeKey, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="destination-section">
      <div className="section-header">
        <span>Destination</span>
      </div>

      <div className="dest-path-bar">
        <span className="dest-path-text">{destFolder}</span>
        <button className="dest-change-btn" onClick={selectDestination}>
          Change...
        </button>
      </div>

      {defaultDestFolder && destFolder !== defaultDestFolder && (
        <div className="dest-reset-bar">
          <button className="dest-reset-btn" onClick={resetDestFolder}>
            ↺ Reset to default
          </button>
        </div>
      )}

      <div className="tree-container">
        <div className="tree-root">
          <div className="tree-row" style={{ paddingLeft: "8px", fontWeight: 500 }}>
            <span className="tree-toggle-spacer" />
            <span className="tree-name">{destFolder}</span>
            {selectedPhotos.length > 0 && (
              <span className="tree-count">{selectedPhotos.length}</span>
            )}
          </div>
          {mergedChildren.map((child) => renderNode(child, destFolder || "", 1))}
        </div>
      </div>

      {selectedPhotos.length > 0 && (
        <p className="dest-preview">
          e.g. {previewPath}
        </p>
      )}
    </div>
  );
}
