import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { SceneTemplate } from "@/db/schema";

const { sceneTemplates } = schema;

export async function listTemplates(characterId: string): Promise<SceneTemplate[]> {
  return db.query.sceneTemplates.findMany({
    where: eq(sceneTemplates.characterId, characterId),
    orderBy: [asc(sceneTemplates.source), asc(sceneTemplates.createdAt)],
  });
}

export async function templateByKey(characterId: string, key?: string | null) {
  if (!key) return null;
  return (
    (await db.query.sceneTemplates.findFirst({
      where: and(eq(sceneTemplates.characterId, characterId), eq(sceneTemplates.key, key)),
    })) ?? null
  );
}

/** Şablonun hazır 9:16 başlangıç karesi (yalnızca fotoğraf şablonları). */
export const templateFrame = (t: SceneTemplate | null) => (t && t.source === "photo" && t.frameUrl ? t.frameUrl : "");

/** İstemciye gönderilecek sade biçim. */
export const templateOption = (t: SceneTemplate) => ({
  key: t.key,
  source: t.source,
  title: t.title,
  scene: t.scene,
  shot: t.shot,
  expression: t.expression,
  presets: t.presets,
  talkable: t.talkable,
  imageUrl: t.imageUrl,
  frameUrl: t.frameUrl,
});
export type TemplateOption = ReturnType<typeof templateOption>;
