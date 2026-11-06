"use client";

import { cdnFallback, cdnImage } from "@/lib/image-cdn";

import { Fragment, createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Arch, CornerSpray, Divider, Sprig } from "@/components/ornaments";
import { EVENT_TYPE_LABELS, isSimpleStem, programV2Items, type InvitationContent, type InvitationEvent, type InvitationSection, type RendererKey } from "@/lib/invitation/schema";
import { calendarHref } from "@/lib/ics";
import { ScratchCard } from "./ScratchCard";
import { LayerEditorContext } from "./editor-context";
import { LOCALES, formatDayLabel, formatDotDate, formatLongDate, formatTime, zonedToUtc } from "@/lib/time";
import { eventDay, isMultiDay, sortByDay, rsvpEvents } from "@/lib/invitation/audience";
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
                  <img src={cdnImage(couple.photoUrl, 120)} onError={cdnFallback(couple.photoUrl)} alt="" className="mx-auto mt-5 h-24 w-24 rounded-full object-cover" />
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
    <section className={`relative overflow-x-clip px-7 pb-20 text-center ${renderer === "the-garden" ? "pt-24" : "pt-20"}`}>
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
            <img src={cdnImage(couple.photoUrl, 200)} onError={cdnFallback(couple.photoUrl)} alt="" className="mx-auto mt-8 aspect-[3/4] w-40 object-cover" />
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
  const multi = isMultiDay(content);
  const events = (multi ? sortByDay(content) : content.events).filter((e) => e.startTime || e.title);
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
          const newDay = multi && (i === 0 || eventDay(events[i - 1], content) !== eventDay(e, content));
          // Même lieu que le moment précédent (même jour) : on ne le répète pas
          const prev = events.slice(0, i).reverse().find((x) => x.venueName.trim());
          const showPlace = !!e.venueName.trim() && !(prev && prev.venueName.trim().toLowerCase() === e.venueName.trim().toLowerCase() && eventDay(prev, content) === eventDay(e, content));
          return (
          <Fragment key={e.id}>
          {newDay ? (
            <li className={`list-none text-center ${i > 0 ? "mt-12" : ""} mb-7`} aria-hidden={false}>
              <p className="text-[0.72rem] uppercase tracking-[0.3em]" style={{ color: "var(--inv-accent)" }}>{formatDayLabel(eventDay(e, content), content.language)}</p>
              <span aria-hidden="true" className="mx-auto mt-2 block h-px w-10" style={{ backgroundColor: "var(--inv-accent)", opacity: 0.4 }} />
            </li>
          ) : null}
          <El id={k} as="li" className={renderer === "province" ? "relative mb-7 flex gap-6" : "mb-9 text-center last:mb-0"}>
            {renderer === "province" ? (
              <>
                <El id={`${k}.time`} as="span" className="w-14 shrink-0 pt-0.5 text-end text-[1.15rem]" style={{ ...css.display, color: "var(--inv-accent)" }}>
                  {formatTime(e.startTime, content.language)}
                </El>
                <span aria-hidden="true" className="relative z-10 mt-2.5 h-2 w-2 shrink-0 rotate-45" style={{ backgroundColor: "var(--inv-accent)", marginInlineStart: "-0.5rem" }} />
                <div>
                  <El id={`${k}.title`}><p className="text-[1.05rem]" style={{ color: "var(--inv-ink)" }}>{e.title || EVENT_TYPE_LABELS[e.type]}</p></El>
                  {showPlace ? <El id={`${k}.place`}><p className="text-sm" style={{ color: "var(--inv-muted)" }}>{e.venueName}</p></El> : null}
                  {e.description ? <El id={`${k}.desc`}><p className="mt-1 text-sm" style={{ color: "var(--inv-muted)" }}>{e.description}</p></El> : null}
                </div>
              </>
            ) : (
              <>
                {i > 0 && !newDay && renderer === "the-garden" ? <Divider className="mx-auto mb-6 h-3 w-16" stroke="var(--inv-soft)" /> : null}
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
                {showPlace ? <El id={`${k}.place`}><p className="mt-1 text-sm" style={{ color: "var(--inv-muted)" }}>{e.venueName}</p></El> : null}
                {e.description ? <El id={`${k}.desc`}><p className="mt-1 text-sm italic" style={{ color: "var(--inv-muted)" }}>{e.description}</p></El> : null}
              </>
            )}
          </El>
          </Fragment>
          );
        })}
      </ol>
      </El>
    </Shell>
  );
}

/* ── Compte à rebours (logique verrouillée) ────────────────────────── */
export function CountdownSection({ content, renderer, labels, title, section }: SectionProps & { section?: InvitationSection }) {
  if (section?.look === "savedate") return <SaveTheDate content={content} labels={labels} title={title} section={section} />;
  return <ClassicCountdown content={content} renderer={renderer} labels={labels} title={title} />;
}

/** Temps restant avant l'événement, mis à jour chaque seconde (null avant l'affichage dans le navigateur). */
function useCountdown(content: InvitationContent) {
  const target = useMemo(() => zonedToUtc(content.eventAt, content.timezone), [content.eventAt, content.timezone]);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return { target, diff: target && now !== null ? target.getTime() - now : null };
}

