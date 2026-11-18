import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "client", "public");
const CLIENT = join(PUBLIC, "..");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const manifest = JSON.parse(readFileSync(join(PUBLIC, "manifest.webmanifest"), "utf8"));
const html = readFileSync(join(CLIENT, "index.html"), "utf8");

/** Reads the real size of a PNG file from its IHDR header; throws when it is not a PNG. */
function pngSize(file) {
  const buf = readFileSync(file);
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${file} is not a PNG`);
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
}

/** Path of a site-absolute URL such as "/icons/a.png" inside public/. */
const publicPath = (src) => join(PUBLIC, src.replace(/^\//, ""));

describe("web app manifest", () => {
  it("is valid JSON with the required fields", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe("/");
    for (const key of ["id", "scope", "display", "background_color", "theme_color"]) {
      expect(manifest[key], key).toBeTruthy();
    }
  });

  it("has the icon sizes installable browsers need", () => {
    const has = (sizes, purpose) => manifest.icons.some((i) => i.sizes === sizes && i.purpose === purpose);
    expect(has("192x192", "any")).toBe(true);
    expect(has("512x512", "any")).toBe(true);
    expect(has("512x512", "maskable")).toBe(true);
  });

  it("points every icon at a PNG whose real size matches", () => {
    for (const icon of manifest.icons) {
      const file = publicPath(icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      expect(pngSize(file), icon.src).toBe(icon.sizes);
    }
  });
});

describe("index.html icon links", () => {
  /** href of the first <link> with the given rel. */
  const hrefOf = (rel) => html.match(new RegExp(`<link[^>]*rel="${rel}"[^>]*href="([^"]+)"`))?.[1];

  it("has an apple-touch-icon that is a 180x180 PNG", () => {
    const href = hrefOf("apple-touch-icon");
    expect(href).toBeTruthy();
    expect(existsSync(publicPath(href))).toBe(true);
    expect(pngSize(publicPath(href))).toBe("180x180");
  });

  it("has a favicon that exists", () => {
    const href = hrefOf("icon");
    expect(href).toBeTruthy();
    expect(existsSync(publicPath(href))).toBe(true);
  });
});
