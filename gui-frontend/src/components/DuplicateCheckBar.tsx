import { useUIStore } from "../stores/useUIStore";
import "./DuplicateCheckBar.css";

export default function DuplicateCheckBar() {
  const progress = useUIStore((s) => s.duplicateCheckProgress);

  if (!progress) return null;

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="dup-check-bar">
      <div className="dup-check-bar-inner">
        <div className="dup-check-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="dup-check-label">
        Checking duplicates… {progress.current} / {progress.total}
      </span>
    </div>
  );
}
