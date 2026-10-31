import { describe, expect, it } from "vitest";
import { guessMime, isSafeSvg } from "./media";

describe("isSafeSvg", () => {
  it("accepte une illustration ordinaire", () => {
    expect(isSafeSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 10" fill="#586C60"/></svg>')).toBe(true);
  });
  it("refuse scripts, événements et contenus externes", () => {
    expect(isSafeSvg("<svg><script>alert(1)</script></svg>")).toBe(false);
    expect(isSafeSvg('<svg onload="alert(1)"></svg>')).toBe(false);
    expect(isSafeSvg('<svg><a href="javascript:alert(1)">x</a></svg>')).toBe(false);
    expect(isSafeSvg("<svg><foreignObject><div/></foreignObject></svg>")).toBe(false);
    expect(isSafeSvg('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg/>')).toBe(false);
  });
});

describe("guessMime", () => {
  it("déduit le type de l'extension si le navigateur ne le donne pas", () => {
    expect(guessMime("pivoine.SVG", "")).toBe("image/svg+xml");
    expect(guessMime("ouverture.m4a", "audio/x-m4a")).toBe("audio/x-m4a");
    expect(guessMime("photo.jpeg", "")).toBe("image/jpeg");
  });
});
