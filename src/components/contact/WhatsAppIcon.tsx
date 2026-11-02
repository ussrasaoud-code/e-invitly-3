/** Bulle de discussion avec combiné (icône générique). */
export function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 20.5l1.3-4A8.5 8.5 0 1 1 8 19.6l-4.5.9z" />
      <path d="M9.2 8.6c.2-.5.6-.6.9-.6h.4c.2 0 .4.1.5.4l.6 1.4c.1.2 0 .5-.1.6l-.5.6c.6 1.1 1.5 2 2.6 2.6l.6-.5c.2-.1.4-.2.6-.1l1.4.6c.3.1.4.3.4.5v.4c0 .3-.1.7-.6.9-.6.3-1.5.4-2.6-.1a8.3 8.3 0 0 1-4.1-4.1c-.5-1.1-.4-2 0-2.6z" fill="currentColor" stroke="none" />
    </svg>
  );
}
