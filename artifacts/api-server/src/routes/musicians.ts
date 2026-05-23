import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, musiciansTable, insertMusicianSchema } from "@workspace/db";

const router: IRouter = Router();

function formatMusician(m: typeof musiciansTable.$inferSelect) {
  return {
    id: m.id,
    name: m.name,
    instrument: m.instrument,
    genre: m.genre ?? null,
    city: m.city,
    bio: m.bio ?? null,
    contactEmail: m.contactEmail ?? null,
    lat: m.lat ?? null,
    lng: m.lng ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

// List musicians, optionally filtered by lat/lng/radius
router.get("/musicians", async (req, res) => {
  const { lat, lng, radius } = req.query;
  let rows = await db.select().from(musiciansTable).orderBy(desc(musiciansTable.createdAt));

  // Simple distance filter if coords provided
  if (lat && lng) {
    const userLat = parseFloat(String(lat));
    const userLng = parseFloat(String(lng));
    const km = radius ? parseFloat(String(radius)) : 100;
    rows = rows.filter((m) => {
      if (m.lat == null || m.lng == null) return true; // include if no location set
      const dLat = (m.lat - userLat) * (Math.PI / 180);
      const dLng = (m.lng - userLng) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(userLat * (Math.PI / 180)) * Math.cos(m.lat * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
      const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return dist <= km;
    });
  }

  res.json(rows.map(formatMusician));
});

// Get single musician
router.get("/musicians/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(musiciansTable).where(eq(musiciansTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatMusician(row));
});

// Create musician profile
router.post("/musicians", async (req, res) => {
  const parsed = insertMusicianSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(musiciansTable).values(parsed.data).returning();
  res.status(201).json(formatMusician(row));
});

// Update musician profile
router.patch("/musicians/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const partial = insertMusicianSchema.partial().safeParse(req.body);
  if (!partial.success) { res.status(400).json({ error: partial.error.message }); return; }
  const [row] = await db.update(musiciansTable).set({ ...partial.data, updatedAt: new Date() }).where(eq(musiciansTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatMusician(row));
});

// Delete musician profile
router.delete("/musicians/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(musiciansTable).where(eq(musiciansTable.id, id));
  res.status(204).end();
});

export default router;
