import { describe, expect, it } from "vitest";
import { donateLink, platformName } from "./support";

describe("enlace de apoyo", () => {
  it("reconoce la plataforma por el dominio", () => {
    expect(platformName("https://www.patreon.com/slab")).toBe("Patreon");
    expect(platformName("https://ko-fi.com/slab")).toBe("Ko-fi");
    expect(platformName("https://paypal.me/slab")).toBe("PayPal");
    expect(platformName("https://www.paypal.com/donate/?hosted_button_id=X")).toBe("PayPal");
    expect(platformName("https://apoya.example.org/slab")).toBe("apoya.example.org");
  });
  it("sin URL, o sin https, no hay botón", () => {
    expect(donateLink(undefined)).toBeNull();
    expect(donateLink("http://ko-fi.com/slab")).toBeNull();
    expect(donateLink("no es una url")).toBeNull();
    expect(donateLink("https://ko-fi.com/slab")).toEqual({ url: "https://ko-fi.com/slab", platform: "Ko-fi" });
  });
});
