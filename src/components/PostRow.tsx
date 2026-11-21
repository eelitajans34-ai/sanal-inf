import type { Character, Post } from "@/db/schema";
import { deletePost, publishNow, schedulePost } from "@/app/actions";
import { STATUS, fmtDateTime, toLocalInput } from "@/lib/format";

export default function PostRow({
  post,
  character,
}: {
  post: Post;
  character?: Pick<Character, "name">;
}) {
  const s = STATUS[post.status] ?? STATUS.DRAFT;
  const when = post.status === "PUBLISHED" ? post.publishedAt : post.scheduledAt;
  const defaultTime = toLocalInput(post.scheduledAt ?? new Date(Date.now() + 60 * 60 * 1000));

  return (
    <div className="card flex gap-4 p-4">
      <div className="h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-brand-soft">
        {post.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`badge ${s.cls}`}>{s.label}</span>
          {character && <span className="font-semibold">{character.name}</span>}
          <span className="text-muted">{fmtDateTime(when)}</span>
          {post.externalId.startsWith("demo-") && <span className="text-muted">(demo)</span>}
        </div>
        <p className="mt-1 line-clamp-3 text-sm whitespace-pre-line">{post.caption}</p>
        {post.error && <p className="mt-1 text-xs text-red-600">{post.error}</p>}

        {post.status !== "PUBLISHED" && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <form action={schedulePost.bind(null, post.id)} className="flex items-center gap-2">
              <input
                type="datetime-local"
                name="scheduledAt"
                defaultValue={defaultTime}
                className="input w-auto py-1 text-xs"
              />
              <button className="btn-ghost px-3 py-1 text-xs">
                {post.status === "SCHEDULED" ? "Saati güncelle" : "Planla"}
              </button>
            </form>
            <form action={publishNow.bind(null, post.id)}>
              <button className="btn-ghost px-3 py-1 text-xs">Şimdi paylaş</button>
            </form>
            <form action={deletePost.bind(null, post.id)}>
              <button className="btn-danger px-3 py-1 text-xs">Sil</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
