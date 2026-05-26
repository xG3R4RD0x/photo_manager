import { useState, useMemo, useEffect } from "react";
import { usePhotoStore, PhotoInfo } from "../stores/usePhotoStore";
import { useUIStore } from "../stores/useUIStore";
import { useThumbnailGenerator } from "../hooks/useThumbnailGenerator";
import { useThumbnail } from "../hooks/useThumbnail";
import ThumbnailLoader from "./ThumbnailLoader";
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

/**
 * PhotoGridItem
 * 
 * Individual photo item with thumbnail loader
 */
interface PhotoGridItemProps {
  photo: PhotoInfo;
  isSelected: boolean;
  isDuplicate: boolean;
  isInspected: boolean;
  onToggleSelection: (path: string) => void;
  onInspect: (path: string) => void;
  onDoubleClick: (path: string) => void;
}

function PhotoGridItem({
  photo,
  isSelected,
  isDuplicate,
  isInspected,
  onToggleSelection,
  onInspect,
  onDoubleClick,
}: PhotoGridItemProps) {
  const { thumbnail, isLoading, isFailed } = useThumbnail(photo.path);

  return (
    <ThumbnailLoader photoPath={photo.path}>
      <div
        className={`grid-item ${isSelected ? "selected" : ""} ${
          isDuplicate ? "duplicate" : ""
        } ${isInspected ? "inspected" : ""}`}
        onClick={() => onInspect(photo.path)}
        onDoubleClick={() => onDoubleClick(photo.path)}
        data-photo-path={photo.path}
      >
        <div className="thumbnail-container">
          {thumbnail ? (
            <img src={thumbnail} alt={photo.filename} className="thumbnail-image" />
          ) : isLoading ? (
            <div className="thumbnail-placeholder thumbnail-placeholder--loading">
              <div className="spinner"></div>
            </div>
          ) : isFailed ? (
            <div className="thumbnail-placeholder thumbnail-placeholder--failed" title="Failed to load thumbnail" />
          ) : (
            <div className="thumbnail-placeholder" />
          )}
        </div>
        <div className="filename">{photo.filename}</div>
        {!isDuplicate && (
          <input
            type="checkbox"
            className="grid-checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(photo.path)}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </ThumbnailLoader>
  );
}

export default function PhotoGrid() {
  const photos = usePhotoStore((s) => s.photos);
  const selectedPaths = usePhotoStore((s) => s.selectedPaths);
  const duplicatePaths = usePhotoStore((s) => s.duplicatePaths);
  const inspectedPath = usePhotoStore((s) => s.inspectedPath);
  const { toggleSelection, toggleGroup, setInspectedPath } = usePhotoStore();
  const { setShowPreviewModal } = useUIStore();

  // Initialize thumbnail generation system
  useThumbnailGenerator();

  const isDup = (path: string) => duplicatePaths.has(path);
  const nonDups = (paths: string[]) => paths.filter((p) => !isDup(p));

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

  const yearPaths = (yearGroup: YearGroup) =>
    yearGroup.months.flatMap((m) => m.days.flatMap((d) => d.photos.map((p) => p.path)));
  const monthPaths = (monthGroup: MonthGroup) =>
    monthGroup.days.flatMap((d) => d.photos.map((p) => p.path));

  const yearSelectionState = (yearGroup: YearGroup): "none" | "some" | "all" => {
    const paths = yearPaths(yearGroup);
    if (paths.length === 0) return "none";
    const all = paths.every((p) => selectedPaths.has(p));
    if (all) return "all";
    return paths.some((p) => selectedPaths.has(p)) ? "some" : "none";
  };

  const monthSelectionState = (monthGroup: MonthGroup): "none" | "some" | "all" => {
    const paths = monthPaths(monthGroup);
    if (paths.length === 0) return "none";
    const all = paths.every((p) => selectedPaths.has(p));
    if (all) return "all";
    return paths.some((p) => selectedPaths.has(p)) ? "some" : "none";
  };

  const daySelectionState = (dayGroup: DayGroup): "none" | "some" | "all" => {
    const paths = dayGroup.photos.map((p) => p.path);
    if (paths.length === 0) return "none";
    const all = paths.every((p) => selectedPaths.has(p));
    if (all) return "all";
    return paths.some((p) => selectedPaths.has(p)) ? "some" : "none";
  };

  const handleYearCheckbox = (yearGroup: YearGroup) => {
    toggleGroup(nonDups(yearPaths(yearGroup)));
  };

  const handleMonthCheckbox = (monthGroup: MonthGroup) => {
    toggleGroup(nonDups(monthPaths(monthGroup)));
  };

  const handleDayCheckbox = (dayGroup: DayGroup) => {
    toggleGroup(nonDups(dayGroup.photos.map((p) => p.path)));
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
                    {nonDups(yearPaths(yearGroup)).length > 0 && (
                      <span
                        className={`group-select ${yState}`}
                        onClick={() => handleYearCheckbox(yearGroup)}
                      >
                        {yState === "all" ? "✓" : yState === "some" ? "–" : ""}
                      </span>
                    )}
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
                              {nonDups(monthPaths(monthGroup)).length > 0 && (
                              <span
                                className={`group-select ${mState}`}
                                onClick={() => handleMonthCheckbox(monthGroup)}
                              >
                                {mState === "all" ? "✓" : mState === "some" ? "–" : ""}
                              </span>
                            )}
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
                                        {nonDups(dayGroup.photos.map((p) => p.path)).length > 0 && (
                                          <span
                                            className={`group-select ${dState}`}
                                            onClick={() => handleDayCheckbox(dayGroup)}
                                          >
                                            {dState === "all" ? "✓" : dState === "some" ? "–" : ""}
                                          </span>
                                        )}
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
                                           {dayGroup.photos.map((photo) => {
                                             const dup = isDup(photo.path);
                                             return (
                                                <PhotoGridItem
                                                  key={photo.path}
                                                  photo={photo}
                                                  isSelected={selectedPaths.has(photo.path)}
                                                  isDuplicate={dup}
                                                  isInspected={inspectedPath === photo.path}
                                                  onToggleSelection={toggleSelection}
                                                  onInspect={setInspectedPath}
                                                  onDoubleClick={(path) =>
                                                    setShowPreviewModal(true, path)
                                                  }
                                                />
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
