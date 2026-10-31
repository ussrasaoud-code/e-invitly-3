import { describe, expect, it } from "vitest";
import { countByEvent, DEFAULT_RSVP_FIELDS, normalizeFields, rsvpSubmissionSchema, sanitizeSubmission } from "./rsvp";

const base = { slug: "mark-alice", idempotencyKey: "6f1c3e2a-1b2c-4d5e-8f90-1234567890ab", firstName: "Paul" };
const cfg = { fields: { ...DEFAULT_RSVP_FIELDS, dietary: true, childMenus: true }, maxCompanions: 2, questions: [{ id: "q1", label: "Navette ?", type: "yesno" as const, options: [], required: true }], eventIds: ["e1", "e2"] };

describe("sanitizeSubmission", () => {
  it("plafonne les accompagnants et filtre les événements inconnus", () => {
    const d = rsvpSubmissionSchema.parse({ ...base, lastName: "Durand", attending: true, companionsCount: 5, companionNames: ["A", "B", "C"], events: ["e1", "x"], childMenus: 9, answers: { q1: "oui" } });
    const { value, missing } = sanitizeSubmission(d, cfg);
    expect(missing).toEqual([]);
    expect(value.companionsCount).toBe(2);
    expect(value.companionNames).toEqual(["A", "B"]);
    expect(value.events).toEqual(["e1"]);
    expect(value.childMenus).toBe(3);
  });
  it("un refus n'a ni accompagnant, ni événement, ni régime", () => {
    const d = rsvpSubmissionSchema.parse({ ...base, lastName: "Durand", attending: false, companionsCount: 2, events: ["e1"], dietary: "vegan" });
    const { value, missing } = sanitizeSubmission(d, cfg);
    expect(value).toMatchObject({ companionsCount: 0, events: [], dietary: "", childMenus: 0 });
    expect(missing).toEqual([]);
  });
  it("signale les champs obligatoires manquants", () => {
    const d = rsvpSubmissionSchema.parse({ ...base, attending: true, answers: { q1: "peut-être" } });
    expect(sanitizeSubmission(d, cfg).missing).toEqual(["lastName", "q:q1"]);
  });
  it("ignore les champs désactivés", () => {
    const d = rsvpSubmissionSchema.parse({ ...base, lastName: "X", attending: true, companionsCount: 1, comment: "Bravo" });
    const { value } = sanitizeSubmission(d, { ...cfg, fields: { ...cfg.fields, companions: false, comment: false }, questions: [] });
    expect(value.companionsCount).toBe(0);
    expect(value.comment).toBe("");
  });
});

describe("countByEvent", () => {
  it("compte les personnes et non les formulaires", () => {
    const c = countByEvent([
      { attending: true, companions_count: 1, events: ["e1", "e2"] },
      { attending: true, companions_count: 0, events: ["e1"] },
      { attending: false, companions_count: 0, events: ["e1"] },
    ], ["e1", "e2"]);
    expect(c).toEqual({ e1: 3, e2: 2 });
  });
});

describe("normalizeFields", () => {
  it("complète avec les valeurs par défaut et reprend l'ancien nom « menu »", () => {
    expect(normalizeFields({ menu: true, dietary: true })).toMatchObject({ childMenus: true, dietary: true, lastName: true });
  });
});
