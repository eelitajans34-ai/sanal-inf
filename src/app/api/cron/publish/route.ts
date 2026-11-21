import { NextResponse } from "next/server";
import { publishDuePosts } from "@/lib/publish/run";

// Zamanı gelen gönderileri paylaşır. Vercel Cron (vercel.json) veya
// herhangi bir zamanlayıcı bu adresi çağırabilir:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://site/api/cron/publish
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil" }, { status: 500 });
  }
  const results = await publishDuePosts();
  return NextResponse.json({ published: results.length, results });
}
