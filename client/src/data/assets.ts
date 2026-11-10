/**
 * Local symbol assets. The reference PNGs live in client/public/symbols,
 * split by kind into sigils/, signs/ and shapes/. Filenames are slugified
 * from the symbol's assetKey (see "части заклинаний" source archive).
 */

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export type SymbolAssetKind = "sigil" | "mark" | "shape";

export const symbolAssetPath = (assetKey: string, kind: SymbolAssetKind) => {
  const folder = kind === "sigil" ? "sigils" : kind === "mark" ? "signs" : "shapes";
  // BASE_URL ends with "/" — correct both in dev ("/") and on GitHub Pages ("/<repo>/").
  return `${import.meta.env.BASE_URL}symbols/${folder}/${slugify(assetKey)}.png`;
};
