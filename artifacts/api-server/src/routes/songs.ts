import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc, sum, count } from "drizzle-orm";
import { db, songsTable } from "@workspace/db";
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
  return {
    id: song.id,
    title: song.title,
    notes: song.notes ?? null,
    tags: song.tags ?? null,
    duration: song.duration ?? null,
    audioUrl,
    hasAudio: !!song.audioObjectPath,
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

    res.json({
      totalSongs: stats.totalSongs ?? 0,
      totalDuration: Number(stats.totalDuration ?? 0),
      songsWithAudio: stats.songsWithAudio ?? 0,
      recentSongs: recentSongs.map((s) => formatSong(s)),
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
