/** Lien « Cliquer pour discuter » WhatsApp (wa.me), avec message pré-rempli. */
export function whatsappLink(number: string, text?: string): string | null {
  const digits = number.replace(/^\s*00/, "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
