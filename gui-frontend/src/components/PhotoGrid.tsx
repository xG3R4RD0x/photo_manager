import { useState, useMemo, useEffect } from "react";
import { usePhotoStore, PhotoInfo } from "../stores/usePhotoStore";
import { useUIStore } from "../stores/useUIStore";
import "./PhotoGrid.css";

interface DayGroup {
  day: string;
  photos: PhotoInfo[];
}

interface MonthGroup {
  month: string;
  days: DayGroup[];
}

interface YearGroup {
  year: string;
  months: MonthGroup[];
}

export default function PhotoGrid() {
  const photos = usePhotoStore((s) => s.photos);
  const selectedPaths = usePhotoStore((s) => s.selectedPaths);
  const { toggleSelection, toggleGroup } = usePhotoStore();
  const { setShowPreviewModal } = useUIStore();

  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const groupedPhotos = useMemo(() => {
    const years: Record<string, Record<string, Record<string, PhotoInfo[]>>> = {};

    photos.forEach((photo) => {
      const date = photo.date || "Sin fecha";
      const year = date === "Sin fecha" ? "9999" : date.substring(0, 4);
      const month = date === "Sin fecha" ? "9999-12" : date.substring(0, 7);
      const day = date === "Sin fecha" ? "Sin fecha" : date.substring(0, 10);

      if (!years[year]) years[year] = {};
      if (!years[year][month]) years[year][month] = {};
      if (!years[year][month][day]) years[year][month][day] = [];

      years[year][month][day].push(photo);
    });

    return Object.entries(years)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, months]): YearGroup => ({
        year: year === "9999" ? "Sin fecha" : year,
        months: Object.entries(months)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([month, days]): MonthGroup => ({
            month: month === "9999-12" ? "Sin fecha" : month,
            days: Object.entries(days)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([day, dayPhotos]): DayGroup => ({
                day,
                photos: dayPhotos,
              })),
          })),
      }));
  }, [photos]);

  useEffect(() => {
    setExpandedYears(new Set(groupedPhotos.map((g) => g.year)));
    setExpandedMonths(new Set(groupedPhotos.flatMap((g) => g.months.map((m) => m.month))));
    setExpandedDays(new Set(groupedPhotos.flatMap((g) => g.months.flatMap((m) => m.days.map((d) => d.day)))));
  }, [groupedPhotos]);

  const toggleYear = (year: string) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  const toggleDay = (day: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const yearSelectionState = (yearGroup: YearGroup): "none" | "some" | "all" => {
    const paths = yearGroup.months.flatMap((m) => m.days.flatMap((d) => d.photos.map((p) => p.path)));
    const all = paths.every((p) => selectedPaths.has(p));
    if (all) return "all";
    return paths.some((p) => selectedPaths.has(p)) ? "some" : "none";
  };

  const monthSelectionState = (monthGroup: MonthGroup): "none" | "some" | "all" => {
    const paths = monthGroup.days.flatMap((d) => d.photos.map((p) => p.path));
    const all = paths.every((p) => selectedPaths.has(p));
    if (all) return "all";
    return paths.some((p) => selectedPaths.has(p)) ? "some" : "none";
  };

  const daySelectionState = (dayGroup: DayGroup): "none" | "some" | "all" => {
    const all = dayGroup.photos.every((p) => selectedPaths.has(p.path));
    if (all) return "all";
    return dayGroup.photos.some((p) => selectedPaths.has(p.path)) ? "some" : "none";
  };

  const handleYearCheckbox = (yearGroup: YearGroup) => {
    const paths = yearGroup.months.flatMap((m) => m.days.flatMap((d) => d.photos.map((p) => p.path)));
    toggleGroup(paths);
  };

  const handleMonthCheckbox = (monthGroup: MonthGroup) => {
    const paths = monthGroup.days.flatMap((d) => d.photos.map((p) => p.path));
    toggleGroup(paths);
  };

  const handleDayCheckbox = (dayGroup: DayGroup) => {
    toggleGroup(dayGroup.photos.map((p) => p.path));
  };

  return (
    <div className="photo-grid">
      <div className="grid-header">Photos ({photos.length})</div>
      <div className="grid-content">
        {groupedPhotos.length === 0 ? (
          <p style={{ color: "#666", textAlign: "center", paddingTop: "40px" }}>
            No photos loaded
          </p>
        ) : (
          <div className="grid-groups">
            {groupedPhotos.map((yearGroup) => {
              const yearExpanded = expandedYears.has(yearGroup.year);
              const yState = yearSelectionState(yearGroup);

              return (
                <div key={yearGroup.year} className="year-group">
                  <div className="year-header">
                    <span
                      className="collapse-toggle"
                      onClick={() => toggleYear(yearGroup.year)}
                    >
                      {yearExpanded ? "▼" : "▶"}
                    </span>
                    <span
                      className={`group-select ${yState}`}
                      onClick={() => handleYearCheckbox(yearGroup)}
                    >
                      {yState === "all" ? "✓" : yState === "some" ? "–" : ""}
                    </span>
                    <span
                      className="group-label"
                      onClick={() => toggleYear(yearGroup.year)}
                    >
                      {yearGroup.year}
                    </span>
                    <span className="group-count">
                      {yearGroup.months.reduce((s, m) => s + m.days.reduce((s2, d) => s2 + d.photos.length, 0), 0)}
                    </span>
                  </div>

                  {yearExpanded && (
                    <div className="year-body">
                      {yearGroup.months.map((monthGroup) => {
                        const monthExpanded = expandedMonths.has(monthGroup.month);
                        const mState = monthSelectionState(monthGroup);

                        return (
                          <div key={monthGroup.month} className="month-group">
                            <div className="month-header">
                              <span
                                className="collapse-toggle"
                                onClick={() => toggleMonth(monthGroup.month)}
                              >
                                {monthExpanded ? "▼" : "▶"}
                              </span>
                              <span
                                className={`group-select ${mState}`}
                                onClick={() => handleMonthCheckbox(monthGroup)}
                              >
                                {mState === "all" ? "✓" : mState === "some" ? "–" : ""}
                              </span>
                              <span
                                className="group-label"
                                onClick={() => toggleMonth(monthGroup.month)}
                              >
                                {monthGroup.month}
                              </span>
                              <span className="group-count">
                                {monthGroup.days.reduce((sum, d) => sum + d.photos.length, 0)}
                              </span>
                            </div>

                            {monthExpanded && (
                              <div className="month-body">
                                {monthGroup.days.map((dayGroup) => {
                                  const dayExpanded = expandedDays.has(dayGroup.day);
                                  const dState = daySelectionState(dayGroup);

                                  return (
                                    <div key={dayGroup.day} className="day-group">
                                      <div className="day-header">
                                        <span
                                          className="collapse-toggle"
                                          onClick={() => toggleDay(dayGroup.day)}
                                        >
                                          {dayExpanded ? "▼" : "▶"}
                                        </span>
                                        <span
                                          className={`group-select ${dState}`}
                                          onClick={() => handleDayCheckbox(dayGroup)}
                                        >
                                          {dState === "all" ? "✓" : dState === "some" ? "–" : ""}
                                        </span>
                                        <span
                                          className="group-label"
                                          onClick={() => toggleDay(dayGroup.day)}
                                        >
                                          {dayGroup.day}
                                        </span>
                                        <span className="group-count">
                                          {dayGroup.photos.length}
                                        </span>
                                      </div>

                                      {dayExpanded && (
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
                                              <div className="thumbnail-placeholder" />
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
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
