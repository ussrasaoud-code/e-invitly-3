import { describe, expect, it } from "vitest";
import { translatePrice } from "@/lib/price";
import { PRESETS } from "./presets";
import { invitationContentSchema, newLayer, templateDefinitionSchema } from "./schema";
import { contentFor, newVariant, removeVariant, setVariant, syncDesign, templateLangs } from "./variants";

const base = () => templateDefinitionSchema.parse({ renderer: "the-garden", sample: invitationContentSchema.parse(PRESETS["the-garden"]) });

describe("versions par langue d'un modèle", () => {
  it("ajoute, lit et retire une langue", () => {
    let def = base();
    def = setVariant(def, "ar", newVariant(def, "ar"));
    expect(templateLangs(def)).toEqual(["fr", "ar"]);
    expect(contentFor(def, "ar").language).toBe("ar");
    expect(contentFor(def, "it").language).toBe("fr");
    def = removeVariant(def, "ar");
    expect(templateLangs(def)).toEqual(["fr"]);
  });
  it("applique le design sans toucher aux textes traduits", () => {
    const main = invitationContentSchema.parse(PRESETS["the-garden"]);
    const hero = main.sections[0];
    hero.layers = [newLayer("text", { id: "l-titre", text: "Bienvenue", x: 20 })];
    const variant = structuredClone(main);
    variant.language = "en";
    variant.intro = "Together with their families";
    variant.sections[0].layers[0].text = "Welcome";
    variant.sections[0].title = "Our day";
    // La version principale bouge le texte et change la couleur du thème
    main.sections[0].layers[0].x = 70;
    main.theme.colors.accent = "#112233";
    const synced = syncDesign(main, variant);
    expect(synced.language).toBe("en");
    expect(synced.intro).toBe("Together with their families");
    expect(synced.sections[0].layers[0]).toMatchObject({ text: "Welcome", x: 70 });
    expect(synced.sections[0].title).toBe("Our day");
    expect(synced.theme.colors.accent).toBe("#112233");
    // Un calque ajouté uniquement dans la version anglaise est conservé
    variant.sections[0].layers.push(newLayer("text", { id: "l-en", text: "Only in English" }));
    expect(syncDesign(main, variant).sections[0].layers.map((l) => l.id)).toEqual(["l-titre", "l-en"]);
  });
  it("traduit les prix « à partir de »", () => {
    expect(translatePrice("À partir de 175 €", "en")).toBe("From €175");
    expect(translatePrice("À partir de 175 €", "de")).toBe("Ab 175 €");
    expect(translatePrice("89,90 €", "nl")).toBe("€ 89,90");
    expect(translatePrice("Sur devis", "es")).toBe("Sur devis");
  });
});

import { amountFromPriceLabel, formatMoney } from "@/lib/payment-amount";
describe("montant à payer", () => {
  it("lit le prix du modèle", () => {
    expect(amountFromPriceLabel("À partir de 175 €")).toBe(17500);
    expect(amountFromPriceLabel("89,90 €")).toBe(8990);
    expect(amountFromPriceLabel("Sur devis")).toBeNull();
    expect(amountFromPriceLabel(null)).toBeNull();
    expect(formatMoney(17500, "EUR", "en-GB")).toBe("€175.00");
  });
});
