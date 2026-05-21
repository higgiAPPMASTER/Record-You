import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, and, asc } from "drizzle-orm";
import { db, takesTable, songsTable } from "@workspace/db";
import { UpdateTakeBody } from "@workspace/api-zod";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const objectStorage = new ObjectStorageService();

function formatTake(t: typeof takesTable.$inferSelect) {
  let waveformData: number[] | null = null;
  if (t.waveformData) {
    try { waveformData = JSON.parse(t.waveformData); } catch { /* ignore */ }
  }
  return {
    id: t.id,
    songId: t.songId,
    author: t.author,
    audioUrl: `/api/songs/${t.songId}/takes/${t.id}/audio`,
    duration: t.duration ?? null,
    waveformData,
    offsetMs: t.offsetMs,
    volume: t.volume,
    pan: t.pan,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/songs/:id/takes", async (req, res) => {
  const songId = Number(req.params.id);
  if (!Number.isFinite(songId)) {
    res.status(400).json({ error: "Invalid song id" });
    return;
  }
  try {
    const rows = await db
      .select()
      .from(takesTable)
      .where(eq(takesTable.songId, songId))
      .orderBy(asc(takesTable.createdAt));
    res.json(rows.map(formatTake));
  } catch (err) {
    req.log.error({ err }, "Failed to list takes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/songs/:id/takes", upload.single("audio"), async (req, res) => {
  const songId = Number(req.params.id);
  if (!Number.isFinite(songId)) {
    res.status(400).json({ error: "Invalid song id" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "No audio file" });
    return;
  }
  const author = String(req.body.author ?? "").trim().slice(0, 60);
  if (!author) {
    res.status(400).json({ error: "Author required" });
    return;
  }
  try {
    const [song] = await db
      .select({ id: songsTable.id })
      .from(songsTable)
      .where(eq(songsTable.id, songId));
    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    const duration = req.body.duration ? Number(req.body.duration) : null;
    let waveformData: string | null = null;
    if (req.body.waveform) {
      try {
        const parsed = JSON.parse(req.body.waveform);
        if (Array.isArray(parsed)) waveformData = JSON.stringify(parsed);
      } catch { /* ignore */ }
    }

    const presignedUrl = await objectStorage.getObjectEntityUploadURL();
    const uploadRes = await fetch(presignedUrl, {
      method: "PUT",
      headers: { "Content-Type": req.file.mimetype || "audio/webm" },
      body: req.file.buffer,
    });
    if (!uploadRes.ok) throw new Error(`GCS upload failed: ${uploadRes.status}`);
    const normalizedPath = objectStorage.normalizeObjectEntityPath(presignedUrl.split("?")[0]);

    const [created] = await db
      .insert(takesTable)
      .values({
        songId,
        author,
        audioObjectPath: normalizedPath,
        duration: duration ?? undefined,
        waveformData: waveformData ?? undefined,
      })
      .returning();
    res.status(201).json(formatTake(created));
  } catch (err) {
    req.log.error({ err }, "Failed to upload take");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/songs/:songId/takes/:takeId", async (req, res) => {
  const songId = Number(req.params.songId);
  const takeId = Number(req.params.takeId);
  if (!Number.isFinite(songId) || !Number.isFinite(takeId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateTakeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [updated] = await db
      .update(takesTable)
      .set({
        ...(parsed.data.volume !== undefined && { volume: parsed.data.volume }),
        ...(parsed.data.pan !== undefined && { pan: parsed.data.pan }),
        ...(parsed.data.offsetMs !== undefined && { offsetMs: parsed.data.offsetMs }),
      })
      .where(and(eq(takesTable.id, takeId), eq(takesTable.songId, songId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Take not found" });
      return;
    }
    res.json(formatTake(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update take");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/songs/:songId/takes/:takeId", async (req, res) => {
  const songId = Number(req.params.songId);
  const takeId = Number(req.params.takeId);
  try {
    const [deleted] = await db
      .delete(takesTable)
      .where(and(eq(takesTable.id, takeId), eq(takesTable.songId, songId)))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Take not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete take");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/songs/:songId/takes/:takeId/audio", async (req, res) => {
  const songId = Number(req.params.songId);
  const takeId = Number(req.params.takeId);
  try {
    const [take] = await db
      .select()
      .from(takesTable)
      .where(and(eq(takesTable.id, takeId), eq(takesTable.songId, songId)));
    if (!take) {
      res.status(404).json({ error: "Take not found" });
      return;
    }
    const file = await objectStorage.getObjectEntityFile(take.audioObjectPath);
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
    req.log.error({ err }, "Failed to stream take audio");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
