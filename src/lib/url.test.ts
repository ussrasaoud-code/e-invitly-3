import { describe, expect, it } from "vitest";
import { isAllowedAssetUrl } from "./url";

describe("isAllowedAssetUrl", () => {
  it("accepte https, chemins du site et vide", () => {
    expect(isAllowedAssetUrl("")).toBe(true);
    expect(isAllowedAssetUrl("/templates/garden.svg")).toBe(true);
    expect(isAllowedAssetUrl("https://x.supabase.co/storage/v1/object/public/media/a.png")).toBe(true);
  });
  it("refuse javascript:, data:, // et http distant", () => {
    expect(isAllowedAssetUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedAssetUrl("data:image/png;base64,AAA")).toBe(false);
    expect(isAllowedAssetUrl("//evil.example/a.png")).toBe(false);
    expect(isAllowedAssetUrl("http://evil.example/a.png")).toBe(false);
    expect(isAllowedAssetUrl('https://a.b/x" onerror="1')).toBe(false);
  });
});
