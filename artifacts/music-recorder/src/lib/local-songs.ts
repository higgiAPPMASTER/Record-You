const DB_NAME = "ry-local-songs";
const DB_VERSION = 1;
const STORE = "blobs";
const META_KEY = "ry:local-songs";

export interface LocalSong {
  id: string;
  title: string;
  tags: string;
  notes: string;
  duration: number;
  mimeType: string;
  bytes: number;
  waveform: number[] | null;
  createdAt: number;
  updatedAt: number;
  cloudId: number | null;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteBlob(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function readMeta(): LocalSong[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as LocalSong[]) : [];
  } catch {
    return [];
  }
}

function writeMeta(songs: LocalSong[]): void {
  localStorage.setItem(META_KEY, JSON.stringify(songs));
}

function randId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function listLocalSongs(): LocalSong[] {
  return readMeta().sort((a, b) => b.createdAt - a.createdAt);
}

export function getLocalSong(id: string): LocalSong | null {
  return readMeta().find((s) => s.id === id) ?? null;
}

export async function getLocalAudioUrl(id: string): Promise<string | null> {
  const blob = await getBlob(id);
  return blob ? URL.createObjectURL(blob) : null;
}

export async function getLocalBlob(id: string): Promise<Blob | null> {
  return getBlob(id);
}

export interface SaveLocalInput {
  title: string;
  tags: string;
  notes: string;
  duration: number;
  blob: Blob;
  mimeType: string;
  waveform: number[] | null;
}

export async function saveLocalSong(input: SaveLocalInput): Promise<LocalSong> {
  const id = randId();
  await putBlob(id, input.blob);
  const now = Date.now();
  const song: LocalSong = {
    id,
    title: input.title,
    tags: input.tags,
    notes: input.notes,
    duration: input.duration,
    mimeType: input.mimeType,
    bytes: input.blob.size,
    waveform: input.waveform,
    createdAt: now,
    updatedAt: now,
    cloudId: null,
  };
  const songs = readMeta();
  songs.unshift(song);
  writeMeta(songs);
  return song;
}

export function updateLocalSong(
  id: string,
  patch: Partial<Pick<LocalSong, "title" | "tags" | "notes" | "cloudId">>
): LocalSong | null {
  const songs = readMeta();
  const idx = songs.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  songs[idx] = { ...songs[idx], ...patch, updatedAt: Date.now() };
  writeMeta(songs);
  return songs[idx];
}

export async function deleteLocalSong(id: string): Promise<void> {
  await deleteBlob(id).catch(() => {});
  writeMeta(readMeta().filter((s) => s.id !== id));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
