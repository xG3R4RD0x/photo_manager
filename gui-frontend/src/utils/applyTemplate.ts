const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function applyTemplate(template: string, dateStr: string): string {
  const cleaned = dateStr.substring(0, 10);
  const parts = cleaned.split("-");
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  const monthNum = parseInt(month, 10) - 1;

  let result = template;

  result = result.replaceAll("YYYY", year);
  result = result.replaceAll("MM", month);
  result = result.replaceAll("DD", day);
  result = result.replaceAll("YY", year.slice(-2));
  result = result.replaceAll("MONTH", MONTH_NAMES_EN[monthNum]);
  result = result.replaceAll("MONTH_EN", MONTH_NAMES_EN[monthNum]);
  result = result.replaceAll("MONTH_ES", MONTH_NAMES_ES[monthNum]);
  result = result.replaceAll("YYYY-MM-DD", `${year}-${month}-${day}`);
  result = result.replaceAll("YYYYMMDD", `${year}${month}${day}`);

  return result.replace(/\/+$/, "");
}

export function buildDestinationTree(
  photos: { path: string; date: string | null }[],
  template: string,
): TreeNode {
  const pathCounts: Record<string, number> = {};

  for (const photo of photos) {
    const relPath = photo.date ? applyTemplate(template, photo.date) : "SinFecha";
    const normalized = relPath.replace(/^\/+|\/+$/g, "");
    pathCounts[normalized] = (pathCounts[normalized] || 0) + 1;
  }

  const treeMap: Record<string, { _count: number; _children: Record<string, any> }> = {};

  for (const [path, count] of Object.entries(pathCounts)) {
    const segments = path.split("/");
    let level: Record<string, any> = treeMap;
    for (let i = 0; i < segments.length; i++) {
      if (!level[segments[i]]) {
        level[segments[i]] = { _count: 0, _children: {} };
      }
      level[segments[i]]._count += count;
      if (i < segments.length - 1) {
        level = level[segments[i]]._children;
      }
    }
  }

  function toTreeNodes(
    obj: Record<string, any>,
  ): TreeNode[] {
    return Object.entries(obj)
      .filter(([k]) => !k.startsWith("_"))
      .map(([name, data]) => ({
        name,
        count: data._count,
        isNew: true,
        children: toTreeNodes(data._children),
      }));
  }

  return {
    name: "",
    count: photos.length,
    isNew: false,
    children: toTreeNodes(treeMap),
  };
}

export interface TreeNode {
  name: string;
  count: number;
  isNew: boolean;
  children: TreeNode[];
}

export interface DirEntry {
  name: string;
  children: DirEntry[];
}

export function dirEntryToNode(entry: DirEntry, isNew: boolean = false): TreeNode {
  return {
    name: entry.name,
    count: 0,
    isNew,
    children: entry.children.map((c) => dirEntryToNode(c, false)),
  };
}

export function mergeTrees(real: TreeNode[], projected: TreeNode[]): TreeNode[] {
  const realMap = new Map(real.map((r) => [r.name, r]));
  const seen = new Set<string>();
  const result: TreeNode[] = [];

  for (const p of projected) {
    const r = realMap.get(p.name);
    seen.add(p.name);
    if (r) {
      result.push({
        name: p.name,
        count: p.count,
        isNew: false,
        children: mergeTrees(r.children, p.children),
      });
    } else {
      result.push({ ...p, isNew: true });
    }
  }

  for (const r of real) {
    if (!seen.has(r.name)) {
      result.push({ ...r, count: 0, isNew: false });
    }
  }

  result.sort((a, b) => {
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}
