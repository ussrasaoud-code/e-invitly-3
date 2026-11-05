import { getInstagramFeed } from "@/lib/instagram-feed";

/**
 * Image d'un post Instagram, servie par notre site : le navigateur du visiteur
 * ne contacte jamais Instagram. Seuls les posts du flux affiché sont servis.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,30}$/.test(id)) return new Response("Introuvable", { status: 404 });
  const post = (await getInstagramFeed()).find((p) => p.id === id);
  if (!post) return new Response("Introuvable", { status: 404 });
  const r = await fetch(post.imageUrl, { cache: "no-store" }).catch(() => null);
  const type = r?.headers.get("content-type") ?? "";
  if (!r?.ok || !type.startsWith("image/")) return new Response("Indisponible", { status: 502 });
  return new Response(r.body, {
    headers: { "content-type": type, "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
