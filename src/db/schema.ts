import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const id = () => text("id").primaryKey().$defaultFn(() => randomUUID());
const ts = (name: string) => integer(name, { mode: "timestamp" });
const now = () => sql`(unixepoch())`;

export const characters = sqliteTable("characters", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  handle: text("handle").notNull(), // örn. @luna.istanbul
  city: text("city").notNull().default("İstanbul"),
  niche: text("niche").notNull(), // moda, güzellik, günlük hayat...
  bio: text("bio").notNull(), // tanıtım sitesinde görünen kısa bio
  personality: text("personality").notNull(), // AI'ın yazım tonunu belirler
  voiceRules: text("voice_rules").notNull().default(""), // imza, emoji alışkanlıkları, yasaklar
  appearance: text("appearance").notNull(), // görsel tutarlılık için sabit tarif
  avatarUrl: text("avatar_url").notNull().default(""),
  language: text("language").notNull().default("tr"),
  instagramUserId: text("instagram_user_id").notNull().default(""),
  // Yüz tutarlılığı: referans fotoğraf (Kontext) ve eğitilmiş LoRA modeli
  referenceImageUrl: text("reference_image_url").notNull().default(""),
  loraTrigger: text("lora_trigger").notNull().default(""),
  loraVersion: text("lora_version").notNull().default(""), // owner/model:versionid
  trainingId: text("training_id").notNull().default(""),
  trainingStatus: text("training_status").notNull().default(""), // starting|processing|succeeded|failed|canceled
  trainingError: text("training_error").notNull().default(""),
  // Ses kimliği (MiniMax Speech): her videoda aynı ses
  voiceId: text("voice_id").notNull().default("Lively_Girl"),
  voiceSpeed: real("voice_speed").notNull().default(1),
  voicePitch: integer("voice_pitch").notNull().default(0),
  voiceEmotion: text("voice_emotion").notNull().default("happy"),
  createdAt: ts("created_at").notNull().default(now()),
  updatedAt: ts("updated_at").notNull().default(now()).$onUpdate(() => new Date()),
});

/** LoRA eğitim seti için üretilen aday görseller */
export const trainingImages = sqliteTable("training_images", {
  id: id(),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  scene: text("scene").notNull().default(""),
  selected: integer("selected", { mode: "boolean" }).notNull().default(true),
  createdAt: ts("created_at").notNull().default(now()),
});

export type PostStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "FAILED";

export const posts = sqliteTable(
  "posts",
  {
    id: id(),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    idea: text("idea").notNull().default(""),
    caption: text("caption").notNull(),
    hashtags: text("hashtags").notNull().default(""),
    imagePrompt: text("image_prompt").notNull().default(""),
    imageUrl: text("image_url").notNull().default(""),
    videoUrl: text("video_url").notNull().default(""), // doluysa Reels olarak paylaşılır
    platform: text("platform").notNull().default("instagram"),
    status: text("status").$type<PostStatus>().notNull().default("DRAFT"),
    scheduledAt: ts("scheduled_at"),
    publishedAt: ts("published_at"),
    externalId: text("external_id").notNull().default(""),
    error: text("error").notNull().default(""),
    createdAt: ts("created_at").notNull().default(now()),
    updatedAt: ts("updated_at").notNull().default(now()).$onUpdate(() => new Date()),
  },
  (t) => [index("posts_status_scheduled_idx").on(t.status, t.scheduledAt)]
);

/**
 * Sahne şablonları: karakterin hazır fotoğrafları (doğrudan video başlangıç karesi)
 * ve senaryo fikirleri (başlangıç karesi LoRA/Kontext ile üretilir).
 */
export const sceneTemplates = sqliteTable(
  "scene_templates",
  {
    id: id(),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    source: text("source").$type<"photo" | "idea">().notNull(),
    title: text("title").notNull(),
    scene: text("scene").notNull(), // İngilizce sahne tarifi
    shot: text("shot").$type<"close" | "medium" | "full">().notNull().default("medium"),
    expression: text("expression").notNull().default(""),
    outfit: text("outfit").notNull().default(""),
    presets: text("presets", { mode: "json" }).$type<string[]>().notNull().default([]),
    talkable: integer("talkable", { mode: "boolean" }).notNull().default(false),
    imageUrl: text("image_url").notNull().default(""), // önizleme / orijinal
    frameUrl: text("frame_url").notNull().default(""), // 9:16 başlangıç karesi (sadece photo)
    createdAt: ts("created_at").notNull().default(now()),
  },
  (t) => [uniqueIndex("scene_templates_char_key").on(t.characterId, t.key)]
);

/** Panelden girilen ayarlar ve API anahtarları (.env değerlerinin önüne geçer) */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: ts("updated_at").notNull().default(now()).$onUpdate(() => new Date()),
});

/** Fotoğraf montajı karesi */
export type MontageSlide = { imageUrl: string; text: string; motion?: string };

