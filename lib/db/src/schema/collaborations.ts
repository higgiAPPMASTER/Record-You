import { pgTable, serial, text, real, timestamp, integer } from "drizzle-orm/pg-core";
import { songsTable } from "./songs";

export const collaborationsTable = pgTable("collaborations", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").notNull().references(() => songsTable.id, { onDelete: "cascade" }),
  audioObjectPath: text("audio_object_path").notNull(),
  authorName: text("author_name"),
  duration: real("duration"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Collaboration = typeof collaborationsTable.$inferSelect;
