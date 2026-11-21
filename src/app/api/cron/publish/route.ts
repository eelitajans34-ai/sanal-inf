import { NextResponse } from "next/server";
import { publishDuePosts } from "@/lib/publish/run";
import { refreshAllTrainings } from "@/lib/ai/training";

// Zamanı gelen gönderileri paylaşır ve devam eden LoRA eğitimlerini yoklar.
// Herhangi bir zamanlayıcı bu adresi 5-10 dakikada bir çağırabilir:
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
  const trainings = await refreshAllTrainings();
  return NextResponse.json({ published: results.length, results, trainingsChecked: trainings });
}
