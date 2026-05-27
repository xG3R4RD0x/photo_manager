import { useUIStore } from "../stores/useUIStore";
import { usePhotoStore } from "../stores/usePhotoStore";

import "./Toolbar.css";

export default function Toolbar() {
  const { selectAll, deselectAll } = usePhotoStore();
  const selectedCount = usePhotoStore((s) => s.selectedPaths.size);
  const totalCount = usePhotoStore((s) => s.photos.length);
  const status = useUIStore((s) => s.status);
  return (
    <div className="toolbar">
      <div className="toolbar-center">
        <span>
          {selectedCount} / {totalCount} selected
        </span>
        <button onClick={selectAll}>✓ Select All</button>
        <button onClick={deselectAll}>✗ Deselect All</button>
      </div>
      <div className="toolbar-right">
        <span>{status}</span>
      </div>
    </div>
  );
}
