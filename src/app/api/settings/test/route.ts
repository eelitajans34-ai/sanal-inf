import { NextResponse } from "next/server";
import { SETTING_KEYS, ensureSettings, type SettingKey } from "@/lib/config";
import { testConnection } from "@/lib/connections";
import { apiError } from "@/lib/api";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { key } = await req.json();
    if (!(SETTING_KEYS as readonly string[]).includes(key)) return apiError("Bilinmeyen ayar", 400);
    await ensureSettings(true);
    return NextResponse.json(await testConnection(key as SettingKey));
  } catch (e) {
    return apiError(e);
  }
}
