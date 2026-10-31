/* eslint-disable @next/next/no-img-element */
import type { MediaItem } from "@/lib/media";

/** Vignette d'un média (image, SVG, vidéo ou musique). */
export function MediaThumb({ item, className = "" }: { item: Pick<MediaItem, "kind" | "url" | "name">; className?: string }) {
  if (item.kind === "image" || item.kind === "svg") {
    return (
      <img
        src={item.url}
        alt={item.name}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-contain ${item.kind === "svg" ? "p-3" : ""} ${className}`}
      />
    );
  }
  if (item.kind === "video") {
    return <video src={`${item.url}#t=0.5`} muted playsInline preload="metadata" className={`h-full w-full object-cover ${className}`} aria-label={item.name} />;
  }
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-1 text-stone ${className}`} aria-label={item.name}>
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
      <span className="text-[0.65rem] uppercase tracking-wider">Musique</span>
    </div>
  );
}
