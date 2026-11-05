import type { SiteDict } from "@/lib/i18n/dict";
import { getInstagramFeed, loadConnection } from "@/lib/instagram-feed";
import { InstagramIcon } from "@/components/contact/InstagramIcon";

/** Bande « Suivez-nous sur Instagram » : derniers posts du compte connecté (Admin → Paramètres). */
export async function InstagramStrip({ t, profileUrl }: { t: SiteDict["instagram"]; profileUrl: string }) {
  const posts = await getInstagramFeed().catch(() => []);
  if (posts.length < 3) return null;
  const conn = await loadConnection().catch(() => null);
  const handle = conn?.username ? `@${conn.username}` : "";
  const href = profileUrl || (conn?.username ? `https://www.instagram.com/${conn.username}/` : "https://www.instagram.com/");
  return (
    <section aria-labelledby="ig-title" className="border-t border-line bg-ivory py-14">
      <div className="mx-auto max-w-6xl px-5 text-center">
        <InstagramIcon className="mx-auto h-6 w-6 text-forest" />
        <h2 id="ig-title" className="mt-3 font-serif text-3xl md:text-4xl">{t.title}</h2>
        {handle ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-forest underline-offset-4 hover:underline">
            <bdi dir="ltr">{handle}</bdi>
          </a>
        ) : null}
      </div>
      <ul className="mx-auto mt-8 flex max-w-6xl snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:thin] md:gap-3">
        {posts.map((p) => (
          <li key={p.id} className="w-[44%] shrink-0 snap-start sm:w-[31%] lg:w-[calc(25%-0.6rem)]">
            <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="group relative block aspect-square overflow-hidden bg-paper" aria-label={`${t.view}${p.caption ? ` : ${p.caption.slice(0, 80)}` : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/instagram/image/${p.id}`} alt={p.caption ? p.caption.slice(0, 120) : t.view} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              {p.isVideo ? (
                <span className="absolute end-2 top-2 rounded-full bg-black/50 p-1.5 text-white" aria-label={t.video}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-6 text-center">
        <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm gap-2">
          <InstagramIcon className="h-4 w-4" />
          {t.follow}
        </a>
      </div>
    </section>
  );
}
