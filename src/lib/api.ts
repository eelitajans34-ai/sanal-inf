import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export async function loadCharacter(id: unknown) {
  if (typeof id !== "string" || !id) return null;
  return (await db.query.characters.findFirst({ where: eq(schema.characters.id, id) })) ?? null;
}

export function apiError(e: unknown, status = 500) {
  const message = e instanceof Error ? e.message : String(e);
  console.error(message);
  return NextResponse.json({ error: message }, { status });
}
