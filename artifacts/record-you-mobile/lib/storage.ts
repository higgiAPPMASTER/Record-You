import AsyncStorage from "@react-native-async-storage/async-storage";

const FAV_KEY = "ry:fav-chords";
const TABS_KEY = "ry:tabs";

export async function getFavourites(): Promise<string[]> {
  try {
    const v = await AsyncStorage.getItem(FAV_KEY);
    return v ? JSON.parse(v) : [];
  } catch {
    return [];
  }
}

export async function toggleFavourite(full: string): Promise<string[]> {
  const favs = await getFavourites();
  const next = favs.includes(full) ? favs.filter((f) => f !== full) : [...favs, full];
  await AsyncStorage.setItem(FAV_KEY, JSON.stringify(next));
  return next;
}

export interface SavedTab {
  id: string;
  title: string;
  artist: string;
  content: string;
  createdAt: number;
}

export async function getTabs(): Promise<SavedTab[]> {
  try {
    const v = await AsyncStorage.getItem(TABS_KEY);
    return v ? JSON.parse(v) : [];
  } catch {
    return [];
  }
}

function randId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function saveTab(tab: Omit<SavedTab, "id" | "createdAt">): Promise<SavedTab> {
  const tabs = await getTabs();
  const newTab: SavedTab = { ...tab, id: randId(), createdAt: Date.now() };
  await AsyncStorage.setItem(TABS_KEY, JSON.stringify([newTab, ...tabs]));
  return newTab;
}

export async function deleteTab(id: string): Promise<void> {
  const tabs = (await getTabs()).filter((t) => t.id !== id);
  await AsyncStorage.setItem(TABS_KEY, JSON.stringify(tabs));
}
