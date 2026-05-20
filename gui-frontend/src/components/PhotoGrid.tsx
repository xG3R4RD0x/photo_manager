import { useMemo } from "react";
import { usePhotoStore, PhotoInfo } from "../stores/usePhotoStore";
import { useUIStore } from "../stores/useUIStore";
import "./PhotoGrid.css";

interface DayGroup {
  day: string;
  expanded: boolean;
  photos: PhotoInfo[];
}

interface DateGroup {
  month: string;
  expanded: boolean;
  days: DayGroup[];
}

export default function PhotoGrid() {
  const photos = usePhotoStore((s) => s.photos);
  const selectedPaths = usePhotoStore((s) => s.selectedPaths);
  const { toggleSelection } = usePhotoStore();
  const { setShowPreviewModal } = useUIStore();

  // Group photos by month > day
  const groupedPhotos = useMemo(() => {
    const groups: Record<string, Record<string, PhotoInfo[]>> = {};

    photos.forEach((photo) => {
      const date = photo.date || "Sin fecha";
      const month = date.substring(0, 7); // YYYY-MM
      const day = date; // YYYY-MM-DD

      if (!groups[month]) groups[month] = {};
      if (!groups[month][day]) groups[month][day] = [];

      groups[month][day].push(photo);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a)) // Newest first
      .map(([month, days]): DateGroup => ({
        month,
        expanded: true,
        days: Object.entries(days)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([day, dayPhotos]): DayGroup => ({
            day,
            expanded: true,
            photos: dayPhotos,
        })),
      }));
  }, [photos]);

  return (
    <div className="photo-grid">
      <div className="grid-header">📸 Photos ({photos.length})</div>
      <div className="grid-content">
        {groupedPhotos.length === 0 ? (
          <p style={{ color: "#666", textAlign: "center", paddingTop: "40px" }}>
            No photos loaded
          </p>
        ) : (
          <div className="grid-groups">
            {groupedPhotos.map((monthGroup) => (
              <div key={monthGroup.month} className="month-group">
                <div className="month-header">📅 {monthGroup.month}</div>

                {monthGroup.days.map((dayGroup) => (
                  <div key={dayGroup.day} className="day-group">
                    <div className="day-header">
                      📅 {dayGroup.day} ({dayGroup.photos.length})
                    </div>

                    <div className="grid-items">
                      {dayGroup.photos.map((photo) => (
                        <div
                          key={photo.path}
                          className={`grid-item ${
                            selectedPaths.has(photo.path) ? "selected" : ""
                          }`}
                          onClick={() => toggleSelection(photo.path)}
                          onDoubleClick={() =>
                            setShowPreviewModal(true, photo.path)
                          }
                        >
                          <div className="thumbnail-placeholder">
                            <span>📷</span>
                          </div>
                          <div className="filename">{photo.filename}</div>
                          <input
                            type="checkbox"
                            className="grid-checkbox"
                            checked={selectedPaths.has(photo.path)}
                            onChange={() => toggleSelection(photo.path)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
