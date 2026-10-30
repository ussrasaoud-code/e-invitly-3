import { describe, expect, it } from "vitest";
import { formatLongDate, zonedToUtc } from "./time";

describe("zonedToUtc", () => {
  it("convertit l'heure de Paris en été (UTC+2)", () => {
    expect(zonedToUtc("2027-06-12T15:30", "Europe/Paris")?.toISOString()).toBe("2027-06-12T13:30:00.000Z");
  });
  it("convertit l'heure de Paris en hiver (UTC+1)", () => {
    expect(zonedToUtc("2027-01-09T18:00", "Europe/Paris")?.toISOString()).toBe("2027-01-09T17:00:00.000Z");
  });
  it("gère d'autres fuseaux", () => {
    expect(zonedToUtc("2027-06-12T15:30", "America/New_York")?.toISOString()).toBe("2027-06-12T19:30:00.000Z");
    expect(zonedToUtc("2027-06-12T15:30", "Asia/Tokyo")?.toISOString()).toBe("2027-06-12T06:30:00.000Z");
  });
  it("renvoie null si invalide", () => {
    expect(zonedToUtc("12/06/2027", "Europe/Paris")).toBeNull();
    expect(zonedToUtc("2027-06-12T15:30", "Mars/Olympus")).toBeNull();
  });
});

describe("formatLongDate", () => {
  it("formate en français", () => {
    expect(formatLongDate("2027-06-12T15:30", "fr")).toBe("samedi 12 juin 2027");
  });
});
