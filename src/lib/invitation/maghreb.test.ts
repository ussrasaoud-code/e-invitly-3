import { describe, expect, it } from "vitest";
import { buildInvitationFromRequest } from "./from-request";
import { forAudience, isMultiDay, sortByDay } from "./audience";
import { PRESETS } from "./presets";
import { invitationContentSchema, programV2Items, programV2Section } from "./schema";
import { maghrebSchema, requestSchema } from "@/lib/validation/request";

const sample = invitationContentSchema.parse(PRESETS["the-garden"]);
const maghreb = maghrebSchema.parse({
  separateGuests: "yes",
  henna: { date: "2027-06-11", venueName: "Riad Yasmine", address: "12 rue des Orangers, Lyon", hammamTime: "10:00", hennaTime: "19:00", chantTime: "20:30", dinnerTime: "21:30" },
  soiree: { venueName: "Salle Andalouse", address: "5 avenue des Lilas, Lyon", receptionTime: "16:00", brideTime: "17:00", teaTime: "18:00", dinnerTime: "21:00", cakeTime: "23:30", parking: "Parking gratuit" },
  fatiha: { enabled: true, date: "2027-06-10", time: "18:00", venueName: "Chez les parents", audience: "henna" },
  lendemain: { enabled: true, date: "2027-06-13", time: "11:00", audience: "hidden" },
  decoration: { known: "yes", colors: "blanc et doré", theme: "andalou" },
});
const form = { partnerOne: "Yasmine", partnerTwo: "Karim", eventDate: "2027-06-12", language: "fr" as const, culture: "maghrebin" as const, maghreb };

describe("mariage maghrébin", () => {
  const { content, notesToReview } = buildInvitationFromRequest(sample, form);

  it("crée les moments du henné et de la soirée, sur deux jours", () => {
    const ids = content.events.map((e) => e.id);
    expect(ids).toEqual(["fatiha", "henne", "chants-henne", "diner-henne", "accueil", "entree-mariee", "gouter", "diner", "piece-montee"]);
    expect(content.eventAt).toBe("2027-06-12T16:00");
    expect(isMultiDay(content)).toBe(true);
    expect(content.practical.parking).toBe("Parking gratuit");
  });

  it("réserve le henné aux invités du henné ; le hammam et le lendemain restent privés", () => {
    expect(content.events.filter((e) => e.audience === "henna").map((e) => e.id)).toEqual(["fatiha", "henne", "chants-henne", "diner-henne"]);
    expect(content.events.find((e) => e.id === "hammam")).toBeUndefined();
    expect(notesToReview.join(" ")).toMatch(/Hammam de la mariée \(privé/);
    expect(notesToReview.join(" ")).toMatch(/Brunch du lendemain \(non affiché/);
    expect(notesToReview.join(" ")).toMatch(/blanc et doré/);
  });

  it("le lien normal ne montre que la soirée", () => {
    const pub = forAudience(content, "all");
    expect(pub.events.every((e) => e.audience === "all")).toBe(true);
    expect(pub.events.map((e) => e.id)).not.toContain("henne");
    expect(forAudience(content, "henna").events).toHaveLength(content.events.length);
  });

  it("tout le monde au henné : un seul lien, rien de réservé", () => {
    const one = buildInvitationFromRequest(sample, { ...form, maghreb: { ...maghreb, separateGuests: "no" } }).content;
    expect(one.events.some((e) => e.audience === "henna")).toBe(false);
  });

  it("intitulés dans la langue de l'invitation", () => {
    const ar = buildInvitationFromRequest(sample, { ...form, language: "ar" }).content;
    expect(ar.events.find((e) => e.id === "henne")?.title).toBe("حفل الحناء");
  });

  it("programme v2 : jours triés et indiqués", () => {
    const items = programV2Items(programV2Section(), content, (t) => t, (d) => `J${d.slice(8)}`);
    expect(items[0].detail.split("\n")[0]).toBe("J10");
    expect(sortByDay(content).at(-1)?.id).toBe("piece-montee");
  });

  it("valide la demande : date du henné obligatoire", () => {
    const base = {
      templateSlug: "x", firstName: "A", lastName: "B", email: "a@b.fr", country: "France", language: "fr", partnerOne: "Y", partnerTwo: "K",
      eventDate: "2099-06-12", ceremonies: [], reception: {}, details: {}, consent: true, culture: "maghrebin",
    };
    expect(requestSchema.safeParse({ ...base, maghreb: { henna: { enabled: true } } }).success).toBe(false);
    expect(requestSchema.safeParse({ ...base, maghreb: { henna: { enabled: true, date: "2099-06-11" } } }).success).toBe(true);
  });
});
