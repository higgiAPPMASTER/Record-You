import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, commentsTable, songsTable } from "@workspace/db";
import { CreateCommentBody } from "@workspace/api-zod";

const router: IRouter = Router();

function formatComment(c: typeof commentsTable.$inferSelect) {
  return {
    id: c.id,
    songId: c.songId,
    author: c.author,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/songs/:id/comments", async (req, res) => {
  const songId = Number(req.params.id);
  if (!Number.isFinite(songId)) {
    res.status(400).json({ error: "Invalid song id" });
    return;
  }
  try {
    const rows = await db
      .select()
      .from(commentsTable)
      .where(eq(commentsTable.songId, songId))
      .orderBy(asc(commentsTable.createdAt));
    res.json(rows.map(formatComment));
  } catch (err) {
    req.log.error({ err }, "Failed to list comments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/songs/:id/comments", async (req, res) => {
  const songId = Number(req.params.id);
  if (!Number.isFinite(songId)) {
    res.status(400).json({ error: "Invalid song id" });
    return;
  }
  const parsed = CreateCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
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
    const [created] = await db
      .insert(commentsTable)
      .values({
        songId,
        author: parsed.data.author.trim().slice(0, 60),
        body: parsed.data.body.trim().slice(0, 2000),
      })
      .returning();
    res.status(201).json(formatComment(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create comment");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
