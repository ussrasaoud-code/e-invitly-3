import { whatsappLink } from "@/lib/whatsapp";
import { WhatsAppIcon } from "./WhatsAppIcon";

/** Bouton flottant WhatsApp (coin bas, côté fin de ligne : à gauche en arabe). */
export function WhatsAppFab({ number, label, message }: { number: string; label: string; message: string }) {
  const href = whatsappLink(number, message);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="fixed bottom-5 end-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg ring-4 ring-white/70 transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest print:hidden"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}
