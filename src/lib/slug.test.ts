import { describe, expect, it } from "vitest";
import { findAvailableSlug, slugFromNames, slugify, validateSlug } from "./slug";

describe("slugify", () => {
  it("met en minuscules et relie par des tirets", () => {
    expect(slugFromNames("Mark", "Alice")).toBe("mark-alice");
    expect(slugFromNames("Naomi", "Kate")).toBe("naomi-kate");
    expect(slugFromNames("Sarah", "Adam")).toBe("sarah-adam");
  });

  it("retire les accents et les caractères spéciaux", () => {
    expect(slugify("Hélène & Zoé")).toBe("helene-zoe");
    expect(slugify("  Anne-Sophie  +  Jean-Côme ")).toBe("anne-sophie-jean-come");
    expect(slugify("Léa  &&  Noël!!!")).toBe("lea-noel");
    expect(slugify("D'Artagnan")).toBe("dartagnan");
    expect(slugify("Œdipe Straße")).toBe("oedipe-strasse");
  });

  it("translittère l'arabe", () => {
    const s = slugify("سارة آدم");
    expect(s).toMatch(/^[a-z0-9-]+$/);
    expect(s.length).toBeGreaterThan(3);
  });

  it("borne la longueur", () => {
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

describe("validateSlug", () => {
  it("refuse les chemins réservés", () => {
    expect(validateSlug("admin")).toBe("reserved");
    expect(validateSlug("invitations")).toBe("reserved");
    expect(validateSlug("api")).toBe("reserved");
  });
  it("refuse les formats invalides", () => {
    expect(validateSlug("Mark-Alice")).toBe("format");
    expect(validateSlug("mark--alice")).toBe("format");
    expect(validateSlug("-mark")).toBe("format");
    expect(validateSlug("")).toBe("empty");
  });
  it("accepte un slug correct", () => {
    expect(validateSlug("mark-alice-2")).toBeNull();
  });
});

describe("findAvailableSlug", () => {
  it("ajoute -2, -3 en cas de doublon", async () => {
    const taken = new Set(["mark-alice", "mark-alice-2"]);
    expect(await findAvailableSlug("Mark Alice", async (c) => taken.has(c))).toBe("mark-alice-3");
  });
  it("garde le slug s'il est libre", async () => {
    expect(await findAvailableSlug("Naomi Kate", async () => false)).toBe("naomi-kate");
  });
  it("contourne un slug réservé ou vide", async () => {
    expect(await findAvailableSlug("Admin", async () => false)).toBe("admin-invitation");
    expect(await findAvailableSlug("!!!", async () => false, () => "x1y2")).toBe("invitation-x1y2");
  });
});
