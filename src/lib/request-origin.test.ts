import { describe, expect, it } from "vitest";
import { publicOrigin } from "./request-origin";

describe("adresse publique de la requête", () => {
  it("garde le domaine du visiteur (pas l'adresse technique de Netlify)", () => {
    const r = new Request("https://6ae8ac77--e-invitly.netlify.app/auth/confirm", { headers: { "x-forwarded-host": "e-invitly.com", "x-forwarded-proto": "https" } });
    expect(publicOrigin(r)).toBe("https://e-invitly.com");
    expect(publicOrigin(new Request("http://localhost:3000/x", { headers: { host: "localhost:3000" } }))).toBe("http://localhost:3000");
  });
});
