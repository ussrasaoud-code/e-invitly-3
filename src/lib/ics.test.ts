import { describe, expect, it } from "vitest";
import { buildIcs, calendarHref } from "./ics";

describe("ics", () => {
  it("convertit l'heure locale en UTC", () => {
    const ics = buildIcs({ title: "Mark & Alice, Cérémonie", local: "2027-06-12T15:00", timeZone: "Europe/Paris", location: "Domaine des Oliviers, Aix" })!;
    expect(ics).toContain("DTSTART:20270612T130000Z");
    expect(ics).toContain("DTEND:20270612T150000Z");
    expect(ics).toContain("LOCATION:Domaine des Oliviers\\, Aix");
  });
  it("refuse une date incomplète", () => {
    expect(calendarHref({ date: "", time: "15:00", timeZone: "Europe/Paris", title: "x", location: "" })).toBeNull();
    expect(calendarHref({ date: "2027-06-12", time: "15:00", timeZone: "Europe/Paris", title: "x", location: "" })).toContain("/api/calendrier?");
  });
});
