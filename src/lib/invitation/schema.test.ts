import { describe, expect, it } from "vitest";
import { PRESETS } from "./presets";
import { cloneSection, invitationContentSchema, layerSchema, newLayer, newSection } from "./schema";

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
