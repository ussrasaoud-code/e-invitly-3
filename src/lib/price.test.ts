import { describe, expect, it } from "vitest";
import { formatPrice, parsePrice } from "./price";

describe("prix des modèles", () => {
  it("compose le libellé affiché", () => {
    expect(formatPrice("from", "175", "")).toBe("À partir de 175 €");
    expect(formatPrice("fixed", "89.90", "")).toBe("89,90 €");
    expect(formatPrice("from", "", "")).toBeNull();
    expect(formatPrice("text", "", "  Inclus avec Premium ")).toBe("Inclus avec Premium");
    expect(formatPrice("none", "175", "")).toBeNull();
  });
  it("relit un libellé enregistré", () => {
    expect(parsePrice("À partir de 175 €")).toEqual({ mode: "from", amount: "175", text: "" });
    expect(parsePrice("89,90 €")).toEqual({ mode: "fixed", amount: "89,90", text: "" });
    expect(parsePrice("Sur devis")).toEqual({ mode: "text", amount: "", text: "Sur devis" });
    expect(parsePrice(null).mode).toBe("none");
  });
});
