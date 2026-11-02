"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Arch, CornerSpray, Divider, Sprig } from "@/components/ornaments";
import { EVENT_TYPE_LABELS, programV2Items, type InvitationContent, type InvitationEvent, type InvitationSection, type RendererKey } from "@/lib/invitation/schema";
import { LOCALES, formatDotDate, formatLongDate, formatTime, zonedToUtc } from "@/lib/time";
import type { PublicRsvpConfig } from "@/lib/rsvp";
import type { Labels } from "./i18n";
import { El, ElText, elKey } from "./Element";
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
export { AnimationContext } from "./editor-context";
import { AnimationContext } from "./editor-context";

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
    <El id="title" className="mb-8">
      <h2 className="text-center text-[2rem] italic leading-tight" style={{ ...css.display, color: "var(--inv-ink)" }}>
        {children}
      </h2>
    </El>
  ) : (
    <div className="mb-8 flex flex-col items-center gap-3">
      <El id="title">
        <h2 className="text-center text-[0.95rem] uppercase tracking-[0.32em]" style={{ ...css.display, color: "var(--inv-accent)" }}>
          {children}
        </h2>
      </El>
      {renderer === "the-garden" ? (
        <El id="title-ornament">
          <Divider className="h-4 w-32" stroke="var(--inv-soft)" />
        </El>
      ) : null}
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
          <El id="arch" className="absolute inset-0">
            <Arch className="h-full w-full" stroke="var(--inv-accent)" fill="var(--inv-surface)" />
          </El>
          <El id="sprig-left" className="pointer-events-none absolute -bottom-3 -left-5 z-[1] h-28 w-16">
            <Sprig className="h-full w-full -rotate-[28deg]" stroke="var(--inv-accent)" fill="var(--inv-soft)" />
          </El>
          <El id="sprig-right" className="pointer-events-none absolute -bottom-3 -right-5 z-[1] h-28 w-16">
            <Sprig className="h-full w-full rotate-[28deg] -scale-x-100" stroke="var(--inv-accent)" fill="var(--inv-soft)" />
          </El>
          <div className="absolute inset-x-10 bottom-[10%] top-[24%] flex flex-col items-center justify-center text-center">
            <Reveal>
              <El id="kicker">
                <p className="text-[0.62rem] uppercase leading-relaxed tracking-[0.24em]" style={{ color: "var(--inv-muted)" }}>
                  {kicker}
                </p>
              </El>
              {couple.photoUrl ? (
                <El id="photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={couple.photoUrl} alt="" className="mx-auto mt-5 h-24 w-24 rounded-full object-cover" />
                </El>
              ) : null}
              <El id="names">
                <h1 className="mt-5 text-[2.6rem] italic leading-[1.05]" style={{ ...css.display, color: "var(--inv-ink)" }}>
                  <El id="names.one" as="span" className="block">{couple.partnerOne}</El>
                  <El id="names.and" as="span" className="my-1 block text-[1.9rem] not-italic" style={{ ...css.script, color: "var(--inv-accent)" }}>
                    <ElText fallback="&" />
                  </El>
                  <El id="names.two" as="span" className="block">{couple.partnerTwo}</El>
                </h1>
              </El>
              <El id="date">
                <p className="mt-6 text-[0.95rem] tracking-[0.2em] lining-nums" style={{ ...css.display, color: "var(--inv-accent)" }}>
                  <bdi dir="ltr">{formatDotDate(eventAt)}</bdi>
                </p>
              </El>
            </Reveal>
          </div>
        </div>
        <Reveal delay={200}>
          <El id="intro">
            <p className="mx-auto mt-8 max-w-[300px] text-center text-[1.02rem] leading-relaxed" style={{ color: "var(--inv-ink)" }}>
              {intro}
            </p>
          </El>
          <El id="date-long">
            <p className="mt-6 text-center text-[1.35rem] capitalize" style={{ ...css.display, color: "var(--inv-accent)" }}>
              {date}
            </p>
          </El>
          {mainVenue.name ? (
            <El id="venue">
              <p className="mt-2 text-center text-sm tracking-wide" style={{ color: "var(--inv-muted)" }}>
                <El id="venue.name" as="span">{mainVenue.name}</El>
                {mainVenue.city ? <El id="venue.city" as="span">{` — ${mainVenue.city}`}</El> : null}
              </p>
            </El>
          ) : null}
        </Reveal>
      </section>
    );
  }
  return (
    <section className={`relative overflow-hidden px-7 pb-20 text-center ${renderer === "the-garden" ? "pt-24" : "pt-20"}`}>
      {renderer === "the-garden" ? (
        <>
          <El id="corner-left" className="pointer-events-none absolute -left-4 -top-6 w-36">
            <CornerSpray className="w-full -scale-y-100 opacity-90" stroke="var(--inv-accent)" fill="var(--inv-soft)" />
          </El>
          <El id="corner-right" className="pointer-events-none absolute -right-4 -top-6 w-36">
            <CornerSpray className="w-full -scale-x-100 -scale-y-100 opacity-90" stroke="var(--inv-accent)" fill="var(--inv-soft)" />
          </El>
        </>
      ) : null}
      <Reveal>
        <El id="kicker">
          <p className="text-[0.68rem] uppercase tracking-[0.34em]" style={{ color: "var(--inv-muted)" }}>
            {kicker}
          </p>
        </El>
        {couple.photoUrl ? (
          <El id="photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={couple.photoUrl} alt="" className="mx-auto mt-8 aspect-[3/4] w-40 object-cover" />
          </El>
        ) : null}
        <El id="names">
          <El id="names.one">
            <h1 className="mt-8 text-[2.15rem] uppercase leading-tight tracking-[0.14em]" style={{ ...css.display, color: "var(--inv-ink)" }}>
              {couple.partnerOne}
            </h1>
          </El>
          <El id="names.and">
            <p className="my-1 text-[2.4rem] leading-none" style={{ ...css.script, color: "var(--inv-accent)" }}>
              <ElText fallback="&" />
            </p>
          </El>
          <El id="names.two">
            <h1 className="text-[2.15rem] uppercase leading-tight tracking-[0.14em]" style={{ ...css.display, color: "var(--inv-ink)" }}>
              {couple.partnerTwo}
            </h1>
          </El>
        </El>
      </Reveal>
      <Reveal delay={250}>
        <El id="intro">
          <p className="mx-auto mt-8 max-w-[290px] leading-relaxed" style={{ color: "var(--inv-ink)" }}>
            {intro}
          </p>
        </El>
        {renderer === "the-garden" ? (
          <El id="divider">
            <Divider className="mx-auto mt-8 h-4 w-36" stroke="var(--inv-soft)" />
          </El>
        ) : null}
        <El id="date">
          <p className="mt-6 text-[1.05rem] tracking-[0.28em] lining-nums" style={{ ...css.display, color: "var(--inv-accent)" }}>
            <bdi dir="ltr">{formatDotDate(eventAt)}</bdi>
          </p>
        </El>
        <El id="date-long">
          <p className="mt-2 text-sm capitalize" style={{ color: "var(--inv-muted)" }}>
            {date}
          </p>
        </El>
        {mainVenue.name ? (
          <El id="venue">
            <p className="mt-4 text-[0.95rem]" style={{ color: "var(--inv-ink)" }}>
              <El id="venue.name" as="span" className="block">{mainVenue.name}</El>
              {mainVenue.city ? <El id="venue.city" as="span" className="block text-sm" style={{ color: "var(--inv-muted)" }}>{mainVenue.city}</El> : null}
            </p>
          </El>
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
      <El id="list">
      <ol className="relative mx-auto max-w-[320px]">
        {renderer === "province" ? (
          <span aria-hidden="true" className="absolute bottom-3 top-3 w-px" style={{ insetInlineStart: "4.25rem", backgroundColor: "var(--inv-soft)" }} />
        ) : null}
        {events.map((e, i) => {
          const k = `list.${elKey(e.id)}`;
          return (
          <El id={k} as="li" key={e.id} className={renderer === "province" ? "relative mb-7 flex gap-6" : "mb-9 text-center last:mb-0"}>
            {renderer === "province" ? (
              <>
                <El id={`${k}.time`} as="span" className="w-14 shrink-0 pt-0.5 text-end text-[1.15rem]" style={{ ...css.display, color: "var(--inv-accent)" }}>
                  {formatTime(e.startTime, content.language)}
                </El>
                <span aria-hidden="true" className="relative z-10 mt-2.5 h-2 w-2 shrink-0 rotate-45" style={{ backgroundColor: "var(--inv-accent)", marginInlineStart: "-0.5rem" }} />
                <div>
                  <El id={`${k}.title`}><p className="text-[1.05rem]" style={{ color: "var(--inv-ink)" }}>{e.title || EVENT_TYPE_LABELS[e.type]}</p></El>
                  {e.venueName ? <El id={`${k}.place`}><p className="text-sm" style={{ color: "var(--inv-muted)" }}>{e.venueName}</p></El> : null}
                  {e.description ? <El id={`${k}.desc`}><p className="mt-1 text-sm" style={{ color: "var(--inv-muted)" }}>{e.description}</p></El> : null}
                </div>
              </>
            ) : (
              <>
                {i > 0 && renderer === "the-garden" ? <Divider className="mx-auto mb-6 h-3 w-16" stroke="var(--inv-soft)" /> : null}
                <El id={`${k}.time`}>
                  <p className="text-[1.6rem] leading-none" style={{ ...css.script, color: "var(--inv-accent)" }}>
                    {formatTime(e.startTime, content.language)}
                  </p>
                </El>
                <El id={`${k}.title`}>
                  <p className="mt-2 text-[0.82rem] uppercase tracking-[0.24em]" style={{ ...css.display, color: "var(--inv-ink)" }}>
                    {e.title || EVENT_TYPE_LABELS[e.type]}
                  </p>
                </El>
                {e.venueName ? <El id={`${k}.place`}><p className="mt-1 text-sm" style={{ color: "var(--inv-muted)" }}>{e.venueName}</p></El> : null}
                {e.description ? <El id={`${k}.desc`}><p className="mt-1 text-sm italic" style={{ color: "var(--inv-muted)" }}>{e.description}</p></El> : null}
              </>
            )}
          </El>
          );
        })}
      </ol>
      </El>
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
      <El id="timer">
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
      </El>
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
      <El id="text">
        <p className="mx-auto max-w-[300px] text-center leading-relaxed" style={{ color: "var(--inv-ink)" }}>
          {text}
        </p>
      </El>
      {palette.length ? (
        <El id="palette">
          <ul className="mt-7 flex justify-center gap-3" aria-label="Palette de couleurs">
            {palette.map((c) => (
              <li key={c} className="inv-border-soft h-9 w-9 rounded-full border" style={{ background: c }} title={c} />
            ))}
          </ul>
        </El>
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
      <El id="list">
      <div className="mx-auto max-w-[320px] space-y-6">
        {venues.map((e) => {
          const links = mapLinks(e);
          const k = `list.${elKey(e.id)}`;
          return (
            <El id={k} key={e.id} className="inv-border-soft border p-5 text-center">
              <El id={`${k}.title`}>
                <p className="text-[0.75rem] uppercase tracking-[0.22em]" style={{ color: "var(--inv-accent)" }}>
                  {e.title || EVENT_TYPE_LABELS[e.type]}
                  {e.arrivalTime ? ` · ${labels.arrival} ${formatTime(e.arrivalTime, content.language)}` : ""}
                </p>
              </El>
              <El id={`${k}.place`}><p className="mt-2 text-[1.05rem]" style={{ color: "var(--inv-ink)" }}>{e.venueName}</p></El>
              <El id={`${k}.address`}><p className="mt-1 text-sm" style={{ color: "var(--inv-muted)" }}>{e.address}</p></El>
              <El id={`${k}.maps`} className="mt-4 flex justify-center gap-2">
                <a href={links.google} target="_blank" rel="noopener noreferrer" className="inv-border-accent inline-flex min-h-10 items-center border px-3 text-[0.68rem] uppercase tracking-[0.18em]" style={{ color: "var(--inv-accent)" }}>
                  {labels.googleMaps}
                </a>
                <a href={links.apple} target="_blank" rel="noopener noreferrer" className="inv-border-accent inline-flex min-h-10 items-center border px-3 text-[0.68rem] uppercase tracking-[0.18em]" style={{ color: "var(--inv-accent)" }}>
                  {labels.appleMaps}
                </a>
              </El>
            </El>
          );
        })}
        {practical.length ? (
          <El id="list.practical">
          <dl className="space-y-4 pt-2">
            {practical.map((x) => (
              <div key={x.k}>
                <dt className="text-[0.7rem] uppercase tracking-[0.22em]" style={{ color: "var(--inv-accent)" }}>{x.k}</dt>
                <dd className="mt-1 text-[0.95rem] leading-relaxed" style={{ color: "var(--inv-ink)" }}>{x.v}</dd>
              </div>
            ))}
          </dl>
          </El>
        ) : null}
      </div>
      </El>
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
    ? new Intl.DateTimeFormat(LOCALES[content.language], { day: "numeric", month: "long", year: "numeric", timeZone: content.timezone }).format(new Date(deadlineIso))
    : content.rsvp.deadline
      ? formatLongDate(`${content.rsvp.deadline}T12:00`, content.language)
      : "";
  const inputStyle = { color: "var(--inv-ink)", backgroundColor: "var(--inv-bg)" };
  const fieldCls = "inv-border-soft mt-1 block w-full min-h-11 border px-3 py-2 text-base outline-none focus:ring-2";
  return (
    <Shell renderer={renderer} tone="tinted">
      <SectionTitle renderer={renderer}>{title || labels.rsvp}</SectionTitle>
      {content.rsvp.intro || deadline ? (
        <El id="intro">
          <p className="mx-auto mb-7 max-w-[300px] text-center text-sm leading-relaxed" style={{ color: "var(--inv-muted)" }}>
            {content.rsvp.intro || `${labels.rsvpBefore} ${deadline}.`}
          </p>
        </El>
      ) : null}
      <El id="form">
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
      </El>
    </Shell>
  );
}

/* ── Contacts ──────────────────────────────────────────────────────── */
export function ContactsSection({ content, renderer, labels, title }: SectionProps) {
  if (!content.contacts.length) return null;
  return (
    <Shell renderer={renderer}>
      <SectionTitle renderer={renderer}>{title || labels.contacts}</SectionTitle>
      <El id="list">
      <ul className="mx-auto grid max-w-[320px] gap-5 text-center">
        {content.contacts.map((c, i) => (
          <El id={`list.c${i}`} as="li" key={`${c.name}-${c.phone}-${i}`}>
            <El id={`list.c${i}.name`}><p className="text-[1.05rem]" style={{ color: "var(--inv-ink)" }}>{c.name}</p></El>
            {c.role ? <El id={`list.c${i}.role`}><p className="text-sm" style={{ color: "var(--inv-muted)" }}>{c.role}</p></El> : null}
            {c.phone ? (
              <El id={`list.c${i}.phone`}>
                <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="mt-1 inline-block text-sm underline underline-offset-4" style={{ color: "var(--inv-accent)" }} dir="ltr">
                  {c.phone}
                </a>
              </El>
            ) : null}
          </El>
        ))}
      </ul>
      </El>
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
        <El id="sprig" className="mx-auto mb-6 h-24 w-14">
          <Sprig className="h-full w-full" stroke="var(--inv-accent)" fill="var(--inv-soft)" />
        </El>
      ) : null}
      <Reveal>
        <El id="title">
          <p className="text-[2.4rem] leading-none" style={{ ...css.script, color: "var(--inv-accent)" }}>{title}</p>
        </El>
        <El id="text">
          <p className="mx-auto mt-5 max-w-[280px] leading-relaxed" style={{ color: "var(--inv-ink)" }}>{text}</p>
        </El>
        <El id="signature">
          <p className="mt-8 text-[0.8rem] uppercase tracking-[0.3em]" style={{ ...css.display, color: "var(--inv-muted)" }}>
            {content.couple.partnerOne} &amp; {content.couple.partnerTwo}
          </p>
        </El>
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
        <El id="body">
          <p className="mx-auto max-w-[330px] whitespace-pre-line text-center leading-relaxed" style={{ color: "var(--inv-ink)" }}>
            {body}
          </p>
        </El>
      ) : null}
    </Shell>
  );
}

