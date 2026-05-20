import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc } from "drizzle-orm";
import { db, songsTable, collaborationsTable } from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });
const objectStorage = new ObjectStorageService();

router.get("/collab/:token", async (req, res) => {
  const { token } = req.params;
  try {
    const [song] = await db.select().from(songsTable).where(eq(songsTable.shareToken, token));
    if (!song) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({
      id: song.id,
      title: song.title,
      hasAudio: !!song.audioObjectPath,
      duration: song.duration ?? null,
      audioUrl: song.audioObjectPath ? `/api/collab/${token}/audio` : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get collab song");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/collab/:token/audio", async (req, res) => {
  const { token } = req.params;
  try {
    const [song] = await db.select().from(songsTable).where(eq(songsTable.shareToken, token));
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
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
      res.setHeader("Content-Length", end - start + 1);
      res.end(buffer.slice(start, end + 1));
    } else {
      res.setHeader("Content-Length", total);
      res.end(buffer);
    }
  } catch (err) {
    req.log.error({ err }, "Failed to stream collab audio");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/collab/:token/tracks", async (req, res) => {
  const { token } = req.params;
  try {
    const [song] = await db.select().from(songsTable).where(eq(songsTable.shareToken, token));
    if (!song) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const tracks = await db
      .select()
      .from(collaborationsTable)
      .where(eq(collaborationsTable.songId, song.id))
      .orderBy(desc(collaborationsTable.createdAt));

    res.json(
      tracks.map((t) => ({
        id: t.id,
        authorName: t.authorName ?? null,
        audioUrl: `/api/collab/${token}/tracks/${t.id}/audio`,
        duration: t.duration ?? null,
        createdAt: t.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list collab tracks");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/collab/:token/tracks", upload.single("audio"), async (req, res) => {
  const { token } = req.params;
  if (!req.file) {
    res.status(400).json({ error: "No audio file provided" });
    return;
  }
  try {
    const [song] = await db.select().from(songsTable).where(eq(songsTable.shareToken, token));
    if (!song) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const authorName = req.body.authorName?.trim() || null;
    const duration = req.body.duration ? Number(req.body.duration) : null;

    const presignedUrl = await objectStorage.getObjectEntityUploadURL();
    const uploadRes = await fetch(presignedUrl, {
      method: "PUT",
      headers: { "Content-Type": req.file.mimetype || "audio/webm" },
      body: req.file.buffer,
    });
    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);

    const normalizedPath = objectStorage.normalizeObjectEntityPath(presignedUrl.split("?")[0]);

    const [collab] = await db
      .insert(collaborationsTable)
      .values({ songId: song.id, audioObjectPath: normalizedPath, authorName, duration })
      .returning();

    res.status(201).json({
      id: collab.id,
      authorName: collab.authorName ?? null,
      audioUrl: `/api/collab/${token}/tracks/${collab.id}/audio`,
      duration: collab.duration ?? null,
      createdAt: collab.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to submit collab track");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/collab/:token/tracks/:id/audio", async (req, res) => {
  const { token } = req.params;
  const collabId = Number(req.params.id);
  try {
    const [song] = await db.select().from(songsTable).where(eq(songsTable.shareToken, token));
    if (!song) { res.status(404).json({ error: "Not found" }); return; }

    const [collab] = await db
      .select()
      .from(collaborationsTable)
      .where(eq(collaborationsTable.id, collabId));
    if (!collab || collab.songId !== song.id) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const file = await objectStorage.getObjectEntityFile(collab.audioObjectPath);
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
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
      res.setHeader("Content-Length", end - start + 1);
      res.end(buffer.slice(start, end + 1));
    } else {
      res.setHeader("Content-Length", total);
      res.end(buffer);
    }
  } catch (err) {
    req.log.error({ err }, "Failed to stream collab track audio");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
