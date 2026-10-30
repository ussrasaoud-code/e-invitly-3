import { describe, expect, it } from "vitest";
import { buildInvitationFromRequest } from "./from-request";
import { PRESETS } from "./presets";
import { invitationContentSchema } from "./schema";

const sample = invitationContentSchema.parse(PRESETS["the-garden"]);

describe("buildInvitationFromRequest", () => {
  const { content, notesToReview } = buildInvitationFromRequest(sample, {
    language: "fr",
    partnerOne: "Mark",
    partnerTwo: "Alice",
    eventDate: "2027-09-18",
    introText: "",
    ceremonies: [
      { type: "civil", label: "", showOnInvitation: false, venueName: "Mairie", address: "1 place", arrivalTime: "", startTime: "11:00", notes: "" },
      { type: "secular", label: "", showOnInvitation: true, venueName: "Château", address: "Route du Château", arrivalTime: "15:30", startTime: "16:00", notes: "" },
    ],
    reception: { venueName: "Château", address: "Route du Château", arrivalTime: "", cocktailTime: "17:30", dinnerTime: "20:00", otherTimes: "", mapsUrl: "", parking: "Parking sur place", shuttles: "", lodging: "" },
    details: { dressCode: "", rsvpDeadline: "2027-08-01", program: "", witnesses: "Léo", phoneNumbers: "", customText: "", preferences: "", photos: "", music: "", comments: "" },
  });

  it("reprend les prénoms, la date et l'heure de la première étape visible", () => {
    expect(content.couple).toMatchObject({ partnerOne: "Mark", partnerTwo: "Alice" });
    expect(content.eventAt).toBe("2027-09-18T16:00");
    expect(content.envelope.sealText).toBe("M&A");
  });

  it("n'affiche pas la cérémonie civile masquée, mais la note pour l'admin", () => {
    expect(content.events.map((e) => e.title)).toEqual(["Cérémonie laïque", "Cocktail", "Dîner"]);
    expect(notesToReview.join(" ")).toMatch(/non affichée/);
  });

  it("ne laisse aucune donnée de démonstration", () => {
    const json = JSON.stringify(content);
    expect(json).not.toMatch(/Camille|Elias|Oliviers|Léa|Yanis|Hôtel des Arts/);
    expect(content.contacts).toEqual([]);
    expect(content.practical.parking).toBe("Parking sur place");
  });

  it("garde le thème et les sections du modèle", () => {
    expect(content.theme).toEqual(sample.theme);
    expect(content.sections.map((s) => s.type)).toEqual(sample.sections.map((s) => s.type));
    expect(content.rsvp.deadline).toBe("2027-08-01");
    expect(notesToReview.join(" ")).toMatch(/Témoins/);
  });
});
