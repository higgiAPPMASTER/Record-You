import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { eq, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, songsTable, communityPostsTable } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.userId = userId;
  next();
}

type SongRow = typeof songsTable.$inferSelect;
type PostRow = typeof communityPostsTable.$inferSelect;

function formatPost(post: PostRow, song: SongRow) {
  const audioUrl = song.audioObjectPath ? `/api/songs/${song.id}/audio` : null;
  return {
    id: post.id,
    songId: post.songId,
    userId: post.userId,
    displayName: post.displayName ?? null,
    note: post.note ?? null,
    visibility: post.visibility,
    listenToken: post.listenToken ?? null,
    title: song.title,
    hasAudio: !!song.audioObjectPath,
    duration: song.duration ?? null,
    audioUrl,
    createdAt: post.createdAt.toISOString(),
  };
}

router.get("/community", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(communityPostsTable)
      .innerJoin(songsTable, eq(communityPostsTable.songId, songsTable.id))
      .where(eq(communityPostsTable.visibility, "public"))
      .orderBy(desc(communityPostsTable.createdAt));
    res.json(rows.map((r) => formatPost(r.community_posts, r.songs)));
  } catch (err) {
    req.log.error({ err }, "Failed to list community posts");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/community/mine", requireAuth, async (req: any, res) => {
  try {
    const rows = await db
      .select()
      .from(communityPostsTable)
      .innerJoin(songsTable, eq(communityPostsTable.songId, songsTable.id))
      .where(eq(communityPostsTable.userId, req.userId))
      .orderBy(desc(communityPostsTable.createdAt));
    res.json(rows.map((r) => formatPost(r.community_posts, r.songs)));
  } catch (err) {
    req.log.error({ err }, "Failed to list my community posts");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/community", requireAuth, async (req: any, res) => {
  const { songId, displayName, note, visibility } = req.body;
  if (!songId || !["public", "friends"].includes(visibility)) {
    return res.status(400).json({ error: "songId and visibility (public|friends) are required" });
  }
  try {
    const songs = await db.select().from(songsTable).where(eq(songsTable.id, Number(songId))).limit(1);
    if (!songs.length) return res.status(404).json({ error: "Song not found" });

    const listenToken = visibility === "friends" ? randomUUID() : null;
    const [post] = await db
      .insert(communityPostsTable)
      .values({ songId: Number(songId), userId: req.userId, displayName: displayName || null, note: note || null, visibility, listenToken })
      .returning();
    res.status(201).json(formatPost(post, songs[0]));
  } catch (err) {
    req.log.error({ err }, "Failed to create community post");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/community/:id", requireAuth, async (req: any, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const posts = await db.select().from(communityPostsTable).where(eq(communityPostsTable.id, id)).limit(1);
    if (!posts.length) return res.status(404).json({ error: "Not found" });
    if (posts[0].userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    await db.delete(communityPostsTable).where(eq(communityPostsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete community post");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/listen/:token", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(communityPostsTable)
      .innerJoin(songsTable, eq(communityPostsTable.songId, songsTable.id))
      .where(eq(communityPostsTable.listenToken, req.params.token))
      .limit(1);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(formatPost(rows[0].community_posts, rows[0].songs));
  } catch (err) {
    req.log.error({ err }, "Failed to get listen post");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
