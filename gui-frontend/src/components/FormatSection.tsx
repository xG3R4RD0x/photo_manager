import { useUIStore } from "../stores/useUIStore";

const TEMPLATES = [
  "YYYY/YYYY-MM-DD/",
  "YYYY/MM/DD/",
  "YYYY/MM/",
  "YYYY-MM-DD/",
  "YYYY/",
  "YYYY-MMMM/YYYY-MM-DD/",
];

export default function FormatSection() {
  const { selectedTemplate, setSelectedTemplate } = useUIStore();

  // Generate preview for today
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  let preview = selectedTemplate;
  preview = preview.replace("YYYY", String(year));
  preview = preview.replace("MM", month);
  preview = preview.replace("DD", day);
  preview = preview.replace("YY", String(year).slice(-2));
  preview = preview.replace("MONTH", "Mayo");
  preview = preview.replace("YYYYMMDD", `${year}${month}${day}`);
  preview = preview.replace("YYYY-MM-DD", `${year}-${month}-${day}`);
  preview = preview.replace("MMMM", "Mayo");

  return (
    <div className="format-section">
      <h3>💾 Save Format</h3>
      <select
        value={selectedTemplate}
        onChange={(e) => setSelectedTemplate(e.target.value)}
        style={{ width: "100%" }}
      >
        {TEMPLATES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <div style={{ marginTop: "8px", fontSize: "12px", color: "#888" }}>
        Preview: {preview}
      </div>
    </div>
  );
}
