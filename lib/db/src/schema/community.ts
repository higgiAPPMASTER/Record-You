import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { songsTable } from "./songs";

export const communityPostsTable = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").notNull().references(() => songsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  displayName: text("display_name"),
  note: text("note"),
  visibility: text("visibility").notNull().default("public"),
  listenToken: text("listen_token").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CommunityPost = typeof communityPostsTable.$inferSelect;
