import { describe, expect, it } from "vitest";
import { forGroup, groupId, isMultiDay, sortByDay, usedGroups } from "./audience";
import { PRESETS } from "./presets";
import { invitationContentSchema } from "./schema";

const base = invitationContentSchema.parse(PRESETS["the-garden"]);
const ev = (id: string, date: string, time: string, groups: string[] = []) => ({ ...base.events[0], id, date, startTime: time, groups });
const content = {
  ...base,
  eventAt: "2027-06-12T16:00",
  guestGroups: [{ id: "famille", name: "Famille proche" }, { id: "henne", name: "Henné" }],
  events: [ev("mairie", "2027-06-05", "11:00", ["famille"]), ev("henne", "2027-06-11", "19:00", ["henne"]), ev("soiree", "", "16:00")],
};

describe("groupes d'invités", () => {
  it("le lien principal ne montre que les moments ouverts à tous", () => {
    const pub = forGroup(content, null);
    expect(pub.events.map((e) => e.id)).toEqual(["soiree"]);
    expect(pub.guestGroups).toEqual([]);
  });
  it("le lien d'un groupe ajoute seulement ses moments, sans révéler les autres groupes", () => {
    const fam = forGroup(content, "famille");
    expect(fam.events.map((e) => e.id)).toEqual(["mairie", "soiree"]);
    expect(fam.guestGroups.map((g) => g.id)).toEqual(["famille"]);
  });
  it("identifiants de groupe et groupes utilisés", () => {
    expect(groupId("Famille proche")).toBe("famille-proche");
    expect(groupId("Famille proche", ["famille-proche"])).toBe("famille-proche-2");
    expect(usedGroups(content).length).toBe(2);
  });
  it("trie par jour puis par heure", () => {
    expect(isMultiDay(content)).toBe(true);
    expect(sortByDay(content).map((e) => e.id)).toEqual(["mairie", "henne", "soiree"]);
  });
});
