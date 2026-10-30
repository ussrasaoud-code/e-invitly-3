"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";
import type { FontKey, InvitationContent, RendererKey, SectionType } from "@/lib/invitation/schema";
import { Envelope } from "./Envelope";
import { labelsFor } from "./i18n";
import {
  AnimationContext,
  ClosingSection,
  ContactsSection,
  CountdownSection,
  DressCodeSection,
  HeroSection,
  ProgramSection,
  RsvpSection,
  VenuesSection,
  type SectionProps,
} from "./Sections";

const FONT_STACKS: Record<FontKey, string> = {
  aboreto: '"Aboreto", "Cormorant Garamond", serif',
  dancing: '"Dancing Script", cursive',
  jost: '"Jost Variable", "Jost", system-ui, sans-serif',
  cormorant: '"Cormorant Garamond", Georgia, serif',
  amiri: '"Amiri", serif',
};

const SECTION_COMPONENTS: Record<Exclude<SectionType, "rsvp">, (p: SectionProps) => React.ReactNode> = {
  hero: HeroSection,
  program: ProgramSection,
  countdown: CountdownSection,
  dresscode: DressCodeSection,
  venues: VenuesSection,
  contacts: ContactsSection,
  closing: ClosingSection,
};

export type InvitationViewProps = {
  content: InvitationContent;
  renderer: RendererKey;
  /** demo : contenu d'exemple · preview : aperçu admin · live : invitation publiée */
  mode: "demo" | "preview" | "live";
  /** true quand l'invitation est affichée dans un cadre (téléphone) plutôt qu'en plein écran */
  framed?: boolean;
  /** Masque l'enveloppe (aperçu dans l'éditeur) */
  skipEnvelope?: boolean;
};

export function InvitationView({ content, renderer, mode, framed = false, skipEnvelope = false }: InvitationViewProps) {
  const labels = labelsFor(content.language);
  const { colors, fonts } = content.theme;
  const showEnvelope = !skipEnvelope && content.envelope.mode !== "none";
  const [opened, setOpened] = useState(!showEnvelope);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const isArabic = content.language === "ar";

  const startMusic = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = 0.35;
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);

  const onOpened = useCallback(() => {
    setOpened(true);
    // Le toucher du cachet est un geste utilisateur : la musique peut démarrer.
    if (content.music.enabled && content.music.url) startMusic();
  }, [content.music.enabled, content.music.url, startMusic]);

  const vars = {
    "--inv-bg": colors.background,
    "--inv-surface": colors.surface,
    "--inv-ink": colors.ink,
    "--inv-muted": colors.muted,
    "--inv-accent": colors.accent,
    "--inv-soft": colors.accentSoft,
    "--inv-display": isArabic ? FONT_STACKS.amiri : FONT_STACKS[fonts.display],
    "--inv-script": isArabic ? FONT_STACKS.amiri : FONT_STACKS[fonts.script],
    "--inv-body": isArabic ? FONT_STACKS.amiri : FONT_STACKS[fonts.body],
    background: colors.background,
    color: colors.ink,
    fontFamily: "var(--inv-body)",
  } as CSSProperties;

  return (
    <div
      className={`relative ${framed ? "min-h-full" : "min-h-dvh"} paper-texture`}
      style={vars}
      dir={isArabic ? "rtl" : "ltr"}
      lang={content.language}
      data-renderer={renderer}
    >
      {showEnvelope ? (
        <Envelope
          envelope={content.envelope}
          colors={colors}
          labels={labels}
          scope={framed ? "absolute" : "fixed"}
          onOpened={onOpened}
        />
      ) : null}

      <main
        className="mx-auto max-w-[480px] transition-opacity duration-1000"
        style={opened ? { opacity: 1 } : { opacity: 0, height: 0, overflow: "hidden" }}
        aria-hidden={!opened}
      >
        <AnimationContext.Provider value={content.theme.animation !== "none"}>
        {content.sections
          .filter((s) => s.visible)
          .map((s) => {
            const props: SectionProps = { content, renderer, labels, title: s.title };
            if (s.type === "rsvp") return <RsvpSection key={s.id} {...props} mode={mode} />;
            const Component = SECTION_COMPONENTS[s.type];
            return <Component key={s.id} {...props} />;
          })}
        </AnimationContext.Provider>
      </main>

      {content.music.enabled && content.music.url ? (
        <>
          <audio ref={audioRef} src={content.music.url} loop preload="none" />
          <button
            type="button"
            onClick={() => {
              const a = audioRef.current;
              if (!a) return;
              if (playing) {
                a.pause();
                setPlaying(false);
              } else startMusic();
            }}
            aria-pressed={playing}
            aria-label={playing ? labels.musicOff : labels.musicOn}
            className={`${framed ? "absolute" : "fixed"} bottom-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border shadow-sm`}
            style={{ insetInlineEnd: "1rem", background: colors.background, borderColor: colors.accentSoft, color: colors.accent }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M9 18V6l10-2v12" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="6.5" cy="18" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="16.5" cy="16" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              {!playing ? <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.5" /> : null}
            </svg>
          </button>
        </>
      ) : null}
    </div>
  );
}
