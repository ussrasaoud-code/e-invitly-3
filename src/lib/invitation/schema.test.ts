import { describe, expect, it } from "vitest";
import { PRESETS } from "./presets";
import { elementsFor } from "./elements";
import { cloneSection, invitationContentSchema, layerSchema, newLayer, newSection, sectionSchema, templateDefinitionSchema } from "./schema";

describe("calques et sections (phase 6)", () => {
  it("un contenu enregistré avant la phase 6 reste valide (valeurs par défaut)", () => {
    const old = structuredClone(PRESETS["the-garden"]) as Record<string, unknown> & { sections: Record<string, unknown>[] };
    old.sections = old.sections.map(({ id, type, visible, title }) => ({ id, type, visible, title }));
    const parsed = invitationContentSchema.parse(old);
    expect(parsed.sections[0]).toMatchObject({ layers: [], animation: "inherit", body: "", height: 60 });
  });

  it("refuse les valeurs hors limites et les adresses dangereuses", () => {
    expect(layerSchema.safeParse({ ...newLayer("image"), opacity: 2 }).success).toBe(false);
    expect(layerSchema.safeParse({ ...newLayer("image"), width: 500 }).success).toBe(false);
    expect(layerSchema.safeParse({ ...newLayer("image"), src: "javascript:alert(1)" }).success).toBe(false);
    expect(layerSchema.safeParse({ ...newLayer("text"), color: "red" }).success).toBe(false);
    expect(layerSchema.safeParse(newLayer("text")).success).toBe(true);
    // Nom de fichier très long (bibliothèque de médias) : raccourci, pas refusé
    const long = layerSchema.safeParse({ ...newLayer("image"), name: "x".repeat(120) + ".png" });
    expect(long.success && long.data.name.length).toBe(60);
  });

  it("dupliquer une section donne de nouveaux identifiants sans toucher l'original", () => {
    const s = { ...newSection("text"), layers: [newLayer("image", { src: "/decor/colombe.png" })] };
    const copy = cloneSection(s);
    expect(copy.id).not.toBe(s.id);
    expect(copy.layers[0].id).not.toBe(s.layers[0].id);
    copy.layers[0].x = 10;
    expect(s.layers[0].x).toBe(50);
  });
});

describe("modèle vierge et éléments du modèle", () => {
  it("la page blanche est un modèle valide, sans ornement et avec une seule section", () => {
    const def = templateDefinitionSchema.parse({ renderer: "blank", sample: PRESETS.blank });
    expect(def.sample.sections.map((s) => s.type)).toEqual(["hero"]);
    expect(def.sample.envelope.mode).toBe("none");
    expect(elementsFor("hero", "blank", invitationContentSchema.parse(PRESETS.blank)).some((e) => e.kind === "ornament")).toBe(false);
    expect(elementsFor("hero", "the-garden", invitationContentSchema.parse(PRESETS["the-garden"])).map((e) => e.id)).toContain("corner-left");
  });

  it("les réglages d'éléments sont bornés et les clés contrôlées", () => {
    const base = newSection("hero");
    expect(sectionSchema.safeParse({ ...base, elements: { names: { dx: 10, color: "#112233" } } }).success).toBe(true);
    expect(sectionSchema.safeParse({ ...base, elements: { names: { scale: 10 } } }).success).toBe(false);
    expect(sectionSchema.safeParse({ ...base, elements: { "<script>": { hidden: true } } }).success).toBe(false);
  });
});

describe("groupes et parties", () => {
  it("les listes exposent une partie par moment, les prénoms trois parties", () => {
    const c = invitationContentSchema.parse(PRESETS["the-garden"]);
    const hero = elementsFor("hero", "the-garden", c);
    expect(hero.find((d) => d.id === "names")?.children?.map((d) => d.id)).toEqual(["names.one", "names.and", "names.two"]);
    const program = elementsFor("program", "the-garden", c).find((d) => d.id === "list");
    expect(program?.children?.[0].id).toBe("list.e-ceremonie");
    expect(program?.children?.[0].children?.map((d) => d.id)).toContain("list.e-ceremonie.time");
    expect(sectionSchema.safeParse({ ...newSection("program"), elements: { "list.e-ceremonie.time": { font: "greatvibes" } } }).success).toBe(true);
  });
});

describe("formes", () => {
  it("les formats prêts à l'emploi sont des calques valides", async () => {
    const { shapePresets } = await import("./shape-presets");
    const colors = invitationContentSchema.parse(PRESETS["the-garden"]).theme.colors;
    for (const p of shapePresets(colors)) expect(layerSchema.safeParse(newLayer("shape", p.patch)).success, p.id).toBe(true);
    expect(layerSchema.safeParse({ ...newLayer("shape"), strokeWidth: 50 }).success).toBe(false);
    expect(layerSchema.safeParse({ ...newLayer("shape"), fill: "red" }).success).toBe(false);
  });
});
