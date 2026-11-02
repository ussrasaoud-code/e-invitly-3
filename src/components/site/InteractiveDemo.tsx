"use client";

import { useState } from "react";
import { InvitationView } from "@/components/invitation/InvitationView";
import { PhoneFrame } from "@/components/site/PhoneFrame";
import type { Showcase } from "@/lib/templates";

/** Démonstration interactive dans un cadre de smartphone, avec choix du modèle. */
export function InteractiveDemo({ items, initial = 0, showTabs = true, labels }: { items: Showcase[]; initial?: number; showTabs?: boolean; labels: { badge: string; demoLabel: string; tabs: string } }) {
  const [index, setIndex] = useState(initial);
  const current = items[index];
  if (!current) return null;
  return (
    <div>
      {showTabs && items.length > 1 ? (
        <div role="tablist" aria-label={labels.tabs} className="mb-8 flex justify-center gap-2">
          {items.map((it, i) => (
            <button
              key={it.slug}
              role="tab"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={`btn btn-sm ${i === index ? "btn-primary" : "btn-secondary"}`}
            >
              {it.name}
            </button>
          ))}
        </div>
      ) : null}
      <PhoneFrame label={labels.demoLabel.replace("{name}", current.name)}>
        <span className="pointer-events-none absolute end-3 top-9 z-50 rounded-full bg-charcoal/75 px-2 py-0.5 text-[0.6rem] uppercase tracking-widest text-ivory">
          {labels.badge}
        </span>
        <InvitationView key={current.slug} content={current.sample} renderer={current.renderer} mode="demo" framed />
      </PhoneFrame>
    </div>
  );
}
