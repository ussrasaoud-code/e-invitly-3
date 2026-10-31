"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Arch, CornerSpray, Divider, Sprig } from "@/components/ornaments";
import { EVENT_TYPE_LABELS, type InvitationContent, type InvitationEvent, type RendererKey } from "@/lib/invitation/schema";
import { formatDotDate, formatLongDate, formatTime, zonedToUtc } from "@/lib/time";
import type { PublicRsvpConfig } from "@/lib/rsvp";
import type { Labels } from "./i18n";
import { LiveRsvpForm } from "./LiveRsvpForm";

export type SectionProps = {
  content: InvitationContent;
  renderer: RendererKey;
  labels: Labels;
  title: string;
  /** Invitation publiée : adresse et configuration RSVP (lues côté serveur) */
  slug?: string;
  rsvp?: PublicRsvpConfig | null;
};

/* ── Apparition au défilement ─────────────────────────────────────── */
/** false quand le thème désactive les animations */
export const AnimationContext = createContext(true);

/** Animation d'apparition propre à la section ("inherit" = montée douce du thème) */
export const SectionAnimationContext = createContext<string>("inherit");

const HIDDEN_STATE: Record<string, string> = {
  inherit: "translateY(18px)",
  rise: "translateY(18px)",
  fade: "none",
  zoom: "scale(0.94)",
  "slide-left": "translateX(-28px)",
  "slide-right": "translateX(28px)",
  draw: "translateY(18px)",
};

