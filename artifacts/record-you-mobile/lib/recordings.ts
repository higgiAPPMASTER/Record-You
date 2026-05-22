import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

const SONGS_KEY = "ry:local-songs";

export interface LocalSong {
  id: string;
  title: string;
  tags: string;
  notes: string;
  duration: number;
  uri: string;
  mimeType: string;
  filename: string;
  bytes: number;
  createdAt: number;
  updatedAt: number;
  cloudId: number | null;
}

async function readSongs(): Promise<LocalSong[]> {
  try {
    const raw = await AsyncStorage.getItem(SONGS_KEY);
    return raw ? (JSON.parse(raw) as LocalSong[]) : [];
  } catch {
    return [];
  }
}

async function writeSongs(songs: LocalSong[]): Promise<void> {
  await AsyncStorage.setItem(SONGS_KEY, JSON.stringify(songs));
}

function getRecordingsDir(): string {
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error("No document directory available");
  return `${base}recordings/`;
}

async function ensureDir(): Promise<string> {
  if (Platform.OS === "web") return "";
  const dir = getRecordingsDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

function randId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function listLocalSongs(): Promise<LocalSong[]> {
  const songs = await readSongs();
  return songs.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getLocalSong(id: string): Promise<LocalSong | null> {
  const songs = await readSongs();
  return songs.find((s) => s.id === id) ?? null;
}

export interface SaveSongInput {
  title: string;
  tags: string;
  notes: string;
  duration: number;
  sourceUri: string;
  mimeType: string;
}

export async function saveLocalSong(input: SaveSongInput): Promise<LocalSong> {
  if (Platform.OS === "web") {
    throw new Error("Local storage is not available on web");
  }

  const id = randId();
  const ext = input.mimeType.includes("m4a") || input.mimeType.includes("mp4") ? "m4a" : "aac";
  const dir = await ensureDir();
  const filename = `${id}.${ext}`;
  const dest = `${dir}${filename}`;

  await FileSystem.copyAsync({ from: input.sourceUri, to: dest });

  const info = await FileSystem.getInfoAsync(dest);
  const bytes =
    info.exists && "size" in info ? (info as { size?: number }).size ?? 0 : 0;

  const now = Date.now();
  const song: LocalSong = {
    id,
    title: input.title,
    tags: input.tags,
    notes: input.notes,
    duration: input.duration,
    uri: dest,
    mimeType: input.mimeType,
    filename,
    bytes,
    createdAt: now,
    updatedAt: now,
    cloudId: null,
  };

  const songs = await readSongs();
  songs.unshift(song);
  await writeSongs(songs);
  return song;
}

export async function updateLocalSong(
  id: string,
  patch: Partial<Pick<LocalSong, "title" | "tags" | "notes" | "cloudId">>
): Promise<LocalSong | null> {
  const songs = await readSongs();
  const idx = songs.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  songs[idx] = { ...songs[idx], ...patch, updatedAt: Date.now() };
  await writeSongs(songs);
  return songs[idx];
}

export async function deleteLocalSong(id: string): Promise<void> {
  const songs = await readSongs();
  const song = songs.find((s) => s.id === id);
  if (song) {
    await FileSystem.deleteAsync(song.uri, { idempotent: true }).catch(() => {});
  }
  await writeSongs(songs.filter((s) => s.id !== id));
}

export async function getLocalStorageBytes(): Promise<number> {
  const songs = await readSongs();
  return songs.reduce((sum, s) => sum + (s.bytes ?? 0), 0);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
