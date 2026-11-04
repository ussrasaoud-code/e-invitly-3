import { describe, expect, it } from "vitest";
import { PRESETS } from "./presets";
import { invitationContentSchema, newLayer } from "./schema";
import { setText, translationRows } from "./texts";

describe("textes à traduire", () => {
  const main = invitationContentSchema.parse(PRESETS["the-garden"]);
  main.sections[0].layers.push({ ...newLayer("text"), text: "Ensemble, avec leurs familles" });
  it("liste les textes et repère ceux encore identiques", () => {
    const variant = structuredClone(main);
    const rows = translationRows(main, variant);
    const layer = rows.find((r) => r.source === "Ensemble, avec leurs familles");
    expect(layer?.todo).toBe(true);
    expect(rows.find((r) => r.key === "couple.one")?.auto).toBe(false);
    const after = setText(variant, layer!, "معاً، مع عائلاتهم");
    const again = translationRows(main, after).find((r) => r.key === layer!.key);
    expect(again?.value).toBe("معاً، مع عائلاتهم");
    expect(again?.todo).toBe(false);
    expect(invitationContentSchema.safeParse(after).success).toBe(true);
  });
  it("coupe un texte trop long à la longueur autorisée", () => {
    const row = translationRows(main, main).find((r) => r.key === "kicker")!;
    expect(setText(main, row, "x".repeat(500)).kicker.length).toBe(120);
  });
});
