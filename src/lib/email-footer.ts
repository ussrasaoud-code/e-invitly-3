/**
 * Pied de tous les e-mails : l'adresse d'envoi ne reçoit pas de messages,
 * on indique où écrire (WhatsApp et adresse de contact des Paramètres).
 */
const NO_REPLY: Record<string, string> = {
  fr: "Merci de ne pas répondre à cet e-mail : cette adresse ne reçoit pas de messages.",
  en: "Please do not reply to this email: this address does not receive messages.",
  ar: "يرجى عدم الرد على هذه الرسالة: هذا العنوان لا يستقبل الرسائل.",
  es: "Por favor, no respondáis a este correo: esta dirección no recibe mensajes.",
  it: "Per favore non rispondete a questa e-mail: questo indirizzo non riceve messaggi.",
  de: "Bitte antwortet nicht auf diese E-Mail: Diese Adresse empfängt keine Nachrichten.",
  nl: "Beantwoord deze e-mail alsjeblieft niet: dit adres ontvangt geen berichten.",
};
const WRITE: Record<string, string> = {
  fr: "Pour nous écrire :",
  en: "To reach us:",
  ar: "للتواصل معنا:",
  es: "Para escribirnos:",
  it: "Per scriverci:",
  de: "So erreicht ihr uns:",
  nl: "Zo bereik je ons:",
};

export function emailFooter(lang: string, contact: { whatsapp?: string; email?: string }): string[] {
  const l = NO_REPLY[lang] ? lang : "fr";
  const ways = [contact.whatsapp ? `WhatsApp ${contact.whatsapp}` : "", contact.email ?? ""].filter(Boolean);
  return [NO_REPLY[l], ...(ways.length ? [`${WRITE[l]} ${ways.join(" · ")}`] : [])];
}
