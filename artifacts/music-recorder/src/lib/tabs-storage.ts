const TABS_KEY = "ry:tabs";

export interface SavedTab {
  id: string;
  title: string;
  artist: string;
  content: string;
  createdAt: number;
}

export function getTabs(): SavedTab[] {
  try {
    return JSON.parse(localStorage.getItem(TABS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveTab(tab: Omit<SavedTab, "id" | "createdAt">): SavedTab {
  const tabs = getTabs();
  const newTab: SavedTab = { ...tab, id: crypto.randomUUID(), createdAt: Date.now() };
  localStorage.setItem(TABS_KEY, JSON.stringify([newTab, ...tabs]));
  return newTab;
}

export function deleteTab(id: string): void {
  const tabs = getTabs().filter((t) => t.id !== id);
  localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
}

export function updateTab(id: string, patch: Partial<Omit<SavedTab, "id" | "createdAt">>): void {
  const tabs = getTabs().map((t) => (t.id === id ? { ...t, ...patch } : t));
  localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
}