/** Günlük işler: belirlenen gün/saatte otomatik içerik üretimi */
export type RoutineType = "reels" | "montage" | "photo";
export const routines = sqliteTable("routines", {
  id: id(),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").$type<RoutineType>().notNull(),
  days: text("days", { mode: "json" }).$type<number[]>().notNull().default([0, 1, 2, 3, 4, 5, 6]), // 0 = Pazar
  time: text("time").notNull().default("09:00"), // üretim saati (İstanbul)
  topics: text("topics").notNull().default(""), // satır satır konu listesi; sırayla kullanılır
  topicIndex: integer("topic_index").notNull().default(0),
  publishMode: text("publish_mode").$type<"draft" | "schedule">().notNull().default("draft"),
  publishTime: text("publish_time").notNull().default("19:00"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastRunDate: text("last_run_date").notNull().default(""),
  lastStatus: text("last_status").notNull().default(""),
  lastMessage: text("last_message").notNull().default(""),
  createdAt: ts("created_at").notNull().default(now()),
});

export const routineRuns = sqliteTable("routine_runs", {
  id: id(),
  routineId: text("routine_id")
    .notNull()
    .references(() => routines.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  topic: text("topic").notNull().default(""),
  status: text("status").notNull(), // started | done | failed
  message: text("message").notNull().default(""),
  reelId: text("reel_id"),
  postId: text("post_id"),
  createdAt: ts("created_at").notNull().default(now()),
});

/** Reels senaryosu ve birleştirilmiş video */
export type ReelShot = {
  kind: "talk" | "action";
  presetId: string;
  scene: string; // görsel/sahne tarifi (İngilizce)
  line: string; // konuşma repliği (Türkçe, sadece talk)
  templateKey?: string; // sahne şablonu (varsa başlangıç karesi oradan gelir)
};

export const reels = sqliteTable("reels", {
  id: id(),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  topic: text("topic").notNull().default(""),
  title: text("title").notNull().default(""),
  hook: text("hook").notNull().default(""), // ilk saniyelerde ekranda yazı
  caption: text("caption").notNull().default(""),
  hashtags: text("hashtags").notNull().default(""),
  kind: text("kind").$type<"ai" | "montage">().notNull().default("ai"),
  shots: text("shots", { mode: "json" }).$type<ReelShot[]>().notNull().default([]),
  slides: text("slides", { mode: "json" }).$type<MontageSlide[]>().notNull().default([]),
  // Hazır olunca otomatik gönderi oluşturma (günlük işler)
  routineId: text("routine_id"),
  publishMode: text("publish_mode").notNull().default("none"), // none | draft | schedule
  publishAt: ts("publish_at"),
  postId: text("post_id"),
  // draft | generating | rendering | ready | failed
  status: text("status").notNull().default("draft"),
  videoUrl: text("video_url").notNull().default(""),
  coverUrl: text("cover_url").notNull().default(""),
  error: text("error").notNull().default(""),
  createdAt: ts("created_at").notNull().default(now()),
});

/** Tek bir video klip üretimi (hareket testi veya reels sahnesi) */
export const clips = sqliteTable(
  "clips",
  {
    id: id(),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    reelId: text("reel_id"),
    shotIndex: integer("shot_index"),
    kind: text("kind").$type<"talk" | "action">().notNull(),
    presetId: text("preset_id").notNull(),
    engine: text("engine").notNull(),
    scene: text("scene").notNull().default(""),
    line: text("line").notNull().default(""),
    startImageUrl: text("start_image_url").notNull().default(""),
    audioUrl: text("audio_url").notNull().default(""),
    prompt: text("prompt").notNull().default(""),
    predictionId: text("prediction_id").notNull().default(""),
    // preparing | starting | running | succeeded | failed
    status: text("status").notNull().default("preparing"),
    videoUrl: text("video_url").notNull().default(""),
    error: text("error").notNull().default(""),
    rating: integer("rating").notNull().default(0), // -1, 0, 1
    createdAt: ts("created_at").notNull().default(now()),
    updatedAt: ts("updated_at").notNull().default(now()).$onUpdate(() => new Date()),
  },
  (t) => [index("clips_reel_idx").on(t.reelId), index("clips_char_preset_idx").on(t.characterId, t.presetId)]
);

export const charactersRelations = relations(characters, ({ many }) => ({
  posts: many(posts),
  trainingImages: many(trainingImages),
}));
export const trainingImagesRelations = relations(trainingImages, ({ one }) => ({
  character: one(characters, { fields: [trainingImages.characterId], references: [characters.id] }),
}));
export const postsRelations = relations(posts, ({ one }) => ({
  character: one(characters, { fields: [posts.characterId], references: [characters.id] }),
}));

export type Character = typeof characters.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type TrainingImage = typeof trainingImages.$inferSelect;

export type Reel = typeof reels.$inferSelect;
export type Clip = typeof clips.$inferSelect;
export type SceneTemplate = typeof sceneTemplates.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type RoutineRun = typeof routineRuns.$inferSelect;
