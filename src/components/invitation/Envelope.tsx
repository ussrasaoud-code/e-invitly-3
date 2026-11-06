"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WaxSeal } from "@/components/ornaments";
import { cdnImage } from "@/lib/image-cdn";
import type { InvitationContent } from "@/lib/invitation/schema";
import type { Labels } from "./i18n";

type Props = {
  envelope: InvitationContent["envelope"];
  colors: InvitationContent["theme"]["colors"];
  labels: Labels;
  scope: "fixed" | "absolute";
  onOpened: () => void;
  /** Démos : rien ne démarre avant que le visiteur touche l'écran */
  manualStart?: boolean;
  /** Appelé au toucher du visiteur (dans son geste) : lance la musique dès le début de l'ouverture */
  onTap?: () => void;
};

/**
 * Ouverture de l'invitation.
 * - « animation » : enveloppe dessinée, le rabat s'ouvre au toucher du cachet.
 * - « video » : vidéo muette ; sa fin déclenche l'invitation sans clic.
 *   Si la vidéo ne charge pas ou si la lecture est bloquée, un bouton
 *   « Ouvrir l'invitation » apparaît.
 * - Respecte prefers-reduced-motion (ouverture instantanée).
 */
export function Envelope({ envelope, colors, labels, scope, onOpened, manualStart = false, onTap }: Props) {
  const [phase, setPhase] = useState<"closed" | "opening" | "gone">("closed");
  const [started, setStarted] = useState(!manualStart);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const reduced =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const finish = useCallback(() => {
    setPhase("gone");
    onOpened();
  }, [onOpened]);

  const open = useCallback(() => {
    if (phase !== "closed") return;
    onTap?.();
    if (reduced) return finish();
    setPhase("opening");
    window.setTimeout(finish, 1900);
  }, [phase, reduced, finish, onTap]);

  // Démarrage automatique (option)
  useEffect(() => {
    if (envelope.mode === "animation" && envelope.autoStart && !manualStart) {
      const t = window.setTimeout(open, 1200);
      return () => window.clearTimeout(t);
    }
  }, [envelope.mode, envelope.autoStart, open, manualStart]);

  // Vidéo : tentative de lecture, repli si bloquée
  useEffect(() => {
    if (envelope.mode !== "video" || !started) return;
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => setVideoFailed(true));
  }, [envelope.mode, started]);

  if (phase === "gone") return null;
  const pos = scope === "fixed" ? "fixed" : "absolute";

  if (envelope.mode === "video" && envelope.videoUrl) {
    return (
      // Format téléphone sur grand écran aussi : colonne de la largeur de l'invitation, centrée
      <div className={`${pos} inset-0 z-40 flex justify-center`} style={{ background: colors.background }}>
        <div className="relative h-full w-full max-w-[480px] overflow-hidden bg-black shadow-[0_0_60px_-20px_rgb(0_0_0/0.35)]">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          // Sans affiche : la première image est montrée grâce à #t=… . L'adresse ne change pas
          // au toucher (sinon la vidéo se rechargerait) et la vidéo se télécharge pendant l'attente.
          src={envelope.posterUrl ? envelope.videoUrl : `${envelope.videoUrl}#t=0.05`}
          poster={envelope.posterUrl ? cdnImage(envelope.posterUrl, 390) : undefined}
          muted
          playsInline
          autoPlay={started}
          preload="auto"
          onEnded={finish}
          // La vidéo démarre : si le navigateur a mis la musique en pause, on la relance
          onPlaying={() => onTap?.()}
          onError={() => setVideoFailed(true)}
        />
        {!started ? (
          <button
            type="button"
            onClick={() => {
              // La musique part dans le même geste que la vidéo (Safari / iPhone l'exigent)
              onTap?.();
              setStarted(true);
            }}
            className="absolute inset-0 flex flex-col items-center justify-end gap-3 bg-gradient-to-t from-black/45 via-transparent to-transparent pb-16"
          >
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-charcoal shadow-lg">
              <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-white/40" />
              <svg viewBox="0 0 24 24" className="ms-1 h-6 w-6" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
            </span>
            <span className="rounded-full bg-black/35 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-white backdrop-blur-sm">{labels.open}</span>
          </button>
        ) : null}
        <div className={`absolute inset-x-0 bottom-8 flex justify-center gap-3 ${started ? "" : "hidden"}`}>
          {videoFailed ? (
            <button type="button" onClick={finish} className="btn btn-primary">
              {labels.open}
            </button>
          ) : (
            <button type="button" onClick={finish} className="text-xs tracking-widest text-white/80 underline-offset-4 hover:underline">
              {labels.skip}
            </button>
          )}
        </div>
        </div>
      </div>
    );
  }

  const opening = phase === "opening";
  return (
    <div
      className={`${pos} inset-0 z-40 flex flex-col items-center justify-center transition-opacity duration-700 ${opening ? "pointer-events-none" : ""}`}
      style={{ background: colors.background, opacity: opening ? 0 : 1, transitionDelay: opening ? "1.2s" : "0s" }}
    >
      <div className="relative w-[78%] max-w-[340px]" style={{ perspective: "900px" }}>
        {/* Corps de l'enveloppe */}
        <div
          className="relative aspect-[4/3] w-full shadow-[0_24px_48px_-16px_rgb(0_0_0/0.25)] paper-texture"
          style={{ background: colors.surface }}
        >
          {/* Carte qui sort */}
          <div
            className="absolute inset-x-[7%] top-[8%] bottom-[6%] transition-transform duration-[900ms] ease-out"
            style={{
              background: colors.background,
              transform: opening ? "translateY(-46%)" : "translateY(0)",
              transitionDelay: opening ? "0.45s" : "0s",
              border: `1px solid ${colors.accentSoft}`,
            }}
          />
          {/* Rabats latéraux et bas */}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 0 L200 165 L0 300 Z" fill={colors.surface} />
            <path d="M400 0 L200 165 L400 300 Z" fill={colors.surface} />
            <path d="M0 300 L200 150 L400 300 Z" fill={colors.accentSoft} fillOpacity="0.35" />
            <path d="M0 300 L200 150 L400 300" fill="none" stroke={colors.accentSoft} strokeWidth="1" />
          </svg>
          {/* Rabat supérieur */}
          <div
            className="absolute inset-x-0 top-0 h-[58%] origin-top transition-transform duration-700 ease-in-out"
            style={{
              transform: opening ? "rotateX(180deg)" : "rotateX(0deg)",
              transformStyle: "preserve-3d",
              zIndex: opening ? 0 : 2,
            }}
          >
            <svg className="h-full w-full" viewBox="0 0 400 174" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 0 H400 L200 174 Z" fill={colors.surface} stroke={colors.accentSoft} strokeWidth="1" />
            </svg>
          </div>
          {/* Cachet */}
          <button
            type="button"
            onClick={open}
            aria-label={labels.open}
            className="absolute left-1/2 top-[50%] z-10 h-[30%] -translate-x-1/2 -translate-y-1/2 transition-transform duration-500 hover:scale-105 focus-visible:scale-105"
            style={{ aspectRatio: "1", opacity: opening ? 0 : 1 }}
          >
            <WaxSeal text={envelope.sealText || "♥"} color={colors.accent} className="h-full w-full drop-shadow-md" />
          </button>
        </div>
      </div>
      <p
        className="mt-10 px-6 text-center text-[0.68rem] uppercase tracking-[0.22em] animate-[fade_2s_ease_1s_both]"
        style={{ color: colors.ink }}
      >
        {labels.tapSeal}
      </p>
      <button type="button" onClick={finish} className="sr-only focus:not-sr-only focus:mt-4 focus:underline">
        {labels.skip}
      </button>
    </div>
  );
}