/* ── Bande décorative : un espace qui n'accueille que des calques ──── */
export function DecorSection({ height }: { height: number }) {
  return <div aria-hidden="true" style={{ paddingTop: `${height}%` }} />;
}

/* ── Programme v2 : frise végétale et fleur qui suit le défilement ── */
export function ProgramV2Section({ section, content }: SectionProps & { section: InvitationSection }) {
  const { kicker, title, marker } = section;
  // Par défaut, le programme de l'invitation (rempli depuis la demande du client)
  const items = programV2Items(section, content, (t) => formatTime(t, content.language));
  const stemUrl = `url(/decor/tiges/${section.stem ?? "feuilles"}.svg)`;
  // Colonnes en % de la largeur de l'invitation : heure | tige | texte
  const cols = "grid-cols-[24cqw_12cqw_minmax(0,1fr)]";
  return (
    <section className="relative px-[6cqw] pb-16 pt-14">
      <Reveal>
        {kicker ? (
          <El id="kicker">
            <p className="text-center text-[0.68rem] uppercase tracking-[0.24em]" style={{ color: "var(--inv-muted)" }}>{kicker}</p>
          </El>
        ) : null}
        {title ? (
          <El id="title">
            <h2 className="mx-auto mt-3 max-w-[300px] text-center text-[2rem] leading-snug" style={{ ...css.script, color: "var(--inv-ink)" }}>{title}</h2>
          </El>
        ) : null}
      </Reveal>
      {items.length ? (
        <div className="relative mt-10">
          <El id="stem" className="pointer-events-none absolute inset-y-0" style={{ left: "24cqw", width: "12cqw" }}>
            <div
              aria-hidden="true"
              className="h-full w-full"
              style={{
                backgroundColor: "var(--inv-accent)",
                WebkitMaskImage: stemUrl,
                maskImage: stemUrl,
                WebkitMaskRepeat: "repeat-y",
                maskRepeat: "repeat-y",
                WebkitMaskSize: "100% auto",
                maskSize: "100% auto",
                WebkitMaskPosition: "center top",
                maskPosition: "center top",
              }}
            />
          </El>
          {marker ? (
            <El id="marker" className="pointer-events-none absolute z-[2]" style={{ left: "24cqw", width: "12cqw", top: "calc(var(--p, 0) * (100% - 12cqw))", transition: "top 140ms linear" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={marker} alt="" className="block h-auto w-full drop-shadow-sm" />
            </El>
          ) : null}
          <El id="list">
            <ol className="relative">
              {items.map((it) => {
                const k = `list.${elKey(it.id)}`;
                return (
                  <El id={k} as="li" key={it.id} className={`grid ${cols} items-start py-[3.4cqw]`}>
                    <El id={`${k}.time`}>
                      <p className="pt-0.5 text-[1.05rem] uppercase lining-nums tracking-wide" style={{ ...css.display, color: "var(--inv-ink)" }}>{it.time}</p>
                    </El>
                    <span aria-hidden="true" />
                    <div className="min-w-0">
                      <El id={`${k}.title`}>
                        <p className="text-[1.02rem] uppercase tracking-[0.06em]" style={{ ...css.display, color: "var(--inv-ink)" }}>{it.title}</p>
                      </El>
                      {it.detail ? (
                        <El id={`${k}.detail`}>
                          <p className="mt-1 whitespace-pre-line text-[0.66rem] uppercase leading-relaxed tracking-[0.06em]" style={{ color: "var(--inv-muted)" }}>{it.detail}</p>
                        </El>
                      ) : null}
                    </div>
                  </El>
                );
              })}
            </ol>
          </El>
        </div>
      ) : null}
    </section>
  );
}
