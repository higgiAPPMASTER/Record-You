import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc, sum, count, and, gte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, songsTable, collaborationsTable } from "@workspace/db";
import {
  CreateSongBody,
  UpdateSongBody,
  UpdateSongParams,
  GetSongParams,
  DeleteSongParams,
} from "@workspace/api-zod";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });
const objectStorage = new ObjectStorageService();

function formatSong(song: typeof songsTable.$inferSelect) {
  const audioUrl = song.audioObjectPath
    ? `/api/songs/${song.id}/audio`
    : null;
  let waveformData: number[] | null = null;
  if (song.waveformData) {
    try { waveformData = JSON.parse(song.waveformData); } catch { /* ignore */ }
  }
  return {
    id: song.id,
    title: song.title,
    notes: song.notes ?? null,
    tags: song.tags ?? null,
    duration: song.duration ?? null,
    audioUrl,
    hasAudio: !!song.audioObjectPath,
    waveformData,
    isPublic: song.isPublic,
    seekingHelp: song.seekingHelp ?? null,
    shareToken: song.shareToken ?? null,
    createdAt: song.createdAt.toISOString(),
    updatedAt: song.updatedAt.toISOString(),
  };
}

router.get("/songs", async (req, res) => {
  try {
    const songs = await db
      .select()
      .from(songsTable)
      .orderBy(desc(songsTable.createdAt));
    res.json(songs.map((s) => formatSong(s)));
  } catch (err) {
    req.log.error({ err }, "Failed to list songs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/songs", async (req, res) => {
  const parsed = CreateSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [song] = await db
      .insert(songsTable)
      .values({
        title: parsed.data.title,
        notes: parsed.data.notes ?? null,
        tags: parsed.data.tags ?? null,
      })
      .returning();
    res.status(201).json(formatSong(song));
  } catch (err) {
    req.log.error({ err }, "Failed to create song");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/songs/stats", async (req, res) => {
  try {
    const [stats] = await db
      .select({
        totalSongs: count(),
        totalDuration: sum(songsTable.duration),
        songsWithAudio: count(songsTable.audioObjectPath),
      })
      .from(songsTable);

    const recentSongs = await db
      .select()
      .from(songsTable)
      .orderBy(desc(songsTable.createdAt))
      .limit(5);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [collabStats] = await db
      .select({ recentCollabs: count() })
      .from(collaborationsTable)
      .innerJoin(songsTable, eq(collaborationsTable.songId, songsTable.id))
      .where(gte(collaborationsTable.createdAt, sevenDaysAgo));

    res.json({
      totalSongs: stats.totalSongs ?? 0,
      totalDuration: Number(stats.totalDuration ?? 0),
      songsWithAudio: stats.songsWithAudio ?? 0,
      recentSongs: recentSongs.map((s) => formatSong(s)),
      recentCollabs: Number(collabStats?.recentCollabs ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get song stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/songs/:id", async (req, res) => {
  const parsed = GetSongParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [song] = await db
      .select()
      .from(songsTable)
      .where(eq(songsTable.id, parsed.data.id));
    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }
    res.json(formatSong(song));
  } catch (err) {
    req.log.error({ err }, "Failed to get song");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/songs/:id", async (req, res) => {
  const parsedParams = UpdateSongParams.safeParse({ id: Number(req.params.id) });
  const parsedBody = UpdateSongBody.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const [updated] = await db
      .update(songsTable)
      .set({
        ...(parsedBody.data.title !== undefined && { title: parsedBody.data.title }),
        ...(parsedBody.data.notes !== undefined && { notes: parsedBody.data.notes }),
        ...(parsedBody.data.tags !== undefined && { tags: parsedBody.data.tags }),
        updatedAt: new Date(),
      })
      .where(eq(songsTable.id, parsedParams.data.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Song not found" });
      return;
    }
    res.json(formatSong(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update song");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/songs/:id", async (req, res) => {
  const parsed = DeleteSongParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(songsTable)
      .where(eq(songsTable.id, parsed.data.id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Song not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete song");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/songs/:id/share", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [song] = await db.select().from(songsTable).where(eq(songsTable.id, id));
    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }
    let token = song.shareToken;
    if (!token) {
      token = randomUUID().replace(/-/g, "");
      await db.update(songsTable).set({ shareToken: token, updatedAt: new Date() }).where(eq(songsTable.id, id));
    }
    const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = (req.headers["x-forwarded-host"] as string) || (req.headers.host as string) || "localhost";
    const shareUrl = `${protocol}://${host}/collab/${token}`;
    res.json({ shareToken: token, shareUrl });
  } catch (err) {
    req.log.error({ err }, "Failed to share song");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/songs/:id/publish", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { isPublic, seekingHelp } = req.body as { isPublic?: boolean; seekingHelp?: string };
  if (typeof isPublic !== "boolean") { res.status(400).json({ error: "isPublic (boolean) required" }); return; }
  try {
    const [song] = await db.select().from(songsTable).where(eq(songsTable.id, id));
    if (!song) { res.status(404).json({ error: "Song not found" }); return; }

    // Ensure a shareToken exists when publishing
    let token = song.shareToken;
    if (isPublic && !token) {
      token = randomUUID().replace(/-/g, "");
    }

    const [updated] = await db
      .update(songsTable)
      .set({
        isPublic,
        seekingHelp: seekingHelp?.trim() || null,
        ...(token && !song.shareToken ? { shareToken: token } : {}),
        updatedAt: new Date(),
      })
      .where(eq(songsTable.id, id))
      .returning();

    res.json(formatSong(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update publish status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/sessions", async (req, res) => {
  try {
    const songs = await db
      .select()
      .from(songsTable)
      .where(eq(songsTable.isPublic, true))
      .orderBy(desc(songsTable.updatedAt));

    const results = await Promise.all(
      songs.map(async (song) => {
        const [{ collabCount }] = await db
          .select({ collabCount: count() })
          .from(collaborationsTable)
          .where(eq(collaborationsTable.songId, song.id));
        return {
          id: song.id,
          title: song.title,
          hasAudio: !!song.audioObjectPath,
          isPublic: song.isPublic,
          seekingHelp: song.seekingHelp ?? null,
          duration: song.duration ?? null,
          collabCount: Number(collabCount ?? 0),
          shareToken: song.shareToken!,
          audioUrl: song.audioObjectPath ? `/api/songs/${song.id}/audio` : null,
          createdAt: song.createdAt.toISOString(),
        };
      })
    );

    res.json(results);
  } catch (err) {
    req.log.error({ err }, "Failed to list sessions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/songs/:id/audio", upload.single("audio"), async (req, res) => {
  const id = Number(req.params.id);
  if (!req.file) {
    res.status(400).json({ error: "No audio file provided" });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(songsTable)
      .where(eq(songsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    const duration = req.body.duration ? Number(req.body.duration) : null;
    const waveformRaw = req.body.waveform ?? null;
    let waveformData: string | null = null;
    if (waveformRaw) {
      try {
        const parsed = JSON.parse(waveformRaw);
        if (Array.isArray(parsed)) waveformData = JSON.stringify(parsed);
      } catch { /* ignore */ }
    }

    const presignedUrl = await objectStorage.getObjectEntityUploadURL();

    const uploadRes = await fetch(presignedUrl, {
      method: "PUT",
      headers: { "Content-Type": req.file.mimetype || "audio/webm" },
      body: req.file.buffer,
    });

    if (!uploadRes.ok) {
      throw new Error(`GCS upload failed: ${uploadRes.status}`);
    }

    const normalizedPath = objectStorage.normalizeObjectEntityPath(presignedUrl.split("?")[0]);

    const [updated] = await db
      .update(songsTable)
      .set({
        audioObjectPath: normalizedPath,
        ...(duration !== null && { duration }),
        ...(waveformData !== null && { waveformData }),
        updatedAt: new Date(),
      })
      .where(eq(songsTable.id, id))
      .returning();

    res.json(formatSong(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to upload audio");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/songs/:id/audio", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [song] = await db
      .select()
      .from(songsTable)
      .where(eq(songsTable.id, id));
    if (!song || !song.audioObjectPath) {
      res.status(404).json({ error: "Audio not found" });
      return;
    }
    const file = await objectStorage.getObjectEntityFile(song.audioObjectPath);
    const response = await objectStorage.downloadObject(file);
    const contentType = response.headers.get("content-type") ?? "audio/webm";
    const buffer = Buffer.from(await response.arrayBuffer());
    const total = buffer.length;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=3600");

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const parts = rangeHeader.replace("bytes=", "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
      res.setHeader("Content-Length", chunkSize);
      res.end(buffer.slice(start, end + 1));
    } else {
      res.setHeader("Content-Length", total);
      res.end(buffer);
    }
  } catch (err) {
    req.log.error({ err }, "Failed to stream audio");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