/** Petit nœud entre deux traits */
function BowDivider({ wide = false }: { wide?: boolean }) {
  return (
    <div aria-hidden="true" className={`mx-auto flex items-center justify-center gap-2 ${wide ? "w-[270px]" : "w-[170px]"}`} style={{ color: "var(--inv-accent)" }}>
      <span className="h-px flex-1" style={{ background: "currentColor", opacity: 0.55 }} />
      <svg viewBox="0 0 40 14" width={wide ? 40 : 26} height={wide ? 14 : 9} fill="currentColor" style={{ opacity: 0.8 }}>
        <path d="M20 7C15 2 7 1 3 3.2c3 1 4.6 2.4 5 3.8-.4 1.4-2 2.8-5 3.8C7 13 15 12 20 7zM20 7c5-5 13-6 17-3.8-3 1-4.6 2.4-5 3.8.4 1.4 2 2.8 5 3.8C33 13 25 12 20 7z" opacity=".75" />
        <circle cx="20" cy="7" r="2.3" />
        <path d="M19 8l-4 5M21 8l4 5" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
      <span className="h-px flex-1" style={{ background: "currentColor", opacity: 0.55 }} />
    </div>
  );
}

/** « Save the date » : grande date, heure, compteur en cases et bouton calendrier */
function SaveTheDate({ content, labels, title, section }: { content: InvitationContent; labels: SectionProps["labels"]; title: string; section: InvitationSection }) {
  const { diff } = useCountdown(content);
  if (!content.eventAt) return null;
  const d = new Date(`${content.eventAt.slice(0, 10)}T12:00:00Z`);
  const locale = LOCALES[content.language];
  const fmtPart = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...o, timeZone: "UTC" }).format(d);
  const time = content.eventAt.slice(11, 16);
  const couple = [content.couple.partnerOne, content.couple.partnerTwo].filter(Boolean).join(" & ");
  const cal = calendarHref({ date: content.eventAt.slice(0, 10), time: time || "12:00", timeZone: content.timezone, title: couple || title || labels.saveTheDate, location: [content.mainVenue.name, content.mainVenue.city].filter(Boolean).join(", ") });
  const parts =
    diff !== null && diff > 0
      ? [
          { v: Math.floor(diff / 86_400_000), l: labels.days },
          { v: Math.floor((diff / 3_600_000) % 24), l: labels.hours },
          { v: Math.floor((diff / 60_000) % 60), l: labels.minutes },
          { v: Math.floor((diff / 1000) % 60), l: labels.seconds },
        ]
      : null;
  const ink = { ...css.display, color: "var(--inv-ink)" };
  return (
    <section className="relative px-7 pb-16 pt-12 text-center">
      <Reveal>
        <El id="title">
          <h2 className="text-[2.7rem] leading-tight" style={ink}>{title || labels.saveTheDate}</h2>
        </El>
        <div className="mt-2"><BowDivider /></div>
        <El id="date" className="mt-10">
          <p className="text-[6.2rem] leading-[0.8] lining-nums" style={ink}>{fmtPart({ day: "numeric" })}</p>
          <p className="mt-1 text-[2.6rem] capitalize leading-tight" style={ink}>{fmtPart({ month: "long" })}</p>
          <p className="mt-3 text-[2.2rem] leading-none tracking-wide" style={ink}>{fmtPart({ year: "numeric" })}</p>
        </El>
        <div className="mt-6"><BowDivider /></div>
        {time ? (
          <El id="time">
            <p className="mt-6 text-[1.9rem]" style={ink}>{labels.atTime.replace("{time}", formatTime(time, content.language))}</p>
          </El>
        ) : null}
        <div className="mt-6"><BowDivider wide /></div>
      </Reveal>
      <El id="kicker">
        <p className="mt-7 text-[1.35rem]" style={ink}>{section.kicker || labels.countingDown}</p>
      </El>
      <El id="timer">
        {parts ? (
          <div className="mx-auto mt-5 grid max-w-[335px] grid-cols-4 gap-2.5" role="timer" aria-live="off">
            {parts.map((p) => (
              <div key={p.l} className="rounded-xl border px-1 py-3.5" style={{ borderColor: "color-mix(in srgb, var(--inv-ink) 30%, transparent)", background: "color-mix(in srgb, var(--inv-bg) 70%, white)", boxShadow: "inset 0 1px 4px rgb(0 0 0 / 0.06)" }}>
                <span className="block text-[1.9rem] leading-none lining-nums tabular-nums" style={ink}>{String(p.v).padStart(2, "0")}</span>
                <span className="mt-1.5 block truncate text-[0.82rem] capitalize" style={{ ...css.display, color: "var(--inv-muted)" }}>{p.l}</span>
              </div>
            ))}
          </div>
        ) : diff === null ? (
          <div className="h-[92px]" aria-hidden="true" />
        ) : (
          <p className="mt-5 text-lg" style={{ ...css.script, color: "var(--inv-accent)" }}>{diff > -86_400_000 ? labels.countdownToday : labels.countdownPast}</p>
        )}
      </El>
      {cal && parts ? (
        <El id="calendar" className="mt-8">
          <a href={cal} className="inline-flex min-h-12 items-center gap-3 whitespace-nowrap rounded-full border px-7 text-[1.1rem] transition hover:brightness-95" style={{ ...ink, borderColor: "color-mix(in srgb, var(--inv-ink) 45%, transparent)", background: "color-mix(in srgb, var(--inv-bg) 75%, white)" }}>
            <CalendarIcon /> {labels.addCalendar}
          </a>
        </El>
      ) : null}
    </section>
  );
}

