import { describe, expect, it } from "vitest";
import { instagramHandle, instagramUrl } from "./instagram";

describe("instagram", () => {
  it("normalise un @compte en lien", () => {
    expect(instagramUrl("@e.invitly")).toBe("https://www.instagram.com/e.invitly/");
    expect(instagramUrl("instagram.com/e.invitly")).toBe("https://www.instagram.com/e.invitly/");
    expect(instagramUrl("https://instagram.com/e.invitly")).toBe("https://instagram.com/e.invitly");
  });
  it("retrouve le @compte", () => {
    expect(instagramHandle("https://www.instagram.com/e.invitly/")).toBe("@e.invitly");
    expect(instagramHandle("https://instagram.com/e.invitly?igsh=abc")).toBe("@e.invitly");
  });
});
