import { describe, expect, it } from "vitest";
import { fmt, isSitePath, localePath, splitLocale, suggestLang } from "./config";
import { DICTS } from "./dict";

describe("langues du site", () => {
  it("préfixe les adresses (le français reste à la racine)", () => {
    expect(localePath("fr", "/invitations")).toBe("/invitations");
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("ar", "/invitations/the-garden")).toBe("/ar/invitations/the-garden");
    expect(localePath("es", "/#faq")).toBe("/es#faq");
    expect(localePath("de", "/invitations?style=floral")).toBe("/de/invitations?style=floral");
  });
  it("reconnaît la langue dans l'adresse, uniquement sur les pages du site", () => {
    expect(splitLocale("/en/invitations")).toEqual({ lang: "en", path: "/invitations", prefixed: true });
    expect(splitLocale("/ar")).toEqual({ lang: "ar", path: "/", prefixed: true });
    expect(splitLocale("/invitations").prefixed).toBe(false);
    expect(splitLocale("/en/admin").prefixed).toBe(false);
    expect(splitLocale("/fr/invitations").prefixed).toBe(false);
    expect(isSitePath("/demo/the-garden")).toBe(true);
    expect(isSitePath("/marie-et-paul")).toBe(false);
  });
  it("propose la langue du téléphone, puis celle du pays, parmi les langues ouvertes", () => {
    expect(suggestLang(["ar-MA", "fr"], "FR", ["fr", "en", "ar"])).toBe("ar");
    expect(suggestLang(["it-IT", "en-GB"], "IT", ["fr", "en", "ar"])).toBe("en");
    expect(suggestLang(["pt-BR"], "MA", ["fr", "en", "ar"])).toBe("ar");
    expect(suggestLang(["pt-BR"], "BR", ["fr", "en", "ar"])).toBeNull();
    expect(suggestLang(["fr-FR"], "ES", ["fr", "es"])).toBe("fr");
  });
  it("remplace les variables", () => {
    expect(fmt("Étape {n} sur {total}", { n: 2, total: 6 })).toBe("Étape 2 sur 6");
  });
  it("chaque langue garde les variables du français", () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    const walk = (fr: unknown, other: unknown, path: string) => {
      if (typeof fr === "string") expect(vars(other as string), path).toBe(vars(fr));
      else if (fr && typeof fr === "object") for (const k of Object.keys(fr)) walk((fr as never)[k], (other as never)[k], `${path}.${k}`);
    };
    for (const [l, d] of Object.entries(DICTS)) walk(DICTS.fr, d, l);
  });
});
