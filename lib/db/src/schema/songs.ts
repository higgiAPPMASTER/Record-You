import { pgTable, serial, text, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const songsTable = pgTable("songs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  title: text("title").notNull(),
  notes: text("notes"),
  tags: text("tags"),
  duration: real("duration"),
  audioObjectPath: text("audio_object_path"),
  waveformData: text("waveform_data"),
  shareToken: text("share_token").unique(),
  isPublic: boolean("is_public").notNull().default(false),
  seekingHelp: text("seeking_help"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSongSchema = createInsertSchema(songsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSong = z.infer<typeof insertSongSchema>;
export type Song = typeof songsTable.$inferSelect;
