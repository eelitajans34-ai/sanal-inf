import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ensureSettings } from "@/lib/config";

export async function loadCharacter(id: unknown) {
  await ensureSettings();
  if (typeof id !== "string" || !id) return null;
  return (await db.query.characters.findFirst({ where: eq(schema.characters.id, id) })) ?? null;
}

export function apiError(e: unknown, status = 500) {
  const message = e instanceof Error ? e.message : String(e);
  console.error(message);
  return NextResponse.json({ error: message }, { status });
}
