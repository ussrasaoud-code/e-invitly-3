import Image from "next/image";
import Link from "next/link";
import fullLogo from "../../../public/brand/logo.png";
import wordmark from "../../../public/brand/logo-wordmark.png";

/**
 * Logo E-Invitly.
 * - « wordmark » (par défaut) : E · cachet · invitly, pour les en-têtes.
 * - « full » : avec la mention « Invitations digitales », pour le pied de page.
 * La hauteur se règle avec className (ex. h-9) ; la largeur suit.
 */
export function Logo({
  className = "h-8 md:h-10",
  href = "/",
  variant = "wordmark",
  priority = false,
}: {
  className?: string;
  href?: string;
  variant?: "wordmark" | "full";
  priority?: boolean;
}) {
  const src = variant === "full" ? fullLogo : wordmark;
  return (
    <Link href={href} className="inline-flex shrink-0 items-center" aria-label="E-Invitly — accueil">
      <Image src={src} alt="E-Invitly" priority={priority} className={`w-auto ${className}`} sizes="240px" />
    </Link>
  );
}
