import { describe, expect, it } from "vitest";
import { emailFooter } from "./email-footer";

describe("pied des e-mails", () => {
  it("demande de ne pas répondre et indique où écrire", () => {
    expect(emailFooter("fr", { whatsapp: "+33 6 12 34 56 78", email: "einvitly@gmail.com" })).toEqual([
      "Merci de ne pas répondre à cet e-mail : cette adresse ne reçoit pas de messages.",
      "Pour nous écrire : WhatsApp +33 6 12 34 56 78 · einvitly@gmail.com",
    ]);
    expect(emailFooter("xx", {})).toHaveLength(1);
  });
});
