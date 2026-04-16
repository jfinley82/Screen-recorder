import {
  mysqlTable,
  int,
  varchar,
  text,
  mysqlEnum,
  timestamp,
  boolean,
  json,
  index,
} from "drizzle-orm/mysql-core";

export const recordings = mysqlTable(
  "recordings",
  {
    id: int().autoincrement().primaryKey(),
    title: varchar({ length: 255 }).default("Untitled Recording").notNull(),
    status: mysqlEnum(["uploading", "processing", "ready", "error"])
      .default("uploading")
      .notNull(),

    // Storage
    s3Key: varchar("s3_key", { length: 1024 }),
    s3Bucket: varchar("s3_bucket", { length: 255 }),

    // Mux
    muxAssetId: varchar("mux_asset_id", { length: 255 }),
    muxPlaybackId: varchar("mux_playback_id", { length: 255 }),
    muxUploadId: varchar("mux_upload_id", { length: 255 }),

    // Video metadata
    duration: int(), // seconds
    width: int(),
    height: int(),

    // Editor state (stored in milliseconds)
    trimStart: int("trim_start").default(0).notNull(),
    trimEnd: int("trim_end"),
    annotations: json("annotations").$type<object[]>().default([]),
    chapters: json("chapters").$type<object[]>().default([]),
    overlays: json("overlays").$type<object[]>().default([]),

    // Sharing
    shareToken: varchar("share_token", { length: 64 }),
    isPublic: boolean("is_public").default(false).notNull(),
    viewCount: int("view_count").default(0).notNull(),
    password: varchar({ length: 255 }),

    // Transcription
    transcriptStatus: mysqlEnum("transcript_status", ["none", "processing", "ready"])
      .default("none")
      .notNull(),
    transcript: json("transcript").$type<object[]>(),

    // AI
    aiSummary: text("ai_summary"),
    aiSuggestions: json("ai_suggestions").$type<object[]>(),

    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("recordings_status_idx").on(table.status),
    index("recordings_share_token_idx").on(table.shareToken),
    index("recordings_created_at_idx").on(table.createdAt),
  ]
);