export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const themeEnabled = useContext(AnimationContext);
  const kind = useContext(SectionAnimationContext);
  const enabled = themeEnabled && kind !== "none";
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(!enabled);
  useEffect(() => {
    if (!enabled) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return (
    <div
      ref={ref}
      className="transition-[opacity,transform] duration-1000 ease-out"
      style={{ opacity: shown ? 1 : 0, transform: shown ? "none" : HIDDEN_STATE[kind] ?? HIDDEN_STATE.inherit, transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const css = {
  display: { fontFamily: "var(--inv-display)" },
  script: { fontFamily: "var(--inv-script)" },
};

function SectionTitle({ children, renderer }: { children: ReactNode; renderer: RendererKey }) {
  if (!children) return null;
  return renderer === "province" ? (
    <h2 className="mb-8 text-center text-[2rem] italic leading-tight" style={{ ...css.display, color: "var(--inv-ink)" }}>
      {children}
    </h2>
  ) : (
    <div className="mb-8 flex flex-col items-center gap-3">
      <h2 className="text-center text-[0.95rem] uppercase tracking-[0.32em]" style={{ ...css.display, color: "var(--inv-accent)" }}>
        {children}
      </h2>
      <Divider className="h-4 w-32" stroke="var(--inv-soft)" />
    </div>
  );
}

function Shell({ children, renderer, tone = "plain" }: { children: ReactNode; renderer: RendererKey; tone?: "plain" | "tinted" }) {
  return (
    <section
      className="relative px-7 py-16"
      style={{ backgroundColor: tone === "tinted" ? "var(--inv-surface)" : "transparent" }}
      data-renderer={renderer}
      data-tone={tone}
    >
      <Reveal>{children}</Reveal>
    </section>
  );
}

/* ── Invitation principale ─────────────────────────────────────────── */
export function HeroSection({ content, renderer }: SectionProps) {
  const { couple, kicker, intro, eventAt, mainVenue, language } = content;
  const date = formatLongDate(eventAt, language);
  if (renderer === "province") {
    return (
      <section className="relative px-6 pb-16 pt-12">
        <div className="relative mx-auto aspect-[200/260] w-full max-w-[320px]">
          <Arch className="absolute inset-0 h-full w-full" stroke="var(--inv-accent)" fill="var(--inv-surface)" />
          <Sprig className="pointer-events-none absolute -bottom-3 -left-5 h-28 w-16 -rotate-[28deg]" stroke="var(--inv-accent)" fill="var(--inv-soft)" />
          <Sprig className="pointer-events-none absolute -bottom-3 -right-5 h-28 w-16 rotate-[28deg] -scale-x-100" stroke="var(--inv-accent)" fill="var(--inv-soft)" />
          <div className="absolute inset-x-10 bottom-[10%] top-[24%] flex flex-col items-center justify-center text-center">
            <Reveal>
              <p className="text-[0.62rem] uppercase leading-relaxed tracking-[0.24em]" style={{ color: "var(--inv-muted)" }}>
                {kicker}
              </p>
              {couple.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={couple.photoUrl} alt="" className="mx-auto mt-5 h-24 w-24 rounded-full object-cover" />
              ) : null}
              <h1 className="mt-5 text-[2.6rem] italic leading-[1.05]" style={{ ...css.display, color: "var(--inv-ink)" }}>
                {couple.partnerOne}
                <span className="my-1 block text-[1.9rem] not-italic" style={{ ...css.script, color: "var(--inv-accent)" }}>
                  &amp;
                </span>
                {couple.partnerTwo}
              </h1>
              <p className="mt-6 text-[0.95rem] tracking-[0.2em]" style={{ ...css.display, color: "var(--inv-accent)" }}>
                {formatDotDate(eventAt)}
              </p>
            </Reveal>
          </div>
        </div>
        <Reveal delay={200}>
          <p className="mx-auto mt-8 max-w-[300px] text-center text-[1.02rem] leading-relaxed" style={{ color: "var(--inv-ink)" }}>
            {intro}
          </p>
          <p className="mt-6 text-center text-[1.35rem] capitalize" style={{ ...css.display, color: "var(--inv-accent)" }}>
            {date}
          </p>
          {mainVenue.name ? (
            <p className="mt-2 text-center text-sm tracking-wide" style={{ color: "var(--inv-muted)" }}>
              {mainVenue.name}
              {mainVenue.city ? ` — ${mainVenue.city}` : ""}
            </p>
          ) : null}
        </Reveal>
      </section>
    );
  }
  return (
    <section className="relative overflow-hidden px-7 pb-20 pt-24 text-center">
      <CornerSpray className="pointer-events-none absolute -left-4 -top-6 w-36 -scale-y-100 opacity-90" stroke="var(--inv-accent)" fill="var(--inv-soft)" />
      <CornerSpray className="pointer-events-none absolute -right-4 -top-6 w-36 -scale-x-100 -scale-y-100 opacity-90" stroke="var(--inv-accent)" fill="var(--inv-soft)" />
      <Reveal>
        <p className="text-[0.68rem] uppercase tracking-[0.34em]" style={{ color: "var(--inv-muted)" }}>
          {kicker}
        </p>
        {couple.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={couple.photoUrl} alt="" className="mx-auto mt-8 aspect-[3/4] w-40 object-cover" />
        ) : null}
        <h1 className="mt-8 text-[2.15rem] uppercase leading-tight tracking-[0.14em]" style={{ ...css.display, color: "var(--inv-ink)" }}>
          {couple.partnerOne}
        </h1>
        <p className="my-1 text-[2.4rem] leading-none" style={{ ...css.script, color: "var(--inv-accent)" }}>
          &amp;
        </p>
        <h1 className="text-[2.15rem] uppercase leading-tight tracking-[0.14em]" style={{ ...css.display, color: "var(--inv-ink)" }}>
          {couple.partnerTwo}
        </h1>
      </Reveal>
      <Reveal delay={250}>
        <p className="mx-auto mt-8 max-w-[290px] leading-relaxed" style={{ color: "var(--inv-ink)" }}>
          {intro}
        </p>
        <Divider className="mx-auto mt-8 h-4 w-36" stroke="var(--inv-soft)" />
        <p className="mt-6 text-[1.05rem] tracking-[0.28em]" style={{ ...css.display, color: "var(--inv-accent)" }}>
          {formatDotDate(eventAt)}
        </p>
        <p className="mt-2 text-sm capitalize" style={{ color: "var(--inv-muted)" }}>
          {date}
        </p>
        {mainVenue.name ? (
          <p className="mt-4 text-[0.95rem]" style={{ color: "var(--inv-ink)" }}>
            {mainVenue.name}
            {mainVenue.city ? <span className="block text-sm" style={{ color: "var(--inv-muted)" }}>{mainVenue.city}</span> : null}
          </p>
        ) : null}
      </Reveal>
    </section>
  );
}

/* ── Programme ─────────────────────────────────────────────────────── */
export function ProgramSection({ content, renderer, labels, title }: SectionProps) {
  const events = content.events.filter((e) => e.startTime || e.title);
  if (!events.length) return null;
  return (
    <Shell renderer={renderer} tone="tinted">
      <SectionTitle renderer={renderer}>{title || labels.program}</SectionTitle>
      <ol className="relative mx-auto max-w-[320px]">
        {renderer === "province" ? (
          <span aria-hidden="true" className="absolute bottom-3 top-3 w-px" style={{ insetInlineStart: "4.25rem", backgroundColor: "var(--inv-soft)" }} />
        ) : null}
        {events.map((e, i) => (
          <li key={e.id} className={renderer === "province" ? "relative mb-7 flex gap-6" : "mb-9 text-center last:mb-0"}>
            {renderer === "province" ? (
              <>
                <span className="w-14 shrink-0 pt-0.5 text-end text-[1.15rem]" style={{ ...css.display, color: "var(--inv-accent)" }}>
                  {formatTime(e.startTime, content.language)}
                </span>
                <span aria-hidden="true" className="relative z-10 mt-2.5 h-2 w-2 shrink-0 rotate-45" style={{ backgroundColor: "var(--inv-accent)", marginInlineStart: "-0.5rem" }} />
                <div>
                  <p className="text-[1.05rem]" style={{ color: "var(--inv-ink)" }}>{e.title || EVENT_TYPE_LABELS[e.type]}</p>
                  {e.venueName ? <p className="text-sm" style={{ color: "var(--inv-muted)" }}>{e.venueName}</p> : null}
                  {e.description ? <p className="mt-1 text-sm" style={{ color: "var(--inv-muted)" }}>{e.description}</p> : null}
                </div>
              </>
            ) : (
              <>
                {i > 0 ? <Divider className="mx-auto mb-6 h-3 w-16" stroke="var(--inv-soft)" /> : null}
                <p className="text-[1.6rem] leading-none" style={{ ...css.script, color: "var(--inv-accent)" }}>
                  {formatTime(e.startTime, content.language)}
                </p>
                <p className="mt-2 text-[0.82rem] uppercase tracking-[0.24em]" style={{ ...css.display, color: "var(--inv-ink)" }}>
                  {e.title || EVENT_TYPE_LABELS[e.type]}
                </p>
                {e.venueName ? <p className="mt-1 text-sm" style={{ color: "var(--inv-muted)" }}>{e.venueName}</p> : null}
                {e.description ? <p className="mt-1 text-sm italic" style={{ color: "var(--inv-muted)" }}>{e.description}</p> : null}
              </>
            )}
          </li>
        ))}
      </ol>
    </Shell>
  );
}

/* ── Compte à rebours (logique verrouillée) ────────────────────────── */
export function CountdownSection({ content, renderer, labels, title }: SectionProps) {
  const target = useMemo(() => zonedToUtc(content.eventAt, content.timezone), [content.eventAt, content.timezone]);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!target) return null;
  const diff = now === null ? null : target.getTime() - now;
  const parts =
    diff === null || diff <= 0
      ? null
      : [
          { v: Math.floor(diff / 86_400_000), l: labels.days },
          { v: Math.floor((diff / 3_600_000) % 24), l: labels.hours },
          { v: Math.floor((diff / 60_000) % 60), l: labels.minutes },
          { v: Math.floor((diff / 1000) % 60), l: labels.seconds },
        ];
  const sameDay = diff !== null && diff <= 0 && diff > -86_400_000;
  return (
    <Shell renderer={renderer}>
      <SectionTitle renderer={renderer}>{title}</SectionTitle>
      {diff === null ? (
        <div className="h-[72px]" aria-hidden="true" />
      ) : parts ? (
        <div className="mx-auto grid max-w-[320px] grid-cols-4 gap-2 text-center" role="timer" aria-live="off">
          {parts.map((p) => (
            <div key={p.l} className="py-3" style={{ borderInlineStart: renderer === "province" ? "none" : undefined }}>
              <span className="block text-[2rem] leading-none lining-nums tabular-nums" style={{ ...css.display, color: "var(--inv-ink)" }}>
                {String(p.v).padStart(2, "0")}
              </span>
              <span className="mt-2 block text-[0.62rem] uppercase tracking-[0.22em]" style={{ color: "var(--inv-muted)" }}>
                {p.l}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-lg" style={{ ...css.script, color: "var(--inv-accent)" }}>
          {sameDay ? labels.countdownToday : labels.countdownPast}
        </p>
      )}
    </Shell>
  );
}

/* ── Dress code ────────────────────────────────────────────────────── */
export function DressCodeSection({ content, renderer, labels, title }: SectionProps) {
  const { text, palette } = content.dressCode;
  if (!text && !palette.length) return null;
  return (
    <Shell renderer={renderer} tone="tinted">
      <SectionTitle renderer={renderer}>{title || labels.dresscode}</SectionTitle>
      <p className="mx-auto max-w-[300px] text-center leading-relaxed" style={{ color: "var(--inv-ink)" }}>
        {text}
      </p>
      {palette.length ? (
        <ul className="mt-7 flex justify-center gap-3" aria-label="Palette de couleurs">
          {palette.map((c) => (
            <li key={c} className="inv-border-soft h-9 w-9 rounded-full border" style={{ background: c }} title={c} />
          ))}
        </ul>
      ) : null}
    </Shell>
  );
}

/* ── Lieux et transports ───────────────────────────────────────────── */
function mapLinks(e: InvitationEvent) {
  const q = encodeURIComponent([e.venueName, e.address].filter(Boolean).join(", "));
  return {
    google: e.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${q}`,
    apple: `https://maps.apple.com/?q=${q}`,
  };
}

export function VenuesSection({ content, renderer, labels, title }: SectionProps) {
  // Un lieu par adresse distincte
  const seen = new Set<string>();
  const venues = content.events.filter((e) => {
    if (!e.address) return false;
    const key = e.address.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const p = content.practical;
  const practical = [
    { k: labels.parking, v: p.parking },
    { k: labels.shuttles, v: p.shuttles },
    { k: labels.transport, v: p.transport },
    { k: labels.lodging, v: p.lodging },
  ].filter((x) => x.v);
  if (!venues.length && !practical.length) return null;
  return (
    <Shell renderer={renderer}>
      <SectionTitle renderer={renderer}>{title || labels.venues}</SectionTitle>
      <div className="mx-auto max-w-[320px] space-y-6">
        {venues.map((e) => {
          const links = mapLinks(e);
          return (
            <div key={e.id} className="inv-border-soft border p-5 text-center">
              <p className="text-[0.75rem] uppercase tracking-[0.22em]" style={{ color: "var(--inv-accent)" }}>
                {e.title || EVENT_TYPE_LABELS[e.type]}
                {e.arrivalTime ? ` · ${labels.arrival} ${formatTime(e.arrivalTime, content.language)}` : ""}
              </p>
              <p className="mt-2 text-[1.05rem]" style={{ color: "var(--inv-ink)" }}>{e.venueName}</p>
              <p className="mt-1 text-sm" style={{ color: "var(--inv-muted)" }}>{e.address}</p>
              <div className="mt-4 flex justify-center gap-2">
                <a href={links.google} target="_blank" rel="noopener noreferrer" className="inv-border-accent inline-flex min-h-10 items-center border px-3 text-[0.68rem] uppercase tracking-[0.18em]" style={{ color: "var(--inv-accent)" }}>
                  {labels.googleMaps}
                </a>
                <a href={links.apple} target="_blank" rel="noopener noreferrer" className="inv-border-accent inline-flex min-h-10 items-center border px-3 text-[0.68rem] uppercase tracking-[0.18em]" style={{ color: "var(--inv-accent)" }}>
                  {labels.appleMaps}
                </a>
              </div>
            </div>
          );
        })}
        {practical.length ? (
          <dl className="space-y-4 pt-2">
            {practical.map((x) => (
              <div key={x.k}>
                <dt className="text-[0.7rem] uppercase tracking-[0.22em]" style={{ color: "var(--inv-accent)" }}>{x.k}</dt>
                <dd className="mt-1 text-[0.95rem] leading-relaxed" style={{ color: "var(--inv-ink)" }}>{x.v}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </Shell>
  );
}

/* ── RSVP (démo) ───────────────────────────────────────────────────── */
export function RsvpSection({ content, renderer, labels, title, mode, slug, rsvp }: SectionProps & { mode: "demo" | "preview" | "live" }) {
  const [attending, setAttending] = useState<"yes" | "no" | "">("");
  const [sent, setSent] = useState(false);
  // La date limite réglée dans l'onglet RSVP fait foi ; sinon celle du contenu.
  const deadlineIso = rsvp?.deadline ?? null;
  const deadline = deadlineIso
    ? new Intl.DateTimeFormat({ fr: "fr-FR", en: "en-GB", ar: "ar-MA" }[content.language], { day: "numeric", month: "long", year: "numeric", timeZone: content.timezone }).format(new Date(deadlineIso))
    : content.rsvp.deadline
      ? formatLongDate(`${content.rsvp.deadline}T12:00`, content.language)
      : "";
  const inputStyle = { color: "var(--inv-ink)", backgroundColor: "var(--inv-bg)" };
  const fieldCls = "inv-border-soft mt-1 block w-full min-h-11 border px-3 py-2 text-base outline-none focus:ring-2";
  return (
    <Shell renderer={renderer} tone="tinted">
      <SectionTitle renderer={renderer}>{title || labels.rsvp}</SectionTitle>
      {content.rsvp.intro || deadline ? (
        <p className="mx-auto mb-7 max-w-[300px] text-center text-sm leading-relaxed" style={{ color: "var(--inv-muted)" }}>
          {content.rsvp.intro || `${labels.rsvpBefore} ${deadline}.`}
        </p>
      ) : null}
      {mode === "live" ? (
        rsvp && slug ? (
          <LiveRsvpForm slug={slug} config={rsvp} events={content.events} labels={labels} />
        ) : (
          <p className="mx-auto max-w-[300px] text-center leading-relaxed" style={{ color: "var(--inv-ink)" }}>
            {labels.rsvpSoon}
          </p>
        )
      ) : sent ? (
        <p role="status" className="mx-auto max-w-[300px] text-center leading-relaxed" style={{ color: "var(--inv-ink)" }}>
          {labels.demoThanks}
        </p>
      ) : (
        <form
          className="mx-auto max-w-[320px] space-y-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            setSent(true);
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs" style={{ color: "var(--inv-muted)" }}>
              {labels.firstName}
              <input required name="firstName" autoComplete="given-name" className={fieldCls} style={inputStyle} />
            </label>
            <label className="text-xs" style={{ color: "var(--inv-muted)" }}>
              {labels.lastName}
              <input name="lastName" autoComplete="family-name" className={fieldCls} style={inputStyle} />
            </label>
          </div>
          <fieldset>
            <legend className="text-xs" style={{ color: "var(--inv-muted)" }}>{labels.attending}</legend>
            <div className="mt-2 grid gap-2">
              {(["yes", "no"] as const).map((v) => (
                <label
                  key={v}
                  className={`${attending === v ? "inv-border-accent" : "inv-border-soft"} flex min-h-11 cursor-pointer items-center gap-3 border px-3 text-sm`}
                  style={{ color: "var(--inv-ink)", backgroundColor: "var(--inv-bg)" }}
                >
                  <input type="radio" name="attending" value={v} required checked={attending === v} onChange={() => setAttending(v)} style={{ accentColor: "var(--inv-accent)" }} />
                  {v === "yes" ? labels.yes : labels.no}
                </label>
              ))}
            </div>
          </fieldset>
          {attending === "yes" ? (
            <>
              <label className="block text-xs" style={{ color: "var(--inv-muted)" }}>
                {labels.companions}
                <input type="number" min={0} max={5} defaultValue={0} inputMode="numeric" className={fieldCls} style={inputStyle} />
              </label>
              {content.events.length > 1 ? (
                <fieldset>
                  <legend className="text-xs" style={{ color: "var(--inv-muted)" }}>{labels.whichEvents}</legend>
                  <div className="mt-2 space-y-1">
                    {content.events.map((e) => (
                      <label key={e.id} className="flex min-h-9 items-center gap-3 text-sm" style={{ color: "var(--inv-ink)" }}>
                        <input type="checkbox" defaultChecked style={{ accentColor: "var(--inv-accent)" }} />
                        {e.title || EVENT_TYPE_LABELS[e.type]}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              <label className="block text-xs" style={{ color: "var(--inv-muted)" }}>
                {labels.dietary}
                <input className={fieldCls} style={inputStyle} />
              </label>
            </>
          ) : null}
          <label className="block text-xs" style={{ color: "var(--inv-muted)" }}>
            {labels.message}
            <textarea rows={3} className={`${fieldCls} min-h-20`} style={inputStyle} />
          </label>
          <button
            type="submit"
            className="mt-2 inline-flex min-h-12 w-full items-center justify-center text-[0.75rem] uppercase tracking-[0.22em] transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--inv-accent)", color: "var(--inv-bg)" }}
          >
            {labels.send}
          </button>
          <p className="text-center text-xs italic" style={{ color: "var(--inv-muted)" }}>
            {labels.demoNotice}
          </p>
        </form>
      )}
    </Shell>
  );
}

/* ── Contacts ──────────────────────────────────────────────────────── */
export function ContactsSection({ content, renderer, labels, title }: SectionProps) {
  if (!content.contacts.length) return null;
  return (
    <Shell renderer={renderer}>
      <SectionTitle renderer={renderer}>{title || labels.contacts}</SectionTitle>
      <ul className="mx-auto grid max-w-[320px] gap-5 text-center">
        {content.contacts.map((c) => (
          <li key={`${c.name}-${c.phone}`}>
            <p className="text-[1.05rem]" style={{ color: "var(--inv-ink)" }}>{c.name}</p>
            {c.role ? <p className="text-sm" style={{ color: "var(--inv-muted)" }}>{c.role}</p> : null}
            {c.phone ? (
              <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="mt-1 inline-block text-sm underline underline-offset-4" style={{ color: "var(--inv-accent)" }} dir="ltr">
                {c.phone}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </Shell>
  );
}

/* ── Message final ─────────────────────────────────────────────────── */
export function ClosingSection({ content, renderer }: SectionProps) {
  const { title, text } = content.closing;
  if (!title && !text) return null;
  return (
    <section className="relative overflow-hidden px-7 pb-24 pt-16 text-center">
      {renderer === "the-garden" ? (
        <Sprig className="mx-auto mb-6 h-24 w-14" stroke="var(--inv-accent)" fill="var(--inv-soft)" />
      ) : null}
      <Reveal>
        <p className="text-[2.4rem] leading-none" style={{ ...css.script, color: "var(--inv-accent)" }}>{title}</p>
        <p className="mx-auto mt-5 max-w-[280px] leading-relaxed" style={{ color: "var(--inv-ink)" }}>{text}</p>
        <p className="mt-8 text-[0.8rem] uppercase tracking-[0.3em]" style={{ ...css.display, color: "var(--inv-muted)" }}>
          {content.couple.partnerOne} &amp; {content.couple.partnerTwo}
        </p>
      </Reveal>
    </section>
  );
}

/* ── Texte libre ───────────────────────────────────────────────────── */
export function TextSection({ renderer, title, body }: SectionProps & { body: string }) {
  if (!title && !body) return null;
  return (
    <Shell renderer={renderer}>
      <SectionTitle renderer={renderer}>{title}</SectionTitle>
      {body ? (
        <p className="mx-auto max-w-[330px] whitespace-pre-line text-center leading-relaxed" style={{ color: "var(--inv-ink)" }}>
          {body}
        </p>
      ) : null}
    </Shell>
  );
}

/* ── Bande décorative : un espace qui n'accueille que des calques ──── */
export function DecorSection({ height }: { height: number }) {
  return <div aria-hidden="true" style={{ paddingTop: `${height}%` }} />;
}
