import { pgTable, serial, integer, text, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { songsTable } from "./songs";

export const takesTable = pgTable(
  "takes",
  {
    id: serial("id").primaryKey(),
    songId: integer("song_id")
      .notNull()
      .references(() => songsTable.id, { onDelete: "cascade" }),
    author: text("author").notNull(),
    audioObjectPath: text("audio_object_path").notNull(),
    duration: real("duration"),
    waveformData: text("waveform_data"),
    offsetMs: integer("offset_ms").notNull().default(0),
    volume: real("volume").notNull().default(1),
    pan: real("pan").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("takes_song_id_idx").on(t.songId)],
);

export const insertTakeSchema = createInsertSchema(takesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertTake = z.infer<typeof insertTakeSchema>;
export type Take = typeof takesTable.$inferSelect;
