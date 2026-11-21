import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
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
