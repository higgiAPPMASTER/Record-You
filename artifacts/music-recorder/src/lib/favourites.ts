const FAV_KEY = "ry:fav-chords";

export function getFavourites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function toggleFavourite(full: string): string[] {
  const favs = getFavourites();
  const next = favs.includes(full)
    ? favs.filter((f) => f !== full)
    : [...favs, full];
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  return next;
}
