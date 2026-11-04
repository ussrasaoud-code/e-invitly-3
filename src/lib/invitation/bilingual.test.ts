import { describe, expect, it } from "vitest";
import { PRESETS } from "./presets";
import { invitationContentSchema } from "./schema";
import { altOf, contentInLang, invitationLangs, newAlt, pickLang } from "./bilingual";

const main = invitationContentSchema.parse(PRESETS["the-garden"]);

describe("invitation en deux langues", () => {
  it("ajoute une deuxième langue et la retrouve après relecture", () => {
    const alt = { ...newAlt(main, "ar"), kicker: "معًا مع عائلاتهم" };
    const both = invitationContentSchema.parse({ ...main, alt });
    expect(invitationLangs(both)).toEqual(["fr", "ar"]);
    expect(altOf(both)?.kicker).toBe("معًا مع عائلاتهم");
    expect(altOf(both)?.alt).toBeUndefined();
  });
  it("le design et les horaires suivent toujours la version principale", () => {
    const alt = newAlt(main, "en");
    alt.sections = alt.sections.map((x) => ({ ...x, spaceTop: 99 }));
    alt.events = alt.events.map((e) => ({ ...e, title: `EN ${e.title}`, startTime: "23:59" }));
    const both = invitationContentSchema.parse({ ...main, alt });
    const en = contentInLang(both, "en");
    expect(en.language).toBe("en");
    expect(en.sections.map((x) => x.spaceTop)).toEqual(main.sections.map((x) => x.spaceTop));
    expect(en.events[0].title.startsWith("EN ")).toBe(true);
    expect(en.events[0].startTime).toBe(main.events[0].startTime);
    expect(contentInLang(both, "fr").kicker).toBe(main.kicker);
    expect(contentInLang(both, "fr").alt).toBeUndefined();
  });
  it("choisit la langue : paramètre, puis téléphone, puis principale", () => {
    expect(pickLang(["fr", "ar"], "ar", null)).toBe("ar");
    expect(pickLang(["fr", "ar"], "de", "ar-MA,ar;q=0.9")).toBe("ar");
    expect(pickLang(["fr", "ar"], undefined, "en-GB,en;q=0.9")).toBe("fr");
    expect(pickLang(["fr"], "ar", "ar")).toBe("fr");
  });
});
