"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, useLayoutEffect } from "react";
import { LazyImagesContext } from "./editor-context";
import { FieldsContext } from "./fields-context";
import { fieldValues } from "@/lib/invitation/fields";
import type { FontKey, InvitationContent, RendererKey, SectionType } from "@/lib/invitation/schema";
import type { PublicRsvpConfig } from "@/lib/rsvp";
import { FONTS } from "@/lib/fonts";
import { Envelope } from "./Envelope";
import { labelsFor } from "./i18n";
import { SectionFrame } from "./Layers";
import {
  AnimationContext,
  ClosingSection,
  ContactsSection,
  CountdownSection,
  DecorSection,
  DressCodeSection,
  HeroSection,
  ProgramSection,
  ProgramV2Section,
  GallerySection,
  RsvpSection,
  TextSection,
  VenuesSection,
  ScratchSection,
  type SectionProps,
} from "./Sections";

/** Largeur de composition des invitations (celle du téléphone de l'éditeur visuel) */
const DESIGN_WIDTH = 390;

const FONT_STACKS = Object.fromEntries(Object.entries(FONTS).map(([k, f]) => [k, f.stack])) as Record<FontKey, string>;

const SECTION_COMPONENTS: Record<Exclude<SectionType, "rsvp" | "text" | "decor" | "program2" | "scratch" | "gallery">, (p: SectionProps) => React.ReactNode> = {
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
  /** Invitation publiée : adresse et configuration du formulaire RSVP */
  slug?: string;
  rsvp?: PublicRsvpConfig | null;
  /** false : animations coupées (éditeur visuel, hors prévisualisation) */
  animations?: boolean;
};

export function InvitationView({ content, renderer, mode, framed = false, skipEnvelope = false, slug, rsvp, animations = true }: InvitationViewProps) {
  const labels = labelsFor(content.language);
  const { colors, fonts } = content.theme;
  const showEnvelope = !skipEnvelope && content.envelope.mode !== "none";
  const [opened, setOpened] = useState(!showEnvelope);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const isArabic = content.language === "ar";
  const fields = useMemo(() => fieldValues(content), [content]);

  // Mise à l'échelle : l'invitation est composée sur 390 px (largeur de l'éditeur) puis
  // agrandie ou réduite à la largeur réelle de l'écran (au plus 480 px). Les textes et
  // les décors gardent ainsi exactement leurs positions relatives sur tous les téléphones.
  const rootRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (framed) return;
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.min(el.clientWidth, 480);
      setScale(w > 0 ? Math.round((w / DESIGN_WIDTH) * 1000) / 1000 : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [framed]);

  const hasMusic = content.music.enabled && !!content.music.url;
  /** Le visiteur a coupé la musique : on ne la relance plus de soi-même */
  const mutedByUser = useRef(false);
  const startMusic = useCallback(() => {
    const a = audioRef.current;
    if (!a || !a.paused) return;
    a.volume = 0.35;
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);

  // La musique démarre au premier geste du visiteur (toucher de la vidéo, du cachet, de l'écran) :
  // les navigateurs n'autorisent le son qu'après une action de sa part.
  // Démo intégrée au site (framed) : seuls les gestes DANS la démo comptent, jamais un clic ailleurs sur la page.
  const touchedDemo = useRef(false);
  useEffect(() => {
    if (!hasMusic) return;
    const target: HTMLElement | Window | null = framed ? rootRef.current : window;
    if (!target) return;
    const onGesture = () => {
      touchedDemo.current = true;
      if (!mutedByUser.current) startMusic();
    };
    const events = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;
    events.forEach((e) => target.addEventListener(e, onGesture, { capture: true, passive: true }));
    return () => events.forEach((e) => target.removeEventListener(e, onGesture, { capture: true }));
  }, [hasMusic, startMusic, framed]);

  const onOpened = useCallback(() => {
    setOpened(true);
    // Démo : la musique ne part que si le visiteur a touché la démo elle-même
    if (hasMusic && !mutedByUser.current && (!framed || touchedDemo.current)) startMusic();
  }, [hasMusic, startMusic, framed]);

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
      ref={rootRef}
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
          manualStart={mode === "demo"}
          onTap={hasMusic ? () => !mutedByUser.current && (!framed || touchedDemo.current) && startMusic() : undefined}
        />
      ) : null}

      <main
        className="mx-auto max-w-[480px] transition-opacity duration-1000"
        style={{
          ...(opened ? { opacity: 1 } : { opacity: 0, height: 0, overflow: "hidden" }),
          ...(!framed && scale ? { width: DESIGN_WIDTH, maxWidth: "none", zoom: scale } : {}),
        }}
        // Contenu caché derrière l'enveloppe : ni lu, ni atteignable au clavier
        inert={!opened}
      >
        <FieldsContext.Provider value={fields}>
        <AnimationContext.Provider value={animations && content.theme.animation !== "none"}>
        {content.sections
          .filter((s) => s.visible)
          .map((s, index) => {
            const props: SectionProps = { content, renderer, labels, title: s.title, slug, rsvp };
            let inner: React.ReactNode;
            if (s.type === "rsvp") inner = <RsvpSection {...props} mode={mode} section={s} />;
            else if (s.type === "text") inner = <TextSection {...props} body={s.body} />;
            else if (s.type === "decor") inner = <DecorSection height={s.height} />;
            else if (s.type === "program2") inner = <ProgramV2Section {...props} section={s} />;
            else if (s.type === "venues") inner = <VenuesSection {...props} section={s} />;
            else if (s.type === "scratch") inner = <ScratchSection {...props} section={s} />;
            else if (s.type === "countdown") inner = <CountdownSection {...props} section={s} />;
            else if (s.type === "gallery") inner = <GallerySection {...props} section={s} />;
            else {
              const Component = SECTION_COMPONENTS[s.type];
              inner = <Component {...props} />;
            }
            return (
              <LazyImagesContext.Provider key={s.id} value={index >= 2}>
                <SectionFrame section={s}>{inner}</SectionFrame>
              </LazyImagesContext.Provider>
            );
          })}
        </AnimationContext.Provider>
        </FieldsContext.Provider>
      </main>

      {content.music.enabled && content.music.url ? (
        <>
          <audio ref={audioRef} src={content.music.url} loop preload="auto" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
          {/* Bouton du son : dans la colonne de l'invitation (visible aussi sur ordinateur), au-dessus de la vidéo d'ouverture */}
          <div className={`${framed ? "absolute" : "fixed"} inset-x-0 bottom-4 z-50 flex justify-center pointer-events-none`}>
            <div className="flex w-full max-w-[480px] justify-end px-4">
              <button
                type="button"
                onClick={() => {
                  const a = audioRef.current;
                  if (!a) return;
                  if (playing) {
                    mutedByUser.current = true;
                    a.pause();
                    setPlaying(false);
                  } else {
                    mutedByUser.current = false;
                    startMusic();
                  }
                }}
                aria-pressed={!playing}
                aria-label={playing ? labels.musicOff : labels.musicOn}
                title={playing ? labels.musicOff : labels.musicOn}
                className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-lg transition hover:scale-105"
                style={{ background: colors.background, borderColor: colors.accent, color: colors.accent }}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" fillOpacity="0.15" />
                  {playing ? (
                    <>
                      <path d="M15.5 9a4 4 0 0 1 0 6" />
                      <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
                    </>
                  ) : (
                    <path d="M16 9.5l5 5M21 9.5l-5 5" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