function ClassicCountdown({ content, renderer, labels, title }: SectionProps) {
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

/* ── Date à gratter ────────────────────────────────────────────────── */
export function ScratchSection({ content, renderer, labels, title, section }: SectionProps & { section: InvitationSection }) {
  const editor = useContext(LayerEditorContext);
  const [found, setFound] = useState<Set<number>>(new Set());
  if (!content.eventAt) return null;
  const d = new Date(`${content.eventAt.slice(0, 10)}T12:00:00Z`);
  const locale = LOCALES[content.language];
  const parts = [
    { v: new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" }).format(d), l: labels.scratchDay },
    { v: new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(d), l: labels.scratchMonth },
    { v: new Intl.DateTimeFormat(locale, { year: "numeric", timeZone: "UTC" }).format(d), l: labels.scratchYear },
  ];
  const cover = section.coverColor || "var(--inv-soft)";
  const all = found.size >= parts.length;
  return (
    <Shell renderer={renderer}>
      <SectionTitle renderer={renderer}>{title || labels.scratchTitle}</SectionTitle>
      <El id="hint">
        <p className="-mt-2 mb-6 text-center text-[0.85rem] tracking-wide" style={{ color: "var(--inv-accent)" }}>
          ✦ {section.kicker || labels.scratchHint} ✦
        </p>
      </El>
      <El id="cards">
        <div className="mx-auto grid max-w-[330px] grid-cols-3 gap-3">
          {parts.map((p, i) => (
            <div key={p.l} className="text-center">
              <div className="aspect-[4/4.6] overflow-hidden rounded-xl shadow-[0_6px_18px_-8px_rgb(0_0_0/0.25)]" style={{ backgroundColor: "var(--inv-surface, #fff)" }}>
                <ScratchCover
                  cover={cover}
                  label={p.l}
                  revealLabel={labels.scratchReveal}
                  disabled={!!editor}
                  onReveal={() => setFound((f) => new Set(f).add(i))}
                >
                  <span
                    className={`flex h-full w-full items-center justify-center px-1 leading-none ${i === 1 ? "text-[clamp(0.85rem,17.94px,1.25rem)]" : "text-[clamp(1.4rem,31.2px,2.1rem)]"}`}
                    style={{ ...css.display, color: "var(--inv-ink)" }}
                  >
                    {p.v}
                  </span>
                </ScratchCover>
              </div>
              <span className="mt-2 block text-[0.6rem] uppercase tracking-[0.28em]" style={{ color: "var(--inv-muted)" }}>{p.l}</span>
            </div>
          ))}
        </div>
      </El>
      <El id="done">
        <p
          aria-live="polite"
          className={`mt-8 text-center text-[2rem] leading-tight transition-all duration-1000 ${all || editor ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
          style={{ ...css.script, color: "var(--inv-ink)" }}
        >
          {all || editor ? section.body || labels.scratchDone : "\u00a0"}
        </p>
      </El>
    </Shell>
  );
}

/** La pellicule a besoin d'une vraie couleur : on lit la variable du thème si besoin. */
function ScratchCover(props: { cover: string; label: string; revealLabel: string; disabled: boolean; onReveal: () => void; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [color, setColor] = useState(props.cover.startsWith("var(") ? "" : props.cover);
  useEffect(() => {
    if (!props.cover.startsWith("var(")) return setColor(props.cover);
    const name = props.cover.slice(4, -1).split(",")[0].trim();
    const v = ref.current ? getComputedStyle(ref.current).getPropertyValue(name).trim() : "";
    setColor(v || "#cfdce6");
  }, [props.cover]);
  return (
    <span ref={ref} className="block h-full w-full">
      {color ? (
        <ScratchCard cover={color} label={props.label} revealLabel={props.revealLabel} disabled={props.disabled} onReveal={props.onReveal}>
          {props.children}
        </ScratchCard>
      ) : (
        <span className="block h-full w-full" style={{ backgroundColor: "#cfdce6" }} />
      )}
    </span>
  );
}

/* ── Dress code ────────────────────────────────────────────────────── */
export function DressCodeSection({ content, renderer, labels, title }: SectionProps) {
  const { text, palette } = content.dressCode;
  // Dans l'éditeur, une section vide reste visible (avec des repères) pour pouvoir la remplir
  const editing = useContext(LayerEditorContext) !== null;
  if (!text && !palette.length && !editing) return null;
  return (
    <Shell renderer={renderer} tone="tinted">
      <SectionTitle renderer={renderer}>{title || labels.dresscode}</SectionTitle>
      <El id="text">
        <p className="mx-auto max-w-[300px] text-center leading-relaxed" style={{ color: "var(--inv-ink)" }}>
          {text || (editing ? <span style={{ opacity: 0.45, fontStyle: "italic" }}>Texte du dress code — à écrire dans « Texte du dress code » (panneau de gauche)</span> : null)}
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
      ) : editing ? (
        <El id="palette">
          <ul className="mt-7 flex justify-center gap-3" aria-label="Palette de couleurs (vide)">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="h-9 w-9 rounded-full border border-dashed" style={{ borderColor: "var(--inv-muted)", opacity: 0.5 }} />
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

export function VenuesSection({ content, renderer, labels, title, section }: SectionProps & { section?: InvitationSection }) {
  // Un lieu par adresse distincte
  const seen = new Set<string>();
  const venues = content.events.filter((e) => {
    if (!e.address) return false;
    const key = `${e.address.toLowerCase()}|${eventDay(e, content)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const p = content.practical;
  const practical = [
    { id: "parking", k: labels.parking, v: p.parking },
    { id: "shuttles", k: labels.shuttles, v: p.shuttles },
    { id: "transport", k: labels.transport, v: p.transport },
    { id: "lodging", k: labels.lodging, v: p.lodging },
  ].filter((x) => x.v);
  if (!venues.length && !practical.length) return null;
  const opts = section?.venueOptions ?? { calendar: true, buttonBg: "", buttonInk: "", detail: "" };
  const detail = opts.detail || "var(--inv-accent)";
  const btnStyle = { backgroundColor: opts.buttonBg || "var(--inv-accent)", color: opts.buttonInk || "var(--inv-bg)", fontFamily: "var(--inv-display)" };
  const btnCls = "inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-[0.95rem] transition hover:brightness-110 active:scale-[0.98]";
  const multi = isMultiDay(content);
  const couple = [content.couple.partnerOne, content.couple.partnerTwo].filter(Boolean).join(" & ");
  if (section?.look === "map") return <VenuesWithMap content={content} labels={labels} title={title} section={section} venues={venues} practical={practical} />;
  return (
    <Shell renderer={renderer}>
      <SectionTitle renderer={renderer}>{title || labels.venues}</SectionTitle>
      <El id="list">
      <div className="mx-auto max-w-[320px]">
        {venues.map((e, i) => {
          const links = mapLinks(e);
          const k = `list.${elKey(e.id)}`;
          const eventTitle = e.title || EVENT_TYPE_LABELS[e.type];
          const time = e.startTime || e.arrivalTime;
          const cal = opts.calendar
            ? calendarHref({ date: eventDay(e, content), time, timeZone: content.timezone, title: couple ? `${couple} · ${eventTitle}` : eventTitle, location: [e.venueName, e.address].filter(Boolean).join(", ") })
            : null;
          return (
            <El id={k} key={e.id} className="text-center">
              {i > 0 ? <div aria-hidden="true" className="mx-auto my-8 h-px w-10" style={{ backgroundColor: detail, opacity: 0.45 }} /> : null}
              <El id={`${k}.title`}>
                <p className="text-[0.75rem] uppercase tracking-[0.24em]" style={{ color: detail }}>{eventTitle}</p>
                {multi ? <p className="mt-1 text-[0.8rem]" style={{ color: "var(--inv-muted)" }}>{formatDayLabel(eventDay(e, content), content.language)}</p> : null}
              </El>
              <El id={`${k}.place`}>
                <p className="mt-2 text-[1.7rem] leading-tight" style={{ color: "var(--inv-ink)", fontFamily: "var(--inv-display)" }}>{e.venueName}</p>
              </El>
              <El id={`${k}.address`}><p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--inv-muted)" }}>{e.address}</p></El>
              {time ? (
                <El id={`${k}.time`}>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--inv-muted)" }}>
                    <ClockIcon color={detail} />
                    <bdi dir="ltr">
                      {e.arrivalTime && e.startTime && e.arrivalTime !== e.startTime
                        ? `${labels.arrival} ${formatTime(e.arrivalTime, content.language)} · ${formatTime(e.startTime, content.language)}`
                        : formatTime(time, content.language)}
                      {e.endTime && e.startTime ? ` – ${formatTime(e.endTime, content.language)}` : ""}
                    </bdi>
                  </p>
                </El>
              ) : null}
              <El id={`${k}.maps`} className="mt-4 flex flex-wrap justify-center gap-2">
                <a href={links.google} target="_blank" rel="noopener noreferrer" className={btnCls} style={btnStyle}>
                  <PinIcon /> {labels.directions}
                </a>
                {cal ? (
                  <a href={cal} className={btnCls} style={btnStyle}>
                    <CalendarIcon /> {labels.calendar}
                  </a>
                ) : null}
              </El>
            </El>
          );
        })}
        {practical.length ? (
          <El id="list.practical">
          <dl className={`space-y-6 text-center ${venues.length ? "mt-12" : ""}`}>
            {venues.length ? <div aria-hidden="true" className="mx-auto -mt-2 mb-8 h-px w-10" style={{ backgroundColor: detail, opacity: 0.45 }} /> : null}
            {practical.map((x) => (
              <El id={`list.practical.${x.id}`} key={x.id}>
                <El id={`list.practical.${x.id}.label`}>
                  <dt className="text-[0.68rem] uppercase tracking-[0.26em]" style={{ color: detail }}>{x.k}</dt>
                </El>
                <El id={`list.practical.${x.id}.text`}>
                  <dd className="mt-1.5 text-[1.18rem] leading-snug" style={{ color: "var(--inv-ink)", fontFamily: 'var(--el-font, "Cormorant Garamond", Georgia, serif)' }}>{x.v}</dd>
                </El>
              </El>
            ))}
          </dl>
          </El>
        ) : null}
      </div>
      </El>
    </Shell>
  );
}

/** Lieux avec carte Google Maps intégrée et bouton « Itinéraire » */
function VenuesWithMap({ content, labels, title, section, venues, practical }: { content: InvitationContent; labels: SectionProps["labels"]; title: string; section: InvitationSection; venues: InvitationEvent[]; practical: Array<{ id: string; k: string; v: string }> }) {
  const editor = useContext(LayerEditorContext);
  const opts = section.venueOptions;
  const multi = isMultiDay(content);
  return (
    <section className="relative px-6 pb-16 pt-14 text-center">
      <Reveal>
        <El id="kicker">
          <p className="text-[0.8rem] uppercase tracking-[0.4em]" style={{ color: opts.detail || "var(--inv-accent)" }}>{section.kicker || labels.where}</p>
        </El>
        <El id="title">
          <h2 className="mt-1 text-[3.1rem] leading-tight" style={{ ...css.script, color: "var(--inv-ink)" }}>{title || labels.theVenue}</h2>
        </El>
      </Reveal>
      <El id="list">
        <div className="mt-8 space-y-14">
          {venues.map((e) => {
            const k = `list.${elKey(e.id)}`;
            const q = [e.venueName, e.address].filter(Boolean).join(", ");
            const showTitle = venues.length > 1;
            return (
              <El id={k} key={e.id}>
                {showTitle ? (
                  <El id={`${k}.title`}>
                    <p className="text-[0.72rem] uppercase tracking-[0.26em]" style={{ color: opts.detail || "var(--inv-accent)" }}>{e.title || EVENT_TYPE_LABELS[e.type]}</p>
                    {multi ? <p className="mt-1 text-[0.8rem]" style={{ color: "var(--inv-muted)" }}>{formatDayLabel(eventDay(e, content), content.language)}</p> : null}
                  </El>
                ) : null}
                <El id={`${k}.place`}>
                  <p className="mt-2 text-[2.3rem] leading-tight" style={{ ...css.display, color: "var(--inv-ink)" }}>{e.venueName}</p>
                </El>
                <El id={`${k}.address`}>
                  <p className="mt-1 text-[0.95rem] tracking-wide" style={{ color: "var(--inv-muted)" }}>{e.address}</p>
                </El>
                <div className="mt-7 overflow-hidden rounded-[22px] bg-white p-1.5 shadow-[0_18px_40px_-14px_rgb(0_0_0/0.28)]">
                  <iframe
                    title={`${labels.openMap} — ${e.venueName || e.address}`}
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="block h-[245px] w-full rounded-[17px] border-0"
                    style={editor ? { pointerEvents: "none" } : undefined}
                  />
                </div>
                <El id={`${k}.maps`} className="mt-8">
                  <a
                    href={mapLinks(e).google}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center gap-3 rounded-full px-10 text-[0.85rem] uppercase tracking-[0.22em] shadow-[0_14px_26px_-12px_rgb(0_0_0/0.35)] transition hover:brightness-110 active:scale-[0.98]"
                    style={{ backgroundColor: opts.buttonBg || "var(--inv-accent)", color: opts.buttonInk || "var(--inv-bg)" }}
                  >
                    <PinIcon /> {labels.directions}
                  </a>
                </El>
              </El>
            );
          })}
          {practical.length ? (
            <El id="list.practical">
              <dl className="space-y-6">
                {practical.map((x) => (
                  <El id={`list.practical.${x.id}`} key={x.id}>
                    <El id={`list.practical.${x.id}.label`}>
                      <dt className="text-[0.68rem] uppercase tracking-[0.26em]" style={{ color: opts.detail || "var(--inv-accent)" }}>{x.k}</dt>
                    </El>
                    <El id={`list.practical.${x.id}.text`}>
                      <dd className="mt-1.5 text-[1.18rem] leading-snug" style={{ ...css.display, color: "var(--inv-ink)" }}>{x.v}</dd>
                    </El>
                  </El>
                ))}
              </dl>
            </El>
          ) : null}
        </div>
      </El>
    </section>
  );
}

function ClockIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      <path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </svg>
  );
}

/* ── RSVP (démo) ───────────────────────────────────────────────────── */
export function RsvpSection({ content, renderer, labels, title, mode, slug, rsvp, section }: SectionProps & { mode: "demo" | "preview" | "live"; section?: InvitationSection }) {
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
  const ticket = section?.look === "ticket";
  const intro = content.rsvp.intro || (deadline ? `${labels.rsvpBefore} ${deadline}.` : "");
  const formBlock = (
    <>
      <El id="form">
      {mode === "live" ? (
        rsvp && slug ? (
          <LiveRsvpForm slug={slug} config={rsvp} events={rsvpEvents(content.events)} labels={labels} />
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
    </>
  );
  if (ticket)
    return (
      <section className="relative px-[27px] pb-12 pt-10" style={{ background: "linear-gradient(170deg, color-mix(in srgb, var(--inv-accent) 72%, white), var(--inv-accent))" }}>
        <Reveal>
          <El id="kicker">
            <p className="text-center text-[0.78rem] uppercase tracking-[0.4em]" style={{ color: "color-mix(in srgb, var(--inv-bg) 85%, transparent)" }}>{section?.kicker || labels.kindlyReply}</p>
          </El>
          <El id="title">
            <h2 className="mt-1 text-center text-[3rem] leading-tight" style={{ ...css.script, color: "var(--inv-bg)" }}>{title || labels.willYouJoin}</h2>
          </El>
        </Reveal>
        <div className="inv-ticket mt-5 px-6 pb-12 pt-12" style={{ backgroundColor: "var(--inv-bg)" }}>
          <El id="mark">
            <p className="text-center text-[3.2rem] leading-none" style={{ ...css.script, color: "var(--inv-ink)" }}>{labels.rsvpMark}</p>
          </El>
          {intro ? (
            <El id="intro">
              <p className="mx-auto mt-5 max-w-[290px] text-center text-[0.72rem] uppercase leading-relaxed tracking-[0.22em]" style={{ color: "var(--inv-muted)" }}>{intro}</p>
            </El>
          ) : null}
          <div className="mt-6">{formBlock}</div>
        </div>
      </section>
    );
  return (
    <Shell renderer={renderer} tone="tinted">
      <SectionTitle renderer={renderer}>{title || labels.rsvp}</SectionTitle>
      {intro ? (
        <El id="intro">
          <p className="mx-auto mb-7 max-w-[300px] text-center text-sm leading-relaxed" style={{ color: "var(--inv-muted)" }}>
            {intro}
          </p>
        </El>
      ) : null}
      {formBlock}
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
    <section className="relative overflow-x-clip px-7 pb-24 pt-16 text-center">
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

/* ── Programme v2 : frise (tige fleurie, trait, perles…) et mises en page ── */
type TItem = { id: string; time: string; title: string; detail: string; icon?: string };

/** Tige verticale qui remplit son conteneur : SVG fleuri, ou trait simple dessiné en CSS */
function StemLine({ stem, color }: { stem: string; color: string }) {
  if (stem === "aucune") return null;
  if (isSimpleStem(stem)) {
    const dashed = stem === "tirets";
    return (
      <div
        aria-hidden="true"
        className="mx-auto h-full"
        style={{
          width: "1.2px",
          background: dashed ? `repeating-linear-gradient(to bottom, ${color} 0 6px, transparent 6px 12px)` : color,
          opacity: 0.85,
        }}
      />
    );
  }
  const url = `url(/decor/tiges/${stem}.svg)`;
  return (
    <div
      aria-hidden="true"
      className="h-full w-full"
      style={{ backgroundColor: color, WebkitMaskImage: url, maskImage: url, WebkitMaskRepeat: "repeat-y", maskRepeat: "repeat-y", WebkitMaskSize: "100% auto", maskSize: "100% auto", WebkitMaskPosition: "center top", maskPosition: "center top" }}
    />
  );
}

/** Perle posée sur la ligne, au niveau de chaque moment */
function Pearl({ color, size = 11 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="relative z-[1] mx-auto block rounded-full"
      style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, #fff 0 18%, ${color} 60%)`, boxShadow: `0 0 0 3px var(--inv-bg), 0 0 0 4px color-mix(in srgb, ${color} 35%, transparent)` }}
    />
  );
}

/** Icône de la bibliothèque, recolorée */
function MomentIcon({ src, color, size }: { src: string; color: string; size: number }) {
  return (
    <span
      aria-hidden="true"
      className="block shrink-0"
      style={{ width: size, height: size, backgroundColor: color, WebkitMaskImage: `url("${src}")`, maskImage: `url("${src}")`, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }}
    />
  );
}

export function ProgramV2Section({ section, content }: SectionProps & { section: InvitationSection }) {
  const { kicker, title, marker } = section;
  // Par défaut, le programme de l'invitation (rempli depuis la demande du client)
  const items: TItem[] = programV2Items(section, content, (t) => formatTime(t, content.language), (d) => formatDayLabel(d, content.language));
  const layout = section.timeline ?? "classic";
  const stem = section.stem ?? "feuilles";
  const stemColor = section.stemColor || "var(--inv-accent)";
  const iconColor = section.iconColor || section.stemColor || "var(--inv-accent)";
  const pearls = stem === "perles";
  const showIcons = layout !== "classic";
  const timeCls = "text-[1.05rem] uppercase lining-nums tracking-wide";
  const titleCls = "text-[1.02rem] uppercase tracking-[0.06em]";
  const detailCls = "mt-1 whitespace-pre-line text-[0.66rem] uppercase leading-relaxed tracking-[0.06em]";
  const ink = { ...css.display, color: "var(--inv-ink)" };
  const muted = { color: "var(--inv-muted)" };
  const Texts = ({ it, k, align = "left" }: { it: TItem; k: string; align?: "left" | "center" | "right" }) => (
    <div className="min-w-0" style={{ textAlign: align }}>
      <El id={`${k}.title`}>
        <p className={titleCls} style={ink}>{it.title}</p>
      </El>
      {it.detail ? (
        <El id={`${k}.detail`}>
          <p className={detailCls} style={muted}>{it.detail}</p>
        </El>
      ) : null}
    </div>
  );
  const Icon = ({ it, k, size }: { it: TItem; k: string; size: number }) =>
    showIcons && it.icon ? (
      <El id={`${k}.icon`}>
        <MomentIcon src={it.icon} color={iconColor} size={size} />
      </El>
    ) : null;

  let body: ReactNode = null;
  if (items.length && layout === "centered") {
    // Médaillons : icône dans un cercle, heure, intitulé ; un trait relie les moments
    body = (
      <El id="list">
        <ol className="relative mt-8 flex flex-col items-center">
          {items.map((it, i) => {
            const k = `list.${elKey(it.id)}`;
            return (
              <El id={k} as="li" key={it.id} className="flex w-full flex-col items-center text-center">
                {i > 0 ? (
                  <El id="stem" className="pointer-events-none my-2 h-9 w-[46.8px]">
                    <StemLine stem={stem} color={stemColor} />
                  </El>
                ) : null}
                {showIcons && it.icon ? (
                  <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full" style={{ border: `1px solid ${stemColor}` }}>
                    <Icon it={it} k={k} size={32} />
                  </span>
                ) : (
                  <Pearl color={stemColor} />
                )}
                <El id={`${k}.time`}>
                  <p className={`mt-3 ${timeCls}`} style={ink}>{it.time}</p>
                </El>
                <div className="mt-1 max-w-[280px]">
                  <Texts it={it} k={k} align="center" />
                </div>
              </El>
            );
          })}
        </ol>
      </El>
    );
  } else if (items.length && layout === "alternate") {
    // Zigzag : une ligne au centre, les moments de part et d'autre, l'icône en face
    body = (
      <div className="relative mt-10">
        <El id="stem" className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2" style={{ width: "46.8px" }}>
          <StemLine stem={stem} color={stemColor} />
        </El>
        <El id="list">
          <ol className="relative">
            {items.map((it, i) => {
              const k = `list.${elKey(it.id)}`;
              const left = i % 2 === 0;
              const text = (
                <div className={left ? "text-right" : "text-left"}>
                  <El id={`${k}.time`}>
                    <p className={timeCls} style={ink}>{it.time}</p>
                  </El>
                  <div className="mt-1">
                    <Texts it={it} k={k} align={left ? "right" : "left"} />
                  </div>
                </div>
              );
              const icon = <div className={`flex ${left ? "justify-start" : "justify-end"} pt-1`}><Icon it={it} k={k} size={40} /></div>;
              return (
                <El id={k} as="li" key={it.id} className="grid grid-cols-[minmax(0,1fr)_46.8px_minmax(0,1fr)] items-start py-[14px]">
                  {left ? text : icon}
                  <span className="flex justify-center pt-[7px]">{pearls || stem === "aucune" ? <Pearl color={stemColor} /> : <span className="block h-[7px] w-[7px] rotate-45" style={{ background: stemColor }} />}</span>
                  {left ? icon : text}
                </El>
              );
            })}
          </ol>
        </El>
      </div>
    );
  } else if (items.length) {
    // Classique (heure | tige | texte) ou avec icônes à droite
    const cols = layout === "icons" ? "grid-cols-[72px_30px_minmax(0,1fr)_46px]" : "grid-cols-[93.6px_46.8px_minmax(0,1fr)]";
    const stemLeft = layout === "icons" ? "72px" : "93.6px";
    const stemWidth = layout === "icons" ? "30px" : "46.8px";
    body = (
      <div className="relative mt-10">
        <El id="stem" className="pointer-events-none absolute inset-y-0" style={{ left: stemLeft, width: stemWidth }}>
          <StemLine stem={stem} color={stemColor} />
        </El>
        {marker && layout === "classic" ? (
          <El id="marker" className="pointer-events-none absolute z-[2]" style={{ left: "93.6px", width: "46.8px", top: "calc(var(--p, 0) * (100% - 46.8px))", transition: "top 140ms linear" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={marker} alt="" className="block h-auto w-full drop-shadow-sm" />
          </El>
        ) : null}
        <El id="list">
          <ol className="relative">
            {items.map((it) => {
              const k = `list.${elKey(it.id)}`;
              return (
                <El id={k} as="li" key={it.id} className={`grid ${cols} items-start py-[13.26px]`}>
                  <El id={`${k}.time`}>
                    <p className={`pt-0.5 ${timeCls}`} style={ink}>{it.time}</p>
                  </El>
                  <span aria-hidden="true" className="pt-[8px]">{pearls ? <Pearl color={stemColor} /> : null}</span>
                  <Texts it={it} k={k} />
                  {layout === "icons" ? <div className="flex justify-end"><Icon it={it} k={k} size={38} /></div> : null}
                </El>
              );
            })}
          </ol>
        </El>
      </div>
    );
  }

  return (
    <section className="relative px-[23.4px] pb-16 pt-14">
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
      {body}
    </section>
  );
}

/* ── Album photo : carrousel (carte centrale, cartes voisines, flèches) ── */
export function GallerySection({ section, labels }: SectionProps & { section: InvitationSection }) {
  const photos = (section.photos ?? []).filter((p) => p.src);
  const [i, setI] = useState(0);
  const n = photos.length;
  const touch = useRef<number | null>(null);
  const go = (d: number) => n && setI((x) => (x + d + n) % n);
  const pad = (v: number) => String(v).padStart(2, "0");
  return (
    <section className="relative overflow-hidden pb-14 pt-14" aria-roledescription="carrousel" aria-label={section.title || "Album"}>
      <Reveal>
        {section.kicker ? (
          <El id="kicker">
            <p className="text-center text-[1.05rem] italic" style={{ ...css.display, color: "var(--inv-muted)" }}>{section.kicker}</p>
          </El>
        ) : null}
        {section.title ? (
          <El id="title">
            <h2 className="mx-auto mt-1 max-w-[320px] text-center text-[2.6rem] leading-none" style={{ ...css.script, color: "var(--inv-accent)" }}>{section.title}</h2>
          </El>
        ) : null}
      </Reveal>
      {n ? (
        <El id="album">
          <div
            className="relative mt-8 h-[300px] select-none"
            onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touch.current === null) return;
              const dx = e.changedTouches[0].clientX - touch.current;
              touch.current = null;
              if (Math.abs(dx) > 35) go(dx < 0 ? 1 : -1);
            }}
          >
            {photos.map((p, j) => {
              let off = j - i;
              if (off > n / 2) off -= n;
              if (off < -n / 2) off += n;
              const far = Math.abs(off) > 1;
              return (
                <figure
                  key={p.id}
                  aria-hidden={off !== 0}
                  className="absolute left-1/2 top-0 m-0 w-[210px] overflow-hidden rounded-[3px] bg-white p-[7px] shadow-[0_10px_28px_rgba(0,0,0,0.14)] transition-all duration-500 ease-out"
                  style={{
                    transform: `translateX(calc(-50% + ${off * 190}px)) scale(${off === 0 ? 1 : 0.82}) rotate(${off * 2.5}deg)`,
                    opacity: far ? 0 : off === 0 ? 1 : 0.55,
                    zIndex: 10 - Math.abs(off),
                    pointerEvents: far ? "none" : undefined,
                  }}
                  onClick={() => off !== 0 && go(off)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cdnImage(p.src, 420)} onError={cdnFallback(p.src)} alt={p.caption || ""} loading={j === i ? "eager" : "lazy"} className="block h-[262px] w-full object-cover" draggable={false} />
                  {p.caption ? <figcaption className="pt-1.5 text-center text-[0.7rem]" style={{ ...css.display, color: "var(--inv-muted)" }}>{p.caption}</figcaption> : null}
                </figure>
              );
            })}
          </div>
          {n > 1 ? (
            <div className="mt-5 flex items-center justify-center gap-5" style={{ color: "var(--inv-accent)" }}>
              <button type="button" onClick={() => go(-1)} aria-label={labels.previous} className="flex h-10 w-10 items-center justify-center rounded-full border" style={{ borderColor: "currentColor" }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
              </button>
              <p className="min-w-[64px] text-center text-[0.8rem] tracking-[0.2em] lining-nums" style={{ ...css.display, color: "var(--inv-ink)" }} aria-live="polite">
                {pad(i + 1)} / {pad(n)}
              </p>
              <button type="button" onClick={() => go(1)} aria-label={labels.next} className="flex h-10 w-10 items-center justify-center rounded-full border" style={{ borderColor: "currentColor" }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          ) : null}
          {n > 1 ? (
            <div className="mt-4 flex justify-center gap-2.5" aria-hidden="true">
              {photos.map((p, j) => (
                <span key={p.id} className="block h-[7px] w-[7px] rotate-45 transition-colors" style={{ border: "1px solid var(--inv-accent)", background: j === i ? "var(--inv-accent)" : "transparent" }} />
              ))}
            </div>
          ) : null}
        </El>
      ) : null}
    </section>
  );
}
