import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const musiciansTable = pgTable("musicians", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  instrument: text("instrument").notNull(),
  genre: text("genre"),
  city: text("city").notNull(),
  bio: text("bio"),
  contactEmail: text("contact_email"),
  lat: real("lat"),
  lng: real("lng"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMusicianSchema = createInsertSchema(musiciansTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMusician = z.infer<typeof insertMusicianSchema>;
export type Musician = typeof musiciansTable.$inferSelect;
