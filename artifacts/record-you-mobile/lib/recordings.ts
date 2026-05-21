import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

const LOCAL_MAP_KEY = "ry:local-recordings";

export interface LocalRecording {
  songId: number;
  uri: string;
  mimeType: string;
  filename: string;
  bytes: number;
  createdAt: number;
}

type LocalMap = Record<string, LocalRecording>;

async function readMap(): Promise<LocalMap> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_MAP_KEY);
    return raw ? (JSON.parse(raw) as LocalMap) : {};
  } catch {
    return {};
  }
}

async function writeMap(map: LocalMap): Promise<void> {
  await AsyncStorage.setItem(LOCAL_MAP_KEY, JSON.stringify(map));
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

export async function copyRecordingToDevice(
  sourceUri: string,
  songId: number,
  mimeType: string
): Promise<LocalRecording | null> {
  if (Platform.OS === "web") return null;

  const ext = mimeType.includes("m4a") || mimeType.includes("mp4") ? "m4a" : "webm";
  const dir = await ensureDir();
  const filename = `song-${songId}.${ext}`;
  const dest = `${dir}${filename}`;

  try {
    const existing = await FileSystem.getInfoAsync(dest);
    if (existing.exists) {
      await FileSystem.deleteAsync(dest, { idempotent: true });
    }
    await FileSystem.copyAsync({ from: sourceUri, to: dest });

    const info = await FileSystem.getInfoAsync(dest);
    const bytes = info.exists && "size" in info ? (info as { size?: number }).size ?? 0 : 0;

    const record: LocalRecording = {
      songId,
      uri: dest,
      mimeType,
      filename,
      bytes,
      createdAt: Date.now(),
    };

    const map = await readMap();
    map[String(songId)] = record;
    await writeMap(map);

    return record;
  } catch {
    return null;
  }
}

export async function getLocalRecording(
  songId: number
): Promise<LocalRecording | null> {
  if (Platform.OS === "web") return null;
  const map = await readMap();
  const rec = map[String(songId)];
  if (!rec) return null;
  const info = await FileSystem.getInfoAsync(rec.uri);
  if (!info.exists) {
    delete map[String(songId)];
    await writeMap(map);
    return null;
  }
  return rec;
}

export async function deleteLocalRecording(songId: number): Promise<void> {
  if (Platform.OS === "web") return;
  const map = await readMap();
  const rec = map[String(songId)];
  if (rec) {
    await FileSystem.deleteAsync(rec.uri, { idempotent: true });
    delete map[String(songId)];
    await writeMap(map);
  }
}

export async function getAllLocalRecordings(): Promise<LocalRecording[]> {
  if (Platform.OS === "web") return [];
  const map = await readMap();
  return Object.values(map).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getLocalStorageBytes(): Promise<number> {
  const all = await getAllLocalRecordings();
  return all.reduce((sum, r) => sum + (r.bytes ?? 0), 0);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
