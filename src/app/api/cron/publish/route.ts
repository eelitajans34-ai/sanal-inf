import { NextResponse } from "next/server";
import { tick } from "@/lib/worker";

// Eski adres: /api/cron/tick ile aynı işi yapar.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil" }, { status: 500 });
  }
  return NextResponse.json(await tick());
}
